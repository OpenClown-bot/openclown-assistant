import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { QueryResultRow } from "pg";
import type { TenantQueryable } from "./tenantStore.js";

export const TENANT_STORE_SCHEMA_COMPONENT = "C3 Tenant-Scoped Store";
export const TENANT_STORE_SCHEMA_VERSION = "TKT-002@0.1.0";

export interface RunMigrationsOptions {
  schemaPath?: string;
  schemaSql?: string;
  expectedVersion?: string;
}

interface SchemaMigrationRow extends QueryResultRow {
  version: string;
}

export class SchemaVersionError extends Error {
  public readonly expectedVersion: string;
  public readonly observedVersion: string | null;

  constructor(expectedVersion: string, observedVersion: string | null) {
    super(
      `Tenant store schema version mismatch: expected ${expectedVersion}, observed ${observedVersion ?? "missing"}`
    );
    this.name = "SchemaVersionError";
    this.expectedVersion = expectedVersion;
    this.observedVersion = observedVersion;
  }
}

export async function runMigrations(db: TenantQueryable, options: RunMigrationsOptions = {}): Promise<void> {
  const schemaSql = options.schemaSql ?? (await loadSchemaSql(options.schemaPath));
  await db.query("BEGIN");
  try {
    await db.query(schemaSql);
    await db.query("COMMIT");
  } catch (error) {
    await rollbackSafely(db);
    throw error;
  }
  await validateSchemaVersion(db, options.expectedVersion ?? TENANT_STORE_SCHEMA_VERSION);
}

export async function validateSchemaVersion(
  db: TenantQueryable,
  expectedVersion = TENANT_STORE_SCHEMA_VERSION
): Promise<void> {
  const result = await db.query<SchemaMigrationRow>(
    "SELECT version FROM schema_migrations WHERE component = $1",
    [TENANT_STORE_SCHEMA_COMPONENT]
  );
  const observedVersion = result.rows[0]?.version ?? null;
  if (observedVersion !== expectedVersion) {
    throw new SchemaVersionError(expectedVersion, observedVersion);
  }
}

async function loadSchemaSql(schemaPath?: string): Promise<string> {
  const resolvedPath = schemaPath ?? resolve(process.cwd(), "src/store/schema.sql");
  return readFile(resolvedPath, "utf8");
}

async function rollbackSafely(db: TenantQueryable): Promise<void> {
  try {
    await db.query("ROLLBACK");
  } catch {
    // Preserve the original migration error.
  }
}
