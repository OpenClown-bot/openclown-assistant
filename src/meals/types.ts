import type {
  KBJUValues,
  MealItemCandidate,
  MealItemSource,
  MealSource,
  MealDraftStatus,
  RussianReplyEnvelope,
  OpenClawLogger,
  ComponentId,
  MetricOutcome,
} from "../shared/types.js";
import type {
  TenantStore,
  MealDraftRow,
  MealDraftItemRow,
  ConfirmedMealRow,
  MealItemRow,
  CreateMealDraftRequest,
  UpdateMealDraftWithVersionRequest,
  CreateMealDraftItemRequest,
  CreateConfirmedMealRequest,
  CreateMealItemRequest,
  CreateAuditEventRequest,
  CreateMetricEventRequest,
} from "../store/types.js";
import type { EstimatorResult } from "../kbju/types.js";
import type { TranscriptionResult } from "../voice/types.js";
import type { PhotoRecognitionResult } from "../photo/types.js";

export type { MealSource, MealDraftStatus, MealItemSource };

export interface MealDraftInput {
  source: MealSource;
  text?: string;
  transcriptId?: string;
  photoConfidence01?: number;
}

export interface MealDraftWithItems {
  draft: MealDraftRow;
  items: MealDraftItemRow[];
}

export interface CorrectionInput {
  draftId: string;
  expectedVersion: number;
  correctedItems: MealItemCandidate[];
  correctedKBJU: KBJUValues;
}

export interface ConfirmResult {
  confirmed: boolean;
  meal?: ConfirmedMealRow;
  mealItems?: MealItemRow[];
  reason?: string;
}

export interface ManualKBJUEntry {
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface ManualEntryParseResult {
  valid: boolean;
  values: ManualKBJUEntry | null;
  errorMessage: string | null;
}

export type MealOrchestratorSource = "text" | "voice" | "photo" | "manual";

export interface MealOrchestratorRequest {
  userId: string;
  requestId: string;
  chatId: number;
  source: MealOrchestratorSource;
  mealText?: string;
  transcriptResult?: TranscriptionResult;
  photoResult?: PhotoRecognitionResult;
  estimatorResult?: EstimatorResult;
  degradeModeEnabled: boolean;
}

export interface MealDraftView {
  draftId: string;
  source: MealSource;
  status: MealDraftStatus;
  version: number;
  items: MealItemCandidate[];
  totalKBJU: KBJUValues;
  confidence01: number | null;
  lowConfidenceLabelShown: boolean;
  normalizedInputText: string | null;
}

export interface C4Deps {
  store: TenantStore;
  logger: OpenClawLogger;
  emitMetric: EmitMetricFn;
}

export type EmitMetricFn = (
  userId: string,
  requestId: string,
  eventName: string,
  component: ComponentId,
  outcome: MetricOutcome,
  extra?: Record<string, unknown>
) => Promise<void>;

export const METRIC_EVENT_NAMES = {
  meals_confirmed_total: "kbju_confirmed_meals_total",
  meals_per_day_per_user: "kbju_meals_per_day_per_user",
  manual_entry_used_total: "kbju_manual_fallback_total",
} as const;

export const PHOTO_LOW_CONFIDENCE_THRESHOLD = 0.70;

export function draftRowToView(
  draft: MealDraftRow,
  items: MealDraftItemRow[]
): MealDraftView {
  return {
    draftId: draft.id,
    source: draft.source,
    status: draft.status,
    version: draft.version,
    items: items.map((it) => ({
      itemNameRu: it.item_name_ru,
      portionTextRu: it.portion_text_ru,
      portionGrams: it.portion_grams ?? undefined,
      caloriesKcal: it.calories_kcal,
      proteinG: it.protein_g,
      fatG: it.fat_g,
      carbsG: it.carbs_g,
      source: it.source,
      sourceRef: it.source_ref ?? undefined,
      confidence01: it.confidence_0_1 ?? undefined,
    })),
    totalKBJU: {
      caloriesKcal: draft.total_calories_kcal ?? 0,
      proteinG: draft.total_protein_g ?? 0,
      fatG: draft.total_fat_g ?? 0,
      carbsG: draft.total_carbs_g ?? 0,
    },
    confidence01: draft.confidence_0_1,
    lowConfidenceLabelShown: draft.low_confidence_label_shown,
    normalizedInputText: draft.normalized_input_text,
  };
}

export function isStaleVersion(currentVersion: number, latestVersion: number): boolean {
  return currentVersion < latestVersion;
}

export function isAlreadyConfirmed(status: MealDraftStatus): boolean {
  return status === "confirmed";
}
