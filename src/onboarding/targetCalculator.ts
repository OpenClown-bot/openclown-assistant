import type { ActivityLevel, Sex, WeightGoal } from "../shared/types.js";

export const FORMULA_VERSION = "mifflin_st_jeor_v1_2026_04";

const KCAL_PER_KG = 7700;
const DAYS_PER_WEEK = 7;

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

interface MacroSplit {
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
}

const MACRO_SPLITS: Record<WeightGoal, MacroSplit> = {
  lose: { proteinPct: 0.30, fatPct: 0.25, carbsPct: 0.45 },
  maintain: { proteinPct: 0.25, fatPct: 0.30, carbsPct: 0.45 },
  gain: { proteinPct: 0.25, fatPct: 0.25, carbsPct: 0.50 },
};

export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

export function getActivityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_MULTIPLIERS[level];
}

export function calculateMaintenance(bmrKcal: number, activityLevel: ActivityLevel): number {
  return bmrKcal * getActivityMultiplier(activityLevel);
}

export function calculateGoalDelta(
  weightGoal: WeightGoal,
  paceKgPerWeek: number | null
): number {
  if (weightGoal === "maintain" || paceKgPerWeek === null || paceKgPerWeek === 0) {
    return 0;
  }
  const dailyDelta = (paceKgPerWeek * KCAL_PER_KG) / DAYS_PER_WEEK;
  return weightGoal === "lose" ? -dailyDelta : dailyDelta;
}

export function calculateCalories(maintenanceKcal: number, goalDelta: number): number {
  return maintenanceKcal + goalDelta;
}

export function calculateMacros(
  caloriesKcal: number,
  weightGoal: WeightGoal
): { proteinG: number; fatG: number; carbsG: number } {
  const split = MACRO_SPLITS[weightGoal];
  return {
    proteinG: Math.round((caloriesKcal * split.proteinPct) / 4),
    fatG: Math.round((caloriesKcal * split.fatPct) / 9),
    carbsG: Math.round((caloriesKcal * split.carbsPct) / 4),
  };
}

export interface TargetCalculationInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
  paceKgPerWeek: number | null;
}

export interface TargetCalculationOutput {
  bmrKcal: number;
  activityMultiplier: number;
  maintenanceKcal: number;
  goalDeltaKcalPerDay: number;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  formulaVersion: string;
}

export function calculateTargets(input: TargetCalculationInput): TargetCalculationOutput {
  const bmrKcal = Math.round(calculateBMR(input.sex, input.weightKg, input.heightCm, input.ageYears));
  const activityMultiplier = getActivityMultiplier(input.activityLevel);
  const maintenanceKcal = Math.round(calculateMaintenance(bmrKcal, input.activityLevel));
  const goalDelta = calculateGoalDelta(input.weightGoal, input.paceKgPerWeek);
  const goalDeltaKcalPerDay = Math.round(goalDelta);
  const caloriesKcal = Math.round(calculateCalories(maintenanceKcal, goalDelta));
  const macros = calculateMacros(caloriesKcal, input.weightGoal);

  return {
    bmrKcal,
    activityMultiplier,
    maintenanceKcal,
    goalDeltaKcalPerDay,
    caloriesKcal,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    formulaVersion: FORMULA_VERSION,
  };
}
