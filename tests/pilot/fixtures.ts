import type {
  ConfirmedMealRow,
  CostEventRow,
  KbjuAccuracyLabelRow,
  MetricEventRow,
  TenantAuditRunRow,
} from "../../src/store/types.js";
import type {
  K1DailyMealCount,
  K3LatencyResult,
  K5SpendResult,
  K7AccuracyResult,
} from "../../src/pilot/kpiQueries.js";
import type { PilotReadinessData } from "../../src/pilot/pilotReadinessReport.js";

export const FIXED_NOW = "2026-05-02T12:00:00.000Z";
export const FIXED_TODAY = "2026-05-02";
export const FIXED_YESTERDAY = "2026-05-01";
export const FIXED_TWO_DAYS_AGO = "2026-04-30";
export const FIXED_THREE_DAYS_AGO = "2026-04-29";
export const FIXED_FOUR_DAYS_AGO = "2026-04-28";
export const FIXED_FIVE_DAYS_AGO = "2026-04-27";
export const FIXED_SIX_DAYS_AGO = "2026-04-26";
export const FIXED_SEVEN_DAYS_AGO = "2026-04-25";
export const FIXED_MONTH_UTC = "2026-05";
export const FIXED_WEEK_START = FIXED_SIX_DAYS_AGO;
export const FIXED_WEEK_END = FIXED_TODAY;

// Synthetic pilot user identifiers: not real Telegram IDs or personal data.
export const USER_A = {
  userId: "synthetic-user-a-id",
  telegramUserId: "9000001",
  telegramChatId: "10000001",
  username: "pilot_a_username",
};

export const USER_B = {
  userId: "synthetic-user-b-id",
  telegramUserId: "9000002",
  telegramChatId: "10000002",
  username: "pilot_b_username",
};

function meal(
  id: string,
  userId: string,
  source: ConfirmedMealRow["source"],
  date: string,
  calories: number,
): ConfirmedMealRow {
  const at = `${date}T12:00:00.000Z`;
  return {
    id,
    user_id: userId,
    source,
    draft_id: `draft-${id}`,
    meal_local_date: date,
    meal_logged_at: at,
    total_calories_kcal: calories,
    total_protein_g: 30,
    total_fat_g: 20,
    total_carbs_g: 50,
    manual_entry: source === "manual",
    deleted_at: null,
    version: 1,
    created_at: at,
    updated_at: at,
  };
}

export const MEALS_USER_A: ConfirmedMealRow[] = [
  meal("meal-a1", USER_A.userId, "text", FIXED_TODAY, 500),
  meal("meal-a2", USER_A.userId, "voice", FIXED_YESTERDAY, 600),
  meal("meal-a3", USER_A.userId, "text", FIXED_TWO_DAYS_AGO, 450),
  meal("meal-a4", USER_A.userId, "photo", FIXED_THREE_DAYS_AGO, 550),
  meal("meal-a5", USER_A.userId, "text", FIXED_FOUR_DAYS_AGO, 480),
  meal("meal-a6", USER_A.userId, "voice", FIXED_FIVE_DAYS_AGO, 520),
  meal("meal-a7", USER_A.userId, "text", FIXED_SIX_DAYS_AGO, 470),
  meal("meal-a8", USER_A.userId, "manual", FIXED_SEVEN_DAYS_AGO, 500),
];

export const MEALS_USER_B: ConfirmedMealRow[] = [
  meal("meal-b1", USER_B.userId, "text", FIXED_TODAY, 400),
  meal("meal-b2", USER_B.userId, "voice", FIXED_YESTERDAY, 550),
  meal("meal-b3", USER_B.userId, "text", FIXED_TWO_DAYS_AGO, 470),
  meal("meal-b4", USER_B.userId, "voice", FIXED_THREE_DAYS_AGO, 510),
  meal("meal-b5", USER_B.userId, "text", FIXED_FOUR_DAYS_AGO, 490),
  meal("meal-b6", USER_B.userId, "voice", FIXED_FIVE_DAYS_AGO, 530),
  meal("meal-b7", USER_B.userId, "text", FIXED_SIX_DAYS_AGO, 460),
  meal("meal-b8", USER_B.userId, "voice", FIXED_SEVEN_DAYS_AGO, 500),
];

export const DELETED_MEAL_A: ConfirmedMealRow = {
  ...meal("meal-a-deleted", USER_A.userId, "text", FIXED_TODAY, 999),
  deleted_at: "2026-05-02T13:00:00.000Z",
};

export const ALL_MEALS: ConfirmedMealRow[] = [
  ...MEALS_USER_A,
  ...MEALS_USER_B,
  DELETED_MEAL_A,
];

export const METRIC_EVENTS: MetricEventRow[] = [
  {
    id: "metric-k2-1",
    user_id: USER_A.userId,
    request_id: "req-k2-a",
    event_name: "meal_content_received",
    component: "C4",
    latency_ms: null,
    outcome: "success",
    metadata: {},
    created_at: "2026-05-02T10:00:00.000Z",
  },
  {
    id: "metric-k2-2",
    user_id: USER_A.userId,
    request_id: "req-k2-a",
    event_name: "draft_reply_sent",
    component: "C4",
    latency_ms: 5000,
    outcome: "success",
    metadata: {},
    created_at: "2026-05-02T10:00:05.000Z",
  },
  {
    id: "metric-k2-dup-reply",
    user_id: USER_A.userId,
    request_id: "req-k2-duplicates",
    event_name: "draft_reply_sent",
    component: "C4",
    latency_ms: 9000,
    outcome: "success",
    metadata: {},
    created_at: "2026-05-02T10:00:09.000Z",
  },
  {
    id: "metric-k2-dup-received-late",
    user_id: USER_A.userId,
    request_id: "req-k2-duplicates",
    event_name: "meal_content_received",
    component: "C4",
    latency_ms: null,
    outcome: "success",
    metadata: {},
    created_at: "2026-05-02T10:00:02.000Z",
  },
  {
    id: "metric-k2-dup-received-first",
    user_id: USER_A.userId,
    request_id: "req-k2-duplicates",
    event_name: "meal_content_received",
    component: "C4",
    latency_ms: null,
    outcome: "success",
    metadata: {},
    created_at: "2026-05-02T10:00:00.000Z",
  },
  ...[3000, 5000, 7000, 4000, 6000, 4500, 5500].map(
    (latencyMs, index): MetricEventRow => ({
      id: `metric-k3-${index + 1}`,
      user_id: index < 5 ? USER_A.userId : USER_B.userId,
      request_id: `req-k3-${index + 1}`,
      event_name: "voice_transcription_completed",
      component: "C5",
      latency_ms: latencyMs,
      outcome: "success",
      metadata: { audio_duration_seconds: [5, 10, 12, 8, 14, 6, 9][index] },
      created_at: `${[
        FIXED_TODAY,
        FIXED_YESTERDAY,
        FIXED_TWO_DAYS_AGO,
        FIXED_THREE_DAYS_AGO,
        FIXED_FOUR_DAYS_AGO,
        FIXED_TODAY,
        FIXED_YESTERDAY,
      ][index]}T09:00:00.000Z`,
    }),
  ),
  {
    id: "metric-k3-long-clip",
    user_id: USER_A.userId,
    request_id: "req-k3-long-clip",
    event_name: "voice_transcription_completed",
    component: "C5",
    latency_ms: 60000,
    outcome: "success",
    metadata: { audio_duration_seconds: 16 },
    created_at: "2026-05-02T09:30:00.000Z",
  },
];

export const TENANT_AUDIT_RUNS: TenantAuditRunRow[] = [
  {
    id: "audit-run-1",
    run_type: "end_of_pilot_k4",
    started_at: "2026-05-02T00:00:00.000Z",
    completed_at: "2026-05-02T00:05:00.000Z",
    checked_tables: [
      "user_profiles",
      "user_targets",
      "summary_schedules",
      "onboarding_states",
      "transcripts",
      "meal_drafts",
      "meal_draft_items",
      "confirmed_meals",
      "meal_items",
      "summary_records",
      "audit_events",
      "metric_events",
      "cost_events",
      "monthly_spend_counters",
      "food_lookup_cache",
      "kbju_accuracy_labels",
    ],
    cross_user_reference_count: 0,
    findings: [],
  },
];

export const COST_EVENTS: CostEventRow[] = [
  {
    id: "cost-1",
    user_id: USER_A.userId,
    request_id: "req-cost-a",
    provider_alias: "fireworks",
    model_alias: "qwen3-vl-30b-a3b-instruct",
    call_type: "text_llm",
    estimated_cost_usd: 0.05,
    actual_cost_usd: 0.05,
    input_units: 100,
    output_units: 50,
    billing_unit: "token",
    created_at: "2026-05-02T10:00:00.000Z",
  },
  {
    id: "cost-2",
    user_id: USER_A.userId,
    request_id: "req-cost-a2",
    provider_alias: "fireworks",
    model_alias: "whisper-v3-turbo",
    call_type: "transcription",
    estimated_cost_usd: 0.10,
    actual_cost_usd: 0.10,
    input_units: 10,
    output_units: 0,
    billing_unit: "audio_second",
    created_at: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "cost-3",
    user_id: USER_B.userId,
    request_id: "req-cost-b",
    provider_alias: "fireworks",
    model_alias: "qwen3-vl-30b-a3b-instruct",
    call_type: "text_llm",
    estimated_cost_usd: 0.03,
    actual_cost_usd: 0.03,
    input_units: 80,
    output_units: 40,
    billing_unit: "token",
    created_at: "2026-05-02T11:00:00.000Z",
  },
  {
    id: "cost-4",
    user_id: USER_B.userId,
    request_id: "req-cost-b2",
    provider_alias: "fireworks",
    model_alias: "whisper-v3-turbo",
    call_type: "transcription",
    estimated_cost_usd: 0.08,
    actual_cost_usd: 0.08,
    input_units: 8,
    output_units: 0,
    billing_unit: "audio_second",
    created_at: "2026-04-30T09:00:00.000Z",
  },
];

function label(
  id: string,
  userId: string,
  mealId: string,
  createdAt: string,
  calorieErrorPct: number,
  proteinErrorPct: number,
): KbjuAccuracyLabelRow {
  return {
    id,
    user_id: userId,
    meal_id: mealId,
    labeled_by: id.endsWith("2") ? "partner" : "po",
    sample_reason: id.endsWith("2") ? "random_pilot_sample" : "low_confidence_review",
    estimate_totals: { calories_kcal: 510, protein_g: 31, fat_g: 20, carbs_g: 50 },
    ground_truth_totals: { calories_kcal: 500, protein_g: 30, fat_g: 20, carbs_g: 50 },
    calorie_error_pct: calorieErrorPct,
    protein_error_pct: proteinErrorPct,
    fat_error_pct: 0,
    carbs_error_pct: 0,
    notes: null,
    created_at: createdAt,
  };
}

export const K7_LABELS_A: KbjuAccuracyLabelRow[] = [
  label("label-a1", USER_A.userId, "meal-a1", "2026-05-02T12:00:00.000Z", 2, 3.33),
  label("label-a2", USER_A.userId, "meal-a2", "2026-05-02T18:00:00.000Z", 0.83, 2.86),
  label("label-a3", USER_A.userId, "meal-a3", "2026-05-02T20:00:00.000Z", 4, 1),
];

export const K7_LABELS_B: KbjuAccuracyLabelRow[] = [
  label("label-b1", USER_B.userId, "meal-b1", "2026-05-01T12:00:00.000Z", 1.25, 4),
  label("label-b2", USER_B.userId, "meal-b2", "2026-05-01T18:00:00.000Z", 0.91, 3.13),
  label("label-b3", USER_B.userId, "meal-b3", "2026-05-01T20:00:00.000Z", 3, 2),
];

export const ALL_K7_LABELS: KbjuAccuracyLabelRow[] = [
  ...K7_LABELS_A,
  ...K7_LABELS_B,
];

export const K1_DAILY_COUNTS: K1DailyMealCount[] = [
  ...MEALS_USER_A,
  ...MEALS_USER_B,
].map((m) => ({ userId: m.user_id, mealLocalDate: m.meal_local_date, count: 1 }));

export const K1_USER_THRESHOLDS: Record<string, boolean> = {
  [USER_A.userId]: true,
  [USER_B.userId]: true,
};

export const K3_LATENCY: K3LatencyResult = { p95Ms: 7000, p100Ms: 7000 };
export const K5_SPEND: K5SpendResult = {
  totalEstimatedUsd: 0.18,
  withinBudget: true,
  degradeModeActive: false,
};
export const K7_ACCURACY: K7AccuracyResult = {
  mealsWithinCalorieBounds: 6,
  mealsWithinMacroBounds: 6,
  totalLabeled: 6,
  dailyCalorieAccuracy: new Map<string, { totalError: number; count: number }>(),
  dailyMacroAccuracy: new Map<string, { totalError: number; count: number }>(),
  withinK7Targets: true,
};

export const SENSITIVE_SENTINELS = {
  telegramId: "987654321",
  username: "raw_pilot_username",
  rawMealText: "RAW_MEAL_TEXT_SENTINEL гречка с курицей",
  transcriptText: "RAW_TRANSCRIPT_SENTINEL голосовой текст еды",
  providerPrompt: "PROVIDER_PROMPT_SENTINEL estimate calories",
  providerToken: "sk-test-provider-token-sentinel-1234567890",
  rawMediaMarker: "RAW_MEDIA_SENTINEL telegram-photo-file-id",
};

export interface SmokeMessage {
  toUserId: string;
  text: string;
}

export interface SmokeStore {
  meals: Array<{ userId: string; id: string; text: string; deleted?: boolean }>;
  summaries: Array<{ userId: string; text: string }>;
  histories: Array<{ userId: string; text: string }>;
  transcripts: Array<{ userId: string; text: string }>;
  audits: Array<{ userId: string; text: string }>;
  drafts: Array<{ userId: string; id: string; text: string; lowConfidence: boolean }>;
  users: Set<string>;
}

export function buildSmokeStore(): SmokeStore {
  return {
    meals: [
      { userId: USER_A.userId, id: "smoke-meal-a", text: "meal A private text" },
      { userId: USER_B.userId, id: "smoke-meal-b", text: "meal B private text" },
    ],
    summaries: [
      { userId: USER_A.userId, text: "summary A private totals" },
      { userId: USER_B.userId, text: "summary B private totals" },
    ],
    histories: [
      { userId: USER_A.userId, text: "history A private correction" },
      { userId: USER_B.userId, text: "history B private correction" },
    ],
    transcripts: [
      { userId: USER_A.userId, text: "transcript A private voice" },
      { userId: USER_B.userId, text: "transcript B private voice" },
    ],
    audits: [
      { userId: USER_A.userId, text: "audit A private meal_created" },
      { userId: USER_B.userId, text: "audit B private meal_created" },
    ],
    drafts: [],
    users: new Set([USER_A.userId, USER_B.userId]),
  };
}

export function renderUserInbox(store: SmokeStore, userId: string): SmokeMessage[] {
  return [
    ...store.meals.filter((row) => row.userId === userId && !row.deleted),
    ...store.summaries.filter((row) => row.userId === userId),
    ...store.histories.filter((row) => row.userId === userId),
    ...store.transcripts.filter((row) => row.userId === userId),
    ...store.audits.filter((row) => row.userId === userId),
  ].map((row) => ({ toUserId: userId, text: row.text }));
}

export function createLowConfidencePhotoDraft(store: SmokeStore, userId: string): SmokeMessage {
  const draft = {
    userId,
    id: "photo-draft-low-confidence",
    text: "низкая уверенность: фото похоже на суп, подтвердите перед сохранением",
    lowConfidence: true,
  };
  store.drafts.push(draft);
  return { toUserId: userId, text: draft.text };
}

export function confirmPhotoDraft(store: SmokeStore, userId: string, draftId: string): void {
  const draft = store.drafts.find((row) => row.userId === userId && row.id === draftId);
  if (!draft) return;
  store.meals.push({ userId, id: "confirmed-photo-meal", text: draft.text });
}

export function deliverSummaryWithGuard(store: SmokeStore, userId: string, providerText: string): string {
  const forbidden = /диагноз|лекарств|medical|dose/i.test(providerText);
  const text = forbidden
    ? "Детерминированная рекомендация: сверяйте КБЖУ с целью и корректируйте порции."
    : providerText;
  store.summaries.push({ userId, text });
  return text;
}

export function rightToDeleteUser(store: SmokeStore, userId: string): void {
  store.meals = store.meals.filter((row) => row.userId !== userId);
  store.summaries = store.summaries.filter((row) => row.userId !== userId);
  store.histories = store.histories.filter((row) => row.userId !== userId);
  store.transcripts = store.transcripts.filter((row) => row.userId !== userId);
  store.audits = store.audits.filter((row) => row.userId !== userId);
  store.drafts = store.drafts.filter((row) => row.userId !== userId);
  store.users.delete(userId);
}

export function freshOnboardUser(store: SmokeStore, userId: string): void {
  store.users.add(userId);
}

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
    reportGeneratedAtUtc: FIXED_NOW,
    diagnostics: {
      telegram_id: SENSITIVE_SENTINELS.telegramId,
      username: SENSITIVE_SENTINELS.username,
      raw_meal_text: SENSITIVE_SENTINELS.rawMealText,
      transcript_text: SENSITIVE_SENTINELS.transcriptText,
      provider_prompt: SENSITIVE_SENTINELS.providerPrompt,
      provider_key: SENSITIVE_SENTINELS.providerToken,
      raw_media: SENSITIVE_SENTINELS.rawMediaMarker,
    },
  };
}
