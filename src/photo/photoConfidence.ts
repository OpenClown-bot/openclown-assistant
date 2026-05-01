import {
  LOW_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_LABEL_RU,
} from "./types.js";

export function isLowConfidence(confidence01: number): boolean {
  return confidence01 < LOW_CONFIDENCE_THRESHOLD;
}

export function getLowConfidenceLabel(confidence01: number): string | null {
  if (isLowConfidence(confidence01)) {
    return LOW_CONFIDENCE_LABEL_RU;
  }
  return null;
}

export function computeDraftConfidence(
  itemConfidences: (number | null)[]
): number {
  const valid = itemConfidences.filter(
    (c): c is number => c !== null && c >= 0 && c <= 1
  );
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, c) => acc + c, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

export function shouldShowLowConfidenceLabel(confidence01: number): boolean {
  return isLowConfidence(confidence01);
}
