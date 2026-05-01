import type { ManualKBJUEntry, ManualEntryParseResult } from "./types.js";
import {
  MSG_MANUAL_ENTRY_INVALID,
  MSG_MANUAL_ENTRY_PROMPT,
} from "./messages.js";

const MANUAL_ENTRY_RE = /^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/;

export function parseManualKBJU(input: string): ManualEntryParseResult {
  const trimmed = input.trim();
  const match = trimmed.match(MANUAL_ENTRY_RE);
  if (!match) {
    return {
      valid: false,
      values: null,
      errorMessage: MSG_MANUAL_ENTRY_INVALID,
    };
  }

  const parseNum = (s: string): number => parseFloat(s.replace(",", "."));

  const caloriesKcal = parseNum(match[1]);
  const proteinG = parseNum(match[2]);
  const fatG = parseNum(match[3]);
  const carbsG = parseNum(match[4]);

  if (
    !Number.isFinite(caloriesKcal) ||
    !Number.isFinite(proteinG) ||
    !Number.isFinite(fatG) ||
    !Number.isFinite(carbsG) ||
    caloriesKcal < 0 ||
    proteinG < 0 ||
    fatG < 0 ||
    carbsG < 0
  ) {
    return {
      valid: false,
      values: null,
      errorMessage: MSG_MANUAL_ENTRY_INVALID,
    };
  }

  return {
    valid: true,
    values: { caloriesKcal, proteinG, fatG, carbsG },
    errorMessage: null,
  };
}

export function buildManualDraftItems(
  entry: ManualKBJUEntry
): { itemNameRu: string; portionTextRu: string; portionGrams: number | null; caloriesKcal: number; proteinG: number; fatG: number; carbsG: number; source: "manual"; sourceRef: null; confidence01: null }[] {
  return [
    {
      itemNameRu: "Ручной ввод",
      portionTextRu: "весь приём",
      portionGrams: null,
      caloriesKcal: entry.caloriesKcal,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      carbsG: entry.carbsG,
      source: "manual" as const,
      sourceRef: null,
      confidence01: null,
    },
  ];
}
