import type {
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramVoice,
  TelegramPhotoSize,
  TelegramSticker,
  RussianReplyEnvelope,
} from "../shared/types.js";

export type RouteKind =
  | "start"
  | "forget_me"
  | "text_meal"
  | "voice_meal"
  | "photo_meal"
  | "history"
  | "callback"
  | "summary_delivery"
  | "unsupported";

export interface NormalizedTelegramUpdate {
  requestId: string;
  telegramUserId: number;
  telegramChatId: number;
  routeKind: RouteKind;
  text?: string;
  voice?: TelegramVoice;
  photo?: TelegramPhotoSize[];
  sticker?: TelegramSticker;
  callbackQueryId?: string;
  callbackData?: string;
  cronTriggerType?: string;
  sourceLabel: string;
  messageSubtype?: string;
}

export interface StartHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface ForgetMeHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface TextMealHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface VoiceMealHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface PhotoMealHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface HistoryHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface CallbackHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface SummaryDeliveryHandler {
  (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope | null>;
}

export interface TelegramHandlers {
  start: StartHandler;
  forgetMe: ForgetMeHandler;
  textMeal: TextMealHandler;
  voiceMeal: VoiceMealHandler;
  photoMeal: PhotoMealHandler;
  history: HistoryHandler;
  callback: CallbackHandler;
  summaryDelivery: SummaryDeliveryHandler;
}

export interface SendTelegramMessage {
  (envelope: RussianReplyEnvelope): Promise<void>;
}

export interface SendChatAction {
  (chatId: number, action: string): Promise<void>;
}

export interface C1Deps {
  handlers: TelegramHandlers;
  sendMessage: SendTelegramMessage;
  sendChatAction: SendChatAction;
  logger: import("../shared/types.js").OpenClawLogger;
  pilotUserIds: readonly string[];
}

export class C1MalformedUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "C1MalformedUpdateError";
  }
}

const ROUTING_LOWERCASE_CAP = 256;

export function normalizeMessage(
  requestId: string,
  message: TelegramMessage
): NormalizedTelegramUpdate {
  if (
    !message?.from ||
    typeof message.from.id !== "number" ||
    !message?.chat ||
    typeof message.chat.id !== "number"
  ) {
    throw new C1MalformedUpdateError("from or chat missing");
  }

  const text = message.text?.trim() ?? "";

  let routeKind: RouteKind;
  let sourceLabel: string;
  let messageSubtype: string | undefined;

  if (text.startsWith("/start")) {
    routeKind = "start";
    sourceLabel = "command:/start";
  } else if (text.startsWith("/forget_me")) {
    routeKind = "forget_me";
    sourceLabel = "command:/forget_me";
  } else if (text.length <= ROUTING_LOWERCASE_CAP
      ? text.toLowerCase().startsWith("/история") || text.toLowerCase().startsWith("/history")
      : text.slice(0, ROUTING_LOWERCASE_CAP).toLowerCase().startsWith("/история") || text.slice(0, ROUTING_LOWERCASE_CAP).toLowerCase().startsWith("/history")) {
    routeKind = "history";
    sourceLabel = "command:history";
  } else if (message.voice) {
    routeKind = "voice_meal";
    sourceLabel = "voice";
  } else if (message.photo && message.photo.length > 0) {
    routeKind = "photo_meal";
    sourceLabel = "photo";
  } else if (message.sticker) {
    routeKind = "unsupported";
    sourceLabel = "sticker";
    messageSubtype = "sticker";
  } else if (text) {
    routeKind = "text_meal";
    sourceLabel = "text";
  } else {
    routeKind = "unsupported";
    sourceLabel = "unknown";
    messageSubtype = "empty";
  }

  return {
    requestId,
    telegramUserId: message.from.id,
    telegramChatId: message.chat.id,
    routeKind,
    text: text || undefined,
    voice: message.voice,
    photo: message.photo,
    sticker: message.sticker,
    sourceLabel,
    messageSubtype,
  };
}

export function normalizeCallbackQuery(
  requestId: string,
  query: TelegramCallbackQuery
): NormalizedTelegramUpdate {
  if (!query?.from || typeof query.from.id !== "number") {
    throw new C1MalformedUpdateError("from missing");
  }

  const callbackData = typeof query.data === "string" ? query.data.slice(0, 256) : "";

  return {
    requestId,
    telegramUserId: query.from.id,
    telegramChatId: query.message?.chat?.id ?? 0,
    routeKind: "callback",
    callbackQueryId: query.id,
    callbackData,
    sourceLabel: "callback",
  };
}

export function normalizeCronEvent(
  requestId: string,
  userId: number,
  chatId: number,
  triggerType: string
): NormalizedTelegramUpdate {
  return {
    requestId,
    telegramUserId: userId,
    telegramChatId: chatId,
    routeKind: "summary_delivery",
    cronTriggerType: triggerType,
    sourceLabel: "cron",
  };
}
