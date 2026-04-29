import type {
  ActivityLevel,
  OnboardingStatus,
  RussianReplyEnvelope,
  Sex,
  WeightGoal,
} from "../shared/types.js";
import type {
  CreateUserProfileRequest,
  CreateUserTargetRequest,
  OnboardingStateRow,
  TenantStore,
  UpsertOnboardingStateRequest,
  UpsertSummaryScheduleRequest,
} from "../store/types.js";
import type {
  C2Deps,
  OnboardingAnswers,
  OnboardingStep,
  ValidationResult,
} from "./types.js";
import {
  DEFAULT_PACE_KG_PER_WEEK,
  VALID_ACTIVITY_LEVELS,
  VALID_SEX_VALUES,
  VALID_TIMEZONE_RE,
  VALID_WEIGHT_GOALS,
  VALIDATION_RANGES,
  REPORT_TIME_RE,
  ONBOARDING_STEPS,
  makeEnvelope,
  nextStep,
  serializePartialAnswers,
  deserializePartialAnswers,
} from "./types.js";
import {
  MSG_WELCOME,
  MSG_ASK_AGE,
  MSG_ASK_HEIGHT,
  MSG_ASK_WEIGHT,
  MSG_ASK_SEX,
  MSG_ASK_ACTIVITY_LEVEL,
  MSG_ASK_WEIGHT_GOAL,
  MSG_ASK_PACE,
  MSG_ASK_TIMEZONE,
  MSG_ASK_REPORT_TIME,
  MSG_CONFIRM_TARGET,
  MSG_DEFAULT_PACE_DISCLOSED,
  MSG_DISCLAIMER,
  MSG_ONBOARDING_COMPLETE,
  MSG_REASK_ACTIVITY_LEVEL,
  MSG_REASK_AGE,
  MSG_REASK_HEIGHT,
  MSG_REASK_PACE,
  MSG_REASK_REPORT_TIME,
  MSG_REASK_SEX,
  MSG_REASK_TIMEZONE,
  MSG_REASK_WEIGHT,
  MSG_REASK_WEIGHT_GOAL,
  MSG_TARGET_SUMMARY,
  STEP_PROMPTS,
  STEP_REASKS,
  WEIGHT_GOAL_LABELS,
  ACTIVITY_LEVEL_LABELS,
  parseActivityLevel,
  parseSex,
  parseWeightGoal,
} from "./messages.js";
import { calculateTargets, FORMULA_VERSION } from "./targetCalculator.js";

function validateSex(input: string): ValidationResult {
  const parsed = parseSex(input);
  if (parsed !== null) return { valid: true, value: parsed as Sex };
  return { valid: false, errorMessage: MSG_REASK_SEX };
}

function validateAge(input: string): ValidationResult {
  const num = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(num) || num !== Math.round(num))
    return { valid: false, errorMessage: MSG_REASK_AGE };
  const age = Math.round(num);
  if (age < VALIDATION_RANGES.age.min || age > VALIDATION_RANGES.age.max)
    return { valid: false, errorMessage: MSG_REASK_AGE };
  return { valid: true, value: age };
}

function validateHeight(input: string): ValidationResult {
  const num = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(num)) return { valid: false, errorMessage: MSG_REASK_HEIGHT };
  if (num < VALIDATION_RANGES.height.min || num > VALIDATION_RANGES.height.max)
    return { valid: false, errorMessage: MSG_REASK_HEIGHT };
  return { valid: true, value: num };
}

function validateWeight(input: string): ValidationResult {
  const num = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(num)) return { valid: false, errorMessage: MSG_REASK_WEIGHT };
  if (num < VALIDATION_RANGES.weight.min || num > VALIDATION_RANGES.weight.max)
    return { valid: false, errorMessage: MSG_REASK_WEIGHT };
  return { valid: true, value: num };
}

function validateActivityLevel(input: string): ValidationResult {
  const parsed = parseActivityLevel(input);
  if (parsed !== null) return { valid: true, value: parsed as ActivityLevel };
  const lowered = input.trim().toLowerCase();
  if (VALID_ACTIVITY_LEVELS.includes(lowered as ActivityLevel))
    return { valid: true, value: lowered as ActivityLevel };
  return { valid: false, errorMessage: MSG_REASK_ACTIVITY_LEVEL };
}

function validateWeightGoal(input: string): ValidationResult {
  const parsed = parseWeightGoal(input);
  if (parsed !== null) return { valid: true, value: parsed as WeightGoal };
  const lowered = input.trim().toLowerCase();
  if (VALID_WEIGHT_GOALS.includes(lowered as WeightGoal))
    return { valid: true, value: lowered as WeightGoal };
  return { valid: false, errorMessage: MSG_REASK_WEIGHT_GOAL };
}

function validatePace(input: string): ValidationResult {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "пропусти" || trimmed === "пропустить" || trimmed === "skip" || trimmed === "-") {
    return { valid: true, value: null };
  }
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(num)) return { valid: false, errorMessage: MSG_REASK_PACE };
  if (num < VALIDATION_RANGES.pace.min || num > VALIDATION_RANGES.pace.max)
    return { valid: false, errorMessage: MSG_REASK_PACE };
  return { valid: true, value: num };
}

function validateTimezone(input: string): ValidationResult {
  const trimmed = input.trim();
  if (VALID_TIMEZONE_RE.test(trimmed)) return { valid: true, value: trimmed };
  return { valid: false, errorMessage: MSG_REASK_TIMEZONE };
}

function validateReportTime(input: string): ValidationResult {
  const trimmed = input.trim();
  if (REPORT_TIME_RE.test(trimmed)) return { valid: true, value: trimmed };
  return { valid: false, errorMessage: MSG_REASK_REPORT_TIME };
}

function validateConfirmation(input: string): ValidationResult {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "да" || trimmed === "yes" || trimmed === "подтверждаю") {
    return { valid: true, value: true };
  }
  return { valid: false, errorMessage: MSG_CONFIRM_TARGET };
}

const STEP_VALIDATORS: Record<OnboardingStep, (input: string) => ValidationResult> = {
  sex: validateSex,
  age: validateAge,
  height: validateHeight,
  weight: validateWeight,
  activity_level: validateActivityLevel,
  weight_goal: validateWeightGoal,
  pace: validatePace,
  timezone: validateTimezone,
  report_time: validateReportTime,
  target_confirmation: validateConfirmation,
};

export { STEP_VALIDATORS };

export async function getOrCreateOnboardingState(
  userId: string,
  store: TenantStore
): Promise<{ state: OnboardingStateRow; isNew: boolean }> {
  const user = await store.getUser(userId);
  if (!user) {
    throw new Error(`User ${userId} not found — C1 must create user before onboarding`);
  }

  const isNew = user.onboarding_status === "pending";

  const state = await store.upsertOnboardingState(userId, {
    currentStep: "sex",
    partialAnswers: {},
  });

  return { state, isNew };
}

export async function handleOnboardingStep(
  chatId: number,
  userId: string,
  inputText: string,
  state: OnboardingStateRow,
  store: TenantStore
): Promise<{ reply: RussianReplyEnvelope; newState: OnboardingStateRow; persisted: boolean }> {
  const currentStep = state.current_step as OnboardingStep;
  const answers = deserializePartialAnswers(state.partial_answers);
  let persisted = false;

  if (!ONBOARDING_STEPS.includes(currentStep)) {
    const newState = await store.upsertOnboardingState(userId, {
      id: state.id,
      currentStep: "sex",
      partialAnswers: {},
    });
    return {
      reply: makeEnvelope(chatId, MSG_WELCOME + "\n\n" + MSG_ASK_SEX),
      newState,
      persisted: false,
    };
  }

  const validator = STEP_VALIDATORS[currentStep];
  const result = validator(inputText);

  if (!result.valid) {
    return {
      reply: makeEnvelope(chatId, result.errorMessage),
      newState: state,
      persisted: false,
    };
  }

  const isPaceSkip = currentStep === "pace" && result.value === null;

  if (currentStep === "pace" && isPaceSkip) {
    answers.paceKgPerWeek = DEFAULT_PACE_KG_PER_WEEK;
    answers.defaultPaceApplied = true;
  } else if (currentStep === "pace" && result.value !== null) {
    answers.paceKgPerWeek = result.value as number;
    answers.defaultPaceApplied = false;
  } else if (currentStep === "target_confirmation") {
    // handled below
  } else {
    const key = stepToAnswerKey(currentStep);
    if (key) {
      (answers as Record<string, unknown>)[key] = result.value;
    }
  }

  const next = nextStep(currentStep);

  if (currentStep === "target_confirmation") {
    const confirmation = result.value as boolean;
    if (confirmation) {
      persisted = true;
      const persistedState = await persistOnboardingCompletion(userId, answers, store);
      const reply = makeEnvelope(chatId, MSG_ONBOARDING_COMPLETE);
      return { reply, newState: persistedState, persisted: true };
    }
    const reaskState = await store.upsertOnboardingState(userId, {
      id: state.id,
      currentStep: "target_confirmation",
      partialAnswers: serializePartialAnswers(answers),
    });
    return {
      reply: makeEnvelope(chatId, MSG_CONFIRM_TARGET),
      newState: reaskState,
      persisted: false,
    };
  }

  let replyParts: string[] = [];

  if (isPaceSkip) {
    replyParts.push(MSG_DEFAULT_PACE_DISCLOSED);
  }

  const updatedState = await store.upsertOnboardingState(userId, {
    id: state.id,
    currentStep: next ?? "target_confirmation",
    partialAnswers: serializePartialAnswers(answers),
  });

  if (next === null || next === "target_confirmation") {
    const targets = calculateTargets({
      sex: answers.sex!,
      weightKg: answers.weight!,
      heightCm: answers.height!,
      ageYears: answers.age!,
      activityLevel: answers.activityLevel!,
      weightGoal: answers.weightGoal!,
      paceKgPerWeek: answers.paceKgPerWeek ?? null,
    });

    const goalLabel = WEIGHT_GOAL_LABELS[answers.weightGoal!] ?? answers.weightGoal!;
    replyParts.push(
      MSG_TARGET_SUMMARY(targets.caloriesKcal, targets.proteinG, targets.fatG, targets.carbsG, goalLabel)
    );
    replyParts.push(MSG_DISCLAIMER);
    replyParts.push(MSG_CONFIRM_TARGET);

    const confirmState = await store.upsertOnboardingState(userId, {
      id: state.id,
      currentStep: "target_confirmation",
      partialAnswers: serializePartialAnswers(answers),
    });

    return {
      reply: makeEnvelope(chatId, replyParts.join("\n\n")),
      newState: confirmState,
      persisted: false,
    };
  }

  const prompt = STEP_PROMPTS[next] ?? "";
  replyParts.push(prompt);

  return {
    reply: makeEnvelope(chatId, replyParts.join("\n\n")),
    newState: updatedState,
    persisted: false,
  };
}

function stepToAnswerKey(step: OnboardingStep): string | null {
  const map: Record<OnboardingStep, string> = {
    sex: "sex",
    age: "age",
    height: "height",
    weight: "weight",
    activity_level: "activityLevel",
    weight_goal: "weightGoal",
    pace: "paceKgPerWeek",
    timezone: "timezone",
    report_time: "reportTime",
    target_confirmation: "",
  };
  return map[step] || null;
}

async function persistOnboardingCompletion(
  userId: string,
  answers: OnboardingAnswers,
  store: TenantStore
): Promise<OnboardingStateRow> {
  const targets = calculateTargets({
    sex: answers.sex!,
    weightKg: answers.weight!,
    heightCm: answers.height!,
    ageYears: answers.age!,
    activityLevel: answers.activityLevel!,
    weightGoal: answers.weightGoal!,
    paceKgPerWeek: answers.paceKgPerWeek ?? null,
  });

  return store.withTransaction(userId, async (repo) => {
    const profile = await repo.createUserProfile(userId, {
      sex: answers.sex!,
      ageYears: answers.age!,
      heightCm: answers.height!,
      weightKg: answers.weight!,
      activityLevel: answers.activityLevel!,
      weightGoal: answers.weightGoal!,
      paceKgPerWeek: answers.paceKgPerWeek ?? undefined,
      defaultPaceApplied: answers.defaultPaceApplied ?? false,
      formulaVersion: FORMULA_VERSION,
    });

    await repo.createUserTarget(userId, {
      profileId: profile.id,
      bmrKcal: targets.bmrKcal,
      activityMultiplier: targets.activityMultiplier,
      maintenanceKcal: targets.maintenanceKcal,
      goalDeltaKcalPerDay: targets.goalDeltaKcalPerDay,
      caloriesKcal: targets.caloriesKcal,
      proteinG: targets.proteinG,
      fatG: targets.fatG,
      carbsG: targets.carbsG,
      formulaVersion: FORMULA_VERSION,
    });

    await repo.upsertSummarySchedule(userId, {
      periodType: "daily",
      localTime: answers.reportTime ?? "21:00",
      timezone: answers.timezone!,
      enabled: true,
    });

    await repo.updateUserOnboardingStatus(userId, {
      onboardingStatus: "active" as OnboardingStatus,
    });

    return store.upsertOnboardingState(userId, {
      currentStep: "target_confirmation",
      partialAnswers: serializePartialAnswers(answers),
    });
  });
}

export async function handleStart(
  chatId: number,
  userId: string,
  store: TenantStore
): Promise<RussianReplyEnvelope> {
  const { state, isNew } = await getOrCreateOnboardingState(userId, store);

  if (isNew) {
    return makeEnvelope(chatId, MSG_WELCOME + "\n\n" + MSG_ASK_SEX);
  }

  const currentStep = state.current_step as OnboardingStep;
  const prompt = STEP_PROMPTS[currentStep] ?? "";
  return makeEnvelope(chatId, `Продолжаем настройку.\n\n${prompt}`);
}
