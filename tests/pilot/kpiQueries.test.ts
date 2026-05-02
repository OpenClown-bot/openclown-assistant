import { describe, expect, it } from "vitest";
import {
  queryK1DailyConfirmedMeals,
  queryK1MeetsThreshold,
  queryK2LatencyMs,
  queryK3VoiceLatency,
  queryK4CrossUserAudit,
  queryK5MonthlySpend,
  queryK6ActiveDays,
  queryK6WeeklyRetention,
  queryK7Accuracy,
} from "../../src/pilot/kpiQueries.js";
import {
  USER_A,
  USER_B,
  ALL_MEALS,
  METRIC_EVENTS,
  TENANT_AUDIT_RUNS,
  COST_EVENTS,
  ALL_K7_LABELS,
  K1_DAILY_COUNTS,
  FIXED_MONTH_UTC,
  FIXED_NOW,
  FIXED_WEEK_END,
  FIXED_WEEK_START,
} from "../pilot/fixtures.js";
import type { KbjuAccuracyLabelRow, MetricEventRow } from "../../src/store/types.js";

describe("K1 - daily confirmed meals", () => {
  it("counts only non-deleted meals per user per day", () => {
    const counts = queryK1DailyConfirmedMeals(ALL_MEALS);
    const userACounts = counts.filter((c) => c.userId === USER_A.userId);
    const userBCount = counts.filter((c) => c.userId === USER_B.userId);

    expect(new Set(userACounts.map((c) => c.mealLocalDate)).size).toBe(8);
    expect(new Set(userBCount.map((c) => c.mealLocalDate)).size).toBe(8);
    expect(
      userACounts.find((c) => c.mealLocalDate === "2026-05-02")?.count,
    ).toBe(1);
  });

  it("meets threshold for active users", () => {
    const thresholds = queryK1MeetsThreshold(K1_DAILY_COUNTS, 1, 7);
    expect(thresholds[USER_A.userId]).toBe(true);
    expect(thresholds[USER_B.userId]).toBe(true);
  });

  it("returns empty result for no meals", () => {
    expect(queryK1DailyConfirmedMeals([])).toEqual([]);
  });

  it("returns empty thresholds when no users have qualifying days", () => {
    const thresholds = queryK1MeetsThreshold([], 1, 7);
    expect(Object.keys(thresholds)).toHaveLength(0);
  });

  it("marks missing expected users as failing", () => {
    const thresholds = queryK1MeetsThreshold([], 1, 7, [USER_A.userId, USER_B.userId]);
    expect(thresholds[USER_A.userId]).toBe(false);
    expect(thresholds[USER_B.userId]).toBe(false);
  });
});

describe("K2 - time-to-first-value", () => {
  it("calculates latency between meal_content_received and draft_reply_sent", () => {
    expect(queryK2LatencyMs(METRIC_EVENTS, "req-k2-a")).toBe(5000);
  });

  it("returns null when timestamps are missing", () => {
    const missingTimestamp: MetricEventRow[] = [
      {
        id: "missing-start",
        user_id: USER_A.userId,
        request_id: "req-missing",
        event_name: "meal_content_received",
        component: "C4",
        latency_ms: null,
        outcome: "success",
        metadata: {},
        created_at: "",
      },
      {
        id: "missing-end",
        user_id: USER_A.userId,
        request_id: "req-missing",
        event_name: "draft_reply_sent",
        component: "C4",
        latency_ms: 1000,
        outcome: "success",
        metadata: {},
        created_at: "2026-05-02T10:00:01.000Z",
      },
    ];
    expect(queryK2LatencyMs(missingTimestamp, "req-missing")).toBeNull();
  });

  it("uses the first matching events for duplicate out-of-order rows", () => {
    expect(queryK2LatencyMs(METRIC_EVENTS, "req-k2-duplicates")).toBe(7000);
  });
});

describe("K3 - voice latency", () => {
  it("calculates p95 and p100 for <=15s voice messages only", () => {
    const result = queryK3VoiceLatency(METRIC_EVENTS, 30, FIXED_NOW);
    expect(result.p95Ms).toBe(7000);
    expect(result.p100Ms).toBe(7000);
  });

  it("returns empty metrics when there are no eligible <=15s voice rows", () => {
    const onlyLongClips = METRIC_EVENTS.filter(
      (m) => m.request_id === "req-k3-long-clip",
    );
    expect(queryK3VoiceLatency(onlyLongClips, 30, FIXED_NOW)).toEqual({
      p95Ms: null,
      p100Ms: null,
    });
    expect(queryK3VoiceLatency([], 30, FIXED_NOW)).toEqual({
      p95Ms: null,
      p100Ms: null,
    });
  });
});

describe("K4 - cross-user audit", () => {
  it("passes when no cross-user references", () => {
    const result = queryK4CrossUserAudit(TENANT_AUDIT_RUNS);
    expect(result.crossUserReferences).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("fails with missing audit runs", () => {
    expect(queryK4CrossUserAudit([])).toEqual({
      crossUserReferences: -1,
      passed: false,
    });
  });
});

describe("K5 - monthly spend", () => {
  it("calculates total estimated USD and budget status for a fixed month", () => {
    const result = queryK5MonthlySpend(COST_EVENTS, 10, FIXED_MONTH_UTC);
    expect(result.totalEstimatedUsd).toBeCloseTo(0.18, 2);
    expect(result.withinBudget).toBe(true);
    expect(result.degradeModeActive).toBe(false);
  });
});

describe("K6 - weekly retention", () => {
  it("counts active days in a fixed week", () => {
    const activeDays = queryK6ActiveDays(ALL_MEALS, USER_A.userId);
    const retention = queryK6WeeklyRetention(
      activeDays,
      FIXED_WEEK_START,
      FIXED_WEEK_END,
    );

    expect(activeDays.size).toBe(8);
    expect(retention.activeDaysInWeek).toBe(7);
    expect(retention.metThreshold).toBe(true);
  });
});

describe("K7 - KBJU accuracy", () => {
  it("groups daily calorie accuracy by calendar date", () => {
    const result = queryK7Accuracy(ALL_K7_LABELS, 10, 10, 5, 5);

    expect(result.totalLabeled).toBe(6);
    expect(result.mealsWithinCalorieBounds).toBe(6);
    expect(result.mealsWithinMacroBounds).toBe(6);
    expect(result.dailyCalorieAccuracy.get("2026-05-02")).toEqual({
      totalError: 6.83,
      count: 3,
    });
    expect(result.dailyCalorieAccuracy.get("2026-05-01")).toEqual({
      totalError: 5.16,
      count: 3,
    });
    expect(result.withinK7Targets).toBe(true);
  });

  it("fails K7 targets for out-of-tolerance values", () => {
    const badLabels: KbjuAccuracyLabelRow[] = [
      {
        ...ALL_K7_LABELS[0],
        id: "bad-label-1",
        calorie_error_pct: 30,
      },
      {
        ...ALL_K7_LABELS[1],
        id: "bad-label-2",
        protein_error_pct: 35,
      },
    ];
    const result = queryK7Accuracy(badLabels, 10, 10, 5, 5);
    expect(result.mealsWithinCalorieBounds).toBe(1);
    expect(result.mealsWithinMacroBounds).toBe(1);
    expect(result.withinK7Targets).toBe(false);
  });
});
