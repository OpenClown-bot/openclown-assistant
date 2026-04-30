import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  getActivityMultiplier,
  calculateGoalDelta,
  calculateMaintenance,
  calculateCalories,
  calculateMacros,
  calculateTargets,
  FORMULA_VERSION,
} from "../../src/onboarding/targetCalculator.js";
import type { ActivityLevel, Sex, WeightGoal } from "../../src/shared/types.js";

describe("calculateBMR", () => {
  it("calculates male BMR per Mifflin-St Jeor", () => {
    const bmr = calculateBMR("male", 70, 175, 30);
    expect(bmr).toBe(10 * 70 + 6.25 * 175 - 5 * 30 + 5);
  });

  it("calculates female BMR per Mifflin-St Jeor", () => {
    const bmr = calculateBMR("female", 60, 165, 25);
    expect(bmr).toBe(10 * 60 + 6.25 * 165 - 5 * 25 - 161);
  });

  it("male: weight=85, height=182, age=40", () => {
    const expected = 10 * 85 + 6.25 * 182 - 5 * 40 + 5;
    expect(calculateBMR("male", 85, 182, 40)).toBe(expected);
  });

  it("female: weight=55, height=160, age=22", () => {
    const expected = 10 * 55 + 6.25 * 160 - 5 * 22 - 161;
    expect(calculateBMR("female", 55, 160, 22)).toBe(expected);
  });
});

describe("getActivityMultiplier", () => {
  const cases: [ActivityLevel, number][] = [
    ["sedentary", 1.2],
    ["light", 1.375],
    ["moderate", 1.55],
    ["active", 1.725],
    ["very_active", 1.9],
  ];

  for (const [level, expected] of cases) {
    it(`${level} → ${expected}`, () => {
      expect(getActivityMultiplier(level)).toBe(expected);
    });
  }
});

describe("calculateGoalDelta", () => {
  it("lose with pace 0.5 → negative delta", () => {
    const delta = calculateGoalDelta("lose", 0.5);
    expect(delta).toBe(-(0.5 * 7700) / 7);
  });

  it("gain with pace 0.5 → positive delta", () => {
    const delta = calculateGoalDelta("gain", 0.5);
    expect(delta).toBe((0.5 * 7700) / 7);
  });

  it("maintain → zero delta regardless of pace", () => {
    expect(calculateGoalDelta("maintain", 0.5)).toBe(0);
  });

  it("maintain → zero even with null pace", () => {
    expect(calculateGoalDelta("maintain", null)).toBe(0);
  });

  it("lose with pace null → zero delta", () => {
    expect(calculateGoalDelta("lose", null)).toBe(0);
  });

  it("lose with pace 1.0 → correct negative delta", () => {
    const delta = calculateGoalDelta("lose", 1.0);
    expect(delta).toBe(-(1.0 * 7700) / 7);
  });

  it("gain with pace 2.0 → correct positive delta", () => {
    const delta = calculateGoalDelta("gain", 2.0);
    expect(delta).toBe((2.0 * 7700) / 7);
  });
});

describe("calculateMacros", () => {
  it("lose split: 30/25/45", () => {
    const macros = calculateMacros(2000, "lose");
    expect(macros.proteinG).toBe(Math.round((2000 * 0.30) / 4));
    expect(macros.fatG).toBe(Math.round((2000 * 0.25) / 9));
    expect(macros.carbsG).toBe(Math.round((2000 * 0.45) / 4));
  });

  it("maintain split: 25/30/45", () => {
    const macros = calculateMacros(2000, "maintain");
    expect(macros.proteinG).toBe(Math.round((2000 * 0.25) / 4));
    expect(macros.fatG).toBe(Math.round((2000 * 0.30) / 9));
    expect(macros.carbsG).toBe(Math.round((2000 * 0.45) / 4));
  });

  it("gain split: 25/25/50", () => {
    const macros = calculateMacros(2500, "gain");
    expect(macros.proteinG).toBe(Math.round((2500 * 0.25) / 4));
    expect(macros.fatG).toBe(Math.round((2500 * 0.25) / 9));
    expect(macros.carbsG).toBe(Math.round((2500 * 0.50) / 4));
  });
});

describe("calculateTargets — deterministic end-to-end", () => {
  it("male, 70 kg, 175 cm, 30 yo, moderate, lose 0.5 kg/w", () => {
    const result = calculateTargets({
      sex: "male",
      weightKg: 70,
      heightCm: 175,
      ageYears: 30,
      activityLevel: "moderate",
      weightGoal: "lose",
      paceKgPerWeek: 0.5,
    });

    const expectedBMR = Math.round(10 * 70 + 6.25 * 175 - 5 * 30 + 5);
    const expectedMultiplier = 1.55;
    const expectedMaintenance = Math.round(expectedBMR * expectedMultiplier);
    const expectedDelta = Math.round(-(0.5 * 7700) / 7);
    const expectedCalories = Math.round(expectedMaintenance + expectedDelta);
    const expectedMacros = calculateMacros(expectedCalories, "lose");

    expect(result.bmrKcal).toBe(expectedBMR);
    expect(result.activityMultiplier).toBe(expectedMultiplier);
    expect(result.maintenanceKcal).toBe(expectedMaintenance);
    expect(result.goalDeltaKcalPerDay).toBe(expectedDelta);
    expect(result.caloriesKcal).toBe(expectedCalories);
    expect(result.proteinG).toBe(expectedMacros.proteinG);
    expect(result.fatG).toBe(expectedMacros.fatG);
    expect(result.carbsG).toBe(expectedMacros.carbsG);
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
  });

  it("female, 60 kg, 165 cm, 25 yo, light, gain 0.5 kg/w", () => {
    const result = calculateTargets({
      sex: "female",
      weightKg: 60,
      heightCm: 165,
      ageYears: 25,
      activityLevel: "light",
      weightGoal: "gain",
      paceKgPerWeek: 0.5,
    });

    const expectedBMR = Math.round(10 * 60 + 6.25 * 165 - 5 * 25 - 161);
    const expectedMultiplier = 1.375;
    const expectedMaintenance = Math.round(expectedBMR * expectedMultiplier);
    const expectedDelta = Math.round((0.5 * 7700) / 7);
    const expectedCalories = Math.round(expectedMaintenance + expectedDelta);
    const expectedMacros = calculateMacros(expectedCalories, "gain");

    expect(result.bmrKcal).toBe(expectedBMR);
    expect(result.activityMultiplier).toBe(expectedMultiplier);
    expect(result.maintenanceKcal).toBe(expectedMaintenance);
    expect(result.goalDeltaKcalPerDay).toBe(expectedDelta);
    expect(result.caloriesKcal).toBe(expectedCalories);
    expect(result.proteinG).toBe(expectedMacros.proteinG);
    expect(result.fatG).toBe(expectedMacros.fatG);
    expect(result.carbsG).toBe(expectedMacros.carbsG);
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
  });

  it("male, 85 kg, 182 cm, 40 yo, sedentary, maintain", () => {
    const result = calculateTargets({
      sex: "male",
      weightKg: 85,
      heightCm: 182,
      ageYears: 40,
      activityLevel: "sedentary",
      weightGoal: "maintain",
      paceKgPerWeek: null,
    });

    const expectedBMR = Math.round(10 * 85 + 6.25 * 182 - 5 * 40 + 5);
    const expectedMultiplier = 1.2;
    const expectedMaintenance = Math.round(expectedBMR * expectedMultiplier);
    const expectedMacros = calculateMacros(expectedMaintenance, "maintain");

    expect(result.bmrKcal).toBe(expectedBMR);
    expect(result.goalDeltaKcalPerDay).toBe(0);
    expect(result.caloriesKcal).toBe(expectedMaintenance);
    expect(result.proteinG).toBe(expectedMacros.proteinG);
    expect(result.fatG).toBe(expectedMacros.fatG);
    expect(result.carbsG).toBe(expectedMacros.carbsG);
  });

  it("female, 55 kg, 160 cm, 22 yo, very_active, lose 1.0 kg/w", () => {
    const result = calculateTargets({
      sex: "female",
      weightKg: 55,
      heightCm: 165,
      ageYears: 22,
      activityLevel: "very_active",
      weightGoal: "lose",
      paceKgPerWeek: 1.0,
    });

    const expectedBMR = Math.round(10 * 55 + 6.25 * 165 - 5 * 22 - 161);
    const expectedMultiplier = 1.9;
    const expectedMaintenance = Math.round(expectedBMR * expectedMultiplier);
    const expectedDelta = Math.round(-(1.0 * 7700) / 7);
    const expectedCalories = Math.round(expectedMaintenance + expectedDelta);

    expect(result.bmrKcal).toBe(expectedBMR);
    expect(result.activityMultiplier).toBe(expectedMultiplier);
    expect(result.goalDeltaKcalPerDay).toBe(expectedDelta);
    expect(result.caloriesKcal).toBe(expectedCalories);
    expect(result.formulaVersion).toBe("mifflin_st_jeor_v1_2026_04");
  });
});

describe("FORMULA_VERSION", () => {
  it("matches ADR-005@0.2.0 §Decision Detail", () => {
    expect(FORMULA_VERSION).toBe("mifflin_st_jeor_v1_2026_04");
  });
});
