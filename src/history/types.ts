import type { KBJUValues, AuditEventType, MealItemCandidate } from "../shared/types.js";
import type { JsonValue, JsonObject } from "../store/types.js";

export const HISTORY_PAGE_SIZE = 5;

export interface HistoryCursor {
  readonly offset: number;
}

export interface MealItemView {
  id: string;
  itemNameRu: string;
  portionTextRu: string;
  portionGrams: number | null;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: string;
  sourceRef: string | null;
}

export interface ConfirmedMealView {
  id: string;
  userId: string;
  source: string;
  mealLocalDate: string;
  mealLoggedAt: string;
  totalKBJU: KBJUValues;
  version: number;
  deletedAt: string | null;
  items: MealItemView[];
}

export interface HistoryPage {
  meals: ConfirmedMealView[];
  nextCursor: HistoryCursor | null;
}

export type HistoryMutationResult =
  | { kind: "success"; meal: ConfirmedMealView; auditEventId: string; correctionDelta: CorrectionDelta | null }
  | { kind: "not_found" };

export interface EditMealInput {
  mealId: string;
  expectedVersion: number;
  correctedItems: MealItemCandidate[];
  correctedKBJU: KBJUValues;
}

export interface DeleteMealInput {
  mealId: string;
  expectedVersion: number;
}

export interface CorrectionDelta {
  caloriesKcalDelta: number;
  proteinGDelta: number;
  fatGDelta: number;
  carbsGDelta: number;
  itemChanges: ItemChangeSummary;
  [key: string]: JsonValue;
}

export interface ItemChangeSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  [key: string]: JsonValue;
}

export interface AuditSnapshot {
  totals: KBJUValues;
  items: MealItemView[];
}

export class HistoryMutationConflictError extends Error {
  constructor(
    public readonly entityTag: string,
    public readonly expectedVersion: number
  ) {
    super(`history mutation conflict: ${entityTag} expected version ${expectedVersion}`);
    this.name = "HistoryMutationConflictError";
  }
}

export interface HistoryTransactionalDeps {
  getConfirmedMeal(userId: string, mealId: string): Promise<ConfirmedMealView | null>;
  listMealItems(userId: string, mealId: string): Promise<MealItemView[]>;
  listConfirmedMealsPage(
    userId: string,
    offset: number,
    limit: number,
    includeDeleted: boolean
  ): Promise<ConfirmedMealView[]>;
  updateConfirmedMealWithVersion(
    userId: string,
    mealId: string,
    expectedVersion: number,
    totals: KBJUValues
  ): Promise<ConfirmedMealView>;
  replaceMealItems(
    userId: string,
    mealId: string,
    items: MealItemCandidate[]
  ): Promise<MealItemView[]>;
  softDeleteMeal(
    userId: string,
    mealId: string,
    expectedVersion: number,
    deletedAt: string
  ): Promise<ConfirmedMealView>;
  createAuditEvent(
    userId: string,
    eventType: AuditEventType,
    entityType: string,
    entityId: string,
    beforeSnapshot: JsonObject | null,
    afterSnapshot: JsonObject | null,
    reason?: string
  ): Promise<string>;
}

export interface HistoryDeps extends HistoryTransactionalDeps {
  withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T>;
}

export function computeCorrectionDelta(
  before: AuditSnapshot,
  after: AuditSnapshot
): CorrectionDelta {
  const beforeIds = new Set(before.items.map((i) => i.id));
  const afterIds = new Set(after.items.map((i) => i.id));

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;

  for (const item of after.items) {
    if (!beforeIds.has(item.id)) {
      addedCount++;
    }
  }
  for (const item of before.items) {
    if (!afterIds.has(item.id)) {
      removedCount++;
    } else {
      const afterItem = after.items.find((i) => i.id === item.id);
      if (
        afterItem &&
        (afterItem.caloriesKcal !== item.caloriesKcal ||
          afterItem.proteinG !== item.proteinG ||
          afterItem.fatG !== item.fatG ||
          afterItem.carbsG !== item.carbsG ||
          afterItem.portionGrams !== item.portionGrams ||
          afterItem.itemNameRu !== item.itemNameRu ||
          afterItem.portionTextRu !== item.portionTextRu)
      ) {
        modifiedCount++;
      }
    }
  }

  return {
    caloriesKcalDelta: after.totals.caloriesKcal - before.totals.caloriesKcal,
    proteinGDelta: after.totals.proteinG - before.totals.proteinG,
    fatGDelta: after.totals.fatG - before.totals.fatG,
    carbsGDelta: after.totals.carbsG - before.totals.carbsG,
    itemChanges: { addedCount, removedCount, modifiedCount },
  };
}

export function buildAuditSnapshot(totals: KBJUValues, items: MealItemView[]): AuditSnapshot {
  return { totals, items };
}

export function snapshotToJson(snapshot: AuditSnapshot): JsonObject {
  return {
    calories_kcal: snapshot.totals.caloriesKcal,
    protein_g: snapshot.totals.proteinG,
    fat_g: snapshot.totals.fatG,
    carbs_g: snapshot.totals.carbsG,
    items: snapshot.items.map((item) => ({
      id: item.id,
      item_name_ru: item.itemNameRu,
      portion_text_ru: item.portionTextRu,
      portion_grams: item.portionGrams,
      calories_kcal: item.caloriesKcal,
      protein_g: item.proteinG,
      fat_g: item.fatG,
      carbs_g: item.carbsG,
      source: item.source,
      source_ref: item.sourceRef,
    })),
  };
}
