import type { LlmStructuredResponse } from "./types.js";
import { MANUAL_ENTRY_FAILURE_RESULT, FORBIDDEN_RECOMMENDATION_TOPICS } from "./types.js";
import type { EstimatorResult } from "./types.js";

function collectStringValues(obj: unknown): string[] {
  const result: string[] = [];
  function walk(val: unknown): void {
    if (typeof val === "string") {
      result.push(val);
    } else if (Array.isArray(val)) {
      for (const item of val) walk(item);
    } else if (val !== null && typeof val === "object") {
      for (const v of Object.values(val as Record<string, unknown>)) walk(v);
    }
  }
  walk(obj);
  return result;
}

export function validateLlmStructuredOutput(raw: unknown): {
  valid: boolean;
  parsed: LlmStructuredResponse | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { valid: false, parsed: null, errors: ["output_is_not_object"] };
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    errors.push("missing_or_invalid_items_array");
    return { valid: false, parsed: null, errors };
  }

  if (typeof obj.total_calories_kcal !== "number") {
    errors.push("missing_total_calories_kcal");
  }
  if (typeof obj.total_protein_g !== "number") {
    errors.push("missing_total_protein_g");
  }
  if (typeof obj.total_fat_g !== "number") {
    errors.push("missing_total_fat_g");
  }
  if (typeof obj.total_carbs_g !== "number") {
    errors.push("missing_total_carbs_g");
  }

  if (errors.length > 0) {
    return { valid: false, parsed: null, errors };
  }

  for (let i = 0; i < obj.items.length; i++) {
    const item = obj.items[i] as Record<string, unknown>;
    if (typeof item.itemNameRu !== "string" || item.itemNameRu.length === 0) {
      errors.push(`item_${i}_missing_itemNameRu`);
    }
    if (typeof item.portionTextRu !== "string") {
      errors.push(`item_${i}_missing_portionTextRu`);
    }
    if (item.portionGrams !== null && typeof item.portionGrams !== "number") {
      errors.push(`item_${i}_invalid_portionGrams`);
    }
    if (typeof item.caloriesKcal !== "number" || item.caloriesKcal < 0) {
      errors.push(`item_${i}_invalid_caloriesKcal`);
    }
    if (typeof item.proteinG !== "number" || item.proteinG < 0) {
      errors.push(`item_${i}_invalid_proteinG`);
    }
    if (typeof item.fatG !== "number" || item.fatG < 0) {
      errors.push(`item_${i}_invalid_fatG`);
    }
    if (typeof item.carbsG !== "number" || item.carbsG < 0) {
      errors.push(`item_${i}_invalid_carbsG`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, parsed: null, errors };
  }

  return {
    valid: true,
    parsed: obj as unknown as LlmStructuredResponse,
    errors: [],
  };
}

export function isSuspiciousLlmOutput(rawResponseText: string): boolean {
  const trimmed = rawResponseText.trim();

  if (trimmed.length === 0) {
    return true;
  }

  const jsonStart = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!jsonStart) {
    return true;
  }

  let parsedObj: unknown;
  try {
    parsedObj = JSON.parse(trimmed);
    if (typeof parsedObj !== "object" || parsedObj === null) {
      return true;
    }
  } catch {
    return true;
  }

  const lower = trimmed.toLowerCase();

  const instructionPatterns = [
    "ignore previous",
    "ignore your",
    "disregard",
    "new instruction",
    "you are now",
    "forget your",
    "игнорируй",
    "забудь",
    "переопредели",
    "новая инструкция",
    "ты теперь",
  ];

  for (const pattern of instructionPatterns) {
    if (lower.includes(pattern)) {
      return true;
    }
  }

  const chatRolePatterns = ["system:", "assistant:", "система:", "ассистент:"];
  const allValues = collectStringValues(parsedObj);
  for (const value of allValues) {
    const valueLower = value.toLowerCase();
    for (const pattern of chatRolePatterns) {
      if (valueLower.startsWith(pattern) || valueLower.includes(" " + pattern)) {
        return true;
      }
    }
    if (valueLower.includes("override")) {
      return true;
    }
  }

  const obj = parsedObj as Record<string, unknown>;
  const stringified = JSON.stringify(obj).toLowerCase();
  for (const topic of FORBIDDEN_RECOMMENDATION_TOPICS) {
    if (stringified.includes(topic)) {
      return true;
    }
  }

  return false;
}

export function validateKbjuTotalsPresent(response: LlmStructuredResponse): boolean {
  return (
    typeof response.total_calories_kcal === "number" &&
    typeof response.total_protein_g === "number" &&
    typeof response.total_fat_g === "number" &&
    typeof response.total_carbs_g === "number" &&
    response.total_calories_kcal >= 0 &&
    response.total_protein_g >= 0 &&
    response.total_fat_g >= 0 &&
    response.total_carbs_g >= 0
  );
}

export function checkForForbiddenAdvice(responseText: string): boolean {
  const lower = responseText.toLowerCase();
  for (const topic of FORBIDDEN_RECOMMENDATION_TOPICS) {
    if (lower.includes(topic)) {
      return true;
    }
  }
  return false;
}

export function validateEstimatorResult(result: EstimatorResult): EstimatorResult {
  if (result.source === "manual_entry_failure") {
    return result;
  }

  if (result.items.length === 0) {
    return MANUAL_ENTRY_FAILURE_RESULT;
  }

  return result;
}
