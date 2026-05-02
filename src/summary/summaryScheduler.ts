import type { PeriodType, KBJUValues, OpenClawLogger } from "../shared/types.js";
import type {
  SummaryAggregate,
  SummaryDeltas,
  PreviousPeriodComparison,
  DueSchedule,
  ProcessScheduleResult,
  SummaryRecommendationInput,
} from "./types.js";
import type { TenantStore, ConfirmedMealRow } from "../store/types.js";
import { loadPersona } from "./personaLoader.js";
import {
  buildRecommendationPrompt,
  validateRecommendationOutput,
  buildDeterministicFallback,
} from "./recommendationGuard.js";
import { NO_MEAL_NUDGE_RU } from "./messages.js";
import type { OmniRouteConfig, OmniRouteCallOptions, OmniRouteCallResult } from "../llm/omniRouteClient.js";
import { callOmniRoute as realCallOmniRoute } from "../llm/omniRouteClient.js";
import type { SpendTracker } from "../observability/costGuard.js";
import { buildRedactedEvent, emitLog } from "../observability/events.js";
import { KPI_EVENT_NAMES } from "../observability/kpiEvents.js";

export type OmniRouteCaller = (config: OmniRouteConfig, options: OmniRouteCallOptions) => Promise<OmniRouteCallResult>;

export interface SummarySchedulerDeps {
  store: TenantStore;
  omniRouteConfig: OmniRouteConfig;
  spendTracker: SpendTracker;
  logger: OpenClawLogger;
  personaPath: string;
  callOmniRoute?: OmniRouteCaller;
}

export function validateTimezone(timezone: string): void {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`Invalid IANA timezone: "${timezone}"`);
  }
}

function parseLocalDate(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid local date format: "${dateStr}", expected YYYY-MM-DD`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatCalendarDate(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month];
}

function dayOfWeekUtc(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function computePeriodBounds(
  periodType: PeriodType,
  referenceDate: string,
  timezone: string,
): { periodStart: string; periodEnd: string } {
  validateTimezone(timezone);

  const { year, month, day } = parseLocalDate(referenceDate);

  switch (periodType) {
    case "daily":
      return { periodStart: referenceDate, periodEnd: referenceDate };
    case "weekly": {
      const dow = dayOfWeekUtc(year, month, day);
      const mondayDay = day - (dow - 1);
      const monday = normalizeDate(year, month, mondayDay);
      const sundayDay = monday.day + 6;
      const sunday = normalizeDate(monday.year, monday.month, sundayDay);
      return {
        periodStart: formatCalendarDate(monday.year, monday.month, monday.day),
        periodEnd: formatCalendarDate(sunday.year, sunday.month, sunday.day),
      };
    }
    case "monthly": {
      const lastDay = daysInMonth(year, month);
      return {
        periodStart: formatCalendarDate(year, month, 1),
        periodEnd: formatCalendarDate(year, month, lastDay),
      };
    }
  }
}

function normalizeDate(year: number, month: number, day: number): { year: number; month: number; day: number } {
  while (day < 1) {
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    day += daysInMonth(year, month);
  }
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return { year, month, day };
}

export function buildIdempotencyKey(
  userId: string,
  periodType: PeriodType,
  periodStart: string,
): string {
  return `${userId}:${periodType}:${periodStart}`;
}

export function aggregateMeals(meals: ConfirmedMealRow[]): SummaryAggregate {
  let totalCaloriesKcal = 0;
  let totalProteinG = 0;
  let totalFatG = 0;
  let totalCarbsG = 0;
  for (const meal of meals) {
    totalCaloriesKcal += meal.total_calories_kcal;
    totalProteinG += meal.total_protein_g;
    totalFatG += meal.total_fat_g;
    totalCarbsG += meal.total_carbs_g;
  }
  return {
    totalCaloriesKcal: Math.round(totalCaloriesKcal),
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
    totalCarbsG: Math.round(totalCarbsG * 10) / 10,
    mealCount: meals.length,
  };
}

export function computeDeltas(aggregate: SummaryAggregate, targets: KBJUValues): SummaryDeltas {
  return {
    deltaCaloriesKcal: aggregate.totalCaloriesKcal - targets.caloriesKcal,
    deltaProteinG: Math.round((aggregate.totalProteinG - targets.proteinG) * 10) / 10,
    deltaFatG: Math.round((aggregate.totalFatG - targets.fatG) * 10) / 10,
    deltaCarbsG: Math.round((aggregate.totalCarbsG - targets.carbsG) * 10) / 10,
  };
}

export function computePreviousPeriodComparison(
  current: SummaryAggregate,
  previous: SummaryAggregate | null,
): PreviousPeriodComparison | null {
  if (previous === null) return null;
  return {
    deltaCaloriesKcal: current.totalCaloriesKcal - previous.totalCaloriesKcal,
    deltaProteinG: Math.round((current.totalProteinG - previous.totalProteinG) * 10) / 10,
    deltaFatG: Math.round((current.totalFatG - previous.totalFatG) * 10) / 10,
    deltaCarbsG: Math.round((current.totalCarbsG - previous.totalCarbsG) * 10) / 10,
  };
}

export function periodTypeToTargetMultiplier(periodType: PeriodType): number {
  switch (periodType) {
    case "daily": return 1;
    case "weekly": return 7;
    case "monthly": return 30;
  }
}

export function computePeriodTargets(dailyTargets: KBJUValues, periodType: PeriodType): KBJUValues {
  const m = periodTypeToTargetMultiplier(periodType);
  return {
    caloriesKcal: dailyTargets.caloriesKcal * m,
    proteinG: dailyTargets.proteinG * m,
    fatG: dailyTargets.fatG * m,
    carbsG: dailyTargets.carbsG * m,
  };
}

export interface ProcessScheduleOptions {
  dailyTargets: KBJUValues;
  previousPeriodMeals?: ConfirmedMealRow[];
}

export async function processDueSchedule(
  deps: SummarySchedulerDeps,
  schedule: DueSchedule,
  requestId: string,
  degradeModeEnabled: boolean,
  options: ProcessScheduleOptions,
): Promise<ProcessScheduleResult> {
  const { store, omniRouteConfig, spendTracker, logger, personaPath } = deps;
  const doLlmCall = deps.callOmniRoute ?? realCallOmniRoute;

  const referenceDate = schedule.localTime;
  const { periodStart, periodEnd } = computePeriodBounds(schedule.periodType, referenceDate, schedule.timezone);

  const idempotencyKey = buildIdempotencyKey(schedule.userId, schedule.periodType, periodStart);

  if (schedule.lastDuePeriodStart === periodStart) {
    logger.info("summary_schedule_already_processed", {
      user_id: schedule.userId,
      period_type: schedule.periodType,
      period_start: periodStart,
    });
    return {
      idempotencyKey,
      periodStartLocalDate: periodStart,
      periodEndLocalDate: periodEnd,
      totals: { totalCaloriesKcal: 0, totalProteinG: 0, totalFatG: 0, totalCarbsG: 0, mealCount: 0 },
      deltas: { deltaCaloriesKcal: 0, deltaProteinG: 0, deltaFatG: 0, deltaCarbsG: 0 },
      previousPeriodComparison: null,
      recommendationTextRu: null,
      recommendationMode: "no_meal_nudge",
      blockedReason: null,
      skipped: true,
    };
  }

  const meals = await store.listConfirmedMeals(schedule.userId, {
    mealLocalDateFrom: periodStart,
    mealLocalDateTo: periodEnd,
    includeDeleted: false,
    limit: 10000,
    offset: 0,
  });

  const aggregate = aggregateMeals(meals);
  const periodTargets = computePeriodTargets(options.dailyTargets, schedule.periodType);
  const deltas = computeDeltas(aggregate, periodTargets);

  const previousAggregate = options.previousPeriodMeals
    ? aggregateMeals(options.previousPeriodMeals)
    : null;
  const prevComparison = computePreviousPeriodComparison(aggregate, previousAggregate);

  if (aggregate.mealCount === 0) {
    const result: ProcessScheduleResult = {
      idempotencyKey,
      periodStartLocalDate: periodStart,
      periodEndLocalDate: periodEnd,
      totals: aggregate,
      deltas,
      previousPeriodComparison: prevComparison,
      recommendationTextRu: NO_MEAL_NUDGE_RU,
      recommendationMode: "no_meal_nudge",
      blockedReason: null,
      skipped: false,
    };

    await persistRecord(store, schedule.userId, schedule.periodType, result);
    return result;
  }

  const recommendationInput: SummaryRecommendationInput = {
    aggregate,
    deltas,
    previousPeriodComparison: prevComparison,
    targets: periodTargets,
    periodType: schedule.periodType,
    periodStartLocalDate: periodStart,
  };

  const persona = loadPersona(personaPath, logger);
  const { systemPrompt, userContent } = buildRecommendationPrompt(persona, recommendationInput);

  let llmResult: OmniRouteCallResult;
  try {
    llmResult = await doLlmCall(omniRouteConfig, {
      callType: "text_llm",
      systemPrompt,
      userContent,
      requestId,
      userId: schedule.userId,
      degradeModeEnabled,
      logger,
      spendTracker,
    });
  } catch {
    const fallbackText = buildDeterministicFallback(aggregate, periodTargets);
    const result: ProcessScheduleResult = {
      idempotencyKey,
      periodStartLocalDate: periodStart,
      periodEndLocalDate: periodEnd,
      totals: aggregate,
      deltas,
      previousPeriodComparison: prevComparison,
      recommendationTextRu: fallbackText,
      recommendationMode: "deterministic_fallback",
      blockedReason: "llm_call_failed",
      skipped: false,
    };
    await persistRecord(store, schedule.userId, schedule.periodType, result);
    return result;
  }

  if (llmResult.outcome !== "success") {
    const fallbackText = buildDeterministicFallback(aggregate, periodTargets);
    const result: ProcessScheduleResult = {
      idempotencyKey,
      periodStartLocalDate: periodStart,
      periodEndLocalDate: periodEnd,
      totals: aggregate,
      deltas,
      previousPeriodComparison: prevComparison,
      recommendationTextRu: fallbackText,
      recommendationMode: "deterministic_fallback",
      blockedReason: `llm_outcome:${llmResult.outcome}`,
      skipped: false,
    };
    await persistRecord(store, schedule.userId, schedule.periodType, result);
    return result;
  }

  const validation = validateRecommendationOutput(llmResult.rawResponseText);

  if (!validation.valid) {
    const fallbackText = buildDeterministicFallback(aggregate, periodTargets);
    emitLog(logger, buildRedactedEvent(
      "warn",
      "kbju-summary",
      "C9",
      KPI_EVENT_NAMES.summary_recommendation_blocked,
      requestId,
      schedule.userId,
      "validation_blocked",
      degradeModeEnabled,
      { blocked_reason: validation.blockedReason },
    ));
    const result: ProcessScheduleResult = {
      idempotencyKey,
      periodStartLocalDate: periodStart,
      periodEndLocalDate: periodEnd,
      totals: aggregate,
      deltas,
      previousPeriodComparison: prevComparison,
      recommendationTextRu: fallbackText,
      recommendationMode: "deterministic_fallback",
      blockedReason: validation.blockedReason,
      skipped: false,
    };
    await persistRecord(store, schedule.userId, schedule.periodType, result);
    return result;
  }

  const result: ProcessScheduleResult = {
    idempotencyKey,
    periodStartLocalDate: periodStart,
    periodEndLocalDate: periodEnd,
    totals: aggregate,
    deltas,
    previousPeriodComparison: prevComparison,
    recommendationTextRu: validation.recommendationTextRu,
    recommendationMode: "llm_validated",
    blockedReason: null,
    skipped: false,
  };
  await persistRecord(store, schedule.userId, schedule.periodType, result);
  return result;
}

async function persistRecord(
  store: TenantStore,
  userId: string,
  periodType: PeriodType,
  result: ProcessScheduleResult,
): Promise<void> {
  await store.createSummaryRecord(userId, {
    periodType,
    periodStartLocalDate: result.periodStartLocalDate,
    periodEndLocalDate: result.periodEndLocalDate,
    idempotencyKey: result.idempotencyKey,
    totals: {
      caloriesKcal: result.totals.totalCaloriesKcal,
      proteinG: result.totals.totalProteinG,
      fatG: result.totals.totalFatG,
      carbsG: result.totals.totalCarbsG,
      mealCount: result.totals.mealCount,
    },
    deltasVsTarget: {
      deltaCaloriesKcal: result.deltas.deltaCaloriesKcal,
      deltaProteinG: result.deltas.deltaProteinG,
      deltaFatG: result.deltas.deltaFatG,
      deltaCarbsG: result.deltas.deltaCarbsG,
    },
    previousPeriodComparison: result.previousPeriodComparison
      ? {
          deltaCaloriesKcal: result.previousPeriodComparison.deltaCaloriesKcal,
          deltaProteinG: result.previousPeriodComparison.deltaProteinG,
          deltaFatG: result.previousPeriodComparison.deltaFatG,
          deltaCarbsG: result.previousPeriodComparison.deltaCarbsG,
        }
      : undefined,
    recommendationTextRu: result.recommendationTextRu ?? undefined,
    recommendationMode: result.recommendationMode,
    blockedReason: result.blockedReason ?? undefined,
    deliveredAt: new Date().toISOString(),
  });
}
