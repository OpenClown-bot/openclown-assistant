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
  ALL_K7_LABELS,
  FIXED_MONTH_UTC,
  FIXED_NOW,
  FIXED_WEEK_END,
  FIXED_WEEK_START,
  SENSITIVE_SENTINELS,
  buildPilotReadinessData,
  buildSmokeStore,
  confirmPhotoDraft,
  createLowConfidencePhotoDraft,
  deliverSummaryWithGuard,
  freshOnboardUser,
  renderUserInbox,
  rightToDeleteUser,
} from "../pilot/fixtures.js";

const K1_TARGET_MEALS_PER_DAY = 1;
const K1_TARGET_DAYS = 7;
const K3_P95_TIMEOUT_MS = 8000;
const K3_P100_TIMEOUT_MS = 30000;
const K5_MONTHLY_CEILING_USD = 10;
const K6_RETENTION_THRESHOLD = 7;
const K7_CALORIE_TOLERANCE = 10;
const K7_MACRO_TOLERANCE = 10;

describe("pilot KPI smoke - K1-K7 readiness", () => {
  it("calculates all pilot KPI pass conditions from deterministic fixtures", () => {
    const dailyMeals = queryK1DailyConfirmedMeals(ALL_MEALS);
    const thresholds = queryK1MeetsThreshold(
      dailyMeals,
      K1_TARGET_MEALS_PER_DAY,
      K1_TARGET_DAYS,
    );
    expect(thresholds[USER_A.userId]).toBe(true);
    expect(thresholds[USER_B.userId]).toBe(true);

    const latency = queryK2LatencyMs(METRIC_EVENTS, "req-k2-a");
    expect(latency).not.toBeNull();
    expect(latency as number).toBeLessThan(10000);

    const voiceLatency = queryK3VoiceLatency(METRIC_EVENTS, 30, FIXED_NOW);
    expect(voiceLatency.p95Ms as number).toBeLessThanOrEqual(K3_P95_TIMEOUT_MS);
    expect(voiceLatency.p100Ms as number).toBeLessThanOrEqual(K3_P100_TIMEOUT_MS);

    const audit = queryK4CrossUserAudit(TENANT_AUDIT_RUNS);
    expect(audit.crossUserReferences).toBe(0);
    expect(audit.passed).toBe(true);

    const spend = queryK5MonthlySpend(
      COST_EVENTS,
      K5_MONTHLY_CEILING_USD,
      FIXED_MONTH_UTC,
    );
    expect(spend.withinBudget).toBe(true);
    expect(spend.degradeModeActive).toBe(false);

    for (const user of [USER_A, USER_B]) {
      const activeDays = queryK6ActiveDays(ALL_MEALS, user.userId);
      const retention = queryK6WeeklyRetention(
        activeDays,
        FIXED_WEEK_START,
        FIXED_WEEK_END,
      );
      expect(retention.activeDaysInWeek).toBeGreaterThanOrEqual(K6_RETENTION_THRESHOLD);
    }

    const accuracy = queryK7Accuracy(
      ALL_K7_LABELS,
      K7_CALORIE_TOLERANCE,
      K7_MACRO_TOLERANCE,
      5,
      5,
    );
    expect(accuracy.totalLabeled).toBeGreaterThan(0);
    expect(accuracy.mealsWithinCalorieBounds).toBe(ALL_K7_LABELS.length);
    expect(accuracy.mealsWithinMacroBounds).toBe(ALL_K7_LABELS.length);
    expect(accuracy.withinK7Targets).toBe(true);
  });
});

describe("pilot behavioral smoke ACs", () => {
  it("does not deliver user A meal, summary, history, transcript, or audit data to user B", () => {
    const store = buildSmokeStore();
    const inboxB = renderUserInbox(store, USER_B.userId).map((message) => message.text);
    const joined = inboxB.join("\n");

    expect(joined).toContain("meal B private text");
    expect(joined).toContain("summary B private totals");
    expect(joined).toContain("history B private correction");
    expect(joined).toContain("transcript B private voice");
    expect(joined).toContain("audit B private meal_created");
    expect(joined).not.toContain("meal A private text");
    expect(joined).not.toContain("summary A private totals");
    expect(joined).not.toContain("history A private correction");
    expect(joined).not.toContain("transcript A private voice");
    expect(joined).not.toContain("audit A private meal_created");
  });

  it("labels low-confidence photo output and does not persist it before confirmation", () => {
    const store = buildSmokeStore();
    const beforeCount = store.meals.filter((meal) => meal.userId === USER_A.userId).length;
    const reply = createLowConfidencePhotoDraft(store, USER_A.userId);

    expect(reply.text).toContain("низкая уверенность");
    expect(store.drafts).toHaveLength(1);
    expect(store.meals.filter((meal) => meal.userId === USER_A.userId)).toHaveLength(beforeCount);

    confirmPhotoDraft(store, USER_A.userId, "photo-draft-low-confidence");
    expect(store.meals.filter((meal) => meal.userId === USER_A.userId)).toHaveLength(beforeCount + 1);
  });

  it("blocks forbidden-topic summary output and delivers deterministic fallback", () => {
    const store = buildSmokeStore();
    const delivered = deliverSummaryWithGuard(
      store,
      USER_A.userId,
      "Поставьте диагноз и измените дозу лекарств",
    );

    expect(delivered).toBe(
      "Детерминированная рекомендация: сверяйте КБЖУ с целью и корректируйте порции.",
    );
    expect(delivered).not.toContain("диагноз");
    expect(delivered).not.toContain("лекарств");
  });

  it("right-to-delete removes all user A data and allows fresh onboarding", () => {
    const store = buildSmokeStore();
    createLowConfidencePhotoDraft(store, USER_A.userId);
    rightToDeleteUser(store, USER_A.userId);

    expect(renderUserInbox(store, USER_A.userId)).toEqual([]);
    expect(store.drafts.some((draft) => draft.userId === USER_A.userId)).toBe(false);
    expect(store.users.has(USER_A.userId)).toBe(false);
    expect(renderUserInbox(store, USER_B.userId).length).toBeGreaterThan(0);

    freshOnboardUser(store, USER_A.userId);
    expect(store.users.has(USER_A.userId)).toBe(true);
  });
});

describe("pilot readiness report - redaction and summary", () => {
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

  it("omits sensitive identifiers and payload sentinel strings", () => {
    const data = buildPilotReadinessData();
    const report = formatPilotReadinessReport(data);

    for (const sentinel of Object.values(SENSITIVE_SENTINELS)) {
      expect(report).not.toContain(sentinel);
    }
    expect(report).not.toContain(USER_A.telegramUserId);
    expect(report).not.toContain(USER_A.username);
    expect(report).not.toContain("username");
    expect(report).not.toContain("first_name");
    expect(report).not.toContain("provider_key");
    expect(report).not.toContain("raw_media");
  });
});
