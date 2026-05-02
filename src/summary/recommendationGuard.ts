import type {
  SummaryRecommendationInput,
  SummaryRecommendationResult,
} from "./types.js";
import type { KBJUValues, RecommendationMode } from "../shared/types.js";

const FORBIDDEN_TOPICS_RU: readonly string[] = [
  "медицин",
  "клиник",
  "витамин",
  "добавк",
  "препарат",
  "лекарств",
  "гидратац",
  "гликемич",
  "микронутриент",
  "диагноз",
  "лечени",
  "тренировк",
  "фитнес",
  "упражнен",
  "режим питан",
  "приём пищ",
  "время приём",
];

const FORBIDDEN_TOPICS_EN: readonly string[] = [
  "medical",
  "clinical",
  "vitamin",
  "supplement",
  "drug",
  "medication",
  "hydration",
  "glycemic",
  "micronutrient",
  "diagnosis",
  "treatment",
  "exercise",
  "fitness",
  "workout",
  "meal timing",
  "eating schedule",
];

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u00AD\u2060-\u2064\u206A-\u206F]/g;

export function normalizeForValidation(text: string): string {
  return text.normalize("NFKC").replace(ZERO_WIDTH_RE, "").toLowerCase();
}

export function buildRecommendationPrompt(
  persona: string,
  input: SummaryRecommendationInput,
): { systemPrompt: string; userContent: string } {
  const periodLabel = periodTypeLabel(input.periodType);
  const systemPrompt = `${persona}\n\nЗАПРЕЩЁННЫЕ ТЕМЫ: ты не должен упоминать медицинские советы, клинические рекомендации, витамины, добавки, препараты, лекарства, гидратацию, гликимический индекс, режим питания, время приёмов пищи, микронутриенты, диагнозы, лечение, тренировки, фитнес, упражнения. Твои рекомендации — только про калории, белки, жиры и углеводы относительно целей.\n\nОтветь в формате JSON: { "recommendation_ru": "..." }`;

  const target = input.targets;
  const agg = input.aggregate;
  const deltas = input.deltas;
  const prev = input.previousPeriodComparison;

  let userContent = `${periodLabel}: ${input.periodStartLocalDate}\n`;
  userContent += `Итого: ${agg.totalCaloriesKcal} ккал, ${agg.totalProteinG} г белка, ${agg.totalFatG} г жиров, ${agg.totalCarbsG} г углеводов (${agg.mealCount} приёмов)\n`;
  userContent += `Цель: ${target.caloriesKcal} ккал, ${target.proteinG} г белка, ${target.fatG} г жиров, ${target.carbsG} г углеводов\n`;
  userContent += `Дельта vs цель: ${deltas.deltaCaloriesKcal} ккал, ${deltas.deltaProteinG} г белка, ${deltas.deltaFatG} г жиров, ${deltas.deltaCarbsG} г углеводов\n`;

  if (prev) {
    userContent += `Сравнение с предыдущим периодом: ${prev.deltaCaloriesKcal} ккал, ${prev.deltaProteinG} г белка, ${prev.deltaFatG} г жиров, ${prev.deltaCarbsG} г углеводов\n`;
  }

  return { systemPrompt, userContent };
}

function periodTypeLabel(periodType: string): string {
  switch (periodType) {
    case "daily": return "Дневная сводка";
    case "weekly": return "Недельная сводка";
    case "monthly": return "Месячная сводка";
    default: return "Сводка";
  }
}

export function validateRecommendationOutput(rawOutput: string): {
  valid: boolean;
  recommendationTextRu: string | null;
  blockedReason: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput.trim());
  } catch {
    return {
      valid: false,
      recommendationTextRu: null,
      blockedReason: "invalid_json",
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      valid: false,
      recommendationTextRu: null,
      blockedReason: "output_not_object",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const text = obj.recommendation_ru;
  if (typeof text !== "string" || text.trim().length === 0) {
    return {
      valid: false,
      recommendationTextRu: null,
      blockedReason: "missing_recommendation_ru",
    };
  }

  const normalized = normalizeForValidation(text);
  for (const stem of FORBIDDEN_TOPICS_RU) {
    if (normalized.includes(stem)) {
      return {
        valid: false,
        recommendationTextRu: null,
        blockedReason: `forbidden_topic_ru:${stem}`,
      };
    }
  }

  for (const stem of FORBIDDEN_TOPICS_EN) {
    if (normalized.includes(stem)) {
      return {
        valid: false,
        recommendationTextRu: null,
        blockedReason: `forbidden_topic_en:${stem}`,
      };
    }
  }

  return {
    valid: true,
    recommendationTextRu: text,
    blockedReason: null,
  };
}

export function buildDeterministicFallback(
  aggregate: { totalCaloriesKcal: number; totalProteinG: number; totalFatG: number; totalCarbsG: number },
  targets: KBJUValues,
): string {
  const dCal = aggregate.totalCaloriesKcal - targets.caloriesKcal;
  const dProt = aggregate.totalProteinG - targets.proteinG;
  const dFat = aggregate.totalFatG - targets.fatG;
  const dCarbs = aggregate.totalCarbsG - targets.carbsG;
  return `Сводка: ${aggregate.totalCaloriesKcal} ккал (цель ${targets.caloriesKcal}, дельта ${dCal}), белок ${aggregate.totalProteinG}/${targets.proteinG} г (дельта ${dProt}), жиры ${aggregate.totalFatG}/${targets.fatG} г (дельта ${dFat}), углеводы ${aggregate.totalCarbsG}/${targets.carbsG} г (дельта ${dCarbs}).`;
}
