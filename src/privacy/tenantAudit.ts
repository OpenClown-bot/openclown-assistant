import type { TenantAuditDeps, TenantAuditFinding, TenantAuditResult, TenantAuditRunRow } from "./types.js";

export const TENANT_AUDIT_CHECKED_TABLES = [
  "user_profiles",
  "user_targets",
  "summary_schedules",
  "onboarding_states",
  "transcripts",
  "meal_drafts",
  "meal_draft_items",
  "confirmed_meals",
  "meal_items",
  "summary_records",
  "audit_events",
  "metric_events",
  "cost_events",
  "monthly_spend_counters",
  "food_lookup_cache",
  "kbju_accuracy_labels",
] as const;

const CROSS_USER_CHECKS: readonly { check: string; table: string; sql: string }[] = [
  {
    check: "user_targets_profile_owner",
    table: "user_targets",
    sql: `SELECT count(*)::int AS count
          FROM user_targets t
          JOIN user_profiles p ON p.id = t.profile_id
          WHERE p.user_id <> t.user_id`,
  },
  {
    check: "meal_drafts_transcript_owner",
    table: "meal_drafts",
    sql: `SELECT count(*)::int AS count
          FROM meal_drafts d
          JOIN transcripts t ON t.id = d.transcript_id
          WHERE d.transcript_id IS NOT NULL AND t.user_id <> d.user_id`,
  },
  {
    check: "meal_draft_items_draft_owner",
    table: "meal_draft_items",
    sql: `SELECT count(*)::int AS count
          FROM meal_draft_items i
          JOIN meal_drafts d ON d.id = i.draft_id
          WHERE d.user_id <> i.user_id`,
  },
  {
    check: "confirmed_meals_draft_owner",
    table: "confirmed_meals",
    sql: `SELECT count(*)::int AS count
          FROM confirmed_meals m
          JOIN meal_drafts d ON d.id = m.draft_id
          WHERE m.draft_id IS NOT NULL AND d.user_id <> m.user_id`,
  },
  {
    check: "meal_items_meal_owner",
    table: "meal_items",
    sql: `SELECT count(*)::int AS count
          FROM meal_items i
          JOIN confirmed_meals m ON m.id = i.meal_id
          WHERE m.user_id <> i.user_id`,
  },
  {
    check: "kbju_accuracy_labels_meal_owner",
    table: "kbju_accuracy_labels",
    sql: `SELECT count(*)::int AS count
          FROM kbju_accuracy_labels l
          JOIN confirmed_meals m ON m.id = l.meal_id
          WHERE m.user_id <> l.user_id`,
  },
];

export class TenantAuditConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TenantAuditConfigError";
  }
}

export async function runEndOfPilotTenantAudit(deps: TenantAuditDeps): Promise<TenantAuditResult> {
  const auditDbUrl = deps.env?.AUDIT_DB_URL;
  if (!auditDbUrl) {
    throw new TenantAuditConfigError("AUDIT_DB_URL is required for the tenant audit runner");
  }

  const connection = await deps.connect(auditDbUrl);
  try {
    const findings: TenantAuditFinding[] = [];
    for (const check of CROSS_USER_CHECKS) {
      const result = await connection.query<{ count: number | string }>(check.sql);
      const count = Number(result.rows[0]?.count ?? 0);
      if (count > 0) {
        findings.push({ check: check.check, table: check.table, count });
      }
    }

    const crossUserReferenceCount = findings.reduce((sum, finding) => sum + finding.count, 0);
    const insertResult = await connection.query<TenantAuditRunRow>(
      `INSERT INTO tenant_audit_runs (
         run_type, checked_tables, cross_user_reference_count, findings, completed_at
       ) VALUES ('end_of_pilot_k4', $1, $2, $3, now())
       RETURNING id, checked_tables, cross_user_reference_count, findings`,
      [TENANT_AUDIT_CHECKED_TABLES, crossUserReferenceCount, findings],
    );

    const row = insertResult.rows[0];
    if (!row) {
      throw new Error("tenant audit run insert returned no row");
    }

    return {
      runId: row.id,
      runType: "end_of_pilot_k4",
      checkedTables: row.checked_tables,
      crossUserReferenceCount: row.cross_user_reference_count,
      findings,
    };
  } finally {
    await connection.end();
  }
}
