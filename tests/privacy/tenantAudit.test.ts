import { describe, expect, it } from "vitest";
import { runEndOfPilotTenantAudit, TenantAuditConfigError } from "../../src/privacy/tenantAudit.js";
import type { TenantAuditConnection } from "../../src/privacy/types.js";

class MemoryAuditConnection implements TenantAuditConnection {
  public readonly queries: string[] = [];
  public closed = false;

  public constructor(private readonly counts: number[]) {}

  public async query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]) {
    this.queries.push(sql);
    if (sql.includes("INSERT INTO tenant_audit_runs")) {
      return {
        rows: [
          {
            id: "audit-run-1",
            checked_tables: values?.[0],
            cross_user_reference_count: values?.[1],
            findings: values?.[2],
          } as unknown as Row,
        ],
        rowCount: 1,
      };
    }

    return { rows: [{ count: this.counts.shift() ?? 0 } as unknown as Row], rowCount: 1 };
  }

  public async end(): Promise<void> {
    this.closed = true;
  }
}

describe("runEndOfPilotTenantAudit", () => {
  it("refuses to start when AUDIT_DB_URL is unset", async () => {
    await expect(runEndOfPilotTenantAudit({ env: {}, connect: async () => new MemoryAuditConnection([]) })).rejects.toBeInstanceOf(
      TenantAuditConfigError,
    );
  });

  it("returns aggregate findings without user payloads", async () => {
    const connection = new MemoryAuditConnection([0, 2, 0, 1, 0, 0]);

    const result = await runEndOfPilotTenantAudit({
      env: { AUDIT_DB_URL: "postgres://audit" },
      connect: async () => connection,
    });

    expect(result).toMatchObject({
      runId: "audit-run-1",
      runType: "end_of_pilot_k4",
      crossUserReferenceCount: 3,
    });
    expect(result.findings).toEqual([
      { check: "meal_drafts_transcript_owner", table: "meal_drafts", count: 2 },
      { check: "confirmed_meals_draft_owner", table: "confirmed_meals", count: 1 },
    ]);
    expect(result.findings.every((finding) => Object.keys(finding).sort().join(",") === "check,count,table")).toBe(true);
    expect(JSON.stringify(result.findings)).not.toMatch(/user_id|telegram|payload|item_name|user-\d/i);
    expect(connection.closed).toBe(true);
  });

  it("writes only aggregate counts and findings to tenant_audit_runs.findings", async () => {
    const connection = new MemoryAuditConnection([1, 0, 0, 0, 0, 0]);

    await runEndOfPilotTenantAudit({
      env: { AUDIT_DB_URL: "postgres://audit" },
      connect: async () => connection,
    });

    const insertSql = connection.queries.find((query) => query.includes("INSERT INTO tenant_audit_runs"));
    expect(insertSql).toContain("cross_user_reference_count");
    expect(insertSql).toContain("findings");
    expect(insertSql).not.toContain("user_id");
  });

  it("keeps AUDIT_DB_URL out of application skill source imports", async () => {
    const applicationFiles = [
      "src/shared/types.ts",
      "src/store/tenantStore.ts",
      "src/telegram/types.ts",
      "src/observability/events.ts",
      "src/history/historyService.ts",
      "src/summary/summaryScheduler.ts",
    ];

    for (const file of applicationFiles) {
      const source = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"));
      expect(source, file).not.toContain("AUDIT_DB_URL");
    }
  });
});
