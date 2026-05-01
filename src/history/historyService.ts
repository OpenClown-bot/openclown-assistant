import type {
  HistoryDeps,
  HistoryPage,
  HistoryMutationResult,
  EditMealInput,
  DeleteMealInput,
  HistoryCursor,
  ConfirmedMealView,
} from "./types.js";
import {
  computeCorrectionDelta,
  buildAuditSnapshot,
  snapshotToJson,
  HISTORY_PAGE_SIZE,
} from "./types.js";

export class HistoryService {
  constructor(private deps: HistoryDeps) {}

  async listHistory(userId: string, cursor?: HistoryCursor): Promise<HistoryPage> {
    const offset = cursor?.offset ?? 0;
    const meals = await this.deps.listConfirmedMealsPage(userId, offset, HISTORY_PAGE_SIZE + 1, false);
    const hasMore = meals.length > HISTORY_PAGE_SIZE;
    const pageMeals = hasMore ? meals.slice(0, HISTORY_PAGE_SIZE) : meals;
    const nextCursor: HistoryCursor | null =
      hasMore ? { offset: offset + HISTORY_PAGE_SIZE } : null;

    return { meals: pageMeals, nextCursor };
  }

  async editMeal(userId: string, input: EditMealInput): Promise<HistoryMutationResult> {
    const meal = await this.deps.getConfirmedMeal(userId, input.mealId);

    if (!meal || meal.deletedAt !== null) {
      return { kind: "not_found" };
    }

    if (meal.version !== input.expectedVersion) {
      return { kind: "not_found" };
    }

    const beforeItems = await this.deps.listMealItems(userId, input.mealId);
    const beforeSnapshot = buildAuditSnapshot(meal.totalKBJU, beforeItems);

    const updatedMeal = await this.deps.updateConfirmedMealWithVersion(
      userId,
      input.mealId,
      input.expectedVersion,
      input.correctedKBJU
    );

    const newItems = await this.deps.replaceMealItems(
      userId,
      input.mealId,
      input.correctedItems
    );

    const afterSnapshot = buildAuditSnapshot(input.correctedKBJU, newItems);
    const correctionDelta = computeCorrectionDelta(beforeSnapshot, afterSnapshot);

    const auditEventId = await this.deps.createAuditEvent(
      userId,
      "meal_edited",
      "confirmed_meal",
      input.mealId,
      snapshotToJson(beforeSnapshot),
      { ...snapshotToJson(afterSnapshot), correction_delta: correctionDelta }
    );

    const resultMeal: ConfirmedMealView = {
      ...updatedMeal,
      items: newItems,
      totalKBJU: input.correctedKBJU,
    };

    return {
      kind: "success",
      meal: resultMeal,
      auditEventId,
      correctionDelta,
    };
  }

  async deleteMeal(userId: string, input: DeleteMealInput): Promise<HistoryMutationResult> {
    const meal = await this.deps.getConfirmedMeal(userId, input.mealId);

    if (!meal || meal.deletedAt !== null) {
      return { kind: "not_found" };
    }

    if (meal.version !== input.expectedVersion) {
      return { kind: "not_found" };
    }

    const beforeItems = await this.deps.listMealItems(userId, input.mealId);
    const beforeSnapshot = buildAuditSnapshot(meal.totalKBJU, beforeItems);

    const deletedAt = new Date().toISOString();
    const deletedMeal = await this.deps.softDeleteMeal(
      userId,
      input.mealId,
      input.expectedVersion,
      deletedAt
    );

    const afterSnapshot = buildAuditSnapshot(meal.totalKBJU, beforeItems);

    const auditEventId = await this.deps.createAuditEvent(
      userId,
      "meal_deleted",
      "confirmed_meal",
      input.mealId,
      snapshotToJson(beforeSnapshot),
      snapshotToJson(afterSnapshot)
    );

    const resultMeal: ConfirmedMealView = {
      ...deletedMeal,
      items: beforeItems,
    };

    return {
      kind: "success",
      meal: resultMeal,
      auditEventId,
      correctionDelta: {
        caloriesKcalDelta: -meal.totalKBJU.caloriesKcal,
        proteinGDelta: -meal.totalKBJU.proteinG,
        fatGDelta: -meal.totalKBJU.fatG,
        carbsGDelta: -meal.totalKBJU.carbsG,
        itemChanges: {
          addedCount: 0,
          removedCount: meal.items.length,
          modifiedCount: 0,
        },
      },
    };
  }
}
