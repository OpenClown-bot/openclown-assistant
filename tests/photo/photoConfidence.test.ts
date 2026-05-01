import { describe, it, expect } from "vitest";
import {
  isLowConfidence,
  getLowConfidenceLabel,
  computeDraftConfidence,
  shouldShowLowConfidenceLabel,
} from "../../src/photo/photoConfidence.js";
import {
  LOW_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_LABEL_RU,
} from "../../src/photo/types.js";

describe("isLowConfidence", () => {
  it("returns true when confidence 0.69 is below threshold 0.70", () => {
    expect(isLowConfidence(0.69)).toBe(true);
  });

  it("returns false when confidence is exactly 0.70", () => {
    expect(isLowConfidence(0.70)).toBe(false);
  });

  it("returns false when confidence is 0.80 above threshold", () => {
    expect(isLowConfidence(0.80)).toBe(false);
  });

  it("returns true when confidence is 0", () => {
    expect(isLowConfidence(0)).toBe(true);
  });

  it("returns false when confidence is 1", () => {
    expect(isLowConfidence(1)).toBe(false);
  });
});

describe("getLowConfidenceLabel", () => {
  it("returns Russian label when confidence 0.69 is below 0.70", () => {
    expect(getLowConfidenceLabel(0.69)).toBe(LOW_CONFIDENCE_LABEL_RU);
  });

  it("returns null when confidence is exactly 0.70", () => {
    expect(getLowConfidenceLabel(0.70)).toBeNull();
  });

  it("returns null when confidence is 0.80", () => {
    expect(getLowConfidenceLabel(0.80)).toBeNull();
  });

  it("returns Russian label for confidence 0", () => {
    expect(getLowConfidenceLabel(0)).toBe(LOW_CONFIDENCE_LABEL_RU);
  });
});

describe("computeDraftConfidence", () => {
  it("averages valid item confidences", () => {
    expect(computeDraftConfidence([0.8, 0.6, 0.7])).toBe(0.7);
  });

  it("returns 0 for empty array", () => {
    expect(computeDraftConfidence([])).toBe(0);
  });

  it("skips null values", () => {
    expect(computeDraftConfidence([0.8, null, 0.6])).toBe(0.7);
  });

  it("skips out-of-range values", () => {
    expect(computeDraftConfidence([0.8, 1.5, 0.6])).toBe(0.7);
  });

  it("skips negative values", () => {
    expect(computeDraftConfidence([0.8, -0.1, 0.6])).toBe(0.7);
  });

  it("rounds to 2 decimal places", () => {
    const result = computeDraftConfidence([0.33, 0.66]);
    expect(result).toBe(0.5);
  });
});

describe("shouldShowLowConfidenceLabel", () => {
  it("returns true for confidence 0.69", () => {
    expect(shouldShowLowConfidenceLabel(0.69)).toBe(true);
  });

  it("returns false for confidence 0.70", () => {
    expect(shouldShowLowConfidenceLabel(0.70)).toBe(false);
  });

  it("matches isLowConfidence", () => {
    for (const c of [0, 0.1, 0.5, 0.69, 0.70, 0.71, 1]) {
      expect(shouldShowLowConfidenceLabel(c)).toBe(isLowConfidence(c));
    }
  });
});

describe("LOW_CONFIDENCE_THRESHOLD constant", () => {
  it("is 0.70", () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.70);
  });
});

describe("LOW_CONFIDENCE_LABEL_RU constant", () => {
  it('is "низкая уверенность"', () => {
    expect(LOW_CONFIDENCE_LABEL_RU).toBe("низкая уверенность");
  });
});
