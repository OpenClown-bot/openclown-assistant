import { describe, it, expect, vi, beforeEach } from "vitest";
import { MealOrchestrator } from "../../src/meals/mealOrchestrator.js";
import type { MealOrchestratorDeps, DraftLookup } from "../../src/meals/mealOrchestrator.js";
import type { C4Deps, EmitMetricFn } from "../../src/meals/types.js";
import type {
  TenantStore,
  TenantScopedRepository,
  MealDraftRow,
  MealDraftItemRow,
  ConfirmedMealRow,
  MealItemRow,
  AuditEventRow,
  MetricEventRow,
  CreateMealDraftRequest,
  UpdateMealDraftWithVersionRequest,
  CreateMealDraftItemRequest,
  CreateConfirmedMealRequest,
  CreateMealItemRequest,
  CreateAuditEventRequest,
  CreateMetricEventRequest,
} from "../../src/store/types.js";
import { OptimisticVersionError } from "../../src/store/tenantStore.js";
import type { EstimatorResult } from "../../src/kbju/types.js";
import { MANUAL_ENTRY_FAILURE_RESULT } from "../../src/kbju/types.js";
import type { PhotoRecognitionResult } from "../../src/photo/types.js";
import type { TranscriptionResult } from "../../src/voice/types.js";
import type { OpenClawLogger, MealDraftStatus, KBJUValues } from "../../src/shared/types.js";
import {
  MSG_DRAFT_CONFIRMED,
  MSG_STALE_DRAFT_REJECTED,
  MSG_ALREADY_CONFIRMED,
  MSG_KBJU_FAILURE_FALLBACK,
  MSG_MANUAL_ENTRY_PROMPT,
  MSG_MANUAL_ENTRY_INVALID,
} from "../../src/meals/messages.js";

const USER_ID = "user-001";
const REQUEST_ID = "req-001";
const CHAT_ID = 12345;
const DRAFT_ID = "draft-001";

function makeMockLogger(): OpenClawLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  };
}

function makeDraftRow(overrides: Partial<MealDraftRow> = {}): MealDraftRow {
  return {
    id: DRAFT_ID,
    user_id: USER_ID,
    source: "text",
    transcript_id: null,
    status: "awaiting_confirmation",
    normalized_input_text: "гречка 200г",
    photo_confidence_0_1: null,
    low_confidence_label_shown: false,
    total_calories_kcal: 220,
    total_protein_g: 8.4,
    total_fat_g: 2.2,
    total_carbs_g: 42.6,
    confidence_0_1: 0.7,
    version: 1,
    created_at: "2026-04-29T12:00:00Z",
    updated_at: "2026-04-29T12:00:00Z",
    ...overrides,
  };
}

function makeDraftItemRow(overrides: Partial<MealDraftItemRow> = {}): MealDraftItemRow {
  return {
    id: "item-001",
    user_id: USER_ID,
    draft_id: DRAFT_ID,
    item_name_ru: "гречка",
    portion_text_ru: "200г",
    portion_grams: 200,
    calories_kcal: 220,
    protein_g: 8.4,
    fat_g: 2.2,
    carbs_g: 42.6,
    source: "open_food_facts",
    source_ref: "123456",
    confidence_0_1: 0.7,
    ...overrides,
  };
}

function makeConfirmedMealRow(overrides: Partial<ConfirmedMealRow> = {}): ConfirmedMealRow {
  return {
    id: "meal-001",
    user_id: USER_ID,
    source: "text",
    draft_id: DRAFT_ID,
    meal_local_date: "2026-04-29",
    meal_logged_at: "2026-04-29T12:00:00Z",
    total_calories_kcal: 220,
    total_protein_g: 8.4,
    total_fat_g: 2.2,
    total_carbs_g: 42.6,
    manual_entry: false,
    deleted_at: null,
    version: 1,
    created_at: "2026-04-29T12:00:00Z",
    updated_at: "2026-04-29T12:00:00Z",
    ...overrides,
  };
}

function makeEstimatorResult(overrides: Partial<EstimatorResult> = {}): EstimatorResult {
  return {
    items: [
      {
        itemNameRu: "гречка",
        portionTextRu: "200г",
        portionGrams: 200,
        caloriesKcal: 220,
        proteinG: 8.4,
        fatG: 2.2,
        carbsG: 42.6,
        source: "open_food_facts",
        sourceRef: "123456",
        confidence01: 0.7,
      },
    ],
    totalKBJU: { caloriesKcal: 220, proteinG: 8.4, fatG: 2.2, carbsG: 42.6 },
    confidence01: 0.7,
    source: "lookup",
    validationErrors: [],
    ...overrides,
  };
}

function makePhotoResult(overrides: Partial<PhotoRecognitionResult> = {}): PhotoRecognitionResult {
  return {
    providerAlias: "fireworks",
    modelAlias: "qwen3-vl-30b-a3b-instruct",
    items: [
      {
        itemNameRu: "салат",
        portionTextRu: "тарелка",
        portionGrams: 200,
        caloriesKcal: 150,
        proteinG: 5,
        fatG: 10,
        carbsG: 12,
        confidence01: 0.65,
      },
    ],
    totalKBJU: { caloriesKcal: 150, proteinG: 5, fatG: 10, carbsG: 12 },
    confidence01: 0.65,
    lowConfidenceLabelShown: true,
    needsUserConfirmation: true,
    estimatedCostUsd: 0.002,
    outcome: "success",
    photoDeleted: true,
    transientFailure: false,
    ...overrides,
  };
}

function makeMockRepository() {
  const createdDrafts: MealDraftRow[] = [];
  const createdDraftItems: MealDraftItemRow[] = [];

  return {
    createdDrafts,
    createdDraftItems,
    createMealDraft: vi.fn(async (_userId: string, request: CreateMealDraftRequest) => {
      const draft: MealDraftRow = {
        id: `draft-${createdDrafts.length + 1}`,
        user_id: _userId,
        source: request.source,
        transcript_id: request.transcriptId ?? null,
        status: request.status,
        normalized_input_text: request.normalizedInputText ?? null,
        photo_confidence_0_1: request.photoConfidence01 ?? null,
        low_confidence_label_shown: request.lowConfidenceLabelShown,
        total_calories_kcal: request.totalCaloriesKcal ?? null,
        total_protein_g: request.totalProteinG ?? null,
        total_fat_g: request.totalFatG ?? null,
        total_carbs_g: request.totalCarbsG ?? null,
        confidence_0_1: request.confidence01 ?? null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      createdDrafts.push(draft);
      return draft;
    }),
    updateMealDraftWithVersion: vi.fn(async (_userId: string, request: UpdateMealDraftWithVersionRequest) => {
      const existing = createdDrafts.find((d) => d.id === request.id);
      if (!existing) throw new OptimisticVersionError("meal_draft", request.expectedVersion);
      if (request.expectedVersion !== existing.version) {
        throw new OptimisticVersionError("meal_draft", request.expectedVersion);
      }
      existing.status = request.status;
      existing.version += 1;
      existing.updated_at = new Date().toISOString();
      if (request.totalCaloriesKcal !== undefined) existing.total_calories_kcal = request.totalCaloriesKcal;
      if (request.totalProteinG !== undefined) existing.total_protein_g = request.totalProteinG;
      if (request.totalFatG !== undefined) existing.total_fat_g = request.totalFatG;
      if (request.totalCarbsG !== undefined) existing.total_carbs_g = request.totalCarbsG;
      return { ...existing };
    }),
    createMealDraftItem: vi.fn(async (_userId: string, request: CreateMealDraftItemRequest) => {
      const item: MealDraftItemRow = {
        id: `item-${createdDraftItems.length + 1}`,
        user_id: _userId,
        draft_id: request.draftId,
        item_name_ru: request.itemNameRu,
        portion_text_ru: request.portionTextRu,
        portion_grams: request.portionGrams ?? null,
        calories_kcal: request.caloriesKcal,
        protein_g: request.proteinG,
        fat_g: request.fatG,
        carbs_g: request.carbsG,
        source: request.source,
        source_ref: request.sourceRef ?? null,
        confidence_0_1: request.confidence01 ?? null,
      };
      createdDraftItems.push(item);
      return item;
    }),
    createConfirmedMeal: vi.fn(async (_userId: string, request: CreateConfirmedMealRequest) => {
      return makeConfirmedMealRow({
        source: request.source,
        draft_id: request.draftId ?? null,
        meal_local_date: request.mealLocalDate,
        meal_logged_at: request.mealLoggedAt,
        total_calories_kcal: request.totalCaloriesKcal,
        total_protein_g: request.totalProteinG,
        total_fat_g: request.totalFatG,
        total_carbs_g: request.totalCarbsG,
        manual_entry: request.manualEntry,
      });
    }),
    createMealItem: vi.fn(async (_userId: string, request: CreateMealItemRequest) => {
      return {
        id: "mi-001",
        user_id: _userId,
        meal_id: request.mealId,
        item_name_ru: request.itemNameRu,
        portion_text_ru: request.portionTextRu,
        portion_grams: request.portionGrams ?? null,
        calories_kcal: request.caloriesKcal,
        protein_g: request.proteinG,
        fat_g: request.fatG,
        carbs_g: request.carbsG,
        source: request.source,
        source_ref: request.sourceRef ?? null,
      } as MealItemRow;
    }),
    createAuditEvent: vi.fn(async (_userId: string, _request: CreateAuditEventRequest) => {
      return {
        id: "audit-001",
        user_id: _userId,
        event_type: _request.eventType,
        entity_type: _request.entityType,
        entity_id: _request.entityId ?? null,
        before_snapshot: _request.beforeSnapshot ?? null,
        after_snapshot: _request.afterSnapshot ?? null,
        reason: _request.reason ?? null,
        created_at: new Date().toISOString(),
      } as AuditEventRow;
    }),
    createMetricEvent: vi.fn(async (_userId: string, _request: CreateMetricEventRequest) => {
      return {
        id: "metric-001",
        user_id: _userId,
        request_id: _request.requestId,
        event_name: _request.eventName,
        component: _request.component,
        latency_ms: _request.latencyMs ?? null,
        outcome: _request.outcome,
        metadata: _request.metadata ?? {},
        created_at: new Date().toISOString(),
      } as MetricEventRow;
    }),
  };
}

type MockRepo = ReturnType<typeof makeMockRepository>;

function makeMockStore(repo: MockRepo): TenantStore {
  return {
    ...repo,
    withTransaction: vi.fn(async <T>(_userId: string, action: (r: TenantScopedRepository) => Promise<T>) => {
      return action(repo as unknown as TenantScopedRepository);
    }),
  } as unknown as TenantStore;
}

function makeMockDraftLookup(drafts: MealDraftRow[], items: MealDraftItemRow[]): DraftLookup {
  return {
    getMealDraft: vi.fn(async (draftId: string) => {
      return drafts.find((d) => d.id === draftId) ?? null;
    }),
    listMealDraftItems: vi.fn(async (draftId: string) => {
      return items.filter((i) => i.draft_id === draftId);
    }),
  };
}

function makeOrchestrator(repo: MockRepo, drafts: MealDraftRow[], items: MealDraftItemRow[]) {
  for (const d of drafts) {
    repo.createdDrafts.push(d);
  }
  for (const i of items) {
    repo.createdDraftItems.push(i);
  }
  const store = makeMockStore(repo);
  const draftLookup: DraftLookup = {
    getMealDraft: vi.fn(async (draftId: string) => {
      const fromCreated = repo.createdDrafts.find((d) => d.id === draftId);
      if (fromCreated) return fromCreated;
      return drafts.find((d) => d.id === draftId) ?? null;
    }),
    listMealDraftItems: vi.fn(async (draftId: string) => {
      const fromCreated = repo.createdDraftItems.filter((i) => i.draft_id === draftId);
      if (fromCreated.length > 0) return fromCreated;
      return items.filter((i) => i.draft_id === draftId);
    }),
  };
  const emitMetric = vi.fn(async () => {});
  const logger = makeMockLogger();

  const deps: MealOrchestratorDeps = {
    store,
    logger,
    emitMetric: emitMetric as EmitMetricFn,
    draftLookup,
  };

  const orchestrator = new MealOrchestrator(deps);
  return { orchestrator, emitMetric, repo, draftLookup };
}

describe("MealOrchestrator", () => {
  describe("handleMealInput — text source", () => {
    it("creates a draft and returns a reply envelope with inline keyboard (AC#1)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const estimatorResult = makeEstimatorResult();
      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "text",
        mealText: "гречка 200г",
        estimatorResult,
        degradeModeEnabled: false,
      });

      expect(envelope.chatId).toBe(CHAT_ID);
      expect(envelope.text).toContain("гречка");
      expect(envelope.text).toContain("220");
      expect(envelope.replyMarkup).toBeDefined();
      expect(envelope.parseMode).toBe("HTML");
      expect(repo.createMealDraft).toHaveBeenCalledTimes(1);
      expect(repo.createMealDraftItem).toHaveBeenCalledTimes(1);
    });

    it("stores draft with source=text and correct totals", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "text",
        mealText: "гречка 200г",
        estimatorResult: makeEstimatorResult(),
        degradeModeEnabled: false,
      });

      const createCall = repo.createMealDraft.mock.calls[0][1] as CreateMealDraftRequest;
      expect(createCall.source).toBe("text");
      expect(createCall.status).toBe("awaiting_confirmation");
      expect(createCall.totalCaloriesKcal).toBe(220);
      expect(createCall.totalProteinG).toBe(8.4);
      expect(createCall.lowConfidenceLabelShown).toBe(false);
    });
  });

  describe("handleMealInput — voice source", () => {
    it("creates a draft with source=voice and returns reply envelope (AC#4)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const transcriptResult: TranscriptionResult = {
        providerAlias: "fireworks",
        modelAlias: "whisper-large-v3",
        transcriptText: "гречка 200 грамм",
        confidence: 0.9,
        estimatedCostUsd: 0.001,
        outcome: "success",
        audioDeleted: true,
      };

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "voice",
        mealText: "гречка 200 грамм",
        transcriptResult,
        estimatorResult: makeEstimatorResult(),
        degradeModeEnabled: false,
      });

      const createCall = repo.createMealDraft.mock.calls[0][1] as CreateMealDraftRequest;
      expect(createCall.source).toBe("voice");
      expect(createCall.status).toBe("awaiting_confirmation");
      expect(envelope.text).toContain("гречка");
      expect(repo.createConfirmedMeal).not.toHaveBeenCalled();
    });
  });

  describe("handleMealInput — photo source", () => {
    it("creates draft with photo source and low confidence label (AC#5)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const photoResult = makePhotoResult();
      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "photo",
        photoResult,
        degradeModeEnabled: false,
      });

      const createCall = repo.createMealDraft.mock.calls[0][1] as CreateMealDraftRequest;
      expect(createCall.source).toBe("photo");
      expect(createCall.lowConfidenceLabelShown).toBe(true);
      expect(createCall.photoConfidence01).toBe(0.65);
      expect(envelope.text).toContain("низкая уверенность");
    });

    it("does not auto-save photo draft as confirmed — requires explicit confirm (AC#5)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "photo",
        photoResult: makePhotoResult(),
        degradeModeEnabled: false,
      });

      expect(repo.createConfirmedMeal).not.toHaveBeenCalled();
      expect(repo.createMealDraft).toHaveBeenCalledTimes(1);
      const createCall = repo.createMealDraft.mock.calls[0][1] as CreateMealDraftRequest;
      expect(createCall.status).toBe("awaiting_confirmation");
    });
  });

  describe("handleMealInput — KBJU failure", () => {
    it("opens manual entry path and does not persist confirmed meal (AC#8)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "text",
        mealText: "абракадабра",
        estimatorResult: MANUAL_ENTRY_FAILURE_RESULT,
        degradeModeEnabled: false,
      });

      expect(repo.createMealDraft).not.toHaveBeenCalled();
      expect(repo.createConfirmedMeal).not.toHaveBeenCalled();
      expect(envelope.text).toContain(MSG_KBJU_FAILURE_FALLBACK);
      expect(envelope.text).toContain(MSG_MANUAL_ENTRY_PROMPT);
    });

    it("emits K5 metric on KBJU failure fallback (AC#9)", async () => {
      const repo = makeMockRepository();
      const { orchestrator, emitMetric } = makeOrchestrator(repo, [], []);

      await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "text",
        estimatorResult: MANUAL_ENTRY_FAILURE_RESULT,
        degradeModeEnabled: false,
      });

      expect(emitMetric).toHaveBeenCalledWith(
        USER_ID,
        REQUEST_ID,
        "kbju_manual_fallback_total",
        "C4",
        "success",
        {}
      );
    });
  });

  describe("handleMealInput — manual source", () => {
    it("creates a manual draft and returns reply envelope", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "manual",
        mealText: "450 30 15 50",
        degradeModeEnabled: false,
      });

      const createCall = repo.createMealDraft.mock.calls[0][1] as CreateMealDraftRequest;
      expect(createCall.source).toBe("manual");
      expect(createCall.totalCaloriesKcal).toBe(450);
      expect(envelope.text).toContain("450");
    });

    it("returns prompt when no text provided for manual entry", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "manual",
        degradeModeEnabled: false,
      });

      expect(envelope.text).toContain(MSG_MANUAL_ENTRY_PROMPT);
    });

    it("returns invalid format message for bad manual input", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "manual",
        mealText: "abc",
        degradeModeEnabled: false,
      });

      expect(envelope.text).toContain(MSG_MANUAL_ENTRY_INVALID);
      expect(repo.createMealDraft).not.toHaveBeenCalled();
    });
  });

  describe("confirmDraft", () => {
    it("persists confirmed_meal and meal_items on confirm (AC#1)", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "awaiting_confirmation", version: 1 });
      const item = makeDraftItemRow();
      const { orchestrator } = makeOrchestrator(repo, [draft], [item]);

      const result = await orchestrator.confirmDraft(
        USER_ID, REQUEST_ID, CHAT_ID, DRAFT_ID, 1
      );

      expect(result.confirmed).toBe(true);
      expect(result.meal).toBeDefined();
      expect(result.envelope.text).toContain(MSG_DRAFT_CONFIRMED);
      expect(repo.updateMealDraftWithVersion).toHaveBeenCalledTimes(1);
      expect(repo.createConfirmedMeal).toHaveBeenCalledTimes(1);
      expect(repo.createMealItem).toHaveBeenCalledTimes(1);
      expect(repo.createAuditEvent).toHaveBeenCalledTimes(1);
    });

    it("emits K1 and K2 metrics on confirm (AC#9)", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "awaiting_confirmation", version: 1 });
      const item = makeDraftItemRow();
      const { orchestrator, emitMetric } = makeOrchestrator(repo, [draft], [item]);

      await orchestrator.confirmDraft(USER_ID, REQUEST_ID, CHAT_ID, DRAFT_ID, 1);

      const metricNames = emitMetric.mock.calls.map((c: unknown[]) => c[2]);
      expect(metricNames).toContain("kbju_confirmed_meals_total");
      expect(metricNames).toContain("kbju_meals_per_day_per_user");
    });

    it("emits K5 for manual source meals (AC#9)", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ source: "manual", status: "awaiting_confirmation", version: 1 });
      const item = makeDraftItemRow({ source: "manual" });
      const { orchestrator, emitMetric } = makeOrchestrator(repo, [draft], [item]);

      await orchestrator.confirmDraft(USER_ID, REQUEST_ID, CHAT_ID, DRAFT_ID, 1);

      const metricNames = emitMetric.mock.calls.map((c: unknown[]) => c[2]);
      expect(metricNames).toContain("kbju_confirmed_meals_total");
      expect(metricNames).toContain("kbju_meals_per_day_per_user");
    });

    it("rejects stale version confirmation idempotently (AC#6)", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "awaiting_confirmation", version: 3 });
      const item = makeDraftItemRow();
      const { orchestrator } = makeOrchestrator(repo, [draft], [item]);

      const result = await orchestrator.confirmDraft(
        USER_ID, REQUEST_ID, CHAT_ID, DRAFT_ID, 1
      );

      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe("stale_version");
      expect(result.envelope.text).toContain(MSG_STALE_DRAFT_REJECTED);
      expect(repo.createConfirmedMeal).not.toHaveBeenCalled();
    });

    it("rejects duplicate confirm idempotently (AC#7)", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "confirmed", version: 2 });
      const item = makeDraftItemRow();
      const { orchestrator } = makeOrchestrator(repo, [draft], [item]);

      const result = await orchestrator.confirmDraft(
        USER_ID, REQUEST_ID, CHAT_ID, DRAFT_ID, 2
      );

      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe("already_confirmed");
      expect(result.envelope.text).toContain(MSG_ALREADY_CONFIRMED);
      expect(repo.createConfirmedMeal).not.toHaveBeenCalled();
    });

    it("returns not found for missing draft", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const result = await orchestrator.confirmDraft(
        USER_ID, REQUEST_ID, CHAT_ID, "nonexistent", 1
      );

      expect(result.confirmed).toBe(false);
      expect(result.reason).toBe("draft_not_found");
    });
  });

  describe("applyCorrection", () => {
    it("creates a new draft version with corrected items", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "awaiting_confirmation", version: 1 });
      repo.createdDrafts.push(draft);
      const item = makeDraftItemRow();
      const { orchestrator } = makeOrchestrator(repo, [draft], [item]);

      const envelope = await orchestrator.applyCorrection(USER_ID, REQUEST_ID, CHAT_ID, {
        draftId: DRAFT_ID,
        expectedVersion: 1,
        correctedItems: [
          {
            itemNameRu: "рис",
            portionTextRu: "150г",
            portionGrams: 150,
            caloriesKcal: 180,
            proteinG: 4,
            fatG: 1,
            carbsG: 40,
            source: "manual",
            sourceRef: undefined,
            confidence01: undefined,
          },
        ],
        correctedKBJU: { caloriesKcal: 180, proteinG: 4, fatG: 1, carbsG: 40 },
      });

      expect(envelope.text).toContain("рис");
      expect(repo.updateMealDraftWithVersion).toHaveBeenCalledTimes(1);
    });

    it("rejects correction on stale version (optimistic locking)", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "awaiting_confirmation", version: 2 });
      const { orchestrator } = makeOrchestrator(repo, [draft], []);

      const envelope = await orchestrator.applyCorrection(USER_ID, REQUEST_ID, CHAT_ID, {
        draftId: DRAFT_ID,
        expectedVersion: 1,
        correctedItems: [],
        correctedKBJU: { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
      });

      expect(envelope.text).toContain(MSG_STALE_DRAFT_REJECTED);
    });

    it("rejects correction on already confirmed draft", async () => {
      const repo = makeMockRepository();
      const draft = makeDraftRow({ status: "confirmed", version: 2 });
      const { orchestrator } = makeOrchestrator(repo, [draft], []);

      const envelope = await orchestrator.applyCorrection(USER_ID, REQUEST_ID, CHAT_ID, {
        draftId: DRAFT_ID,
        expectedVersion: 2,
        correctedItems: [],
        correctedKBJU: { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
      });

      expect(envelope.text).toContain(MSG_ALREADY_CONFIRMED);
    });
  });

  describe("draft message rendering", () => {
    it("renders text draft with itemized lines and total (AC#3)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "text",
        mealText: "гречка 200г",
        estimatorResult: makeEstimatorResult(),
        degradeModeEnabled: false,
      });

      expect(envelope.text).toContain("Черновик приёма пищи");
      expect(envelope.text).toContain("гречка");
      expect(envelope.text).toContain("Итого:");
      expect(envelope.text).toContain("220 ккал");
    });

    it("renders low confidence label for photo drafts below threshold (AC#4)", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "photo",
        photoResult: makePhotoResult({ confidence01: 0.65, lowConfidenceLabelShown: true }),
        degradeModeEnabled: false,
      });

      expect(envelope.text).toContain("низкая уверенность");
    });

    it("does not render low confidence label for high-confidence photo drafts", async () => {
      const repo = makeMockRepository();
      const { orchestrator } = makeOrchestrator(repo, [], []);

      const envelope = await orchestrator.handleMealInput({
        userId: USER_ID,
        requestId: REQUEST_ID,
        chatId: CHAT_ID,
        source: "photo",
        photoResult: makePhotoResult({
          confidence01: 0.85,
          lowConfidenceLabelShown: false,
          items: [{
            itemNameRu: "салат",
            portionTextRu: "тарелка",
            portionGrams: 200,
            caloriesKcal: 150,
            proteinG: 5,
            fatG: 10,
            carbsG: 12,
            confidence01: 0.85,
          }],
        }),
        degradeModeEnabled: false,
      });

      expect(envelope.text).not.toContain("низкая уверенность");
    });
  });
});
