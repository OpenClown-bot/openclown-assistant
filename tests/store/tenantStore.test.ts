import { types as pgTypes } from "pg";
import type { QueryResult, QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";
import type { TenantStore } from "../../src/store/types.js";
import {
  OptimisticVersionError,
  TenantStoreError,
  TenantPostgresStore,
  nextVersion,
  registerPgNumericTypeParser,
  type TenantConnectionPool,
  type TenantPoolClient,
} from "../../src/store/tenantStore.js";

const NUMERIC_OID = pgTypes.builtins.NUMERIC;
const defaultNumericTextParser = pgTypes.getTypeParser(NUMERIC_OID, "text");
const VALID_USER_ID = "123e4567-e89b-42d3-a456-426614174000";

type NonUserScopedMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => unknown
    ? Args extends [string, ...unknown[]]
      ? never
      : K
    : never;
}[keyof T];

const tenantStoreMethodsRequireUserId: NonUserScopedMethods<TenantStore> extends never ? true : false = true;

const expectedTenantStoreMethods = [
  "withTransaction",
  "createUser",
  "getUser",
  "updateUserOnboardingStatus",
  "deleteUser",
  "createUserProfile",
  "getLatestUserProfile",
  "createUserTarget",
  "upsertSummarySchedule",
  "listSummarySchedules",
  "upsertOnboardingState",
  "updateOnboardingStateWithVersion",
  "createTranscript",
  "createMealDraft",
  "updateMealDraftWithVersion",
  "createMealDraftItem",
  "createConfirmedMeal",
  "listConfirmedMeals",
  "softDeleteConfirmedMealWithVersion",
  "createMealItem",
  "createSummaryRecord",
  "createAuditEvent",
  "createMetricEvent",
  "createCostEvent",
  "upsertMonthlySpendCounter",
  "upsertFoodLookupCache",
  "createKbjuAccuracyLabel",
] as const satisfies readonly (keyof TenantStore)[];

describe("tenant store typing and transactions", () => {
  it("registers pg NUMERIC parsing as a JavaScript number", () => {
    expect(defaultNumericTextParser("1500.00")).toBe("1500.00");

    registerPgNumericTypeParser();
    const numericParser = pgTypes.getTypeParser(NUMERIC_OID, "text");

    expect(numericParser("1500.00")).toBe(1500);
    expect(typeof numericParser("1500.00")).toBe("number");
  });

  it("has no unscoped exported repository methods", () => {
    expect(tenantStoreMethodsRequireUserId).toBe(true);

    const prototypeMethods = Object.getOwnPropertyNames(TenantPostgresStore.prototype)
      .filter((name) => name !== "constructor")
      .sort();
    expect(prototypeMethods).toEqual([...expectedTenantStoreMethods].sort());

    for (const methodName of prototypeMethods) {
      const descriptor = Object.getOwnPropertyDescriptor(TenantPostgresStore.prototype, methodName);
      const method = descriptor?.value;
      expect(typeof method).toBe("function");
      if (typeof method !== "function") {
        throw new Error(`${methodName} is not a function`);
      }
      expect(method.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("sets app.user_id inside transactions and keeps SQL parameterized", async () => {
    const client = new FakeClient();
    const store = new TenantPostgresStore(new FakePool(client));

    const result = await store.withTransaction(VALID_USER_ID, async (repository) => {
      const rows = await repository.listConfirmedMeals(VALID_USER_ID, {
        mealLocalDateFrom: undefined,
        mealLocalDateTo: undefined,
        includeDeleted: false,
        limit: 5,
        offset: 0,
      });
      return `rows:${rows.length}`;
    });

    expect(result).toBe("rows:0");
    expect(client.released).toBe(true);
    expect(client.queries[0]).toMatchObject({ text: "BEGIN", values: [] });
    expect(client.queries[1]).toMatchObject({
      text: "SELECT set_config('app.user_id', $1, true)",
      values: [VALID_USER_ID],
    });

    const listQuery = client.queries.find((query) => query.text.includes("FROM confirmed_meals"));
    if (!listQuery) {
      throw new Error("Missing confirmed_meals list query");
    }
    expect(listQuery.text).toContain("WHERE user_id = $1");
    expect(listQuery.values).toEqual([VALID_USER_ID, null, null, false, 5, 0]);
    expect(client.queries.at(-1)).toMatchObject({ text: "COMMIT", values: [] });
  });

  it("rejects invalid userId values before database interaction", async () => {
    const emptyUserIdClient = new FakeClient();
    const emptyUserIdStore = new TenantPostgresStore(new FakePool(emptyUserIdClient));
    await expect(emptyUserIdStore.getUser("")).rejects.toMatchObject({
      name: "TenantStoreError",
      message: "Invalid userId: not a UUID v4",
    });
    expect(emptyUserIdClient.queries).toEqual([]);
    expect(emptyUserIdClient.released).toBe(false);

    const maliciousUserIdClient = new FakeClient();
    const maliciousUserIdStore = new TenantPostgresStore(new FakePool(maliciousUserIdClient));
    await expect(maliciousUserIdStore.getUser("1; DROP TABLE users")).rejects.toBeInstanceOf(TenantStoreError);
    await expect(maliciousUserIdStore.getUser("1; DROP TABLE users")).rejects.toThrow(
      "Invalid userId: not a UUID v4"
    );
    await expect(maliciousUserIdStore.getUser("1; DROP TABLE users")).rejects.not.toThrow("DROP");
    expect(maliciousUserIdClient.queries).toEqual([]);
    expect(maliciousUserIdClient.released).toBe(false);

    const validUserIdClient = new FakeClient();
    const validUserIdStore = new TenantPostgresStore(new FakePool(validUserIdClient));
    await expect(validUserIdStore.getUser(VALID_USER_ID)).resolves.toBeNull();
    expect(validUserIdClient.queries[0]).toMatchObject({ text: "BEGIN", values: [] });
  });

  it("wraps public repository methods in tenant transactions", async () => {
    const client = new FakeClient();
    const store = new TenantPostgresStore(new FakePool(client));

    const deleted = await store.deleteUser(VALID_USER_ID);

    expect(deleted).toBe(true);
    expect(client.queries.map((query) => query.text)).toEqual([
      "BEGIN",
      "SELECT set_config('app.user_id', $1, true)",
      "DELETE FROM users WHERE id = $1",
      "COMMIT",
    ]);
    expect(client.queries[2]?.values).toEqual([VALID_USER_ID]);
    expect(client.released).toBe(true);
  });

  it("rolls back and surfaces stale optimistic versions", async () => {
    const client = new FakeClient();
    const store = new TenantPostgresStore(new FakePool(client));

    await expect(
      store.updateMealDraftWithVersion(VALID_USER_ID, {
        id: "draft-1",
        expectedVersion: 3,
        status: "awaiting_confirmation",
        normalizedInputText: "гречка",
        totalCaloriesKcal: 100,
        totalProteinG: 3,
        totalFatG: 1,
        totalCarbsG: 20,
        confidence01: 0.8,
        lowConfidenceLabelShown: false,
      })
    ).rejects.toBeInstanceOf(OptimisticVersionError);

    expect(client.queries.map((query) => query.text)).toContain("ROLLBACK");
    expect(client.queries.map((query) => query.text)).not.toContain("COMMIT");
    expect(client.released).toBe(true);
    expect(nextVersion(3)).toBe(4);
  });
});

interface RecordedQuery {
  text: string;
  values: unknown[];
}

class FakePool implements TenantConnectionPool {
  public constructor(private readonly client: FakeClient) {}

  public async connect(): Promise<TenantPoolClient> {
    return this.client;
  }

  public async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<Row>> {
    return this.client.query<Row>(text, values);
  }
}

class FakeClient implements TenantPoolClient {
  public readonly queries: RecordedQuery[] = [];
  public released = false;

  public async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<Row>> {
    this.queries.push({ text: text.trim(), values });
    const rowCount = text.trim() === "DELETE FROM users WHERE id = $1" ? 1 : 0;
    return emptyResult<Row>(rowCount);
  }

  public release(): void {
    this.released = true;
  }
}

function emptyResult<Row extends QueryResultRow>(rowCount: number): QueryResult<Row> {
  return {
    command: "",
    rowCount,
    oid: 0,
    fields: [],
    rows: [],
  };
}
