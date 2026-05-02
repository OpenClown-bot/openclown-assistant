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
  K7_LABELS_A,
  K7_LABELS_B,
  K1_DAILY_COUNTS,
  buildPilotReadinessData,
} from "../pilot/fixtures.js";

describe("K1 — daily confirmed meals", () => {
  it("counts only non-deleted meals per user per day", () => {
    const counts = queryK1DailyConfirmedMeals(ALL_MEALS);
    const userACounts = counts.filter((c) => c.userId === USER_A.userId);
    const userBCount = counts.filter((c) => c.userId === USER_B.userId);

    // User A: 8 non-deleted meals across 8 unique days (DELETED_MEAL_A is excluded)
    const uniqueDaysA = new Set(userACounts.map((c) => c.mealLocalDate));
    expect(uniqueDaysA.size).toBe(8);

    // User B: 8 meals across 8 unique days
    const uniqueDaysB = new Set(userBCount.map((c) => c.mealLocalDate));
    expect(uniqueDaysB.size).toBe(8);
  });

  it("meets threshold for active users", () => {
    const thresholds = queryK1MeetsThreshold(K1_DAILY_COUNTS, 1, 7);
    expect(thresholds[USER_A.userId]).toBe(true);
    expect(thresholds[USER_B.userId]).toBe(true);
  });
});

describe("K2 — time-to-first-value", () => {
  it("calculates latency between meal_content_received and draft_reply_sent", () => {
    const latency = queryK2LatencyMs(METRIC_EVENTS, "req-k2-a");
    expect(latency).toBe(5000);
  });
});

describe("K3 — voice latency", () => {
  it("calculates p95 and p100 correctly", () => {
    const result = queryK3VoiceLatency(METRIC_EVENTS, 30);
    expect(result.p95Ms).toBe(7000);
    expect(result.p100Ms).toBe(7000);
  });
});

describe("K4 — cross-user audit", () => {
  it("passes when no cross-user references", () => {
    const result = queryK4CrossUserAudit(TENANT_AUDIT_RUNS);
    expect(result.crossUserReferences).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("fails with missing audit runs", () => {
    const result = queryK4CrossUserAudit([]);
    expect(result.crossUserReferences).toBe(-1);
    expect(result.passed).toBe(false);
  });
});

describe("K5 — monthly spend", () => {
  it("calculates total estimated USD and budget status", () => {
    const now = new Date();
    const monthUtc = now.toISOString().slice(0, 7);
    const result = queryK5MonthlySpend(COST_EVENTS, 10, monthUtc);
    // twoDaysAgo is Apr 30 so falls outside monthUtc "2026-05"; only 3 of 4 events match
    expect(result.totalEstimatedUsd).toBeCloseTo(0.18, 2);
    expect(result.withinBudget).toBe(true);
    expect(result.degradeModeActive).toBe(false);
  });
});

describe("K6 — weekly retention", () => {
  it("counts active days correctly", () => {
    const activeDays = queryK6ActiveDays(ALL_MEALS, USER_A.userId);
    // 8 unique non-deleted meal dates for user A
    expect(activeDays.size).toBe(8);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

    const retention = queryK6WeeklyRetention(
      activeDays,
      sevenDaysAgo,
      today
    );

    expect(retention.metThreshold).toBe(true);
  });
});

describe("K7 — KBJU accuracy", () => {
  it("calculates accuracy against tolerance", () => {
    const allLabels = [...K7_LABELS_A, ...K7_LABELS_B];
    const result = queryK7Accuracy(allLabels, 10, 10, 5, 5);

    expect(result.totalLabeled).toBe(4);
    expect(result.mealsWithinCalorieBounds).toBe(4);
    expect(result.mealsWithinMacroBounds).toBe(4);
    expect(result.withinK7Targets).toBe(true);
  });
});
