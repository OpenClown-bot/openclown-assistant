import type {
  K1DailyMealCount,
  K3LatencyResult,
  K5SpendResult,
  K7AccuracyResult,
} from "./kpiQueries.js";

export interface PilotReadinessData {
  k1UserThresholds: Record<string, boolean>;
  k3VoiceLatency: K3LatencyResult;
  k4CrossUserAudit: { crossUserReferences: number; passed: boolean };
  k5Spend: K5SpendResult;
  k6WeeklyRetentions: Record<
    string,
    { activeDaysInWeek: number; daysInWeek: number; metThreshold: boolean }
  >;
  k7Accuracy: K7AccuracyResult;
  totalUsers: number;
  reportGeneratedAtUtc: string;
  diagnostics?: unknown;
}

const FORBIDDEN_PATTERNS = [
  /\b\d{9,}\b/g,
  /["']?telegram["']?\s*\d+/gi,
  /["']?tg_user_id["']?\s*:\s*["']?\d+/gi,
  /["']?telegram_id["']?\s*:\s*["']?\d+/gi,
  /["']?username["']?\s*:\s*["'][^"']+["']/gi,
  /["']?first_name["']?\s*:\s*["'][^"']+["']/gi,
  /["']?last_name["']?\s*:\s*["'][^"']+["']/gi,
  /raw[_-]?meal[_-]?text[^\n]*/gi,
  /transcript[_-]?text[^\n]*/gi,
  /provider[_-]?prompt[^\n]*/gi,
  /provider[_-]?(key|token)[^\n]*/gi,
  /raw[_-]?media[^\n]*/gi,
  /sk-[A-Za-z0-9_-]+/g,
];

function redactValue(value: string): string {
  let result = value;
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function redactK1Report(thresholds: Record<string, boolean>): Record<string, boolean> {
  return thresholds;
}

function redactK7Report(k7: K7AccuracyResult): K7AccuracyResult {
  return {
    mealsWithinCalorieBounds: k7.mealsWithinCalorieBounds,
    mealsWithinMacroBounds: k7.mealsWithinMacroBounds,
    totalLabeled: k7.totalLabeled,
    dailyCalorieAccuracy: new Map(),
    withinK7Targets: k7.withinK7Targets,
  };
}

export function formatPilotReadinessReport(data: PilotReadinessData): string {
  const lines: string[] = [];

  lines.push("=== PILOT READINESS REPORT ===");
  lines.push(`Generated: ${data.reportGeneratedAtUtc}`);
  lines.push(`Users evaluated: ${data.totalUsers}`);
  lines.push("");

  lines.push("--- K1: Daily Confirmed Meals ---");
  const k1Entries = Object.entries(data.k1UserThresholds);
  const k1Pass = k1Entries.length > 0 && k1Entries.every(([, passes]) => passes);
  lines.push(`  All users meet threshold: ${k1Pass ? "PASS" : "FAIL"}`);
  for (const [userId, passes] of Object.entries(data.k1UserThresholds)) {
    lines.push(`  ${redactValue(userId)}: ${passes ? "PASS" : "FAIL"}`);
  }
  lines.push("");

  lines.push("--- K3: Voice Latency ---");
  const k3 = data.k3VoiceLatency;
  lines.push(`  p95: ${k3.p95Ms ?? "N/A"} ms`);
  lines.push(`  p100: ${k3.p100Ms ?? "N/A"} ms`);
  const k3Pass = (k3.p95Ms ?? Infinity) <= 8000 && (k3.p100Ms ?? Infinity) <= 30000;
  lines.push(`  Within target: ${k3Pass ? "PASS" : "FAIL"}`);
  lines.push("");

  lines.push("--- K4: Cross-User Audit ---");
  lines.push(`  Cross-user references: ${data.k4CrossUserAudit.crossUserReferences}`);
  lines.push(`  Zero leakage: ${data.k4CrossUserAudit.passed ? "PASS" : "FAIL"}`);
  lines.push("");

  lines.push("--- K5: Monthly Spend ---");
  lines.push(`  Total estimated: $${data.k5Spend.totalEstimatedUsd.toFixed(2)}`);
  lines.push(`  Within $10 budget: ${data.k5Spend.withinBudget ? "PASS" : "WARN"}`);
  lines.push(`  Degrade mode active: ${data.k5Spend.degradeModeActive}`);
  lines.push("");

  lines.push("--- K6: Weekly Retention ---");
  for (const [userId, retention] of Object.entries(data.k6WeeklyRetentions)) {
    lines.push(
      `  ${redactValue(userId)}: ${retention.activeDaysInWeek}/${retention.daysInWeek} days - ${retention.metThreshold ? "PASS" : "FAIL"}`,
    );
  }
  lines.push("");

  lines.push("--- K7: KBJU Accuracy ---");
  const k7Report = redactK7Report(data.k7Accuracy);
  lines.push(`  Meals within calorie bounds: ${k7Report.mealsWithinCalorieBounds}/${k7Report.totalLabeled}`);
  lines.push(`  Meals within macro bounds: ${k7Report.mealsWithinMacroBounds}/${k7Report.totalLabeled}`);
  lines.push(`  Within K7 targets: ${k7Report.withinK7Targets ? "PASS" : "FAIL"}`);
  lines.push("");

  const allPass =
    k1Pass &&
    k3Pass &&
    data.k4CrossUserAudit.passed &&
    data.k5Spend.withinBudget &&
    Object.values(data.k6WeeklyRetentions).every((r) => r.metThreshold) &&
    data.k7Accuracy.withinK7Targets;

  lines.push(`=== OVERALL: ${allPass ? "READY" : "NOT READY"} ===`);
  return redactValue(lines.join("\n"));
}
