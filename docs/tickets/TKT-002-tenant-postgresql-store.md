---
id: TKT-002
title: "Tenant PostgreSQL Store"
status: in_review
arch_ref: ARCH-001@0.2.0
component: "C3 Tenant-Scoped Store"
depends_on: ["TKT-001@0.1.0"]
blocks: ["TKT-003@0.1.0", "TKT-004@0.1.0", "TKT-005@0.1.0", "TKT-009@0.1.0", "TKT-010@0.1.0", "TKT-011@0.1.0", "TKT-012@0.1.0", "TKT-014@0.1.0"]
estimate: L
assigned_executor: "codex-gpt-5.5"
created: 2026-04-26
updated: 2026-04-26
---

# TKT-002: Tenant PostgreSQL Store

## 1. Goal (one sentence, no "and")
Implement the PostgreSQL tenant store with RLS-backed repositories.

## 2. In Scope
- Add the C3 PostgreSQL schema matching ARCH-001@0.2.0 §5, including `kbju_accuracy_labels`.
- Add RLS policy SQL for every user-owned table and ownership checks for child rows.
- Provision a separate PostgreSQL role `kbju_audit` with `BYPASSRLS` per ARCH-001@0.2.0 §9.2 in the schema bootstrap so the C11 K4 audit job can run; the application role must NOT inherit this privilege.
- Add a typed tenant repository layer that requires `user_id` for all user-owned reads and writes.
- Add transaction helpers, optimistic version helpers, and migration startup validation.
- Add tests proving unscoped repository methods do not exist and SQL/RLS invariants are present.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No OpenClaw Telegram entrypoint or UX messages; that belongs to TKT-004@0.1.0.
- No meal estimation, summary, or provider calls; those belong to TKT-006@0.1.0, TKT-008@0.1.0, and TKT-011@0.1.0.
- No Docker Compose deployment; that belongs to TKT-013@0.1.0.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.2.0 §3.3 C3 Tenant-Scoped Store
- ARCH-001@0.2.0 §4 Data Flow
- ARCH-001@0.2.0 §5 Data Model / Schemas
- ARCH-001@0.2.0 §9.2 Access Control and Tenant Isolation
- ADR-001@0.1.0
- ADR-009@0.1.0
- docs/knowledge/openclaw.md
- `package.json`
- `src/shared/types.ts`
- `src/shared/config.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `package.json` updated only if adding the allowed PostgreSQL dependency
- [ ] `package-lock.json` updated only if adding the allowed PostgreSQL dependency
- [ ] `src/store/schema.sql` containing DDL and RLS policies
- [ ] `src/store/types.ts` exporting table and repository request types
- [ ] `src/store/tenantStore.ts` exporting the C3 repository surface
- [ ] `src/store/migrations.ts` exporting migration/version validation helpers
- [ ] `tests/store/schema.test.ts` verifying schema invariants from ARCH-001@0.2.0 §5
- [ ] `tests/store/tenantStore.test.ts` verifying repository scoping and transaction behavior with mocks

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/store/schema.test.ts tests/store/tenantStore.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests assert every user-owned table in ARCH-001@0.2.0 §5 has `user_id NOT NULL` except `users` and `tenant_audit_runs`.
- [ ] Tests assert every user-owned table has an `ENABLE ROW LEVEL SECURITY` statement.
- [ ] Tests assert no exported repository method can list or mutate user-owned rows without a `userId` parameter.
- [ ] Tests assert raw voice/photo durable columns do not exist in `schema.sql`.
- [ ] Tests assert `users` has no `deleted_at` column and `onboarding_status` enum has no `deleted` value (right-to-delete is hard-delete only per ARCH-001@0.2.0 §9.5).
- [ ] Tests assert the `kbju_audit` role exists with `BYPASSRLS` and that the application role is not a member of it.

## 7. Constraints (hard rules for Executor)
- Allowed new runtime dependencies: `pg`.
- Allowed new dev dependencies: `@types/pg`.
- Do NOT add an ORM unless you raise a Q-TKT and receive approval.
- All SQL must be parameterized; no string-concatenated values.
- The app DB role must be documented in SQL comments as non-owner and unable to bypass RLS.
- Codex assignment is required because RLS, deletion semantics, and tenant repository typing are security-critical.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-002-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- YYYY-MM-DD HH:MM model-id: started -->
<!-- YYYY-MM-DD HH:MM model-id: opened PR #NN -->
2026-04-26 20:46 codex-gpt-5.5: started
2026-04-26 20:46 codex-gpt-5.5: opened PR #12
2026-04-26 22:00 gpt-5.5: corrected execution log — original entries said "codex-gpt-5.5" but actual runtime was opencode + GPT-5.5 (xhigh) on the OpenClaw VPS; git author shown as "GLM-5.1 Executor" is a VPS-pinned config, not the actual model
2026-04-26 22:00 gpt-5.5: applied RV-CODE-002 fixes F-H1 + F-M1 + F-M2 + F-L1 + F-L2 to PR #12
2026-04-26 22:00 gpt-5.5: re-pushed exec/TKT-002-tenant-postgresql-store
2026-04-26 22:26 gpt-5.5: iter 2 — applied F-DR-DBTS (registerPgTypeParsers extended to TIMESTAMPTZ OID 1184)
2026-04-26 22:26 gpt-5.5: iter 2 — F-DR-CONFLICT-A decision: keep ON CONFLICT (id) because users.id is the C3 tenant key for RLS and same-UUID retries are idempotent; telegram_user_id remains the UNIQUE external identity guard
2026-04-26 22:26 gpt-5.5: iter 2 — F-DR-CONFLICT-B decision: keep ON CONFLICT (user_id, id) because schema.sql defines that unique constraint; both upserts are id-addressed, omitted id creates a new row, and summary schedules may coexist per user
2026-04-26 22:26 gpt-5.5: iter 2 — F-DR-SOFTDELETE decision: changed softDeleteConfirmedMealWithVersion so first delete sets deleted_at/version, re-delete of an already soft-deleted row is a no-op returning the existing marker, and stale versions still fail for non-deleted rows
2026-04-26 22:26 gpt-5.5: iter 2 — corrective: iter 1 silently dropped F-DR-DBTS and three informational flags despite invocation 13 listing all seven fixes; this iter 2 closes the gap
2026-04-26 22:28 gpt-5.5: blocked on Q-TKT-002-01
2026-04-26 22:38 gpt-5.5: Q-TKT-002-01 answered (option A); merged origin/main into branch; status blocked -> in_review
2026-04-26 22:41 gpt-5.5: blocked on Q-TKT-002-02
2026-04-27 10:14 gpt-5.5: Q-TKT-002-02 + Q-TKT-002-03 answered (option A both); pinned unpinned ticket-reference token in Q-TKT-002-01 line 41; status blocked -> in_review

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
