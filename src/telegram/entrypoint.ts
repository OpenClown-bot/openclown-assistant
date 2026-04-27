import type { TelegramMessage, TelegramCallbackQuery, RussianReplyEnvelope } from "../shared/types.js";
import { buildRedactedEvent, emitLog } from "../observability/events.js";
import { KPI_EVENT_NAMES } from "../observability/kpiEvents.js";
import {
  type C1Deps,
  type NormalizedTelegramUpdate,
  type RouteKind,
  normalizeMessage,
  normalizeCallbackQuery,
  normalizeCronEvent,
  C1MalformedUpdateError,
} from "./types.js";
import { startTypingRenewal, type TypingCancelHandle } from "./typing.js";
import {
  MSG_GENERIC_RECOVERY,
  MSG_VOICE_TOO_LONG,
} from "./messages.js";

export const MAX_VOICE_DURATION_SECONDS = 15;

const SERVICE_NAME = "kbju-telegram-entrypoint";

const ROUTE_KIND_EVENT_NAME: Record<RouteKind, string> = {
  start: KPI_EVENT_NAMES.onboarding_started,
  forget_me: KPI_EVENT_NAMES.forget_me_requested,
  text_meal: KPI_EVENT_NAMES.meal_content_received,
  voice_meal: KPI_EVENT_NAMES.meal_content_received,
  photo_meal: KPI_EVENT_NAMES.meal_content_received,
  history: KPI_EVENT_NAMES.history_query,
  callback: KPI_EVENT_NAMES.callback_received,
  summary_delivery: KPI_EVENT_NAMES.summary_delivered,
};

function isAllowlisted(telegramUserId: number, pilotUserIds: readonly string[]): boolean {
  const idStr = String(telegramUserId);
  return pilotUserIds.includes(idStr);
}

function safeUserId(telegramUserId: number): string {
  return Number.isFinite(telegramUserId) ? String(telegramUserId) : "anonymous";
}

function logRouteOutcome(
  deps: C1Deps,
  update: NormalizedTelegramUpdate,
  outcome: string,
  extra?: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info"
): void {
  const event = buildRedactedEvent(
    level,
    SERVICE_NAME,
    "C1",
    ROUTE_KIND_EVENT_NAME[update.routeKind],
    update.requestId,
    safeUserId(update.telegramUserId),
    outcome,
    false,
    {
      source: update.sourceLabel,
      ...extra,
    }
  );
  emitLog(deps.logger, event);
}

function logAccessDenied(
  deps: C1Deps,
  update: NormalizedTelegramUpdate
): void {
  const event = buildRedactedEvent(
    "warn",
    SERVICE_NAME,
    "C1",
    "access_denied",
    update.requestId,
    safeUserId(update.telegramUserId),
    "user_fallback",
    false,
    { source: update.sourceLabel }
  );
  emitLog(deps.logger, event);
}

function logMalformedUpdate(
  deps: C1Deps,
  requestId: string
): void {
  const event = buildRedactedEvent(
    "error",
    SERVICE_NAME,
    "C1",
    KPI_EVENT_NAMES.telegram_send_failed,
    requestId,
    "anonymous",
    "provider_failure",
    false,
    { error_code: "malformed_update" }
  );
  emitLog(deps.logger, event);
}

async function sendWithRetry(
  deps: C1Deps,
  envelope: RussianReplyEnvelope
): Promise<void> {
  try {
    await deps.sendMessage(envelope);
  } catch {
    try {
      await deps.sendMessage(envelope);
    } catch {
      const failEvent = buildRedactedEvent(
        "error",
        SERVICE_NAME,
        "C1",
        KPI_EVENT_NAMES.telegram_send_failed,
        "",
        "",
        "provider_failure",
        false
      );
      emitLog(deps.logger, failEvent);
    }
  }
}

async function invokeWithTyping(
  deps: C1Deps,
  update: NormalizedTelegramUpdate,
  handler: () => Promise<RussianReplyEnvelope | null>
): Promise<void> {
  const cancelHandle: TypingCancelHandle = startTypingRenewal(
    deps.sendChatAction,
    update.telegramChatId
  );

  try {
    const reply = await handler();
    cancelHandle.cancel();
    if (reply) {
      await sendWithRetry(deps, reply);
    }
    logRouteOutcome(deps, update, "success");
  } catch (error) {
    cancelHandle.cancel();
    await sendWithRetry(deps, {
      chatId: update.telegramChatId,
      text: MSG_GENERIC_RECOVERY,
      typingRenewalRequired: false,
    });
    logRouteOutcome(deps, update, "provider_failure", {
      error_code: error instanceof Error ? error.message : "unknown",
    }, "error");
  }
}

function isVoiceDurationInvalid(duration: number | undefined): boolean {
  return typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0;
}

export async function routeMessage(
  deps: C1Deps,
  requestId: string,
  message: TelegramMessage
): Promise<void> {
  let update: NormalizedTelegramUpdate;
  try {
    update = normalizeMessage(requestId, message);
  } catch (error) {
    if (error instanceof C1MalformedUpdateError) {
      await sendWithRetry(deps, {
        chatId: message?.chat?.id ?? 0,
        text: MSG_GENERIC_RECOVERY,
        typingRenewalRequired: false,
      });
      logMalformedUpdate(deps, requestId);
      return;
    }
    throw error;
  }

  if (!isAllowlisted(update.telegramUserId, deps.pilotUserIds)) {
    logAccessDenied(deps, update);
    return;
  }

  if (update.routeKind === "voice_meal" && update.voice) {
    if (isVoiceDurationInvalid(update.voice.duration)) {
      await sendWithRetry(deps, {
        chatId: update.telegramChatId,
        text: MSG_VOICE_TOO_LONG,
        typingRenewalRequired: false,
      });
      logRouteOutcome(deps, update, "user_fallback", {
        error_code: "voice_duration_invalid",
      });
      return;
    }
    if (update.voice.duration > MAX_VOICE_DURATION_SECONDS) {
      await sendWithRetry(deps, {
        chatId: update.telegramChatId,
        text: MSG_VOICE_TOO_LONG,
        typingRenewalRequired: false,
      });
      logRouteOutcome(deps, update, "user_fallback", {
        error_code: "voice_too_long",
      });
      return;
    }
  }

  switch (update.routeKind) {
    case "start":
      await invokeWithTyping(deps, update, () => deps.handlers.start(update));
      break;
    case "forget_me":
      await invokeWithTyping(deps, update, () =>
        deps.handlers.forgetMe(update)
      );
      break;
    case "text_meal":
      await invokeWithTyping(deps, update, () =>
        deps.handlers.textMeal(update)
      );
      break;
    case "voice_meal":
      await invokeWithTyping(deps, update, () =>
        deps.handlers.voiceMeal(update)
      );
      break;
    case "photo_meal":
      await invokeWithTyping(deps, update, () =>
        deps.handlers.photoMeal(update)
      );
      break;
    case "history":
      await invokeWithTyping(deps, update, () =>
        deps.handlers.history(update)
      );
      break;
    default:
      break;
  }
}

export async function routeCallbackQuery(
  deps: C1Deps,
  requestId: string,
  query: TelegramCallbackQuery
): Promise<void> {
  let update: NormalizedTelegramUpdate;
  try {
    update = normalizeCallbackQuery(requestId, query);
  } catch (error) {
    if (error instanceof C1MalformedUpdateError) {
      await sendWithRetry(deps, {
        chatId: query?.message?.chat?.id ?? 0,
        text: MSG_GENERIC_RECOVERY,
        typingRenewalRequired: false,
      });
      logMalformedUpdate(deps, requestId);
      return;
    }
    throw error;
  }

  if (!isAllowlisted(update.telegramUserId, deps.pilotUserIds)) {
    logAccessDenied(deps, update);
    return;
  }

  await invokeWithTyping(deps, update, () => deps.handlers.callback(update));
}

export async function routeCronEvent(
  deps: C1Deps,
  requestId: string,
  userId: number,
  chatId: number,
  triggerType: string
): Promise<void> {
  const update = normalizeCronEvent(requestId, userId, chatId, triggerType);

  if (!isAllowlisted(update.telegramUserId, deps.pilotUserIds)) {
    logAccessDenied(deps, update);
    return;
  }

  await invokeWithTyping(deps, update, () =>
    deps.handlers.summaryDelivery(update)
  );
}
