import type {
  MealDraftRow,
  MealDraftItemRow,
  ConfirmedMealRow,
  MealItemRow,
  MealDraftSource,
} from "../store/types.js";
import { OptimisticVersionError } from "../store/tenantStore.js";
import type { EstimatorResult } from "../kbju/types.js";
import { MANUAL_ENTRY_FAILURE_RESULT } from "../kbju/types.js";
import type { PhotoRecognitionResult } from "../photo/types.js";
import type { TranscriptionResult } from "../voice/types.js";
import { isLowConfidence } from "../photo/photoConfidence.js";
import {
  buildDraftReplyEnvelope,
  buildKbjuFailureEnvelope,
  buildManualEntryPromptEnvelope,
  buildManualEntryInvalidEnvelope,
  buildConfirmedEnvelope,
  buildStaleDraftRejectedEnvelope,
  buildAlreadyConfirmedEnvelope,
} from "./messages.js";
import { parseManualKBJU, buildManualDraftItems } from "./manualEntry.js";
import {
  type C4Deps,
  type MealOrchestratorRequest,
  type MealDraftView,
  type ConfirmResult,
  type ManualKBJUEntry,
  type CorrectionInput,
  type EmitMetricFn,
  draftRowToView,
  isStaleVersion,
  isAlreadyConfirmed,
  METRIC_EVENT_NAMES,
  PHOTO_LOW_CONFIDENCE_THRESHOLD,
} from "./types.js";
import type {
  MealDraftStatus,
  MealSource,
  RussianReplyEnvelope,
  MealItemCandidate,
  KBJUValues,
  ComponentId,
  MetricOutcome,
} from "../shared/types.js";

export interface DraftLookup {
  getMealDraft(draftId: string): Promise<MealDraftRow | null>;
  listMealDraftItems(draftId: string): Promise<MealDraftItemRow[]>;
}

export interface TimezoneResolver {
  getTimezone(userId: string): Promise<string>;
}

export interface MealOrchestratorDeps extends C4Deps {
  draftLookup: DraftLookup;
  timezoneResolver: TimezoneResolver;
}

function estimatorItemsToCandidates(estimatorResult: EstimatorResult): MealItemCandidate[] {
  return estimatorResult.items.map((item) => ({
    itemNameRu: item.itemNameRu,
    portionTextRu: item.portionTextRu,
    portionGrams: item.portionGrams ?? undefined,
    caloriesKcal: item.caloriesKcal,
    proteinG: item.proteinG,
    fatG: item.fatG,
    carbsG: item.carbsG,
    source: item.source,
    sourceRef: item.sourceRef ?? undefined,
    confidence01: item.confidence01 ?? undefined,
  }));
}

function photoItemsToCandidates(photoResult: PhotoRecognitionResult): MealItemCandidate[] {
  return photoResult.items.map((item) => ({
    itemNameRu: item.itemNameRu,
    portionTextRu: item.portionTextRu,
    portionGrams: item.portionGrams ?? undefined,
    caloriesKcal: item.caloriesKcal,
    proteinG: item.proteinG,
    fatG: item.fatG,
    carbsG: item.carbsG,
    source: "llm_fallback" as const,
    sourceRef: undefined,
    confidence01: item.confidence01,
  }));
}

function isManualEntryFailure(estimatorResult: EstimatorResult | undefined): boolean {
  return estimatorResult?.source === "manual_entry_failure";
}

function nowIso(): string {
  return new Date().toISOString();
}

function localDateInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export class MealOrchestrator {
  private readonly deps: MealOrchestratorDeps;

  constructor(deps: MealOrchestratorDeps) {
    this.deps = deps;
  }

  public async handleMealInput(
    request: MealOrchestratorRequest
  ): Promise<RussianReplyEnvelope> {
    const { userId, requestId, chatId, source } = request;

    if (source === "manual") {
      return this.handleManualEntry(request);
    }

    const estimatorResult = request.estimatorResult;

    if (isManualEntryFailure(estimatorResult)) {
      try {
        await this.emitK1K5(requestId, userId, true);
      } catch (err) {
        this.deps.logger.error("K5 metric emission failed during KBJU failure fallback", { error: err });
      }
      return buildKbjuFailureEnvelope(chatId);
    }

    const draftSource: MealDraftSource = this.mapSourceToDraftSource(source);
    const normalizedInputText = request.mealText ?? null;

    let candidates: MealItemCandidate[];
    let totalKBJU: KBJUValues;
    let draftConfidence: number | null = null;
    let photoConfidence: number | null = null;
    let lowConfidenceLabelShown = false;

    if (source === "photo" && request.photoResult) {
      const photoResult = request.photoResult;
      candidates = photoItemsToCandidates(photoResult);
      totalKBJU = photoResult.totalKBJU;
      draftConfidence = photoResult.confidence01;
      photoConfidence = photoResult.confidence01;
      lowConfidenceLabelShown = photoResult.lowConfidenceLabelShown;
    } else if (estimatorResult) {
      candidates = estimatorItemsToCandidates(estimatorResult);
      totalKBJU = estimatorResult.totalKBJU;
      draftConfidence = estimatorResult.confidence01;
    } else {
      await this.emitK1K5(requestId, userId, true);
      return buildKbjuFailureEnvelope(chatId);
    }

    const draftRow = await this.deps.store.withTransaction(userId, async (repo) => {
      const draft = await repo.createMealDraft(userId, {
        source: draftSource,
        status: "awaiting_confirmation",
        normalizedInputText: normalizedInputText ?? undefined,
        photoConfidence01: photoConfidence ?? undefined,
        lowConfidenceLabelShown,
        totalCaloriesKcal: totalKBJU.caloriesKcal,
        totalProteinG: totalKBJU.proteinG,
        totalFatG: totalKBJU.fatG,
        totalCarbsG: totalKBJU.carbsG,
        confidence01: draftConfidence ?? undefined,
      });

      for (const candidate of candidates) {
        await repo.createMealDraftItem(userId, {
          draftId: draft.id,
          itemNameRu: candidate.itemNameRu,
          portionTextRu: candidate.portionTextRu,
          portionGrams: candidate.portionGrams ?? undefined,
          caloriesKcal: candidate.caloriesKcal,
          proteinG: candidate.proteinG,
          fatG: candidate.fatG,
          carbsG: candidate.carbsG,
          source: candidate.source,
          sourceRef: candidate.sourceRef ?? undefined,
          confidence01: candidate.confidence01 ?? undefined,
        });
      }

      return draft;
    });

    const items = await this.deps.draftLookup.listMealDraftItems(draftRow.id);
    const view = draftRowToView(draftRow, items);

    return buildDraftReplyEnvelope(chatId, view);
  }

  public async confirmDraft(
    userId: string,
    requestId: string,
    chatId: number,
    draftId: string,
    expectedVersion: number
  ): Promise<ConfirmResult & { envelope: RussianReplyEnvelope }> {
    const draftRow = await this.deps.draftLookup.getMealDraft(draftId);
    if (!draftRow) {
      return {
        confirmed: false,
        reason: "draft_not_found",
        envelope: buildStaleDraftRejectedEnvelope(chatId),
      };
    }

    if (isAlreadyConfirmed(draftRow.status)) {
      return {
        confirmed: false,
        reason: "already_confirmed",
        envelope: buildAlreadyConfirmedEnvelope(chatId),
      };
    }

    if (isStaleVersion(expectedVersion, draftRow.version)) {
      return {
        confirmed: false,
        reason: "stale_version",
        envelope: buildStaleDraftRejectedEnvelope(chatId),
      };
    }

    const items = await this.deps.draftLookup.listMealDraftItems(draftId);
    const isManual = draftRow.source === "manual";
    const mealSource = (isManual ? "manual" : draftRow.source) as
      | "text"
      | "voice"
      | "photo"
      | "manual";

    let meal: ConfirmedMealRow;
    try {
      meal = await this.deps.store.withTransaction(userId, async (repo) => {
      const updatedDraft = await repo.updateMealDraftWithVersion(userId, {
        id: draftId,
        expectedVersion,
        status: "confirmed",
        totalCaloriesKcal: draftRow.total_calories_kcal ?? undefined,
        totalProteinG: draftRow.total_protein_g ?? undefined,
        totalFatG: draftRow.total_fat_g ?? undefined,
        totalCarbsG: draftRow.total_carbs_g ?? undefined,
        confidence01: draftRow.confidence_0_1 ?? undefined,
        lowConfidenceLabelShown: draftRow.low_confidence_label_shown,
      });

      const confirmedMeal = await repo.createConfirmedMeal(userId, {
        source: mealSource as "text" | "voice" | "photo" | "manual",
        draftId,
        mealLocalDate: await this.todayLocalDate(userId),
        mealLoggedAt: nowIso(),
        totalCaloriesKcal: updatedDraft.total_calories_kcal ?? 0,
        totalProteinG: updatedDraft.total_protein_g ?? 0,
        totalFatG: updatedDraft.total_fat_g ?? 0,
        totalCarbsG: updatedDraft.total_carbs_g ?? 0,
        manualEntry: isManual,
      });

      for (const item of items) {
        await repo.createMealItem(userId, {
          mealId: confirmedMeal.id,
          itemNameRu: item.item_name_ru,
          portionTextRu: item.portion_text_ru,
          portionGrams: item.portion_grams ?? undefined,
          caloriesKcal: item.calories_kcal,
          proteinG: item.protein_g,
          fatG: item.fat_g,
          carbsG: item.carbs_g,
          source: item.source,
          sourceRef: item.source_ref ?? undefined,
        });
      }

      await repo.createAuditEvent(userId, {
        eventType: "meal_created",
        entityType: "confirmed_meal",
        entityId: confirmedMeal.id,
        afterSnapshot: {
          draft_id: draftId,
          total_calories_kcal: confirmedMeal.total_calories_kcal,
          total_protein_g: confirmedMeal.total_protein_g,
          total_fat_g: confirmedMeal.total_fat_g,
          total_carbs_g: confirmedMeal.total_carbs_g,
          source: mealSource,
        },
      });

      return confirmedMeal;
      });
    } catch (err) {
      if (err instanceof OptimisticVersionError) {
        const refreshedDraft = await this.deps.draftLookup.getMealDraft(draftId);
        if (refreshedDraft && isAlreadyConfirmed(refreshedDraft.status)) {
          return {
            confirmed: false,
            reason: "already_confirmed",
            envelope: buildAlreadyConfirmedEnvelope(chatId),
          };
        }
        return {
          confirmed: false,
          reason: "stale_version",
          envelope: buildStaleDraftRejectedEnvelope(chatId),
        };
      }
      throw err;
    }

    try {
      await this.emitK1K2(requestId, userId, isManual);
    } catch (err) {
      this.deps.logger.error("K1/K2 metric emission failed after confirm", { error: err });
    }

    return {
      confirmed: true,
      meal,
      envelope: buildConfirmedEnvelope(chatId),
    };
  }

  public async applyCorrection(
    userId: string,
    requestId: string,
    chatId: number,
    correction: CorrectionInput
  ): Promise<RussianReplyEnvelope> {
    const draftRow = await this.deps.draftLookup.getMealDraft(correction.draftId);
    if (!draftRow) {
      return buildStaleDraftRejectedEnvelope(chatId);
    }

    if (isAlreadyConfirmed(draftRow.status)) {
      return buildAlreadyConfirmedEnvelope(chatId);
    }

    try {
      const updatedDraft = await this.deps.store.withTransaction(
        userId,
        async (repo) => {
          const updated = await repo.updateMealDraftWithVersion(userId, {
            id: correction.draftId,
            expectedVersion: correction.expectedVersion,
            status: "awaiting_confirmation",
            normalizedInputText: draftRow.normalized_input_text ?? undefined,
            totalCaloriesKcal: correction.correctedKBJU.caloriesKcal,
            totalProteinG: correction.correctedKBJU.proteinG,
            totalFatG: correction.correctedKBJU.fatG,
            totalCarbsG: correction.correctedKBJU.carbsG,
            confidence01: draftRow.confidence_0_1 ?? undefined,
            lowConfidenceLabelShown: draftRow.low_confidence_label_shown,
          });

          for (const candidate of correction.correctedItems) {
            await repo.createMealDraftItem(userId, {
              draftId: correction.draftId,
              itemNameRu: candidate.itemNameRu,
              portionTextRu: candidate.portionTextRu,
              portionGrams: candidate.portionGrams ?? undefined,
              caloriesKcal: candidate.caloriesKcal,
              proteinG: candidate.proteinG,
              fatG: candidate.fatG,
              carbsG: candidate.carbsG,
              source: candidate.source,
              sourceRef: candidate.sourceRef ?? undefined,
              confidence01: candidate.confidence01 ?? undefined,
            });
          }

          return updated;
        }
      );

      const items = await this.deps.draftLookup.listMealDraftItems(
        correction.draftId
      );
      const view = draftRowToView(updatedDraft, items);

      return buildDraftReplyEnvelope(chatId, view);
    } catch (err) {
      if (err instanceof OptimisticVersionError) {
        return buildStaleDraftRejectedEnvelope(chatId);
      }
      throw err;
    }
  }

  public async handleManualEntry(
    request: MealOrchestratorRequest
  ): Promise<RussianReplyEnvelope> {
    const { userId, requestId, chatId } = request;

    if (!request.mealText) {
      return buildManualEntryPromptEnvelope(chatId);
    }

    const parseResult = parseManualKBJU(request.mealText);
    if (!parseResult.valid || !parseResult.values) {
      return buildManualEntryInvalidEnvelope(chatId);
    }

    const entry = parseResult.values;
    const candidates = buildManualDraftItems(entry);
    const totalKBJU: KBJUValues = {
      caloriesKcal: entry.caloriesKcal,
      proteinG: entry.proteinG,
      fatG: entry.fatG,
      carbsG: entry.carbsG,
    };

    const draftRow = await this.deps.store.withTransaction(userId, async (repo) => {
      const draft = await repo.createMealDraft(userId, {
        source: "manual",
        status: "awaiting_confirmation",
        lowConfidenceLabelShown: false,
        totalCaloriesKcal: totalKBJU.caloriesKcal,
        totalProteinG: totalKBJU.proteinG,
        totalFatG: totalKBJU.fatG,
        totalCarbsG: totalKBJU.carbsG,
        confidence01: undefined,
      });

      for (const candidate of candidates) {
        await repo.createMealDraftItem(userId, {
          draftId: draft.id,
          itemNameRu: candidate.itemNameRu,
          portionTextRu: candidate.portionTextRu,
          portionGrams: candidate.portionGrams ?? undefined,
          caloriesKcal: candidate.caloriesKcal,
          proteinG: candidate.proteinG,
          fatG: candidate.fatG,
          carbsG: candidate.carbsG,
          source: candidate.source,
          sourceRef: candidate.sourceRef ?? undefined,
          confidence01: candidate.confidence01 ?? undefined,
        });
      }

      return draft;
    });

    const items = await this.deps.draftLookup.listMealDraftItems(draftRow.id);
    const view = draftRowToView(draftRow, items);

    return buildDraftReplyEnvelope(chatId, view);
  }

  private mapSourceToDraftSource(source: MealOrchestratorRequest["source"]): MealDraftSource {
    switch (source) {
      case "text":
        return "text";
      case "voice":
        return "voice";
      case "photo":
        return "photo";
      case "manual":
        return "manual";
    }
  }

  private async emitK1K2(
    requestId: string,
    userId: string,
    isManual: boolean
  ): Promise<void> {
    await Promise.all([
      this.deps.emitMetric(
        userId,
        requestId,
        METRIC_EVENT_NAMES.meals_confirmed_total,
        "C4",
        "success",
        { source: isManual ? "manual" : "auto" }
      ),
      this.deps.emitMetric(
        userId,
        requestId,
        METRIC_EVENT_NAMES.meals_per_day_per_user,
        "C4",
        "success",
        {}
      ),
    ]);
  }

  private async emitK1K5(
    requestId: string,
    userId: string,
    fallback: boolean
  ): Promise<void> {
    if (fallback) {
      await this.deps.emitMetric(
        userId,
        requestId,
        METRIC_EVENT_NAMES.manual_entry_used_total,
        "C4",
        "success",
        {}
      );
    }
  }

  private async todayLocalDate(userId: string): Promise<string> {
    try {
      const tz = await this.deps.timezoneResolver.getTimezone(userId);
      return localDateInZone(tz);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }
}
