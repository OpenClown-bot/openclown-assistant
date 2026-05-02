import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computePeriodBounds,
  validateTimezone,
  buildIdempotencyKey,
  aggregateMeals,
  computeDeltas,
  computePreviousPeriodComparison,
  computePeriodTargets,
  periodTypeToTargetMultiplier,
  processDueSchedule,
} from "../../src/summary/summaryScheduler.js";
import type { SummarySchedulerDeps } from "../../src/summary/summaryScheduler.js";
import type { DueSchedule } from "../../src/summary/types.js";
import type { ConfirmedMealRow, TenantStore, SummaryRecordRow } from "../../src/store/types.js";
import type { SpendTracker } from "../../src/observability/costGuard.js";
import { resetPersonaCache } from "../../src/summary/personaLoader.js";
import { NO_MEAL_NUDGE_RU } from "../../src/summary/messages.js";

beforeEach(() => {
  resetPersonaCache();
});

function makeMeal(overrides: Partial<ConfirmedMealRow>): ConfirmedMealRow {
  return {
    id: overrides.id ?? "meal-1",
    user_id: overrides.user_id ?? "user-1",
    source: overrides.source ?? "text",
    draft_id: overrides.draft_id ?? null,
    meal_local_date: overrides.meal_local_date ?? "2026-05-01",
    meal_logged_at: overrides.meal_logged_at ?? "2026-05-01T12:00:00Z",
    total_calories_kcal: overrides.total_calories_kcal ?? 500,
    total_protein_g: overrides.total_protein_g ?? 30,
    total_fat_g: overrides.total_fat_g ?? 15,
    total_carbs_g: overrides.total_carbs_g ?? 60,
    manual_entry: overrides.manual_entry ?? false,
    deleted_at: overrides.deleted_at ?? null,
    version: overrides.version ?? 1,
    created_at: overrides.created_at ?? "2026-05-01T12:00:00Z",
    updated_at: overrides.updated_at ?? "2026-05-01T12:00:00Z",
  };
}

function makeRecordRow(overrides: Partial<SummaryRecordRow>): SummaryRecordRow {
  return {
    id: overrides.id ?? "rec-1",
    user_id: overrides.user_id ?? "user-1",
    period_type: overrides.period_type ?? "daily",
    period_start_local_date: overrides.period_start_local_date ?? "2026-05-01",
    period_end_local_date: overrides.period_end_local_date ?? "2026-05-01",
    idempotency_key: overrides.idempotency_key ?? "user-1:daily:2026-05-01",
    totals: overrides.totals ?? {},
    deltas_vs_target: overrides.deltas_vs_target ?? {},
    previous_period_comparison: overrides.previous_period_comparison ?? null,
    recommendation_text_ru: overrides.recommendation_text_ru ?? null,
    recommendation_mode: overrides.recommendation_mode ?? "no_meal_nudge",
    blocked_reason: overrides.blocked_reason ?? null,
    delivered_at: overrides.delivered_at ?? "2026-05-01T12:00:00Z",
  };
}

function makeMockStore(meals: ConfirmedMealRow[] = []): TenantStore {
  const records: SummaryRecordRow[] = [];
  const store: Record<string, unknown> = {
    async listConfirmedMeals() {
      return meals;
    },
    async createSummaryRecord(_userId: string, request: { idempotencyKey: string }) {
      const row = makeRecordRow({ idempotency_key: request.idempotencyKey });
      records.push(row);
      return row;
    },
    async getUser() {
      return null;
    },
    async getLatestUserProfile() {
      return null;
    },
    async upsertSummarySchedule() {
      return {
        id: "sched-1",
        user_id: "user-1",
        period_type: "daily",
        local_time: "21:00",
        timezone: "Europe/Moscow",
        enabled: true,
        last_due_period_start: null,
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
      };
    },
    async listSummarySchedules() {
      return [];
    },
  };
  return store as unknown as TenantStore;
}

describe("computePeriodBounds", () => {
  it("daily returns same date for start and end", () => {
    const result = computePeriodBounds("daily", "2026-05-01", "Europe/Moscow");
    expect(result.periodStart).toBe("2026-05-01");
    expect(result.periodEnd).toBe("2026-05-01");
  });

  it("weekly returns Monday to Sunday for a Wednesday", () => {
    const result = computePeriodBounds("weekly", "2026-05-06", "Europe/Moscow");
    expect(result.periodStart).toBe("2026-05-04");
    expect(result.periodEnd).toBe("2026-05-10");
  });

  it("monthly returns first to last day", () => {
    const result = computePeriodBounds("monthly", "2026-05-15", "Europe/Moscow");
    expect(result.periodStart).toBe("2026-05-01");
    expect(result.periodEnd).toBe("2026-05-31");
  });

  it("monthly handles February in a non-leap year", () => {
    const result = computePeriodBounds("monthly", "2025-02-10", "Europe/Moscow");
    expect(result.periodStart).toBe("2025-02-01");
    expect(result.periodEnd).toBe("2025-02-28");
  });

  it("monthly handles February in a leap year", () => {
    const result = computePeriodBounds("monthly", "2028-02-10", "Europe/Moscow");
    expect(result.periodStart).toBe("2028-02-01");
    expect(result.periodEnd).toBe("2028-02-29");
  });

  it("weekly boundary for a Sunday yields that week's Monday-Sunday", () => {
    const result = computePeriodBounds("weekly", "2026-05-10", "Europe/Moscow");
    expect(result.periodStart).toBe("2026-05-04");
    expect(result.periodEnd).toBe("2026-05-10");
  });

  it("weekly boundary for a Monday yields that same Monday-Sunday", () => {
    const result = computePeriodBounds("weekly", "2026-05-04", "Europe/Moscow");
    expect(result.periodStart).toBe("2026-05-04");
    expect(result.periodEnd).toBe("2026-05-10");
  });

  it("period boundaries are host-runtime-timezone-independent", () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const result = computePeriodBounds("weekly", "2026-05-06", "Europe/Moscow");
      expect(result.periodStart).toBe("2026-05-04");
      expect(result.periodEnd).toBe("2026-05-10");
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });

  it("throws for invalid IANA timezone", () => {
    expect(() => computePeriodBounds("daily", "2026-05-01", "Invalid/Zone")).toThrow(
      'Invalid IANA timezone: "Invalid/Zone"',
    );
  });
});

describe("validateTimezone", () => {
  it("accepts valid IANA timezone", () => {
    expect(() => validateTimezone("Europe/Moscow")).not.toThrow();
  });

  it("accepts UTC timezone", () => {
    expect(() => validateTimezone("UTC")).not.toThrow();
  });

  it("rejects invalid timezone string", () => {
    expect(() => validateTimezone("not-a-zone")).toThrow();
  });
});

describe("buildIdempotencyKey", () => {
  it("builds key from userId, periodType, periodStart", () => {
    const key = buildIdempotencyKey("user-1", "daily", "2026-05-01");
    expect(key).toBe("user-1:daily:2026-05-01");
  });
});

describe("aggregateMeals", () => {
  it("sums KBJU across meals", () => {
    const meals = [
      makeMeal({ total_calories_kcal: 500, total_protein_g: 30, total_fat_g: 15, total_carbs_g: 60 }),
      makeMeal({ total_calories_kcal: 700, total_protein_g: 40, total_fat_g: 20, total_carbs_g: 80 }),
    ];
    const result = aggregateMeals(meals);
    expect(result.totalCaloriesKcal).toBe(1200);
    expect(result.totalProteinG).toBe(70);
    expect(result.totalFatG).toBe(35);
    expect(result.totalCarbsG).toBe(140);
    expect(result.mealCount).toBe(2);
  });

  it("returns zeros for empty array", () => {
    const result = aggregateMeals([]);
    expect(result.totalCaloriesKcal).toBe(0);
    expect(result.mealCount).toBe(0);
  });
});

describe("computeDeltas", () => {
  it("computes deltas vs targets", () => {
    const aggregate = { totalCaloriesKcal: 1800, totalProteinG: 90, totalFatG: 60, totalCarbsG: 200, mealCount: 3 };
    const targets = { caloriesKcal: 2000, proteinG: 100, fatG: 55, carbsG: 215 };
    const result = computeDeltas(aggregate, targets);
    expect(result.deltaCaloriesKcal).toBe(-200);
    expect(result.deltaProteinG).toBe(-10);
    expect(result.deltaFatG).toBe(5);
    expect(result.deltaCarbsG).toBe(-15);
  });
});

describe("computePreviousPeriodComparison", () => {
  it("returns null when previous is null", () => {
    const current = { totalCaloriesKcal: 1800, totalProteinG: 90, totalFatG: 60, totalCarbsG: 200, mealCount: 3 };
    expect(computePreviousPeriodComparison(current, null)).toBeNull();
  });

  it("computes deltas between current and previous", () => {
    const current = { totalCaloriesKcal: 1800, totalProteinG: 90, totalFatG: 60, totalCarbsG: 200, mealCount: 3 };
    const previous = { totalCaloriesKcal: 1700, totalProteinG: 85, totalFatG: 55, totalCarbsG: 190, mealCount: 2 };
    const result = computePreviousPeriodComparison(current, previous);
    expect(result).not.toBeNull();
    expect(result!.deltaCaloriesKcal).toBe(100);
    expect(result!.deltaProteinG).toBe(5);
    expect(result!.deltaFatG).toBe(5);
    expect(result!.deltaCarbsG).toBe(10);
  });
});

describe("computePeriodTargets", () => {
  it("multiplies daily targets by period multiplier", () => {
    const daily = { caloriesKcal: 2000, proteinG: 100, fatG: 55, carbsG: 215 };
    expect(computePeriodTargets(daily, "daily")).toEqual(daily);
    const weekly = computePeriodTargets(daily, "weekly");
    expect(weekly.caloriesKcal).toBe(14000);
    expect(weekly.proteinG).toBe(700);
  });
});

describe("periodTypeToTargetMultiplier", () => {
  it("returns 1 for daily, 7 for weekly, 30 for monthly", () => {
    expect(periodTypeToTargetMultiplier("daily")).toBe(1);
    expect(periodTypeToTargetMultiplier("weekly")).toBe(7);
    expect(periodTypeToTargetMultiplier("monthly")).toBe(30);
  });
});

describe("processDueSchedule", () => {
  const dailyTargets = { caloriesKcal: 2000, proteinG: 100, fatG: 55, carbsG: 215 };

  function makeDeps(meals: ConfirmedMealRow[] = [], llmOverride?: SummarySchedulerDeps["callOmniRoute"]): SummarySchedulerDeps {
    const store = makeMockStore(meals);
    const spendTracker = {
      preflightCheck: vi.fn().mockResolvedValue({ allowed: true, estimatedCostUsd: 0.001 }),
      recordSpend: vi.fn().mockResolvedValue(undefined),
    } as unknown as SpendTracker;
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    };
    return {
      store,
      omniRouteConfig: {
        baseUrl: "http://localhost",
        apiKey: "test-key",
        textModelAlias: "gpt-oss-120b",
        maxInputTokens: 1500,
        maxOutputTokens: 600,
      },
      spendTracker,
      logger,
      personaPath: "docs/personality/PERSONA-001-kbju-coach.md",
      callOmniRoute: llmOverride,
    };
  }

  it("skips duplicate cron event when lastDuePeriodStart matches", async () => {
    const deps = makeDeps();
    const schedule: DueSchedule = {
      scheduleId: "sched-1",
      userId: "user-1",
      periodType: "daily",
      localTime: "2026-05-01",
      timezone: "Europe/Moscow",
      lastDuePeriodStart: "2026-05-01",
    };
    const result = await processDueSchedule(deps, schedule, "req-1", false, { dailyTargets });
    expect(result.skipped).toBe(true);
  });

  it("produces deterministic nudge for zero-meal period without LLM call", async () => {
    const deps = makeDeps([]);
    const schedule: DueSchedule = {
      scheduleId: "sched-1",
      userId: "user-1",
      periodType: "daily",
      localTime: "2026-05-01",
      timezone: "Europe/Moscow",
      lastDuePeriodStart: null,
    };
    const result = await processDueSchedule(deps, schedule, "req-2", false, { dailyTargets });
    expect(result.recommendationMode).toBe("no_meal_nudge");
    expect(result.recommendationTextRu).toBe(NO_MEAL_NUDGE_RU);
    expect(result.skipped).toBe(false);
  });

  it("duplicate cron events produce one summary_records row per idempotency key", async () => {
    const meals = [
      makeMeal({ total_calories_kcal: 500, total_protein_g: 30, total_fat_g: 15, total_carbs_g: 60 }),
    ];
    const mockLlm = vi.fn().mockResolvedValue({
      providerAlias: "omniroute",
      modelAlias: "gpt-oss-120b",
      rawResponseText: '{"recommendation_ru": "Ты получил 500 ккал при цели 2000. Добавь белка и углеводов."}',
      inputUnits: 100,
      outputUnits: 30,
      estimatedCostUsd: 0.0001,
      outcome: "success",
    });
    const deps = makeDeps(meals, mockLlm);

    const schedule: DueSchedule = {
      scheduleId: "sched-1",
      userId: "user-1",
      periodType: "daily",
      localTime: "2026-05-01",
      timezone: "Europe/Moscow",
      lastDuePeriodStart: null,
    };

    const result1 = await processDueSchedule(deps, schedule, "req-3", false, { dailyTargets });
    expect(result1.skipped).toBe(false);
    expect(result1.idempotencyKey).toBe("user-1:daily:2026-05-01");

    const scheduleDup: DueSchedule = {
      ...schedule,
      lastDuePeriodStart: "2026-05-01",
    };
    const result2 = await processDueSchedule(deps, scheduleDup, "req-4", false, { dailyTargets });
    expect(result2.skipped).toBe(true);

    expect(mockLlm).toHaveBeenCalledTimes(1);
  });

  it("zero-meal periods send deterministic Russian nudge without LLM call", async () => {
    const mockLlm = vi.fn();
    const deps = makeDeps([], mockLlm);
    const schedule: DueSchedule = {
      scheduleId: "sched-1",
      userId: "user-1",
      periodType: "daily",
      localTime: "2026-05-01",
      timezone: "Europe/Moscow",
      lastDuePeriodStart: null,
    };
    const result = await processDueSchedule(deps, schedule, "req-5", false, { dailyTargets });
    expect(mockLlm).not.toHaveBeenCalled();
    expect(result.recommendationMode).toBe("no_meal_nudge");
    expect(result.recommendationTextRu).toContain("нет подтверждённых приёмов пищи");
  });

  it("blocked recommendation sends deterministic numeric KBJU fallback and emits summary_recommendation_blocked", async () => {
    const meals = [
      makeMeal({ total_calories_kcal: 500, total_protein_g: 30, total_fat_g: 15, total_carbs_g: 60 }),
    ];
    const mockLlm = vi.fn().mockResolvedValue({
      providerAlias: "omniroute",
      modelAlias: "gpt-oss-120b",
      rawResponseText: '{"recommendation_ru": "Принимай витамины и добавки для здоровья."}',
      inputUnits: 100,
      outputUnits: 30,
      estimatedCostUsd: 0.0001,
      outcome: "success",
    });
    const deps = makeDeps(meals, mockLlm);

    const schedule: DueSchedule = {
      scheduleId: "sched-1",
      userId: "user-1",
      periodType: "daily",
      localTime: "2026-05-01",
      timezone: "Europe/Moscow",
      lastDuePeriodStart: null,
    };
    const result = await processDueSchedule(deps, schedule, "req-6", false, { dailyTargets });
    expect(result.recommendationMode).toBe("deterministic_fallback");
    expect(result.blockedReason).toContain("forbidden_topic_ru");
    expect(result.recommendationTextRu).toContain("ккал");
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("summary_recommendation_blocked"),
      expect.objectContaining({ error_code: expect.stringContaining("forbidden_topic_ru") }),
    );
  });
});
