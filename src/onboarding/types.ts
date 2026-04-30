import type {
  ActivityLevel,
  OnboardingStatus,
  Sex,
  WeightGoal,
  RussianReplyEnvelope,
} from "../shared/types.js";
import type { JsonObject } from "../store/types.js";

export const ONBOARDING_STEPS = [
  "sex",
  "age",
  "height",
  "weight",
  "activity_level",
  "weight_goal",
  "pace",
  "timezone",
  "report_time",
  "target_confirmation",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const DEFAULT_PACE_KG_PER_WEEK = 0.5;

export const VALIDATION_RANGES = {
  age: { min: 10, max: 120 },
  height: { min: 100, max: 250 },
  weight: { min: 20, max: 300 },
  pace: { min: 0.1, max: 2.0 },
} as const;

export const VALID_ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

export const VALID_WEIGHT_GOALS: WeightGoal[] = ["lose", "maintain", "gain"];

export const VALID_SEX_VALUES: Sex[] = ["male", "female"];

export const REPORT_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface OnboardingAnswers {
  sex?: Sex;
  age?: number;
  height?: number;
  weight?: number;
  activityLevel?: ActivityLevel;
  weightGoal?: WeightGoal;
  paceKgPerWeek?: number;
  defaultPaceApplied?: boolean;
  timezone?: string;
  reportTime?: string;
}

export interface TargetCalculationResult {
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

export interface OnboardingState {
  id: string;
  userId: string;
  currentStep: OnboardingStep;
  partialAnswers: OnboardingAnswers;
  version: number;
}

export interface C2Deps {
  store: import("../store/types.js").TenantStore;
  getOrCreateOnboardingState: (
    userId: string,
    store: import("../store/types.js").TenantStore
  ) => Promise<OnboardingState>;
}

export type ValidationResult =
  | { valid: true; value: unknown }
  | { valid: false; errorMessage: string };

export function makeEnvelope(
  chatId: number,
  text: string,
  typingRenewalRequired = false
): RussianReplyEnvelope {
  return {
    chatId,
    text,
    typingRenewalRequired,
  };
}

export function serializePartialAnswers(answers: OnboardingAnswers): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value !== undefined) {
      result[key] = value as string | number | boolean | null;
    }
  }
  return result;
}

export function deserializePartialAnswers(json: JsonObject): OnboardingAnswers {
  const answers: OnboardingAnswers = {};
  if (json.sex === "male" || json.sex === "female") answers.sex = json.sex;
  if (typeof json.age === "number") answers.age = json.age;
  if (typeof json.height === "number") answers.height = json.height;
  if (typeof json.weight === "number") answers.weight = json.weight;
  if (
    typeof json.activityLevel === "string" &&
    VALID_ACTIVITY_LEVELS.includes(json.activityLevel as ActivityLevel)
  )
    answers.activityLevel = json.activityLevel as ActivityLevel;
  if (
    typeof json.weightGoal === "string" &&
    VALID_WEIGHT_GOALS.includes(json.weightGoal as WeightGoal)
  )
    answers.weightGoal = json.weightGoal as WeightGoal;
  if (typeof json.paceKgPerWeek === "number") answers.paceKgPerWeek = json.paceKgPerWeek;
  if (typeof json.defaultPaceApplied === "boolean") answers.defaultPaceApplied = json.defaultPaceApplied;
  if (typeof json.timezone === "string") answers.timezone = json.timezone;
  if (typeof json.reportTime === "string") answers.reportTime = json.reportTime;
  return answers;
}

export function nextStep(currentStep: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(currentStep);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1];
}
