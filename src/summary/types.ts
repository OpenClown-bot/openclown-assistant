import type { KBJUValues, PeriodType, RecommendationMode } from "../shared/types.js";

export type { PeriodType, RecommendationMode };

export interface SummaryPeriod {
  periodType: PeriodType;
  periodStartLocalDate: string;
  periodEndLocalDate: string;
  timezone: string;
}

export interface SummaryAggregate {
  totalCaloriesKcal: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
  mealCount: number;
}

export interface SummaryDeltas {
  deltaCaloriesKcal: number;
  deltaProteinG: number;
  deltaFatG: number;
  deltaCarbsG: number;
}

export interface PreviousPeriodComparison {
  deltaCaloriesKcal: number;
  deltaProteinG: number;
  deltaFatG: number;
  deltaCarbsG: number;
}

export interface SummaryRecommendationInput {
  aggregate: SummaryAggregate;
  deltas: SummaryDeltas;
  previousPeriodComparison: PreviousPeriodComparison | null;
  targets: KBJUValues;
  periodType: PeriodType;
  periodStartLocalDate: string;
}

export interface SummaryRecommendationResult {
  recommendationTextRu: string | null;
  recommendationMode: RecommendationMode;
  blockedReason: string | null;
}

export interface DueSchedule {
  scheduleId: string;
  userId: string;
  periodType: PeriodType;
  localTime: string;
  timezone: string;
  lastDuePeriodStart: string | null;
}

export interface ProcessScheduleResult {
  idempotencyKey: string;
  periodStartLocalDate: string;
  periodEndLocalDate: string;
  totals: SummaryAggregate;
  deltas: SummaryDeltas;
  previousPeriodComparison: PreviousPeriodComparison | null;
  recommendationTextRu: string | null;
  recommendationMode: RecommendationMode;
  blockedReason: string | null;
  skipped: boolean;
}
