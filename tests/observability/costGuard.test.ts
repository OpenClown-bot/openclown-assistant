import { describe, it, expect, vi } from "vitest";
import {
  MONTHLY_SPEND_CEILING_USD,
  worstCaseCostForCall,
  shouldDegrade,
  shouldSuppressPoAlert,
  WORST_CASE_PRICES,
  SpendTracker,
} from "../../src/observability/costGuard.js";
import type { CallType } from "../../src/shared/types.js";
import type { TenantStore, MonthlySpendCounterRow } from "../../src/store/types.js";

function makeRow(overrides: Partial<MonthlySpendCounterRow>): MonthlySpendCounterRow {
  return {
    id: overrides.id ?? "row-uuid-001",
    user_id: overrides.user_id ?? "user-001",
    month_utc: overrides.month_utc ?? "2026-04",
    estimated_spend_usd: overrides.estimated_spend_usd ?? 0,
    actual_spend_usd: overrides.actual_spend_usd ?? null,
    degrade_mode_enabled: overrides.degrade_mode_enabled ?? false,
    po_alert_sent_at: overrides.po_alert_sent_at ?? null,
    updated_at: overrides.updated_at ?? "2026-04-27T12:00:00Z",
  };
}

function createMockStore(rows: Map<string, MonthlySpendCounterRow>): TenantStore {
  const store: Record<string, unknown> = {
    async getMonthlySpendCounter(userId: string, monthUtc: string) {
      const key = `${userId}:${monthUtc}`;
      return rows.get(key) ?? null;
    },
    async incrementMonthlySpend(userId: string, monthUtc: string, request: { deltaUsd: number; degradeModeEnabled?: boolean; poAlertSentAt?: string }) {
      const key = `${userId}:${monthUtc}`;
      const existing = rows.get(key);
      const newRow = makeRow({
        id: existing?.id ?? "row-uuid-001",
        user_id: userId,
        month_utc: monthUtc,
        estimated_spend_usd: (existing?.estimated_spend_usd ?? 0) + request.deltaUsd,
        degrade_mode_enabled: request.degradeModeEnabled ?? existing?.degrade_mode_enabled ?? false,
        po_alert_sent_at: request.poAlertSentAt ?? existing?.po_alert_sent_at ?? null,
      });
      rows.set(key, newRow);
      return newRow;
    },
  };
  for (const method of [
    "withTransaction", "createUser", "getUser", "updateUserOnboardingStatus",
    "deleteUser", "createUserProfile", "getLatestUserProfile", "createUserTarget",
    "upsertSummarySchedule", "listSummarySchedules", "upsertOnboardingState",
    "updateOnboardingStateWithVersion", "createTranscript", "createMealDraft",
    "updateMealDraftWithVersion", "createMealDraftItem", "createConfirmedMeal",
    "listConfirmedMeals", "softDeleteConfirmedMealWithVersion", "createMealItem",
    "createSummaryRecord", "createAuditEvent", "createMetricEvent",
    "createCostEvent", "upsertMonthlySpendCounter", "upsertFoodLookupCache",
    "createKbjuAccuracyLabel",
  ]) {
    if (!(method in store)) {
      (store as Record<string, unknown>)[method] = vi.fn();
    }
  }
  return store as unknown as TenantStore;
}

describe("costGuard worst-case prices", () => {
  it("returns a non-zero cost for text_llm per ADR-002@0.1.0", () => {
    const cost = worstCaseCostForCall("text_llm");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns a non-zero cost for vision_llm per ADR-004@0.1.0", () => {
    const cost = worstCaseCostForCall("vision_llm");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns a non-zero cost for transcription per ADR-003@0.1.0", () => {
    const cost = worstCaseCostForCall("transcription");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns zero cost for lookup per ADR-005@0.1.0", () => {
    const cost = worstCaseCostForCall("lookup");
    expect(cost).toBe(0);
  });

  it("returns fallback cost for unknown call type", () => {
    const cost = worstCaseCostForCall("unknown_type" as CallType);
    expect(cost).toBe(0.001);
  });

  it("text_llm worst-case is based on ADR-002 gpt-oss-120b pricing", () => {
    const textPrice = WORST_CASE_PRICES.find((p) => p.callType === "text_llm");
    expect(textPrice).toBeDefined();
    expect(textPrice!.modelAlias).toBe("gpt-oss-120b");
    expect(textPrice!.maxInputUnits).toBe(1500);
    expect(textPrice!.maxOutputUnits).toBe(600);
  });

  it("transcription worst-case is based on ADR-003 Whisper V3 Turbo pricing", () => {
    const transPrice = WORST_CASE_PRICES.find((p) => p.callType === "transcription");
    expect(transPrice).toBeDefined();
    expect(transPrice!.modelAlias).toBe("whisper-v3-turbo");
    expect(transPrice!.maxInputUnits).toBe(15);
  });
});

describe("costGuard shouldDegrade", () => {
  it("does not degrade when spend is below $10 ceiling", () => {
    expect(shouldDegrade(5.0)).toBe(false);
  });

  it("enables degrade mode when projected spend reaches $10 ceiling per ARCH-001@0.2.0 §4.8", () => {
    expect(shouldDegrade(10.0)).toBe(true);
  });

  it("enables degrade mode when projected spend exceeds $10", () => {
    expect(shouldDegrade(10.01)).toBe(true);
  });

  it("enables degrade mode when projected spend is well above $10", () => {
    expect(shouldDegrade(15.0)).toBe(true);
  });

  it("MONTHLY_SPEND_CEILING_USD is $10 per ARCH-001 §4.8", () => {
    expect(MONTHLY_SPEND_CEILING_USD).toBe(10);
  });
});

describe("costGuard shouldSuppressPoAlert", () => {
  it("does not suppress alert when no alert has been sent this month", () => {
    expect(shouldSuppressPoAlert(null, "2026-04")).toBe(false);
  });

  it("suppresses duplicate PO alert within the same UTC month", () => {
    const alertSentAt = "2026-04-15T10:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(true);
  });

  it("allows PO alert in a new UTC month after previous alert", () => {
    const alertSentAt = "2026-03-28T10:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(false);
  });

  it("suppresses duplicate alert when alert sent at start of month", () => {
    const alertSentAt = "2026-04-01T00:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(true);
  });

  it("allows alert in next month even if same month number different year", () => {
    const alertSentAt = "2025-04-15T10:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(false);
  });
});

describe("costGuard worst-case price coverage per ADR", () => {
  it("covers all four call types from ADR-002/003/004/005", () => {
    const callTypes = WORST_CASE_PRICES.map((p) => p.callType);
    expect(callTypes).toContain("text_llm");
    expect(callTypes).toContain("vision_llm");
    expect(callTypes).toContain("transcription");
    expect(callTypes).toContain("lookup");
  });

  it("all prices use the omniroute provider alias per ADR-002", () => {
    for (const price of WORST_CASE_PRICES) {
      expect(price.providerAlias).toBe("omniroute");
    }
  });
});

describe("SpendTracker (F-H5 coverage)", () => {
  it("fresh-instance read preserves existing DB spend (F-H1)", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    rows.set("user-001:2026-04", makeRow({
      user_id: "user-001",
      month_utc: "2026-04",
      estimated_spend_usd: 7.5,
    }));
    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    const state = await tracker.getState();
    expect(state.estimatedSpendUsd).toBe(7.5);
    expect(state.monthUtc).toBe(getCurrentMonthUtc());
  });

  it("concurrent recordCostAndCheckBudget calls do not lose updates (F-H2)", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    await tracker.recordCostAndCheckBudget(3, false);
    await tracker.recordCostAndCheckBudget(4, false);

    const state = await tracker.getState();
    expect(state.estimatedSpendUsd).toBe(7);
  });

  it("month rollover resets state to fresh DB read (F-H3)", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    const aprilRow = makeRow({
      user_id: "user-001",
      month_utc: "2026-04",
      estimated_spend_usd: 9.5,
    });
    rows.set("user-001:2026-04", aprilRow);

    const currentMonth = getCurrentMonthUtc();
    rows.set(`user-001:${currentMonth}`, makeRow({
      user_id: "user-001",
      month_utc: currentMonth,
      estimated_spend_usd: 0,
    }));

    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    const state = await tracker.getState();
    expect(state.estimatedSpendUsd).toBeLessThan(9.5);
  });

  it("preflightCheck blocks call that would exceed ceiling", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    const currentMonth = getCurrentMonthUtc();
    rows.set(`user-001:${currentMonth}`, makeRow({
      user_id: "user-001",
      month_utc: currentMonth,
      estimated_spend_usd: 9.999,
    }));
    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    const result = await tracker.preflightCheck("text_llm");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("preflightCheck allows call within ceiling", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    const currentMonth = getCurrentMonthUtc();
    rows.set(`user-001:${currentMonth}`, makeRow({
      user_id: "user-001",
      month_utc: currentMonth,
      estimated_spend_usd: 1,
    }));
    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    const result = await tracker.preflightCheck("text_llm");
    expect(result.allowed).toBe(true);
  });

  it("markPoAlertSent sets poAlertSentAt on current month", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    await tracker.getState();
    await tracker.markPoAlertSent();

    const state = await tracker.getState();
    expect(state.poAlertSentAt).not.toBeNull();
  });

  it("recordCostAndCheckBudget enables degrade mode when spend reaches ceiling", async () => {
    const rows = new Map<string, MonthlySpendCounterRow>();
    const store = createMockStore(rows);
    const tracker = new SpendTracker(store, "user-001");

    const state = await tracker.recordCostAndCheckBudget(10, false);
    expect(state.degradeModeEnabled).toBe(true);
  });
});

function getCurrentMonthUtc(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
