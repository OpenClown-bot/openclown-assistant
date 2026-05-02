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
import { formatPilotReadinessReport } from "../../src/pilot/pilotReadinessReport.js";
import {
  USER_A,
  USER_B,
  ALL_MEALS,
  METRIC_EVENTS,
  TENANT_AUDIT_RUNS,
  COST_EVENTS,
  K7_LABELS_A,
  K7_LABELS_B,
  buildPilotReadinessData,
} from "../pilot/fixtures.js";

const K1_TARGET_MEALS_PER_DAY = 1;
const K1_TARGET_DAYS = 7;
const K3_P95_TIMEOUT_MS = 8000;
const K3_P100_TIMEOUT_MS = 30000;
const K5_MONTHLY_CEILING_USD = 10;
const K6_RETENTION_THRESHOLD = 7;
const K7_CALORIE_TOLERANCE = 10;
const K7_MACRO_TOLERANCE = 10;

describe("pilot KPI smoke — end-to-end", () => {
  it("K1: both users maintain daily meal streaks", () => {
    const dailyMeals = queryK1DailyConfirmedMeals(ALL_MEALS);
    const thresholds = queryK1MeetsThreshold(
      dailyMeals,
      K1_TARGET_MEALS_PER_DAY,
      K1_TARGET_DAYS,
    );
    expect(thresholds[USER_A.userId]).toBe(true);
    expect(thresholds[USER_B.userId]).toBe(true);
  });

  it("K2: first-value latency is reasonable for known request", () => {
    const latency = queryK2LatencyMs(METRIC_EVENTS, "req-k2-a");
    expect(latency).not.toBeNull();
    expect(latency as number).toBeLessThan(10000);
  });

  it("K3: voice latency p95/p100 within targets", () => {
    const result = queryK3VoiceLatency(METRIC_EVENTS, 30);
    expect(result.p95Ms).not.toBeNull();
    expect(result.p100Ms).not.toBeNull();
    expect(result.p95Ms as number).toBeLessThanOrEqual(K3_P95_TIMEOUT_MS);
    expect(result.p100Ms as number).toBeLessThanOrEqual(K3_P100_TIMEOUT_MS);
  });

  it("K4: zero cross-user references", () => {
    const audit = queryK4CrossUserAudit(TENANT_AUDIT_RUNS);
    expect(audit.crossUserReferences).toBe(0);
    expect(audit.passed).toBe(true);
  });

  it("K5: monthly spend within budget", () => {
    const monthUtc = new Date().toISOString().slice(0, 7);
    const spend = queryK5MonthlySpend(COST_EVENTS, K5_MONTHLY_CEILING_USD, monthUtc);
    expect(spend.totalEstimatedUsd).toBeGreaterThanOrEqual(0);
    expect(spend.withinBudget).toBe(true);
    expect(spend.degradeModeActive).toBe(false);
  });

  it("K6: weekly retention hits threshold for both users", () => {
    for (const user of [USER_A, USER_B]) {
      const activeDays = queryK6ActiveDays(ALL_MEALS, user.userId);
      const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const weekEnd = new Date().toISOString().slice(0, 10);
      const retention = queryK6WeeklyRetention(activeDays, weekStart, weekEnd);
      expect(retention.activeDaysInWeek).toBeGreaterThanOrEqual(K6_RETENTION_THRESHOLD);
    }
  });

  it("K7: KBJU accuracy within tolerance", () => {
    const allLabels = [...K7_LABELS_A, ...K7_LABELS_B];
    const accuracy = queryK7Accuracy(
      allLabels,
      K7_CALORIE_TOLERANCE,
      K7_MACRO_TOLERANCE,
      5,
      5,
    );
    expect(accuracy.totalLabeled).toBeGreaterThan(0);
    expect(accuracy.mealsWithinCalorieBounds).toBe(allLabels.length);
    expect(accuracy.mealsWithinMacroBounds).toBe(allLabels.length);
    expect(accuracy.withinK7Targets).toBe(true);
  });
});

describe("pilot readiness report — redaction & summary", () => {
  it("prints ready when all KPIs pass", () => {
    const data = buildPilotReadinessData();
    const report = formatPilotReadinessReport(data);
    expect(report).toContain("READY");
    expect(report).toContain("K1");
    expect(report).toContain("K3");
    expect(report).toContain("K4");
    expect(report).toContain("K5");
    expect(report).toContain("K6");
    expect(report).toContain("K7");
  });

  it("redacts sensitive identifiers in K1", () => {
    const data = buildPilotReadinessData();
    const report = formatPilotReadinessReport(data);
    expect(report).not.toContain("90000");
    expect(report).not.toContain("username");
    expect(report).not.toContain("first_name");
  });
});
