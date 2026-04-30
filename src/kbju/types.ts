import type { MealItemSource, KBJUValues } from "../shared/types.js";

export interface EstimatorRequest {
  mealTextRu: string;
  userId: string;
  requestId: string;
  degradeModeEnabled: boolean;
}

export interface EstimatorItemResult {
  itemNameRu: string;
  portionTextRu: string;
  portionGrams: number | null;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: MealItemSource;
  sourceRef: string | null;
  confidence01: number | null;
}

export interface EstimatorResult {
  items: EstimatorItemResult[];
  totalKBJU: KBJUValues;
  confidence01: number | null;
  source: "lookup" | "llm_fallback" | "manual_entry_failure";
  validationErrors: string[];
}

export interface FoodLookupResult {
  itemNameRu: string;
  portionGrams: number;
  per100gKbju: KBJUValues;
  source: Extract<MealItemSource, "open_food_facts" | "usda_fdc">;
  sourceRef: string;
  confidence01: number;
}

export interface LlmParsedItem {
  itemNameRu: string;
  portionTextRu: string;
  portionGrams: number | null;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface LlmStructuredResponse {
  items: LlmParsedItem[];
  total_calories_kcal: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
}

export const MANUAL_ENTRY_FAILURE_RESULT: EstimatorResult = {
  items: [],
  totalKBJU: { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  confidence01: null,
  source: "manual_entry_failure",
  validationErrors: ["suspicious_or_malformed_model_output"],
};

export const OFF_LOOKUP_RATE_LIMIT_PER_MINUTE = 60;
export const USDA_LOOKUP_RATE_LIMIT_PER_HOUR = 1000;

export const OFF_API_BASE_URL = "https://world.openfoodfacts.org";
export const USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

export const LOOKUP_TIMEOUT_MS = 3000;
export const LLM_TIMEOUT_MS = 15000;

export const FORBIDDEN_RECOMMENDATION_TOPICS: readonly string[] = [
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
];
