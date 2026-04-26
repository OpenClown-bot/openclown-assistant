---
id: RV-CODE-002
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/12"
ticket_ref: TKT-002@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-26
---

# Code Review — PR #12 (TKT-002@0.1.0)

## Summary
PR #12 delivers the TKT-002@0.1.0 tenant PostgreSQL schema, RLS policies, typed repository layer, migration helpers, and focused unit tests with correct file scope and dependency discipline. CI passes locally. However, one high-severity runtime type-safety defect (NUMERIC columns declared as `number` while `pg` returns `string`) will silently corrupt arithmetic in downstream Tickets. Two medium findings cover missing UUID input validation and a misleading DDL transaction wrapper. Two low findings note an inaccurate execution-log model name and a missing code comment on transaction-local `app.user_id` semantics.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: A single high-severity finding (F-H1) — the NUMERIC/`number` runtime type mismatch — will cause silent string-concatenation bugs in downstream nutrition-arithmetic tickets; it must be fixed before merge.
Recommendation to PO: request changes from Executor on PR #12 to fix F-H1; F-M1, F-M2, F-M3, F-L1, and F-L2 can be patched in the same fix iteration or ticketed.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT-002@0.1.0 §5 Outputs — plus the assigned Ticket file with permitted `status` frontmatter and append-only §10 Execution Log edits. No extra files.
- [x] No changes to TKT-002@0.1.0 §3 NOT-In-Scope items — no Telegram entrypoint, no meal estimation/summary/provider calls, no Docker Compose.
- [x] No new runtime dependencies beyond TKT-002@0.1.0 §7 Constraints allowlist — `dependencies` adds only `pg`; `devDependencies` adds only `@types/pg`.
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited) — see AC mapping in §B.5 below.
- [x] CI green (lint, typecheck, tests, coverage) — `npm run lint` (0), `npm run typecheck` (0), `npm test` (11 passed), `npm run build` (0) all exit 0 locally.
- [x] Definition of Done complete — PR body lists AC proofs, rollback procedure, and no follow-up TKTs.
- [x] Ticket frontmatter `status: in_review` in a separate commit — commit `c59ae4f` is a clean status-only commit separate from implementation commits.

## Findings

### High (blocking)
- **F-H1 (`src/store/types.ts` — all `NUMERIC`-mapped row interfaces, e.g. `UserTargetRow:bmr_kcal`, `ConfirmedMealRow:total_calories_kcal`, `MealItemRow:calories_kcal`, `CostEventRow:estimated_cost_usd`, etc.):** Every column declared as `NUMERIC(P,S)` in `src/store/schema.sql` is typed as `number` in the TypeScript row interfaces, but the `pg` driver returns PostgreSQL `NUMERIC` values as JavaScript `string` by default (OID 1700). At runtime this causes silent string concatenation instead of arithmetic (e.g. `"1500.00" + "10" === "1500.0010"`) and string-lexicographic comparison instead of numeric ordering. Because TKT-005@0.1.0, TKT-003@0.1.0, and TKT-011@0.1.0 will perform arithmetic on these fields, this is a data-corruption bug waiting in production. The unit tests do not catch it because `tests/store/tenantStore.test.ts` uses a `FakeClient` mock that never exercises real `pg` type parsing. Devin Review also flagged this defect on PR #12. — *Responsible role:* Executor. *Suggested remediation:* Register `pg.types.setTypeParser(1700, parseFloat)` in a shared setup module called before `createTenantStore`, OR change all `NUMERIC`-backed interface fields to `string` and require explicit `parseFloat` at consumer boundaries. Either fix must be accompanied by a test that fails if the parser is absent (e.g., an integration assertion or a mock that simulates `pg`'s string-return behavior).

### Medium
- **F-M1 (`src/store/tenantStore.ts:601` and every public method entry point):** `withTransaction` and every repository method accept `userId: string` without validating it is a well-formed UUID. A malicious or buggy caller can pass an empty string, SQL fragment, or non-UUID value. While parameterized queries prevent injection into `set_config('app.user_id', $1, true)`, the invalid value propagates to RLS policies that cast it with `::uuid`, causing a PostgreSQL type-error exception that may bubble up as an unhandled 500-style error. For a tenant-scoped store this is an insufficient input-validation boundary. — *Responsible role:* Executor. *Suggested remediation:* Add a strict UUID regex validation (e.g. `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`) on `userId` inside `withTransaction` (or a shared guard), throwing `TenantStoreError` before any database interaction.
- **F-M2 (`src/store/migrations.ts:33-46`):** `runMigrations` wraps the entire `schema.sql` bootstrap in a single `BEGIN ... COMMIT` explicit transaction. PostgreSQL DDL statements (`CREATE EXTENSION`, `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE`, `GRANT`, `CREATE POLICY`, etc.) trigger implicit commits; if a failure occurs after an implicit commit, the subsequent `ROLLBACK` cannot undo already-committed changes. While `IF NOT EXISTS` guards make re-running safe, the transaction wrapper creates a false atomicity guarantee and may leave the database in a confusing partial state on failure. — *Responsible role:* Executor. *Suggested remediation:* Remove the explicit `BEGIN/COMMIT` wrapper from `runMigrations` and rely on the idempotent `IF NOT EXISTS` guards already present in `schema.sql`. Alternatively, split the SQL into discrete versioned migration steps tracked in `schema_migrations`, each run individually.
- **F-M3 (`tests/store/tenantStore.test.ts` overall):** No test exercises RLS deny-by-default behavior at runtime — i.e., that a `SELECT` on a user-owned table returns zero rows when `app.user_id` is not set. The `FakeClient` mock always returns empty `QueryResult` objects, so it masks whether real PostgreSQL would enforce the policy. Static analysis in `tests/store/schema.test.ts` confirms the SQL text contains the policies, but runtime enforcement is untested. — *Responsible role:* Executor. *Suggested remediation:* Add an integration test (even a lightweight Docker-based PostgreSQL test) that verifies `SELECT * FROM confirmed_meals` returns `[]` when `app.user_id` is absent. If a live database is unavailable in CI, document the test gap explicitly in the PR body and create a follow-up Ticket for integration-test infrastructure.

### Low
- **F-L1 (the assigned Ticket file §10):** The Execution Log contains the line `2026-04-26 20:46 codex-gpt-5.5: started` and `2026-04-26 20:46 codex-gpt-5.5: opened PR #12`. However, the git commit metadata for every commit in PR #12 shows Author `GLM-5.1 Executor <executor-glm-5.1@openclown-assistant.dev>`. The execution log is factually incorrect about the model that performed the work. (Note: independence between Reviewer and Executor is preserved because GLM and Kimi are different model families; the issue is process accuracy, not independence.) — *Responsible role:* Executor. *Suggested remediation:* Append a corrective line to §10 documenting the actual Executor model, or correct the existing lines if the append-only carve-out permits factual corrections.
- **F-L2 (`src/store/tenantStore.ts:601`):** The `set_config('app.user_id', $1, true)` call uses the third parameter `true` (PostgreSQL `is_local`), which means the setting is automatically reverted at transaction end. This safety property is subtle and not documented by an inline comment; a future maintainer might incorrectly assume `app.user_id` persists on the connection after `withTransaction` returns, leading to potential tenant-leak bugs in refactored connection-pool logic. — *Responsible role:* Executor. *Suggested remediation:* Add a concise inline comment on the `set_config` line: `-- third arg 'true' = transaction-local; auto-reverts on COMMIT/ROLLBACK`.

## Red-team probes (Reviewer must address each)
- **Error paths:** `withTransaction` catches errors, executes `ROLLBACK` via `rollbackSafely`, releases the client in `finally`, and re-throws the original error. `OptimisticVersionError` is thrown when `UPDATE ... RETURNING *` returns zero rows (stale version). `TenantStoreError` is thrown on invalid `nextVersion` inputs. These paths are correct and do not leak secrets.
- **Concurrency:** Each request acquires its own client from the pool via `pool.connect()`. `app.user_id` is set with `is_local=true`, so it is transaction-scoped and automatically reverts at COMMIT/ROLLBACK. Two simultaneous requests for the same user run on separate connections with separate `app.user_id` settings. No shared mutable state exists in the repository layer. Correct.
- **Input validation:** No runtime validation of `userId` format exists (F-M1). No other external input surface exists in this store layer (it is not an API boundary). The C1 Telegram entrypoint (TKT-004@0.1.0) is responsible for session-level validation.
- **Prompt injection:** Not applicable; no LLM calls exist in this PR.
- **Secrets:** No database credentials, connection strings, or passwords are committed, logged, or leaked through error messages. `TenantStoreError` and `OptimisticVersionError` messages contain only hardcoded entity names or numeric versions, never user input or secrets.
- **Observability:** Not applicable to this store-layer ticket; ADR-009@0.1.0 audit-event types are defined but no runtime logging or metrics emission is implemented here.

## AC verification mapping (§B.5)
| AC | Location | Status |
|---|---|---|
| AC1 — tests assert schema invariants | `tests/store/schema.test.ts:24-119` | Pass |
| AC2 — tests assert no unscoped methods | `tests/store/tenantStore.test.ts:12-53` (type-level) | Pass |
| AC3 — tests assert SQL parameterized | `tests/store/tenantStore.test.ts:55-69` | Pass |
| AC4 — user-owned tables have `user_id NOT NULL` except `users` and `tenant_audit_runs` | `tests/store/schema.test.ts:55`, `src/store/schema.sql` (verified: `users` has no `user_id`; `tenant_audit_runs` has no `user_id`; all others have `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`) | Pass |
| AC5 — every user-owned table has `ENABLE ROW LEVEL SECURITY` | `tests/store/schema.test.ts:65`, `src/store/schema.sql:361` area | Pass |
| AC6 — no exported repository method can list/mutate without `userId` | `tests/store/tenantStore.test.ts:12` (type-level compile-time check) | Pass |
| AC7 — raw voice/photo durable columns absent | `tests/store/schema.test.ts:96` | Pass |
| AC8 — `users` has no `deleted_at`; onboarding enum has no `deleted` | `tests/store/schema.test.ts:116-118`, `src/store/schema.sql:27`, `src/store/schema.sql:89` | Pass |
| AC9 — `kbju_audit` has `BYPASSRLS`; app role is not a member | `tests/store/schema.test.ts:123-126`, `src/store/schema.sql:7-18` | Pass |

## Dependency verification (§B.4)
- `package.json` `dependencies` on PR head: **only `pg`**.
- `package.json` `dependencies` on main: **none**.
- `package.json` `devDependencies` on PR head: adds `@types/pg` to the prior allowlist (`typescript`, `tsx`, `vitest`, `@types/node`).
- `package-lock.json` changes are limited to `pg` and its transitive runtime dependencies (`pg-pool`, `pg-protocol`, `pg-types`, `pgpass`, etc.) plus `@types/pg`. No orphan or unexpected packages.

## Lint / typing (§B.9)
- `npm run lint` → 0 errors (still aliased to `npm run typecheck`; F-M1 from RV-CODE-001 remains deferred to a follow-up lint-toolchain Ticket).
- `npm run typecheck` → 0 errors.
- `npm test` → 11 tests passed, 0 failed.
- `npm run build` → 0 errors.

## Hostile-reader pass summary (§B.10–13)
- **Tenant isolation bypass via forged `app.user_id`:** RLS isolation is per-session; the repository layer trusts the caller to supply the correct `userId`. This is by design per ARCH-001@0.2.0 §3.3 — the C1 Telegram entrypoint is responsible for session authentication. The repository layer itself does not validate session origin (not its job), but it SHOULD validate UUID format (F-M1).
- **Connection pool exhaustion / transaction leakage:** `withTransaction` releases the client in `finally`. `app.user_id` is transaction-local (`is_local=true`). No leakage between requests.
- **Migration order corruption:** `schema.sql` is idempotent (`IF NOT EXISTS` everywhere). Concurrent migration runs race on DDL locks, which PostgreSQL handles safely. No ordering issue.
- **Audit log on errors:** The `createAuditEvent` repository method is synchronous within a transaction. If the caller catches an error and calls `createAuditEvent` in a `catch` block, it will write. The code does not auto-audit on unhandled errors; per ADR-009@0.1.0, C11 K4 is async/best-effort and not implemented in this Ticket.
- **Rollback procedure:** PR body states "revert this PR and drop the created PostgreSQL schema objects/roles from the target database if migrations were applied." ARCH-001@0.2.0 §11 confirms this is a greenfield deployment; this rollback procedure is acceptable.
- **Follow-up TKTs:** PR body states "None." No in-scope items were deferred that should have been fixed here.
