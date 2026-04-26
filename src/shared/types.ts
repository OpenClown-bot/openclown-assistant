export interface OpenClawContext {
  secrets: Record<string, string>;
  log: OpenClawLogger;
  db: unknown;
  config: Record<string, unknown>;
}

export interface OpenClawLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  critical(message: string, meta?: Record<string, unknown>): void;
}

export interface SkillMetadata {
  name: string;
  version: string;
  capabilities: string[];
}

export interface SkillInput {
  userId: string;
  telegramChatId: string;
  source: InputSource;
  text?: string;
  voice?: VoiceInput;
  photo?: PhotoInput;
  callback?: CallbackInput;
  cron?: CronInput;
}

export type InputSource = "text" | "voice" | "photo" | "callback" | "cron" | "manual";

export interface VoiceInput {
  fileId: string;
  durationSeconds: number;
  mimeType: string;
}

export interface PhotoInput {
  fileId: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

export interface CallbackInput {
  callbackQueryId: string;
  data: string;
}

export interface CronInput {
  triggerType: string;
  scheduledTimeUtc: string;
}

export interface TelegramUser {
  id: number;
  isBot: boolean;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface TelegramMessage {
  messageId: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
  photo?: TelegramPhotoSize[];
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

export interface TelegramVoice {
  fileId: string;
  fileUniqueId: string;
  duration: number;
  mimeType?: string;
  fileSize?: number;
}

export interface TelegramPhotoSize {
  fileId: string;
  fileUniqueId: string;
  width: number;
  height: number;
  fileSize?: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export type OnboardingStatus = "pending" | "awaiting_target_confirmation" | "active";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type WeightGoal = "lose" | "maintain" | "gain";

export type Sex = "male" | "female";

export interface KBJUTargets {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface KBJUValues {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealItemCandidate {
  itemNameRu: string;
  portionTextRu: string;
  portionGrams?: number;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: MealItemSource;
  sourceRef?: string;
  confidence01?: number;
}

export type MealItemSource = "open_food_facts" | "usda_fdc" | "llm_fallback" | "manual";

export type MealSource = "text" | "voice" | "photo" | "manual" | "correction";

export type MealDraftStatus = "estimating" | "awaiting_confirmation" | "confirmed" | "abandoned" | "failed";

export interface MealDraft {
  id: string;
  userId: string;
  source: MealSource;
  status: MealDraftStatus;
  items: MealItemCandidate[];
  totalKBJU: KBJUValues;
  confidence01?: number;
  lowConfidenceLabelShown: boolean;
  version: number;
}

export interface ConfirmedMeal {
  id: string;
  userId: string;
  source: MealSource;
  draftId?: string;
  mealLocalDate: string;
  totalKBJU: KBJUValues;
  version: number;
}

export type PeriodType = "daily" | "weekly" | "monthly";

export type RecommendationMode = "llm_validated" | "deterministic_fallback" | "no_meal_nudge";

export interface SummaryRecord {
  id: string;
  userId: string;
  periodType: PeriodType;
  periodStartLocalDate: string;
  periodEndLocalDate: string;
  totals: KBJUValues;
  deltasVsTarget: KBJUValues;
  previousPeriodComparison?: KBJUValues;
  recommendationTextRu?: string;
  recommendationMode: RecommendationMode;
  blockedReason?: string;
}

export type ProviderAlias = "omniroute" | "fireworks" | "openai";

export type CallType = "text_llm" | "vision_llm" | "transcription" | "lookup";

export interface ProviderCallRequest {
  callType: CallType;
  providerHint?: ProviderAlias;
  modelAlias?: string;
  inputTokensBudget?: number;
  maxLatencyMs?: number;
}

export interface ProviderCallResult {
  providerAlias: ProviderAlias;
  modelAlias: string;
  inputUnits: number;
  outputUnits: number;
  estimatedCostUsd: number;
  outcome: ProviderOutcome;
}

export type ProviderOutcome = "success" | "provider_failure" | "budget_blocked" | "validation_blocked";

export type MetricOutcome = "success" | "user_fallback" | "provider_failure" | "validation_blocked" | "budget_blocked";

export type ComponentId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9" | "C10" | "C11";

export interface MetricEvent {
  requestId: string;
  userId: string;
  eventName: string;
  component: ComponentId;
  latencyMs?: number;
  outcome: MetricOutcome;
}

export type AuditEventType =
  | "meal_created"
  | "meal_edited"
  | "meal_deleted"
  | "profile_created"
  | "right_to_delete_confirmed"
  | "right_to_delete_completed"
  | "summary_blocked";

export interface RussianReplyEnvelope {
  chatId: number;
  text: string;
  parseMode?: "MarkdownV2" | "HTML";
  replyMarkup?: TelegramInlineKeyboardMarkup;
  typingRenewalRequired: boolean;
}

export interface TelegramInlineKeyboardMarkup {
  inlineKeyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callbackData?: string;
}
