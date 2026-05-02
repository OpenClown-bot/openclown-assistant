import type {
  ConfirmedMealRow,
  CostEventRow,
  KbjuAccuracyLabelRow,
  MetricEventRow,
  TenantAuditRunRow,
} from "../../src/store/types.js";
import type { K1DailyMealCount, K3LatencyResult, K5SpendResult, K7AccuracyResult } from "../../src/pilot/kpiQueries.js";
import type { PilotReadinessData } from "../../src/pilot/pilotReadinessReport.js";

// Synthetic pilot user identifiers — NOT real Telegram IDs or personal data.
export const USER_A = {
  userId: "synthetic-user-a-id",
  telegramUserId: "9000001",
  telegramChatId: "10000001",
};

export const USER_B = {
  userId: "synthetic-user-b-id",
  telegramUserId: "9000002",
  telegramChatId: "10000002",
};

const now = new Date().toISOString();
const today = now.slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

// Confirmed meals for User A — one per active day for a full week.
export const MEALS_USER_A: ConfirmedMealRow[] = [
  { id: "meal-a1", user_id: USER_A.userId, source: "text", draft_id: "draft-a1", meal_local_date: today, meal_logged_at: now, total_calories_kcal: 500, total_protein_g: 30, total_fat_g: 20, total_carbs_g: 50, manual_entry: false, deleted_at: null, version: 1, created_at: now, updated_at: now },
  { id: "meal-a2", user_id: USER_A.userId, source: "voice", draft_id: "draft-a2", meal_local_date: yesterday, meal_logged_at: yesterday + "T12:00:00Z", total_calories_kcal: 600, total_protein_g: 35, total_fat_g: 25, total_carbs_g: 55, manual_entry: false, deleted_at: null, version: 1, created_at: yesterday + "T12:00:00Z", updated_at: yesterday + "T12:00:00Z" },
  { id: "meal-a3", user_id: USER_A.userId, source: "text", draft_id: "draft-a3", meal_local_date: twoDaysAgo, meal_logged_at: twoDaysAgo + "T13:00:00Z", total_calories_kcal: 450, total_protein_g: 28, total_fat_g: 18, total_carbs_g: 48, manual_entry: false, deleted_at: null, version: 1, created_at: twoDaysAgo + "T13:00:00Z", updated_at: twoDaysAgo + "T13:00:00Z" },
  { id: "meal-a4", user_id: USER_A.userId, source: "photo", draft_id: "draft-a4", meal_local_date: threeDaysAgo, meal_logged_at: threeDaysAgo + "T12:30:00Z", total_calories_kcal: 550, total_protein_g: 32, total_fat_g: 22, total_carbs_g: 52, manual_entry: false, deleted_at: null, version: 1, created_at: threeDaysAgo + "T12:30:00Z", updated_at: threeDaysAgo + "T12:30:00Z" },
  { id: "meal-a5", user_id: USER_A.userId, source: "text", draft_id: "draft-a5", meal_local_date: fourDaysAgo, meal_logged_at: fourDaysAgo + "T11:00:00Z", total_calories_kcal: 480, total_protein_g: 29, total_fat_g: 19, total_carbs_g: 49, manual_entry: false, deleted_at: null, version: 1, created_at: fourDaysAgo + "T11:00:00Z", updated_at: fourDaysAgo + "T11:00:00Z" },
  { id: "meal-a6", user_id: USER_A.userId, source: "voice", draft_id: "draft-a6", meal_local_date: fiveDaysAgo, meal_logged_at: fiveDaysAgo + "T13:15:00Z", total_calories_kcal: 520, total_protein_g: 31, total_fat_g: 21, total_carbs_g: 51, manual_entry: false, deleted_at: null, version: 1, created_at: fiveDaysAgo + "T13:15:00Z", updated_at: fiveDaysAgo + "T13:15:00Z" },
  { id: "meal-a7", user_id: USER_A.userId, source: "text", draft_id: "draft-a7", meal_local_date: sixDaysAgo, meal_logged_at: sixDaysAgo + "T14:00:00Z", total_calories_kcal: 470, total_protein_g: 27, total_fat_g: 18, total_carbs_g: 47, manual_entry: false, deleted_at: null, version: 1, created_at: sixDaysAgo + "T14:00:00Z", updated_at: sixDaysAgo + "T14:00:00Z" },
  { id: "meal-a8", user_id: USER_A.userId, source: "manual", draft_id: "draft-a8", meal_local_date: sevenDaysAgo, meal_logged_at: sevenDaysAgo + "T12:00:00Z", total_calories_kcal: 500, total_protein_g: 30, total_fat_g: 20, total_carbs_g: 50, manual_entry: true, deleted_at: null, version: 1, created_at: sevenDaysAgo + "T12:00:00Z", updated_at: sevenDaysAgo + "T12:00:00Z" },
];

// Confirmed meals for User B — at least one per day for the same week.
export const MEALS_USER_B: ConfirmedMealRow[] = [
  { id: "meal-b1", user_id: USER_B.userId, source: "text", draft_id: "draft-b1", meal_local_date: today, meal_logged_at: now, total_calories_kcal: 400, total_protein_g: 25, total_fat_g: 15, total_carbs_g: 45, manual_entry: false, deleted_at: null, version: 1, created_at: now, updated_at: now },
  { id: "meal-b2", user_id: USER_B.userId, source: "voice", draft_id: "draft-b2", meal_local_date: yesterday, meal_logged_at: yesterday + "T12:00:00Z", total_calories_kcal: 550, total_protein_g: 32, total_fat_g: 22, total_carbs_g: 50, manual_entry: false, deleted_at: null, version: 1, created_at: yesterday + "T12:00:00Z", updated_at: yesterday + "T12:00:00Z" },
  { id: "meal-b3", user_id: USER_B.userId, source: "text", draft_id: "draft-b3", meal_local_date: twoDaysAgo, meal_logged_at: twoDaysAgo + "T13:00:00Z", total_calories_kcal: 470, total_protein_g: 28, total_fat_g: 18, total_carbs_g: 48, manual_entry: false, deleted_at: null, version: 1, created_at: twoDaysAgo + "T13:00:00Z", updated_at: twoDaysAgo + "T13:00:00Z" },
  { id: "meal-b4", user_id: USER_B.userId, source: "voice", draft_id: "draft-b4", meal_local_date: threeDaysAgo, meal_logged_at: threeDaysAgo + "T12:30:00Z", total_calories_kcal: 510, total_protein_g: 30, total_fat_g: 20, total_carbs_g: 51, manual_entry: false, deleted_at: null, version: 1, created_at: threeDaysAgo + "T12:30:00Z", updated_at: threeDaysAgo + "T12:30:00Z" },
  { id: "meal-b5", user_id: USER_B.userId, source: "text", draft_id: "draft-b5", meal_local_date: fourDaysAgo, meal_logged_at: fourDaysAgo + "T11:00:00Z", total_calories_kcal: 490, total_protein_g: 29, total_fat_g: 19, total_carbs_g: 49, manual_entry: false, deleted_at: null, version: 1, created_at: fourDaysAgo + "T11:00:00Z", updated_at: fourDaysAgo + "T11:00:00Z" },
  { id: "meal-b6", user_id: USER_B.userId, source: "voice", draft_id: "draft-b6", meal_local_date: fiveDaysAgo, meal_logged_at: fiveDaysAgo + "T13:15:00Z", total_calories_kcal: 530, total_protein_g: 31, total_fat_g: 21, total_carbs_g: 52, manual_entry: false, deleted_at: null, version: 1, created_at: fiveDaysAgo + "T13:15:00Z", updated_at: fiveDaysAgo + "T13:15:00Z" },
  { id: "meal-b7", user_id: USER_B.userId, source: "text", draft_id: "draft-b7", meal_local_date: sixDaysAgo, meal_logged_at: sixDaysAgo + "T14:00:00Z", total_calories_kcal: 460, total_protein_g: 27, total_fat_g: 17, total_carbs_g: 46, manual_entry: false, deleted_at: null, version: 1, created_at: sixDaysAgo + "T14:00:00Z", updated_at: sixDaysAgo + "T14:00:00Z" },
  { id: "meal-b8", user_id: USER_B.userId, source: "voice", draft_id: "draft-b8", meal_local_date: sevenDaysAgo, meal_logged_at: sevenDaysAgo + "T12:00:00Z", total_calories_kcal: 500, total_protein_g: 30, total_fat_g: 20, total_carbs_g: 50, manual_entry: false, deleted_at: null, version: 1, created_at: sevenDaysAgo + "T12:00:00Z", updated_at: sevenDaysAgo + "T12:00:00Z" },
];

// Deleted meal for isolation test — should not count toward K1/K6.
export const DELETED_MEAL_A: ConfirmedMealRow = {
  id: "meal-a-deleted",
  user_id: USER_A.userId,
  source: "text",
  draft_id: "draft-a-del",
  meal_local_date: today,
  meal_logged_at: now,
  total_calories_kcal: 999,
  total_protein_g: 99,
  total_fat_g: 99,
  total_carbs_g: 99,
  manual_entry: false,
  deleted_at: now,
  version: 1,
  created_at: now,
  updated_at: now,
};

export const ALL_MEALS: ConfirmedMealRow[] = [
  ...MEALS_USER_A,
  ...MEALS_USER_B,
  DELETED_MEAL_A,
];

// Metric events for K2 (time-to-first-value) and K3 (voice latency).
export const METRIC_EVENTS: MetricEventRow[] = [
  // K2 — request-A timing
  { id: "metric-k2-1", user_id: USER_A.userId, request_id: "req-k2-a", event_name: "meal_content_received", component: "C4", latency_ms: 100, outcome: "success", metadata: {}, created_at: today + "T10:00:00Z" },
  { id: "metric-k2-2", user_id: USER_A.userId, request_id: "req-k2-a", event_name: "draft_reply_sent", component: "C4", latency_ms: 5000, outcome: "success", metadata: {}, created_at: today + "T10:00:05Z" },
  // K3 — voice latency for User A
  { id: "metric-k3-1", user_id: USER_A.userId, request_id: "req-k3-a", event_name: "voice_transcription_completed", component: "C5", latency_ms: 3000, outcome: "success", metadata: { audio_duration_seconds: 5 }, created_at: today + "T09:00:00Z" },
  { id: "metric-k3-2", user_id: USER_A.userId, request_id: "req-k3-a2", event_name: "voice_transcription_completed", component: "C5", latency_ms: 5000, outcome: "success", metadata: { audio_duration_seconds: 10 }, created_at: yesterday + "T09:00:00Z" },
  { id: "metric-k3-3", user_id: USER_A.userId, request_id: "req-k3-a3", event_name: "voice_transcription_completed", component: "C5", latency_ms: 7000, outcome: "success", metadata: { audio_duration_seconds: 12 }, created_at: twoDaysAgo + "09:00:00Z" },
  { id: "metric-k3-4", user_id: USER_A.userId, request_id: "req-k3-a4", event_name: "voice_transcription_completed", component: "C5", latency_ms: 4000, outcome: "success", metadata: { audio_duration_seconds: 8 }, created_at: threeDaysAgo + "T09:00:00Z" },
  { id: "metric-k3-5", user_id: USER_A.userId, request_id: "req-k3-a5", event_name: "voice_transcription_completed", component: "C5", latency_ms: 6000, outcome: "success", metadata: { audio_duration_seconds: 14 }, created_at: fourDaysAgo + "T09:00:00Z" },
  // K3 — voice latency for User B
  { id: "metric-k3-6", user_id: USER_B.userId, request_id: "req-k3-b", event_name: "voice_transcription_completed", component: "C5", latency_ms: 4500, outcome: "success", metadata: { audio_duration_seconds: 6 }, created_at: today + "T09:00:00Z" },
  { id: "metric-k3-7", user_id: USER_B.userId, request_id: "req-k3-b2", event_name: "voice_transcription_completed", component: "C5", latency_ms: 5500, outcome: "success", metadata: { audio_duration_seconds: 9 }, created_at: yesterday + "T09:00:00Z" },
];

// Tenant audit runs for K4.
export const TENANT_AUDIT_RUNS: TenantAuditRunRow[] = [
  {
    id: "audit-run-1",
    run_type: "end_of_pilot_k4",
    started_at: today + "T00:00:00Z",
    completed_at: today + "T00:05:00Z",
    checked_tables: [
      "user_profiles", "user_targets", "summary_schedules", "onboarding_states",
      "transcripts", "meal_drafts", "meal_draft_items", "confirmed_meals",
      "meal_items", "summary_records", "audit_events", "metric_events",
      "cost_events", "monthly_spend_counters", "food_lookup_cache",
      "kbju_accuracy_labels",
    ],
    cross_user_reference_count: 0,
    findings: [],
  },
];

// Cost events for K5.
export const COST_EVENTS: CostEventRow[] = [
  { id: "cost-1", user_id: USER_A.userId, request_id: "req-cost-a", provider_alias: "fireworks", model_alias: "qwen3-vl-30b-a3b-instruct", call_type: "text_llm", estimated_cost_usd: 0.05, actual_cost_usd: 0.05, input_units: 100, output_units: 50, billing_unit: "token", created_at: today + "T10:00:00Z" },
  { id: "cost-2", user_id: USER_A.userId, request_id: "req-cost-a2", provider_alias: "fireworks", model_alias: "whisper-v3-turbo", call_type: "transcription", estimated_cost_usd: 0.10, actual_cost_usd: 0.10, input_units: 10, output_units: 0, billing_unit: "audio_second", created_at: yesterday + "T09:00:00Z" },
  { id: "cost-3", user_id: USER_B.userId, request_id: "req-cost-b", provider_alias: "fireworks", model_alias: "qwen3-vl-30b-a3b-instruct", call_type: "text_llm", estimated_cost_usd: 0.03, actual_cost_usd: 0.03, input_units: 80, output_units: 40, billing_unit: "token", created_at: today + "T11:00:00Z" },
  { id: "cost-4", user_id: USER_B.userId, request_id: "req-cost-b2", provider_alias: "fireworks", model_alias: "whisper-v3-turbo", call_type: "transcription", estimated_cost_usd: 0.08, actual_cost_usd: 0.08, input_units: 8, output_units: 0, billing_unit: "audio_second", created_at: twoDaysAgo + "T09:00:00Z" },
];

// K7 accuracy labels for User A.
export const K7_LABELS_A: KbjuAccuracyLabelRow[] = [
  { id: "label-a1", user_id: USER_A.userId, meal_id: "meal-a1", labeled_by: "po", sample_reason: "low_confidence_review", estimate_totals: { calories_kcal: 510, protein_g: 31, fat_g: 20, carbs_g: 50 }, ground_truth_totals: { calories_kcal: 500, protein_g: 30, fat_g: 20, carbs_g: 50 }, calorie_error_pct: 2.0, protein_error_pct: 3.33, fat_error_pct: 0, carbs_error_pct: 0, notes: null, created_at: today + "T12:00:00Z" },
  { id: "label-a2", user_id: USER_A.userId, meal_id: "meal-a2", labeled_by: "partner", sample_reason: "random_pilot_sample", estimate_totals: { calories_kcal: 605, protein_g: 34, fat_g: 25, carbs_g: 55 }, ground_truth_totals: { calories_kcal: 600, protein_g: 35, fat_g: 25, carbs_g: 55 }, calorie_error_pct: 0.83, protein_error_pct: 2.86, fat_error_pct: 0, carbs_error_pct: 0, notes: null, created_at: yesterday + "T12:00:00Z" },
];

// K7 accuracy labels for User B — within tolerance.
export const K7_LABELS_B: KbjuAccuracyLabelRow[] = [
  { id: "label-b1", user_id: USER_B.userId, meal_id: "meal-b1", labeled_by: "po", sample_reason: "low_confidence_review", estimate_totals: { calories_kcal: 405, protein_g: 24, fat_g: 15, carbs_g: 45 }, ground_truth_totals: { calories_kcal: 400, protein_g: 25, total_fat_g: 15, carbs_g: 45 }, calorie_error_pct: 1.25, protein_error_pct: 4.0, fat_error_pct: 0, carbs_error_pct: 0, notes: null, created_at: today + "T12:00:00Z" },
  { id: "label-b2", user_id: USER_B.userId, meal_id: "meal-b2", labeled_by: "partner", sample_reason: "random_pilot_sample", estimate_totals: { calories_kcal: 555, protein_g: 31, fat_g: 22, carbs_g: 50 }, ground_truth_totals: { calories_kcal: 550, protein_g: 32, total_fat_g: 22, carbs_g: 50 }, calorie_error_pct: 0.91, protein_error_pct: 3.13, fat_error_pct: 0, carbs_error_pct: 0, notes: null, created_at: yesterday + "T12:00:00Z" },
];

export const ALL_K7_LABELS: KbjuAccuracyLabelRow[] = [
  ...K7_LABELS_A,
  ...K7_LABELS_B,
];

// KPI pre-computed results for K1-K7.
export const K1_DAILY_COUNTS: K1DailyMealCount[] = [
  { userId: USER_A.userId, mealLocalDate: today, count: 1 },
  { userId: USER_A.userId, mealLocalDate: yesterday, count: 1 },
  { userId: USER_A.userId, mealLocalDate: twoDaysAgo, count: 1 },
  { userId: USER_A.userId, mealLocalDate: threeDaysAgo, count: 1 },
  { userId: USER_A.userId, mealLocalDate: fourDaysAgo, count: 1 },
  { userId: USER_A.userId, mealLocalDate: fiveDaysAgo, count: 1 },
  { userId: USER_A.userId, mealLocalDate: sixDaysAgo, count: 1 },
  { userId: USER_A.userId, mealLocalDate: sevenDaysAgo, count: 1 },
  { userId: USER_B.userId, mealLocalDate: today, count: 1 },
  { userId: USER_B.userId, mealLocalDate: yesterday, count: 1 },
  { userId: USER_B.userId, mealLocalDate: twoDaysAgo, count: 1 },
  { userId: USER_B.userId, mealLocalDate: threeDaysAgo, count: 1 },
  { userId: USER_B.userId, mealLocalDate: fourDaysAgo, count: 1 },
  { userId: USER_B.userId, mealLocalDate: fiveDaysAgo, count: 1 },
  { userId: USER_B.userId, mealLocalDate: sixDaysAgo, count: 1 },
  { userId: USER_B.userId, mealLocalDate: sevenDaysAgo, count: 1 },
];

export const K1_USER_THRESHOLDS: Record<string, boolean> = {
  [USER_A.userId]: true,
  [USER_B.userId]: true,
};

export const K3_LATENCY: K3LatencyResult = { p95Ms: 7000, p100Ms: 7000 };

export const K5_SPEND: K5SpendResult = { totalEstimatedUsd: 0.26, withinBudget: true, degradeModeActive: false };

export const K7_ACCURACY: K7AccuracyResult = {
  mealsWithinCalorieBounds: 4,
  mealsWithinMacroBounds: 4,
  totalLabeled: 4,
  dailyCalorieAccuracy: new Map<string, { totalError: number; count: number }>(),
  withinK7Targets: true,
};

export function buildPilotReadinessData(): PilotReadinessData {
  return {
    k1UserThresholds: K1_USER_THRESHOLDS,
    k3VoiceLatency: K3_LATENCY,
    k4CrossUserAudit: { crossUserReferences: 0, passed: true },
    k5Spend: K5_SPEND,
    k6WeeklyRetentions: {
      [USER_A.userId]: { activeDaysInWeek: 7, daysInWeek: 7, metThreshold: true },
      [USER_B.userId]: { activeDaysInWeek: 7, daysInWeek: 7, metThreshold: true },
    },
    k7Accuracy: K7_ACCURACY,
    totalUsers: 2,
    reportGeneratedAtUtc: now,
  };
}
