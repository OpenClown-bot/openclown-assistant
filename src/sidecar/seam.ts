import type { C1Deps, RouteKind, NormalizedTelegramUpdate } from "../telegram/types.js";
import type { RussianReplyEnvelope } from "../shared/types.js";
import type { BridgeRequest } from "./types.js";

export function bridgeToRouteKind(source: string): RouteKind {
  switch (source) {
    case "text":
      return "text_meal";
    case "voice":
      return "voice_meal";
    case "photo":
      return "photo_meal";
    case "callback":
      return "callback";
    case "cron":
      return "summary_delivery";
    default:
      return "unsupported";
  }
}

export function bridgeToNormalizedUpdate(
  request: BridgeRequest
): NormalizedTelegramUpdate {
  return {
    requestId: crypto.randomUUID(),
    telegramUserId: request.telegram_id,
    telegramChatId: request.chat_id,
    routeKind: bridgeToRouteKind(request.source),
    text: request.text,
    callbackData: request.callback_data,
    cronTriggerType: request.trigger_type,
    sourceLabel: `bridge:${request.source}`,
  };
}

export async function routeBridgeRequest(
  deps: C1Deps,
  request: BridgeRequest
): Promise<RussianReplyEnvelope | null> {
  const update = bridgeToNormalizedUpdate(request);

  switch (update.routeKind) {
    case "text_meal":
      return deps.handlers.textMeal(update);
    case "voice_meal":
      return deps.handlers.voiceMeal(update);
    case "photo_meal":
      return deps.handlers.photoMeal(update);
    case "callback":
      return deps.handlers.callback(update);
    case "summary_delivery":
      return deps.handlers.summaryDelivery(update);
    case "history":
      return deps.handlers.history(update);
    case "start":
      return deps.handlers.start(update);
    case "forget_me":
      return deps.handlers.forgetMe(update);
    case "unsupported":
    default:
      return null;
  }
}