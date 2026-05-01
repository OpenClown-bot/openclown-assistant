import { describe, it, expect, vi, beforeEach } from "vitest";
import { HistoryService } from "../../src/history/historyService.js";
import {
  HistoryMutationConflictError,
} from "../../src/history/types.js";
import type {
  HistoryDeps,
  HistoryTransactionalDeps,
  ConfirmedMealView,
  MealItemView,
  EditMealInput,
  DeleteMealInput,
} from "../../src/history/types.js";
import type { KBJUValues, MealItemCandidate } from "../../src/shared/types.js";
import type { JsonObject } from "../../src/store/types.js";

const USER_A = "user-001";
const USER_B = "user-002";

function makeKBJU(overrides: Partial<KBJUValues> = {}): KBJUValues {
  return {
    caloriesKcal: 500,
    proteinG: 30,
    fatG: 20,
    carbsG: 40,
    ...overrides,
  };
}

function makeMealItem(overrides: Partial<MealItemView> = {}): MealItemView {
  return {
    id: "item-001",
    itemNameRu: "гречка",
    portionTextRu: "200г",
    portionGrams: 200,
    caloriesKcal: 220,
    proteinG: 8.4,
    fatG: 2.2,
    carbsG: 42.6,
    source: "open_food_facts",
    sourceRef: "123456",
    ...overrides,
  };
}

function makeMealItemCandidate(overrides: Partial<MealItemCandidate> = {}): MealItemCandidate {
  return {
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
    ...overrides,
  };
}

function makeMeal(overrides: Partial<ConfirmedMealView> = {}): ConfirmedMealView {
  return {
    id: "meal-001",
    userId: USER_A,
    source: "text",
    mealLocalDate: "2026-04-29",
    mealLoggedAt: "2026-04-29T12:00:00Z",
    totalKBJU: makeKBJU(),
    version: 1,
    deletedAt: null,
    items: [makeMealItem()],
    ...overrides,
  };
}

interface SummaryRecordFixture {
  id: string;
  userId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  deliveredAt: string;
  totalCaloriesKcal: number;
  totalProteinG: number;
  totalFatG: number;
  totalCarbsG: number;
}

interface FakeStore {
  meals: Map<string, ConfirmedMealView>;
  mealItems: Map<string, MealItemView[]>;
  auditEvents: Array<{
    id: string;
    userId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    beforeSnapshot: JsonObject | null;
    afterSnapshot: JsonObject | null;
  }>;
  summaryRecords: SummaryRecordFixture[];
  transactionLog: Array<"begin" | "commit" | "rollback">;
}

function createFakeTransactionalOps(store: FakeStore): HistoryTransactionalDeps {
  let auditCounter = 0;

  return {
    async getConfirmedMeal(userId: string, mealId: string): Promise<ConfirmedMealView | null> {
      const meal = store.meals.get(mealId);
      if (!meal || meal.userId !== userId) return null;
      return { ...meal, items: store.mealItems.get(mealId) ?? [] };
    },

    async listMealItems(userId: string, mealId: string): Promise<MealItemView[]> {
      const meal = store.meals.get(mealId);
      if (!meal || meal.userId !== userId) return [];
      return [...(store.mealItems.get(mealId) ?? [])];
    },

    async listConfirmedMealsPage(
      userId: string,
      offset: number,
      limit: number,
      includeDeleted: boolean
    ): Promise<ConfirmedMealView[]> {
      const all = Array.from(store.meals.values())
        .filter((m) => m.userId === userId)
        .filter((m) => includeDeleted || m.deletedAt === null);
      return all.slice(offset, offset + limit);
    },

    async updateConfirmedMealWithVersion(
      userId: string,
      mealId: string,
      expectedVersion: number,
      totals: KBJUValues
    ): Promise<ConfirmedMealView> {
      const meal = store.meals.get(mealId);
      if (!meal || meal.userId !== userId || meal.version !== expectedVersion) {
        throw new HistoryMutationConflictError("confirmed_meal", expectedVersion);
      }
      meal.version = expectedVersion + 1;
      meal.totalKBJU = totals;
      return { ...meal };
    },

    async replaceMealItems(
      userId: string,
      mealId: string,
      items: MealItemCandidate[]
    ): Promise<MealItemView[]> {
      const meal = store.meals.get(mealId);
      if (!meal || meal.userId !== userId) {
        throw new HistoryMutationConflictError("confirmed_meal", 0);
      }
      const newItems: MealItemView[] = items.map((item, i) => ({
        id: `item-new-${i}`,
        itemNameRu: item.itemNameRu,
        portionTextRu: item.portionTextRu,
        portionGrams: item.portionGrams ?? null,
        caloriesKcal: item.caloriesKcal,
        proteinG: item.proteinG,
        fatG: item.fatG,
        carbsG: item.carbsG,
        source: item.source,
        sourceRef: item.sourceRef ?? null,
      }));
      store.mealItems.set(mealId, newItems);
      return newItems;
    },

    async softDeleteMeal(
      userId: string,
      mealId: string,
      expectedVersion: number,
      deletedAt: string
    ): Promise<ConfirmedMealView> {
      const meal = store.meals.get(mealId);
      if (!meal || meal.userId !== userId || meal.version !== expectedVersion) {
        throw new HistoryMutationConflictError("confirmed_meal", expectedVersion);
      }
      meal.version = expectedVersion + 1;
      meal.deletedAt = deletedAt;
      return { ...meal };
    },

    async createAuditEvent(
      userId: string,
      eventType: string,
      entityType: string,
      entityId: string,
      beforeSnapshot: JsonObject | null,
      afterSnapshot: JsonObject | null,
      _reason?: string
    ): Promise<string> {
      auditCounter++;
      const id = `audit-${auditCounter}`;
      store.auditEvents.push({
        id,
        userId,
        eventType,
        entityType,
        entityId,
        beforeSnapshot,
        afterSnapshot,
      });
      return id;
    },
  };
}

function snapshotStore(store: FakeStore) {
  return {
    meals: new Map(Array.from(store.meals.entries()).map(([k, v]) => [k, { ...v, totalKBJU: { ...v.totalKBJU }, items: [...v.items] }])),
    mealItems: new Map(Array.from(store.mealItems.entries()).map(([k, v]) => [k, [...v]])),
    auditEvents: [...store.auditEvents],
    summaryRecords: store.summaryRecords.map((r) => ({ ...r })),
  };
}

function restoreStore(store: FakeStore, snapshot: ReturnType<typeof snapshotStore>) {
  store.meals = snapshot.meals;
  store.mealItems = snapshot.mealItems;
  store.auditEvents = snapshot.auditEvents;
  store.summaryRecords = snapshot.summaryRecords;
}

function createFakeDeps(store: FakeStore): HistoryDeps {
  const ops = createFakeTransactionalOps(store);

  return {
    ...ops,
    async withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T> {
      const snapshot = snapshotStore(store);
      store.transactionLog.push("begin");
      try {
        const result = await action(ops);
        store.transactionLog.push("commit");
        return result;
      } catch (err) {
        restoreStore(store, snapshot);
        store.transactionLog.push("rollback");
        throw err;
      }
    },
  };
}

function seedMeals(store: FakeStore, userId: string, count: number): ConfirmedMealView[] {
  const meals: ConfirmedMealView[] = [];
  for (let i = 0; i < count; i++) {
    const meal = makeMeal({
      id: `meal-${userId}-${i}`,
      userId,
      mealLocalDate: `2026-04-${String(29 - i).padStart(2, "0")}`,
      mealLoggedAt: `2026-04-${String(29 - i).padStart(2, "0")}T12:00:00Z`,
      totalKBJU: makeKBJU({ caloriesKcal: 500 + i * 10 }),
      version: 1,
      deletedAt: null,
      items: [makeMealItem({ id: `item-${userId}-${i}-0` })],
    });
    store.meals.set(meal.id, meal);
    store.mealItems.set(meal.id, [makeMealItem({ id: `item-${userId}-${i}-0` })]);
    meals.push(meal);
  }
  return meals;
}

function seedSummaryRecord(store: FakeStore, userId: string): SummaryRecordFixture {
  const record: SummaryRecordFixture = {
    id: "summary-001",
    userId,
    periodType: "daily",
    periodStart: "2026-04-29",
    periodEnd: "2026-04-29",
    deliveredAt: "2026-04-30T08:00:00Z",
    totalCaloriesKcal: 500,
    totalProteinG: 30,
    totalFatG: 20,
    totalCarbsG: 40,
  };
  store.summaryRecords.push(record);
  return record;
}

describe("HistoryService", () => {
  let store: FakeStore;
  let deps: HistoryDeps;
  let service: HistoryService;

  beforeEach(() => {
    store = {
      meals: new Map(),
      mealItems: new Map(),
      auditEvents: [],
      summaryRecords: [],
      transactionLog: [],
    };
    deps = createFakeDeps(store);
    service = new HistoryService(deps);
  });

  describe("listHistory", () => {
    it("returns empty page when no meals exist", async () => {
      const page = await service.listHistory(USER_A);
      expect(page.meals).toHaveLength(0);
      expect(page.nextCursor).toBeNull();
    });

    it("returns up to 5 meals per page newest-first", async () => {
      seedMeals(store, USER_A, 7);
      const page = await service.listHistory(USER_A);

      expect(page.meals).toHaveLength(5);
      expect(page.nextCursor).toEqual({ offset: 5 });

      for (let i = 1; i < page.meals.length; i++) {
        expect(page.meals[i - 1].mealLoggedAt >= page.meals[i].mealLoggedAt).toBe(true);
      }
    });

    it("returns second page with remaining meals", async () => {
      seedMeals(store, USER_A, 7);
      const page1 = await service.listHistory(USER_A);
      const page2 = await service.listHistory(USER_A, page1.nextCursor!);

      expect(page2.meals).toHaveLength(2);
      expect(page2.nextCursor).toBeNull();
    });

    it("does not include deleted meals", async () => {
      const meals = seedMeals(store, USER_A, 3);
      const deletedMeal = meals[0];
      store.meals.set(deletedMeal.id, { ...deletedMeal, deletedAt: "2026-04-30T00:00:00Z" });

      const page = await service.listHistory(USER_A);
      expect(page.meals).toHaveLength(2);
      expect(page.meals.every((m) => m.deletedAt === null)).toBe(true);
    });

    it("uses deterministic tie-breakers for same mealLoggedAt", async () => {
      const meal1 = makeMeal({
        id: "meal-alpha",
        userId: USER_A,
        mealLoggedAt: "2026-04-29T12:00:00Z",
      });
      const meal2 = makeMeal({
        id: "meal-beta",
        userId: USER_A,
        mealLoggedAt: "2026-04-29T12:00:00Z",
      });
      store.meals.set(meal1.id, meal1);
      store.meals.set(meal2.id, meal2);

      const page = await service.listHistory(USER_A);
      expect(page.meals).toHaveLength(2);
      expect(page.meals[0].id > page.meals[1].id).toBe(true);
    });

    it("isolates meals by user_id", async () => {
      seedMeals(store, USER_A, 3);
      seedMeals(store, USER_B, 2);

      const pageA = await service.listHistory(USER_A);
      const pageB = await service.listHistory(USER_B);

      expect(pageA.meals).toHaveLength(3);
      expect(pageB.meals).toHaveLength(2);
      expect(pageA.meals.every((m) => m.userId === USER_A)).toBe(true);
      expect(pageB.meals.every((m) => m.userId === USER_B)).toBe(true);
    });

    it("enforces newest-first even when dependency returns unsorted meals", async () => {
      const mealNew = makeMeal({ id: "meal-new", mealLoggedAt: "2026-04-30T12:00:00Z", userId: USER_A });
      const mealOld = makeMeal({ id: "meal-old", mealLoggedAt: "2026-04-28T12:00:00Z", userId: USER_A });
      const mealMid = makeMeal({ id: "meal-mid", mealLoggedAt: "2026-04-29T12:00:00Z", userId: USER_A });
      store.meals.set("meal-old", mealOld);
      store.meals.set("meal-new", mealNew);
      store.meals.set("meal-mid", mealMid);

      const overrideDeps: HistoryDeps = {
        ...deps,
        async listConfirmedMealsPage(userId: string, offset: number, limit: number, includeDeleted: boolean) {
          const result = await deps.listConfirmedMealsPage(userId, offset, limit, includeDeleted);
          return [...result].reverse();
        },
      };
      const svc = new HistoryService(overrideDeps);

      const page = await svc.listHistory(USER_A);
      expect(page.meals).toHaveLength(3);
      expect(page.meals[0].id).toBe("meal-new");
      expect(page.meals[1].id).toBe("meal-mid");
      expect(page.meals[2].id).toBe("meal-old");
    });
  });

  describe("editMeal", () => {
    it("returns not_found for meal belonging to another user_id", async () => {
      seedMeals(store, USER_A, 1);
      const result = await service.editMeal(USER_B, {
        mealId: "meal-user-001-0",
        expectedVersion: 1,
        correctedItems: [makeMealItemCandidate()],
        correctedKBJU: makeKBJU(),
      });
      expect(result.kind).toBe("not_found");
    });

    it("returns not_found for deleted meal", async () => {
      const meals = seedMeals(store, USER_A, 1);
      store.meals.set(meals[0].id, { ...meals[0], deletedAt: "2026-04-30T00:00:00Z" });

      const result = await service.editMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
        correctedItems: [makeMealItemCandidate()],
        correctedKBJU: makeKBJU(),
      });
      expect(result.kind).toBe("not_found");
    });

    it("returns not_found for version mismatch", async () => {
      seedMeals(store, USER_A, 1);
      const result = await service.editMeal(USER_A, {
        mealId: "meal-user-001-0",
        expectedVersion: 2,
        correctedItems: [makeMealItemCandidate()],
        correctedKBJU: makeKBJU(),
      });
      expect(result.kind).toBe("not_found");
    });

    it("writes before/after audit snapshots and increments meal version", async () => {
      const meals = seedMeals(store, USER_A, 1);
      const meal = meals[0];

      const correctedKBJU = makeKBJU({ caloriesKcal: 600, proteinG: 35 });
      const correctedItems = [
        makeMealItemCandidate({
          itemNameRu: "рис",
          portionTextRu: "300г",
          caloriesKcal: 600,
          proteinG: 35,
          fatG: 20,
          carbsG: 40,
        }),
      ];

      const result = await service.editMeal(USER_A, {
        mealId: meal.id,
        expectedVersion: 1,
        correctedItems,
        correctedKBJU,
      });

      expect(result.kind).toBe("success");

      if (result.kind !== "success") return;

      expect(result.meal.version).toBe(2);
      expect(result.meal.totalKBJU.caloriesKcal).toBe(600);
      expect(result.meal.totalKBJU.proteinG).toBe(35);
      expect(result.auditEventId).toBeTruthy();

      const audit = store.auditEvents[0];
      expect(audit.eventType).toBe("meal_edited");
      expect(audit.entityType).toBe("confirmed_meal");
      expect(audit.entityId).toBe(meal.id);
      expect(audit.beforeSnapshot).toBeTruthy();
      expect(audit.afterSnapshot).toBeTruthy();

      const beforeSnap = audit.beforeSnapshot as JsonObject;
      const afterSnap = audit.afterSnapshot as JsonObject;
      expect(beforeSnap.calories_kcal).toBe(500);
      expect(afterSnap.calories_kcal).toBe(600);
      expect(afterSnap.correction_delta).toBeDefined();
    });

    it("computes correction delta in after snapshot for future summary use", async () => {
      const meals = seedMeals(store, USER_A, 1);

      const correctedKBJU = makeKBJU({ caloriesKcal: 450 });
      const correctedItems = [makeMealItemCandidate({ caloriesKcal: 450 })];

      const result = await service.editMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
        correctedItems,
        correctedKBJU,
      });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;

      expect(result.correctionDelta).toBeTruthy();
      expect(result.correctionDelta!.caloriesKcalDelta).toBe(-50);

      const audit = store.auditEvents[0];
      const afterSnap = audit.afterSnapshot as JsonObject;
      const delta = afterSnap.correction_delta as Record<string, unknown>;
      expect(delta.caloriesKcalDelta).toBe(-50);
    });

    it("returns not_found without existence leakage for non-existent meal", async () => {
      const result = await service.editMeal(USER_A, {
        mealId: "nonexistent-meal",
        expectedVersion: 1,
        correctedItems: [makeMealItemCandidate()],
        correctedKBJU: makeKBJU(),
      });
      expect(result.kind).toBe("not_found");
    });

    it("catches HistoryMutationConflictError from dependency version mismatch and returns not_found", async () => {
      seedMeals(store, USER_A, 1);

      const overrideDeps: HistoryDeps = {
        ...deps,
        async withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T> {
          return deps.withTransaction(async (tx) => {
            const origUpdate = tx.updateConfirmedMealWithVersion.bind(tx);
            const patchedTx: HistoryTransactionalDeps = {
              ...tx,
              async updateConfirmedMealWithVersion() {
                throw new HistoryMutationConflictError("confirmed_meal", 1);
              },
            };
            return action(patchedTx);
          });
        },
      };
      const svc = new HistoryService(overrideDeps);

      const result = await svc.editMeal(USER_A, {
        mealId: "meal-user-001-0",
        expectedVersion: 1,
        correctedItems: [makeMealItemCandidate()],
        correctedKBJU: makeKBJU(),
      });

      expect(result.kind).toBe("not_found");
    });

    it("rolls back edit transaction when audit event fails after meal update", async () => {
      const meals = seedMeals(store, USER_A, 1);
      const meal = meals[0];
      const originalVersion = meal.version;
      const originalKBJU = { ...meal.totalKBJU };

      const overrideDeps: HistoryDeps = {
        ...deps,
        async withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T> {
          return deps.withTransaction(async (tx) => {
            const patchedTx: HistoryTransactionalDeps = {
              ...tx,
              async createAuditEvent() {
                throw new Error("audit write failed");
              },
            };
            return action(patchedTx);
          });
        },
      };
      const svc = new HistoryService(overrideDeps);

      await expect(
        svc.editMeal(USER_A, {
          mealId: meal.id,
          expectedVersion: 1,
          correctedItems: [makeMealItemCandidate()],
          correctedKBJU: makeKBJU({ caloriesKcal: 999 }),
        })
      ).rejects.toThrow("audit write failed");

      expect(store.meals.get(meal.id)!.version).toBe(originalVersion);
      expect(store.meals.get(meal.id)!.totalKBJU.caloriesKcal).toBe(originalKBJU.caloriesKcal);
      expect(store.auditEvents).toHaveLength(0);
      expect(store.transactionLog).toContain("rollback");
    });

    it("successful edit runs inside transaction with commit", async () => {
      const meals = seedMeals(store, USER_A, 1);

      await service.editMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
        correctedItems: [makeMealItemCandidate()],
        correctedKBJU: makeKBJU({ caloriesKcal: 600 }),
      });

      expect(store.transactionLog).toEqual(["begin", "commit"]);
    });
  });

  describe("deleteMeal", () => {
    it("soft-deletes meal by setting deleted_at", async () => {
      const meals = seedMeals(store, USER_A, 1);

      const result = await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
      });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;

      expect(result.meal.deletedAt).toBeTruthy();
      expect(store.meals.get(meals[0].id)!.deletedAt).toBeTruthy();
    });

    it("writes meal_deleted audit event with before/after snapshot", async () => {
      const meals = seedMeals(store, USER_A, 1);

      const result = await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
      });

      expect(result.kind).toBe("success");

      const audit = store.auditEvents[0];
      expect(audit.eventType).toBe("meal_deleted");
      expect(audit.entityType).toBe("confirmed_meal");
      expect(audit.entityId).toBe(meals[0].id);
      expect(audit.beforeSnapshot).toBeTruthy();
      expect(audit.afterSnapshot).toBeTruthy();
    });

    it("excludes deleted meal from future summary query inputs (listHistory)", async () => {
      const meals = seedMeals(store, USER_A, 2);

      await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
      });

      const page = await service.listHistory(USER_A);
      expect(page.meals).toHaveLength(1);
      expect(page.meals[0].id).toBe(meals[1].id);
    });

    it("increments meal version on delete", async () => {
      const meals = seedMeals(store, USER_A, 1);

      const result = await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
      });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;

      expect(result.meal.version).toBe(2);
      expect(store.meals.get(meals[0].id)!.version).toBe(2);
    });

    it("returns not_found for meal owned by another user_id", async () => {
      seedMeals(store, USER_A, 1);

      const result = await service.deleteMeal(USER_B, {
        mealId: "meal-user-001-0",
        expectedVersion: 1,
      });

      expect(result.kind).toBe("not_found");
      expect(store.auditEvents).toHaveLength(0);
    });

    it("returns not_found for already-deleted meal", async () => {
      const meals = seedMeals(store, USER_A, 1);
      store.meals.set(meals[0].id, { ...meals[0], deletedAt: "2026-04-30T00:00:00Z", version: 2 });

      const result = await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 2,
      });

      expect(result.kind).toBe("not_found");
    });

    it("returns not_found without existence leakage for nonexistent meal", async () => {
      const result = await service.deleteMeal(USER_A, {
        mealId: "nonexistent-meal",
        expectedVersion: 1,
      });
      expect(result.kind).toBe("not_found");
      expect(store.auditEvents).toHaveLength(0);
    });

    it("correction delta for delete uses beforeItems.length not meal.items.length", async () => {
      const meal = makeMeal({
        id: "meal-stale-items",
        userId: USER_A,
        items: [],
        version: 1,
      });
      store.meals.set(meal.id, { ...meal });
      store.mealItems.set(meal.id, [
        makeMealItem({ id: "real-item-1" }),
        makeMealItem({ id: "real-item-2", itemNameRu: "салат" }),
      ]);

      const result = await service.deleteMeal(USER_A, {
        mealId: meal.id,
        expectedVersion: 1,
      });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;

      expect(result.correctionDelta!.itemChanges.removedCount).toBe(2);
    });

    it("catches HistoryMutationConflictError from dependency during delete and returns not_found", async () => {
      seedMeals(store, USER_A, 1);

      const overrideDeps: HistoryDeps = {
        ...deps,
        async withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T> {
          return deps.withTransaction(async (tx) => {
            const patchedTx: HistoryTransactionalDeps = {
              ...tx,
              async softDeleteMeal() {
                throw new HistoryMutationConflictError("confirmed_meal", 1);
              },
            };
            return action(patchedTx);
          });
        },
      };
      const svc = new HistoryService(overrideDeps);

      const result = await svc.deleteMeal(USER_A, {
        mealId: "meal-user-001-0",
        expectedVersion: 1,
      });

      expect(result.kind).toBe("not_found");
    });

    it("rolls back delete transaction when audit event fails after soft-delete", async () => {
      const meals = seedMeals(store, USER_A, 1);
      const meal = meals[0];

      const overrideDeps: HistoryDeps = {
        ...deps,
        async withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T> {
          return deps.withTransaction(async (tx) => {
            const patchedTx: HistoryTransactionalDeps = {
              ...tx,
              async createAuditEvent() {
                throw new Error("audit write failed");
              },
            };
            return action(patchedTx);
          });
        },
      };
      const svc = new HistoryService(overrideDeps);

      await expect(
        svc.deleteMeal(USER_A, {
          mealId: meal.id,
          expectedVersion: 1,
        })
      ).rejects.toThrow("audit write failed");

      expect(store.meals.get(meal.id)!.deletedAt).toBeNull();
      expect(store.meals.get(meal.id)!.version).toBe(1);
      expect(store.auditEvents).toHaveLength(0);
      expect(store.transactionLog).toContain("rollback");
    });

    it("successful delete runs inside transaction with commit", async () => {
      const meals = seedMeals(store, USER_A, 1);

      await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
      });

      expect(store.transactionLog).toEqual(["begin", "commit"]);
    });
  });

  describe("already delivered summary records immutability", () => {
    it("delivered summary records are not modified by edit", async () => {
      const meals = seedMeals(store, USER_A, 1);
      seedSummaryRecord(store, USER_A);

      const correctedKBJU = makeKBJU({ caloriesKcal: 700 });
      const correctedItems = [makeMealItemCandidate({ caloriesKcal: 700 })];

      const result = await service.editMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
        correctedItems,
        correctedKBJU,
      });

      expect(result.kind).toBe("success");

      expect(store.summaryRecords).toHaveLength(1);
      expect(store.summaryRecords[0].totalCaloriesKcal).toBe(500);
      expect(store.summaryRecords[0].totalProteinG).toBe(30);
      expect(store.summaryRecords[0].totalFatG).toBe(20);
      expect(store.summaryRecords[0].totalCarbsG).toBe(40);
      expect(store.summaryRecords[0].deliveredAt).toBe("2026-04-30T08:00:00Z");
    });

    it("delivered summary records are not modified by delete", async () => {
      const meals = seedMeals(store, USER_A, 1);
      seedSummaryRecord(store, USER_A);

      const result = await service.deleteMeal(USER_A, {
        mealId: meals[0].id,
        expectedVersion: 1,
      });

      expect(result.kind).toBe("success");

      expect(store.summaryRecords).toHaveLength(1);
      expect(store.summaryRecords[0].totalCaloriesKcal).toBe(500);
      expect(store.summaryRecords[0].totalProteinG).toBe(30);
      expect(store.summaryRecords[0].totalFatG).toBe(20);
      expect(store.summaryRecords[0].totalCarbsG).toBe(40);
      expect(store.summaryRecords[0].deliveredAt).toBe("2026-04-30T08:00:00Z");
    });
  });

  describe("pagination edge cases", () => {
    it("returns exactly 5 meals when exactly 5 exist", async () => {
      seedMeals(store, USER_A, 5);
      const page = await service.listHistory(USER_A);

      expect(page.meals).toHaveLength(5);
      expect(page.nextCursor).toBeNull();
    });

    it("returns correct page when total is a multiple of page size", async () => {
      seedMeals(store, USER_A, 10);
      const page1 = await service.listHistory(USER_A);
      const page2 = await service.listHistory(USER_A, page1.nextCursor!);

      expect(page1.meals).toHaveLength(5);
      expect(page2.meals).toHaveLength(5);
      expect(page2.nextCursor).toBeNull();
    });

    it("returns newest meals first across pages", async () => {
      seedMeals(store, USER_A, 7);
      const page1 = await service.listHistory(USER_A);
      const page2 = await service.listHistory(USER_A, page1.nextCursor!);

      const allDates = [...page1.meals, ...page2.meals].map((m) => m.mealLoggedAt);
      for (let i = 1; i < allDates.length; i++) {
        expect(allDates[i - 1] >= allDates[i]).toBe(true);
      }
    });
  });
});
