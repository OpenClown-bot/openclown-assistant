import type {
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramVoice,
  TelegramPhotoSize,
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
  | "summary_delivery";

export interface NormalizedTelegramUpdate {
  requestId: string;
  telegramUserId: number;
  telegramChatId: number;
  routeKind: RouteKind;
  text?: string;
  voice?: TelegramVoice;
  photo?: TelegramPhotoSize[];
  callbackQueryId?: string;
  callbackData?: string;
  cronTriggerType?: string;
  sourceLabel: string;
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

export function normalizeMessage(
  requestId: string,
  message: TelegramMessage
): NormalizedTelegramUpdate {
  const text = message.text?.trim() ?? "";

  let routeKind: RouteKind;
  let sourceLabel: string;

  if (text.startsWith("/start")) {
    routeKind = "start";
    sourceLabel = "command:/start";
  } else if (text.startsWith("/forget_me")) {
    routeKind = "forget_me";
    sourceLabel = "command:/forget_me";
  } else if (
    text.toLowerCase() === "/история" ||
    text.toLowerCase() === "/history"
  ) {
    routeKind = "history";
    sourceLabel = "command:history";
  } else if (message.voice) {
    routeKind = "voice_meal";
    sourceLabel = "voice";
  } else if (message.photo && message.photo.length > 0) {
    routeKind = "photo_meal";
    sourceLabel = "photo";
  } else {
    routeKind = "text_meal";
    sourceLabel = "text";
  }

  return {
    requestId,
    telegramUserId: message.from.id,
    telegramChatId: message.chat.id,
    routeKind,
    text: text || undefined,
    voice: message.voice,
    photo: message.photo,
    sourceLabel,
  };
}

export function normalizeCallbackQuery(
  requestId: string,
  query: TelegramCallbackQuery
): NormalizedTelegramUpdate {
  return {
    requestId,
    telegramUserId: query.from.id,
    telegramChatId: query.message?.chat.id ?? 0,
    routeKind: "callback",
    callbackQueryId: query.id,
    callbackData: query.data,
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
