import type {
  ConfirmedMealRow,
  CostEventRow,
  KbjuAccuracyLabelRow,
  TenantAuditRunRow,
  MetricEventRow,
} from "../store/types.js";

// ---------------------------------------------------------------------------
// K1 — daily confirmed meals per active pilot user
// ---------------------------------------------------------------------------

export interface K1DailyMealCount {
  userId: string;
  mealLocalDate: string;
  count: number;
}

export function queryK1DailyConfirmedMeals(
  meals: ConfirmedMealRow[],
): K1DailyMealCount[] {
  const active = meals.filter((m) => m.deleted_at == null);
  const index = new Map<string, number>();
  for (const m of active) {
    const key = `${m.user_id}||${m.meal_local_date}`;
    index.set(key, (index.get(key) ?? 0) + 1);
  }
  return Array.from(index.entries()).map(([key, count]) => {
    const [userId, mealLocalDate] = key.split("||");
    return { userId, mealLocalDate, count };
  });
}

export function queryK1MeetsThreshold(
  dailyCounts: K1DailyMealCount[],
  targetMealsPerDay: number,
  targetDays: number,
  expectedUserIds?: readonly string[],
): Record<string, boolean> {
  const userDays = new Map<string, number>();
  for (const c of dailyCounts) {
    if (c.count >= targetMealsPerDay) {
      userDays.set(c.userId, (userDays.get(c.userId) ?? 0) + 1);
    }
  }
  const result: Record<string, boolean> = {};
  for (const [userId, days] of userDays) {
    result[userId] = days >= targetDays;
  }
  if (expectedUserIds) {
    for (const userId of expectedUserIds) {
      if (!(userId in result)) {
        result[userId] = false;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// K2 — time-to-first-value: seconds from first meal_content_received to
//         first draft_reply_sent per request
// ---------------------------------------------------------------------------

export function queryK2LatencyMs(
  metrics: MetricEventRow[],
  requestId: string,
): number | null {
  const filtered = metrics
    .filter((m) => m.request_id === requestId && m.created_at)
    .map((m) => ({ metric: m, time: new Date(m.created_at).getTime() }))
    .filter((m) => Number.isFinite(m.time))
    .sort((a, b) => a.time - b.time);
  const received = filtered.find(
    (m) => m.metric.event_name === "meal_content_received",
  );
  if (!received) {
    return null;
  }
  const reply = filtered.find(
    (m) => m.metric.event_name === "draft_reply_sent" && m.time >= received.time,
  );
  if (!reply) {
    return null;
  }
  return reply.time - received.time;
}

// ---------------------------------------------------------------------------
// K3 — voice round-trip latency p95 / p100
// ---------------------------------------------------------------------------

export interface K3LatencyResult {
  p95Ms: number | null;
  p100Ms: number | null;
}

export function queryK3VoiceLatency(
  metrics: MetricEventRow[],
  windowDays: number,
  nowUtc = new Date().toISOString(),
): K3LatencyResult {
  const now = new Date(nowUtc);
  const cutoff = new Date(now.getTime() - windowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const voiceMetrics = metrics.filter(
    (m) =>
      m.event_name === "voice_transcription_completed" &&
      m.created_at >= cutoff &&
      m.latency_ms != null &&
      typeof m.metadata.audio_duration_seconds === "number" &&
      m.metadata.audio_duration_seconds <= 15,
  );
  if (voiceMetrics.length === 0) {
    return { p95Ms: null, p100Ms: null };
  }
  const sorted = voiceMetrics
    .map((m) => m.latency_ms as number)
    .sort((a, b) => a - b);
  const p95Index = Math.ceil(0.95 * sorted.length) - 1;
  return {
    p95Ms: sorted[p95Index],
    p100Ms: sorted[sorted.length - 1],
  };
}

// ---------------------------------------------------------------------------
// K4 — tenant audit cross-user reference count must be zero
// ---------------------------------------------------------------------------

export function queryK4CrossUserAudit(
  auditRuns: TenantAuditRunRow[],
): { crossUserReferences: number; passed: boolean } {
  if (auditRuns.length === 0) {
    return { crossUserReferences: -1, passed: false };
  }
  const latest = auditRuns.reduce((selected, current) => {
    const selectedTime = selected.completed_at
      ? new Date(selected.completed_at).getTime()
      : -Infinity;
    const currentTime = current.completed_at
      ? new Date(current.completed_at).getTime()
      : -Infinity;
    return currentTime > selectedTime ? current : selected;
  });
  return {
    crossUserReferences: latest.cross_user_reference_count,
    passed: latest.cross_user_reference_count === 0,
  };
}

// ---------------------------------------------------------------------------
// K5 — monthly LLM + voice transcription spend
// ---------------------------------------------------------------------------

export interface K5SpendResult {
  totalEstimatedUsd: number;
  withinBudget: boolean;
  degradeModeActive: boolean;
}

export function queryK5MonthlySpend(
  costEvents: CostEventRow[],
  monthlyCeilingUsd: number,
  monthUtc: string,
): K5SpendResult {
  const filtered = costEvents.filter((e) => e.created_at.startsWith(monthUtc));
  const totalEstimatedUsd = filtered.reduce(
    (sum, e) => sum + e.estimated_cost_usd,
    0,
  );
  return {
    totalEstimatedUsd,
    withinBudget: totalEstimatedUsd <= monthlyCeilingUsd,
    degradeModeActive: totalEstimatedUsd > monthlyCeilingUsd * 0.8,
  };
}

// ---------------------------------------------------------------------------
// K6 — weekly retention: active days with >=1 confirmed meal
// ---------------------------------------------------------------------------

export function queryK6ActiveDays(
  meals: ConfirmedMealRow[],
  userId: string,
): Set<string> {
  const active = meals.filter(
    (m) => m.user_id === userId && m.deleted_at == null,
  );
  return new Set(active.map((m) => m.meal_local_date));
}

export function queryK6WeeklyRetention(
  activeDays: Set<string>,
  weekStart: string,
  weekEnd: string,
): { activeDaysInWeek: number; daysInWeek: number; metThreshold: boolean } {
  const datesInRange: string[] = [];
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    datesInRange.push(d.toISOString().slice(0, 10));
  }
  const activeCount = datesInRange.filter((date) => activeDays.has(date))
    .length;
  return {
    activeDaysInWeek: activeCount,
    daysInWeek: datesInRange.length,
    metThreshold: activeCount === datesInRange.length,
  };
}

// ---------------------------------------------------------------------------
// K7 — KBJU estimation accuracy vs ground truth
// ---------------------------------------------------------------------------

export interface K7AccuracyResult {
  mealsWithinCalorieBounds: number;
  mealsWithinMacroBounds: number;
  totalLabeled: number;
  dailyCalorieAccuracy: Map<string, { totalError: number; count: number }>;
  dailyMacroAccuracy: Map<string, { totalError: number; count: number }>;
  withinK7Targets: boolean;
}

export function queryK7Accuracy(
  labels: KbjuAccuracyLabelRow[],
  calorieTolerance: number,
  macroTolerance: number,
  dailyCalorieTolerance: number,
  dailyMacroTolerance: number,
): K7AccuracyResult {
  let mealsWithinCal = 0;
  let mealsWithinMacro = 0;
  const dailyCalMap = new Map<
    string,
    { totalError: number; count: number }
  >();
  const dailyMacroMap = new Map<
    string,
    { totalError: number; count: number }
  >();

  for (const label of labels) {
    const calError = Math.abs(label.calorie_error_pct);
    const maxMacroError = Math.max(
      Math.abs(label.protein_error_pct),
      Math.abs(label.fat_error_pct),
      Math.abs(label.carbs_error_pct),
    );

    if (calError <= calorieTolerance) mealsWithinCal++;
    if (maxMacroError <= macroTolerance) mealsWithinMacro++;

    const day = label.created_at.slice(0, 10);
    const existing = dailyCalMap.get(day) ?? { totalError: 0, count: 0 };
    dailyCalMap.set(day, {
      totalError: existing.totalError + calError,
      count: existing.count + 1,
    });
    const existingMacro = dailyMacroMap.get(day) ?? { totalError: 0, count: 0 };
    dailyMacroMap.set(day, {
      totalError: existingMacro.totalError + maxMacroError,
      count: existingMacro.count + 1,
    });
  }

  let withinK7Targets =
    labels.length > 0 &&
    mealsWithinCal === labels.length &&
    mealsWithinMacro === labels.length;

  if (withinK7Targets) {
    for (const [, daily] of dailyCalMap) {
      const avgCalError = daily.count > 0 ? daily.totalError / daily.count : 0;
      if (avgCalError > dailyCalorieTolerance) {
        withinK7Targets = false;
        break;
      }
    }
  }

  if (withinK7Targets) {
    for (const [, daily] of dailyMacroMap) {
      const avgMacroError = daily.count > 0 ? daily.totalError / daily.count : 0;
      if (avgMacroError > dailyMacroTolerance) {
        withinK7Targets = false;
        break;
      }
    }
  }

  return {
    mealsWithinCalorieBounds: mealsWithinCal,
    mealsWithinMacroBounds: mealsWithinMacro,
    totalLabeled: labels.length,
    dailyCalorieAccuracy: dailyCalMap,
    dailyMacroAccuracy: dailyMacroMap,
    withinK7Targets,
  };
}
