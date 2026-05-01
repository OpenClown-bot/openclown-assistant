import type {
  HistoryDeps,
  HistoryTransactionalDeps,
  HistoryPage,
  HistoryMutationResult,
  EditMealInput,
  DeleteMealInput,
  HistoryCursor,
  ConfirmedMealView,
} from "./types.js";
import {
  HistoryMutationConflictError,
  computeCorrectionDelta,
  buildAuditSnapshot,
  snapshotToJson,
  HISTORY_PAGE_SIZE,
} from "./types.js";

function sortMealsNewestFirst(meals: ConfirmedMealView[]): ConfirmedMealView[] {
  return [...meals].sort((a, b) => {
    const dateCompare = b.mealLoggedAt.localeCompare(a.mealLoggedAt);
    if (dateCompare !== 0) return dateCompare;
    return b.id.localeCompare(a.id);
  });
}

export class HistoryService {
  constructor(private deps: HistoryDeps) {}

  async listHistory(userId: string, cursor?: HistoryCursor): Promise<HistoryPage> {
    const offset = cursor?.offset ?? 0;
    const meals = await this.deps.listConfirmedMealsPage(userId, offset, HISTORY_PAGE_SIZE + 1, false);
    const sorted = sortMealsNewestFirst(meals);
    const hasMore = sorted.length > HISTORY_PAGE_SIZE;
    const pageMeals = hasMore ? sorted.slice(0, HISTORY_PAGE_SIZE) : sorted;
    const nextCursor: HistoryCursor | null =
      hasMore ? { offset: offset + HISTORY_PAGE_SIZE } : null;

    return { meals: pageMeals, nextCursor };
  }

  async editMeal(userId: string, input: EditMealInput): Promise<HistoryMutationResult> {
    try {
      return await this.deps.withTransaction(async (tx) => {
        const meal = await tx.getConfirmedMeal(userId, input.mealId);

        if (!meal || meal.deletedAt !== null) {
          return { kind: "not_found" as const };
        }

        if (meal.version !== input.expectedVersion) {
          return { kind: "not_found" as const };
        }

        const beforeItems = await tx.listMealItems(userId, input.mealId);
        const beforeSnapshot = buildAuditSnapshot(meal.totalKBJU, beforeItems);

        const updatedMeal = await tx.updateConfirmedMealWithVersion(
          userId,
          input.mealId,
          input.expectedVersion,
          input.correctedKBJU
        );

        const newItems = await tx.replaceMealItems(
          userId,
          input.mealId,
          input.correctedItems
        );

        const afterSnapshot = buildAuditSnapshot(input.correctedKBJU, newItems);
        const correctionDelta = computeCorrectionDelta(beforeSnapshot, afterSnapshot);

        const auditEventId = await tx.createAuditEvent(
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
          kind: "success" as const,
          meal: resultMeal,
          auditEventId,
          correctionDelta,
        };
      });
    } catch (err) {
      if (err instanceof HistoryMutationConflictError) {
        return { kind: "not_found" };
      }
      throw err;
    }
  }

  async deleteMeal(userId: string, input: DeleteMealInput): Promise<HistoryMutationResult> {
    try {
      return await this.deps.withTransaction(async (tx) => {
        const meal = await tx.getConfirmedMeal(userId, input.mealId);

        if (!meal || meal.deletedAt !== null) {
          return { kind: "not_found" as const };
        }

        if (meal.version !== input.expectedVersion) {
          return { kind: "not_found" as const };
        }

        const beforeItems = await tx.listMealItems(userId, input.mealId);
        const beforeSnapshot = buildAuditSnapshot(meal.totalKBJU, beforeItems);

        const deletedAt = new Date().toISOString();
        const deletedMeal = await tx.softDeleteMeal(
          userId,
          input.mealId,
          input.expectedVersion,
          deletedAt
        );

        const afterSnapshot = buildAuditSnapshot(meal.totalKBJU, beforeItems);

        const auditEventId = await tx.createAuditEvent(
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
          kind: "success" as const,
          meal: resultMeal,
          auditEventId,
          correctionDelta: {
            caloriesKcalDelta: -meal.totalKBJU.caloriesKcal,
            proteinGDelta: -meal.totalKBJU.proteinG,
            fatGDelta: -meal.totalKBJU.fatG,
            carbsGDelta: -meal.totalKBJU.carbsG,
            itemChanges: {
              addedCount: 0,
              removedCount: beforeItems.length,
              modifiedCount: 0,
            },
          },
        };
      });
    } catch (err) {
      if (err instanceof HistoryMutationConflictError) {
        return { kind: "not_found" };
      }
      throw err;
    }
  }
}
