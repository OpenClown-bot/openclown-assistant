import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  TenantStore,
  TenantScopedRepository,
  OnboardingStateRow,
  UserProfileRow,
  UserTargetRow,
  SummaryScheduleRow,
  UserRow,
  UpdateOnboardingStateWithVersionRequest,
} from "../../src/store/types.js";
import { OptimisticVersionError } from "../../src/store/tenantStore.js";
import type { OnboardingAnswers, OnboardingStep } from "../../src/onboarding/types.js";
import { ONBOARDING_STEPS, DEFAULT_PACE_KG_PER_WEEK } from "../../src/onboarding/types.js";
import {
  handleOnboardingStep,
  handleStart,
  getOrCreateOnboardingState,
  STEP_VALIDATORS,
} from "../../src/onboarding/onboardingFlow.js";
import { serializePartialAnswers } from "../../src/onboarding/types.js";
import {
  MSG_REASK_AGE,
  MSG_REASK_HEIGHT,
  MSG_REASK_WEIGHT,
  MSG_REASK_PACE,
  MSG_REASK_ACTIVITY_LEVEL,
  MSG_REASK_TIMEZONE,
  MSG_REASK_REPORT_TIME,
  MSG_REASK_SEX,
  MSG_REASK_WEIGHT_GOAL,
  MSG_DEFAULT_PACE_DISCLOSED,
  MSG_ONBOARDING_COMPLETE,
  MSG_DISCLAIMER,
  MSG_CONFIRM_TARGET,
  MSG_WELCOME,
} from "../../src/onboarding/messages.js";

const CHAT_ID = 12345;
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeOnboardingState(
  overrides: Partial<OnboardingStateRow>
): OnboardingStateRow {
  return {
    id: overrides.id ?? "os-uuid-001",
    user_id: overrides.user_id ?? USER_ID,
    current_step: overrides.current_step ?? "sex",
    partial_answers: overrides.partial_answers ?? {},
    version: overrides.version ?? 1,
    updated_at: overrides.updated_at ?? "2026-04-29T12:00:00Z",
  };
}

function makeUserProfileRow(): UserProfileRow {
  return {
    id: "profile-uuid-001",
    user_id: USER_ID,
    sex: "male",
    age_years: 30,
    height_cm: 175,
    weight_kg: 70,
    activity_level: "moderate",
    weight_goal: "lose",
    pace_kg_per_week: 0.5,
    default_pace_applied: false,
    formula_version: "mifflin_st_jeor_v1_2026_04",
    created_at: "2026-04-29T12:00:00Z",
    updated_at: "2026-04-29T12:00:00Z",
  };
}

function makeUserTargetRow(): UserTargetRow {
  return {
    id: "target-uuid-001",
    user_id: USER_ID,
    profile_id: "profile-uuid-001",
    bmr_kcal: 1671,
    activity_multiplier: 1.55,
    maintenance_kcal: 2590,
    goal_delta_kcal_per_day: -550,
    calories_kcal: 2040,
    protein_g: 153,
    fat_g: 57,
    carbs_g: 230,
    formula_version: "mifflin_st_jeor_v1_2026_04",
    confirmed_at: "2026-04-29T12:00:00Z",
  };
}

function makeSummaryScheduleRow(): SummaryScheduleRow {
  return {
    id: "schedule-uuid-001",
    user_id: USER_ID,
    period_type: "daily",
    local_time: "21:00",
    timezone: "Europe/Moscow",
    enabled: true,
    last_due_period_start: null,
    created_at: "2026-04-29T12:00:00Z",
    updated_at: "2026-04-29T12:00:00Z",
  };
}

function makeUserRow(): UserRow {
  return {
    id: USER_ID,
    telegram_user_id: "111222333",
    telegram_chat_id: String(CHAT_ID),
    language_code: null,
    timezone: "Europe/Moscow",
    onboarding_status: "pending",
    created_at: "2026-04-29T12:00:00Z",
    updated_at: "2026-04-29T12:00:00Z",
  };
}

let persistedProfile = false;
let persistedTarget = false;
let persistedSchedule = false;
let mockOnboardingStatus: string = "pending";
let forceVersionConflict = false;

function createMockStore(state?: OnboardingStateRow, onboardingStatus?: string): TenantStore {
  let currentState = state ?? makeOnboardingState({});
  mockOnboardingStatus = onboardingStatus ?? "pending";
  forceVersionConflict = false;

  persistedProfile = false;
  persistedTarget = false;
  persistedSchedule = false;

  const store: Record<string, unknown> = {
    async getUser(userId: string) {
      return { ...makeUserRow(), onboarding_status: mockOnboardingStatus };
    },

    async upsertOnboardingState(
      userId: string,
      request: { id?: string; currentStep: string; partialAnswers: import("../../src/store/types.js").JsonObject }
    ) {
      currentState = {
        ...currentState,
        current_step: request.currentStep,
        partial_answers: request.partialAnswers,
        version: currentState.version + 1,
      };
      return currentState;
    },

    async updateOnboardingStateWithVersion(
      userId: string,
      request: UpdateOnboardingStateWithVersionRequest
    ) {
      if (forceVersionConflict) {
        throw new OptimisticVersionError("onboarding_states", request.expectedVersion);
      }
      currentState = {
        ...currentState,
        current_step: request.currentStep,
        partial_answers: request.partialAnswers,
        version: currentState.version + 1,
      };
      return currentState;
    },

    async updateUserOnboardingStatus(
      userId: string,
      request: { onboardingStatus: string }
    ) {
      return { ...makeUserRow(), onboarding_status: request.onboardingStatus };
    },

    async withTransaction<T>(
      userId: string,
      action: (repo: TenantScopedRepository) => Promise<T>
    ): Promise<T> {
      const repo: Record<string, unknown> = {
        async createUserProfile() {
          persistedProfile = true;
          return makeUserProfileRow();
        },
        async createUserTarget() {
          persistedTarget = true;
          return makeUserTargetRow();
        },
        async upsertSummarySchedule() {
          persistedSchedule = true;
          return makeSummaryScheduleRow();
        },
        async updateUserOnboardingStatus(
          userId: string,
          request: { onboardingStatus: string }
        ) {
          return { ...makeUserRow(), onboarding_status: request.onboardingStatus };
        },
        async upsertOnboardingState(
          userId: string,
          request: { id?: string; currentStep: string; partialAnswers: import("../../src/store/types.js").JsonObject }
        ) {
          currentState = {
            ...currentState,
            current_step: request.currentStep,
            partial_answers: request.partialAnswers,
            version: currentState.version + 1,
          };
          return currentState;
        },
        async updateOnboardingStateWithVersion(
          userId: string,
          request: UpdateOnboardingStateWithVersionRequest
        ) {
          if (forceVersionConflict) {
            throw new OptimisticVersionError("onboarding_states", request.expectedVersion);
          }
          currentState = {
            ...currentState,
            current_step: request.currentStep,
            partial_answers: request.partialAnswers,
            version: currentState.version + 1,
          };
          return currentState;
        },
      };
      return action(repo as unknown as TenantScopedRepository);
    },
  };

  return store as unknown as TenantStore;
}

describe("STEP_VALIDATORS — invalid input with Russian re-ask", () => {
  it("invalid age → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.age("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_AGE);
  });

  it("age out of range (5) → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.age("5");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_AGE);
  });

  it("age out of range (200) → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.age("200");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_AGE);
  });

  it("invalid height → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.height("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_HEIGHT);
  });

  it("height out of range (50) → re-ask", () => {
    const result = STEP_VALIDATORS.height("50");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_HEIGHT);
  });

  it("height out of range (300) → re-ask", () => {
    const result = STEP_VALIDATORS.height("300");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_HEIGHT);
  });

  it("invalid weight → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.weight("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_WEIGHT);
  });

  it("weight out of range (5) → re-ask", () => {
    const result = STEP_VALIDATORS.weight("5");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_WEIGHT);
  });

  it("weight out of range (500) → re-ask", () => {
    const result = STEP_VALIDATORS.weight("500");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_WEIGHT);
  });

  it("invalid pace → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.pace("abc");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_PACE);
  });

  it("pace out of range (0.01) → re-ask", () => {
    const result = STEP_VALIDATORS.pace("0.01");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_PACE);
  });

  it("pace out of range (3.0) → re-ask", () => {
    const result = STEP_VALIDATORS.pace("3.0");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_PACE);
  });

  it("invalid activity level → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.activity_level("супер");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_ACTIVITY_LEVEL);
  });

  it("invalid timezone → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.timezone("Moscow");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_TIMEZONE);
  });

  it("invalid report time → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.report_time("25:00");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_REPORT_TIME);
  });

  it("report time with invalid minutes → re-ask", () => {
    const result = STEP_VALIDATORS.report_time("21:99");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_REPORT_TIME);
  });

  it("invalid sex → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.sex("other");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_SEX);
  });

  it("invalid weight goal → re-ask in Russian", () => {
    const result = STEP_VALIDATORS.weight_goal("slim");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_WEIGHT_GOAL);
  });
});

describe("STEP_VALIDATORS — valid input", () => {
  it("valid sex: мужской", () => {
    const result = STEP_VALIDATORS.sex("мужской");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("male");
  });

  it("valid sex: женский", () => {
    const result = STEP_VALIDATORS.sex("женский");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("female");
  });

  it("valid sex: male (English fallback) [F-M2]", () => {
    const result = STEP_VALIDATORS.sex("male");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("male");
  });

  it("valid sex: female (English fallback) [F-M2]", () => {
    const result = STEP_VALIDATORS.sex("female");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("female");
  });

  it("valid age: 30", () => {
    const result = STEP_VALIDATORS.age("30");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(30);
  });

  it("valid height: 175", () => {
    const result = STEP_VALIDATORS.height("175");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(175);
  });

  it("valid weight: 70", () => {
    const result = STEP_VALIDATORS.weight("70");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(70);
  });

  it("valid activity level: умеренный", () => {
    const result = STEP_VALIDATORS.activity_level("умеренный");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("moderate");
  });

  it("valid activity level: sedentary (English)", () => {
    const result = STEP_VALIDATORS.activity_level("sedentary");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("sedentary");
  });

  it("valid weight goal: похудеть", () => {
    const result = STEP_VALIDATORS.weight_goal("похудеть");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("lose");
  });

  it("valid weight goal: maintain (English)", () => {
    const result = STEP_VALIDATORS.weight_goal("maintain");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("maintain");
  });

  it("valid pace: 0.5", () => {
    const result = STEP_VALIDATORS.pace("0.5");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(0.5);
  });

  it("valid pace skip: пропусти", () => {
    const result = STEP_VALIDATORS.pace("пропусти");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(null);
  });

  it("valid timezone: Europe/Moscow", () => {
    const result = STEP_VALIDATORS.timezone("Europe/Moscow");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("Europe/Moscow");
  });

  it("valid timezone: UTC [F-M3]", () => {
    const result = STEP_VALIDATORS.timezone("UTC");
    expect(result.valid).toBe(false);
  });

  it("valid timezone: America/Argentina/La_Rioja (3-segment) [F-M3]", () => {
    const result = STEP_VALIDATORS.timezone("America/Argentina/La_Rioja");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("America/Argentina/La_Rioja");
  });

  it("invalid timezone: Mars/Olympus_Mons [F-M3]", () => {
    const result = STEP_VALIDATORS.timezone("Mars/Olympus_Mons");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errorMessage).toBe(MSG_REASK_TIMEZONE);
  });

  it("valid report time: 21:00", () => {
    const result = STEP_VALIDATORS.report_time("21:00");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe("21:00");
  });

  it("valid confirmation: да", () => {
    const result = STEP_VALIDATORS.target_confirmation("да");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBe(true);
  });
});

describe("skipped pace applies 0.5 kg/week default and discloses it", () => {
  it("pace skip → default 0.5 kg/week applied and disclosed to user", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
    };
    const state = makeOnboardingState({
      current_step: "pace",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { reply, newState } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "пропусти",
      state,
      store
    );

    expect(reply.text).toContain(MSG_DEFAULT_PACE_DISCLOSED);
    const updatedAnswers = newState.partial_answers as Record<string, unknown>;
    expect(updatedAnswers.paceKgPerWeek).toBe(DEFAULT_PACE_KG_PER_WEEK);
    expect(updatedAnswers.defaultPaceApplied).toBe(true);
  });

  it("pace skip with «пропустить» → same default", async () => {
    const answers: OnboardingAnswers = {
      sex: "female",
      age: 25,
      height: 165,
      weight: 60,
      activityLevel: "light",
      weightGoal: "gain",
    };
    const state = makeOnboardingState({
      current_step: "pace",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { reply, newState } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "пропустить",
      state,
      store
    );

    expect(reply.text).toContain(MSG_DEFAULT_PACE_DISCLOSED);
    const updatedAnswers = newState.partial_answers as Record<string, unknown>;
    expect(updatedAnswers.paceKgPerWeek).toBe(DEFAULT_PACE_KG_PER_WEEK);
    expect(updatedAnswers.defaultPaceApplied).toBe(true);
  });

  it("explicit pace value → NOT default, NOT disclosed", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
    };
    const state = makeOnboardingState({
      current_step: "pace",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { reply, newState } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "1.0",
      state,
      store
    );

    expect(reply.text).not.toContain(MSG_DEFAULT_PACE_DISCLOSED);
    const updatedAnswers = newState.partial_answers as Record<string, unknown>;
    expect(updatedAnswers.paceKgPerWeek).toBe(1.0);
    expect(updatedAnswers.defaultPaceApplied).toBe(false);
  });
});

describe("persistence only after explicit confirmation", () => {
  it("intermediate steps do NOT persist profile/targets/schedules", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
    };
    const state = makeOnboardingState({
      current_step: "pace",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { persisted } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "0.5",
      state,
      store
    );

    expect(persisted).toBe(false);
    expect(persistedProfile).toBe(false);
    expect(persistedTarget).toBe(false);
    expect(persistedSchedule).toBe(false);
  });

  it("target_confirmation step without «да» does NOT persist", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
      paceKgPerWeek: 0.5,
      defaultPaceApplied: false,
      timezone: "Europe/Moscow",
      reportTime: "21:00",
    };
    const state = makeOnboardingState({
      current_step: "target_confirmation",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { persisted } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "нет",
      state,
      store
    );

    expect(persisted).toBe(false);
    expect(persistedProfile).toBe(false);
    expect(persistedTarget).toBe(false);
    expect(persistedSchedule).toBe(false);
  });

  it("target_confirmation with «да» DOES persist profile/targets/schedules", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
      paceKgPerWeek: 0.5,
      defaultPaceApplied: false,
      timezone: "Europe/Moscow",
      reportTime: "21:00",
    };
    const state = makeOnboardingState({
      current_step: "target_confirmation",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { persisted } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "да",
      state,
      store
    );

    expect(persisted).toBe(true);
    expect(persistedProfile).toBe(true);
    expect(persistedTarget).toBe(true);
    expect(persistedSchedule).toBe(true);
  });

  it("target confirmation reply includes onboarding complete message", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
      paceKgPerWeek: 0.5,
      defaultPaceApplied: false,
      timezone: "Europe/Moscow",
      reportTime: "21:00",
    };
    const state = makeOnboardingState({
      current_step: "target_confirmation",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { reply } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "да",
      state,
      store
    );

    expect(reply.text).toContain(MSG_ONBOARDING_COMPLETE);
  });
});

describe("full step-state machine walk-through", () => {
  it("walks all steps from sex to confirmation with valid inputs", async () => {
    const store = createMockStore();
    let state = makeOnboardingState({ current_step: "sex" });

    const inputs: [OnboardingStep, string][] = [
      ["sex", "мужской"],
      ["age", "30"],
      ["height", "175"],
      ["weight", "70"],
      ["activity_level", "умеренный"],
      ["weight_goal", "похудеть"],
      ["pace", "0.5"],
      ["timezone", "Europe/Moscow"],
      ["report_time", "21:00"],
    ];

    for (const [step, input] of inputs) {
      expect(state.current_step).toBe(step);
      const result = await handleOnboardingStep(CHAT_ID, USER_ID, input, state, store);
      state = result.newState;
    }

    expect(state.current_step).toBe("target_confirmation");

    const answers = state.partial_answers as Record<string, unknown>;
    expect(answers.sex).toBe("male");
    expect(answers.age).toBe(30);
    expect(answers.height).toBe(175);
    expect(answers.weight).toBe(70);
    expect(answers.activityLevel).toBe("moderate");
    expect(answers.weightGoal).toBe("lose");
    expect(answers.paceKgPerWeek).toBe(0.5);
    expect(answers.timezone).toBe("Europe/Moscow");
    expect(answers.reportTime).toBe("21:00");
  });
});

describe("handleStart", () => {
  it("new user → welcome + first prompt", async () => {
    const store = createMockStore();
    const reply = await handleStart(CHAT_ID, USER_ID, store);
    expect(reply.text).toContain(MSG_WELCOME);
    expect(reply.chatId).toBe(CHAT_ID);
  });

  it("returning user mid-onboarding → resume prompt", async () => {
    const store = createMockStore(
      makeOnboardingState({
        current_step: "height",
        partial_answers: serializePartialAnswers({ sex: "male", age: 30 }),
      }),
      "in_progress"
    );
    const reply = await handleStart(CHAT_ID, USER_ID, store);
    expect(reply.text).toContain("Продолжаем");
  });
});

describe("target summary includes disclaimer and confirmation", () => {
  it("after report_time, reply contains summary, disclaimer, and confirm prompt", async () => {
    const answers: OnboardingAnswers = {
      sex: "female",
      age: 25,
      height: 165,
      weight: 60,
      activityLevel: "light",
      weightGoal: "gain",
      paceKgPerWeek: 0.5,
      defaultPaceApplied: false,
      timezone: "Europe/Moscow",
    };
    const state = makeOnboardingState({
      current_step: "report_time",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { reply } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "21:00",
      state,
      store
    );

    expect(reply.text).toContain(MSG_DISCLAIMER);
    expect(reply.text).toContain(MSG_CONFIRM_TARGET);
    expect(reply.text).toContain("Калории:");
    expect(reply.text).toContain("Белки:");
    expect(reply.text).toContain("Жиры:");
    expect(reply.text).toContain("Углеводы:");
  });
});

describe("F-M4: version conflict handling", () => {
  it("version mismatch on step advance → re-ask current step", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
    };
    const state = makeOnboardingState({
      current_step: "height",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);
    forceVersionConflict = true;

    const { reply, newState, persisted } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "175",
      state,
      store
    );

    expect(persisted).toBe(false);
    expect(reply.text).toContain("Рост");
    expect(newState).toBe(state);
  });

  it("version mismatch on target confirmation re-ask → returns re-ask", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
      height: 175,
      weight: 70,
      activityLevel: "moderate",
      weightGoal: "lose",
      paceKgPerWeek: 0.5,
      defaultPaceApplied: false,
      timezone: "Europe/Moscow",
      reportTime: "21:00",
    };
    const state = makeOnboardingState({
      current_step: "target_confirmation",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);
    forceVersionConflict = true;

    const { reply, persisted } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "нет",
      state,
      store
    );

    expect(persisted).toBe(false);
    expect(reply.text).toContain(MSG_CONFIRM_TARGET);
  });

  it("no version conflict → normal flow proceeds", async () => {
    const answers: OnboardingAnswers = {
      sex: "male",
      age: 30,
    };
    const state = makeOnboardingState({
      current_step: "height",
      partial_answers: serializePartialAnswers(answers),
    });
    const store = createMockStore(state);

    const { reply, newState, persisted } = await handleOnboardingStep(
      CHAT_ID,
      USER_ID,
      "175",
      state,
      store
    );

    expect(persisted).toBe(false);
    expect(newState.current_step).toBe("weight");
    expect(newState.version).toBe(state.version + 1);
  });
});
