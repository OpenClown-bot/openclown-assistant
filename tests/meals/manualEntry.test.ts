import { describe, it, expect } from "vitest";
import { parseManualKBJU, buildManualDraftItems } from "../../src/meals/manualEntry.js";

describe("parseManualKBJU", () => {
  it("parses valid space-separated KBJU input", () => {
    const result = parseManualKBJU("450 30 15 50");
    expect(result.valid).toBe(true);
    expect(result.values).toEqual({
      caloriesKcal: 450,
      proteinG: 30,
      fatG: 15,
      carbsG: 50,
    });
    expect(result.errorMessage).toBeNull();
  });

  it("parses valid input with decimal values", () => {
    const result = parseManualKBJU("450.5 30.2 15.1 50.7");
    expect(result.valid).toBe(true);
    expect(result.values?.caloriesKcal).toBeCloseTo(450.5);
    expect(result.values?.proteinG).toBeCloseTo(30.2);
    expect(result.values?.fatG).toBeCloseTo(15.1);
    expect(result.values?.carbsG).toBeCloseTo(50.7);
  });

  it("parses input with comma as decimal separator", () => {
    const result = parseManualKBJU("450,5 30,2 15,1 50,7");
    expect(result.valid).toBe(true);
    expect(result.values?.caloriesKcal).toBeCloseTo(450.5);
    expect(result.values?.proteinG).toBeCloseTo(30.2);
  });

  it("rejects input with fewer than four numbers", () => {
    const result = parseManualKBJU("450 30 15");
    expect(result.valid).toBe(false);
    expect(result.values).toBeNull();
    expect(result.errorMessage).toBeTruthy();
  });

  it("rejects input with more than four numbers", () => {
    const result = parseManualKBJU("450 30 15 50 20");
    expect(result.valid).toBe(false);
    expect(result.values).toBeNull();
  });

  it("rejects non-numeric input", () => {
    const result = parseManualKBJU("abc def ghi jkl");
    expect(result.valid).toBe(false);
    expect(result.values).toBeNull();
  });

  it("rejects negative values", () => {
    const result = parseManualKBJU("450 -30 15 50");
    expect(result.valid).toBe(false);
    expect(result.values).toBeNull();
  });

  it("rejects empty input", () => {
    const result = parseManualKBJU("");
    expect(result.valid).toBe(false);
    expect(result.values).toBeNull();
  });

  it("handles leading/trailing whitespace", () => {
    const result = parseManualKBJU("  450 30 15 50  ");
    expect(result.valid).toBe(true);
    expect(result.values?.caloriesKcal).toBe(450);
  });

  it("accepts zero values", () => {
    const result = parseManualKBJU("0 0 0 0");
    expect(result.valid).toBe(true);
    expect(result.values).toEqual({
      caloriesKcal: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
    });
  });
});

describe("buildManualDraftItems", () => {
  it("builds a single manual-entry draft item from KBJU values", () => {
    const entry = { caloriesKcal: 450, proteinG: 30, fatG: 15, carbsG: 50 };
    const items = buildManualDraftItems(entry);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      itemNameRu: "Ручной ввод",
      portionTextRu: "весь приём",
      portionGrams: null,
      caloriesKcal: 450,
      proteinG: 30,
      fatG: 15,
      carbsG: 50,
      source: "manual",
      sourceRef: null,
      confidence01: null,
    });
  });
});
