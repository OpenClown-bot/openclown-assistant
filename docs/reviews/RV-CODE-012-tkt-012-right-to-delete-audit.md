---
id: RV-CODE-012
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/84"
ticket_ref: TKT-012@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-02
---

# Code Review — PR #84 (TKT-012)

## Summary
Executor PR #84 correctly implements the Russian-language `/forget_me` handler, hard-deletion transaction runner, and end-of-pilot tenant audit runner within the allowed file scope. All 12 unit tests pass, lint and typecheck are green, and the ticket frontmatter was updated to `in_review`. However, one **high-severity** data-integrity issue blocks approval: the hard-deletion SQL order in `createDeletionSqlByTable` deletes `meal_drafts` before `confirmed_meals`, violating the parent-child foreign-key relationship (`confirmed_meals.draft_id -> meal_drafts.id`) and causing the right-to-delete transaction to fail on any real PostgreSQL schema with standard FK constraints. A medium-severity UX false-positive in natural-language intent detection and a low test-coverage gap also require remediation.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: The deletion-order bug in `createDeletionSqlByTable` will abort the hard-delete transaction for users with confirmed meals linked to drafts, violating the AC that all user-scoped rows must be removed in one transaction.
Recommendation to PO: **Request changes from Executor** — reorder `DELETION_SQL_BY_TABLE` so child tables are deleted before their parents, fix the `isRussianDeletionIntent` false-positive, and strengthen the deletion-order unit test before re-review.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs (7 files observed)
- [x] No changes to TKT §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
- [ ] All Acceptance Criteria from TKT §6 are verifiably satisfied — **blocked by F-H1 below**
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
- **F-H1 (src/privacy/rightToDelete.ts:74-93):** `createDeletionSqlByTable` deletes `meal_drafts` (line 85) **before** `confirmed_meals` (line 86). Per the ArchSpec data model and the tenant-audit cross-user check `confirmed_meals_draft_owner`, `confirmed_meals.draft_id` is a foreign key referencing `meal_drafts.id`. On a PostgreSQL schema with standard FK constraints (no `ON DELETE CASCADE` on this relationship), deleting the parent `meal_drafts` row before the child `confirmed_meals` row causes a `foreign_key_violation` and **aborts the entire transaction**. This directly violates TKT-012 §6 AC "confirmed deletion removes users, profiles, targets, schedules, onboarding state, transcripts, drafts, confirmed meals, items, summaries, audit events, metric/cost events, lookup cache rows, and K7 labels for that user_id" because the transaction rolls back before `users` is deleted. The in-memory unit tests pass only because the mock repository uses JavaScript `Map.delete()` without FK semantics. — *Responsible role:* Executor. *Suggested remediation:* Reorder `DELETION_SQL_BY_TABLE` so all child tables referencing `meal_drafts` are deleted **before** `meal_drafts`; specifically move `confirmed_meals` ahead of `meal_drafts`. Audit every other pair (e.g., `meal_items` before `confirmed_meals`, `meal_draft_items` before `meal_drafts`) and enforce the full order in the unit test that currently only asserts the first and last table.

### Medium
- **F-M1 (src/privacy/messages.ts:35-37):** `isRussianDeletionIntent` uses `normalized.includes(phrase)` which yields false positives on negated sentences. Example: a user typing *"не удаляй мои данные"* (don't delete my data) contains the substring `"удали мои данные"` and will trigger the deletion confirmation flow. This degrades UX and could confuse users. — *Responsible role:* Executor. *Suggested remediation:* Either switch to exact phrase matching after stripping negation particles, or require the phrase to be a standalone token bounded by word boundaries (e.g., regex `\bудали мои данные\b`), or add a guard clause that returns `false` when the text starts with `"не"`.

### Low
- **F-L1 (tests/privacy/rightToDelete.test.ts:130-135):** The deletion-order test `deletes summary schedules first and users last` only asserts the first and last table names. It does not catch the intermediate FK ordering bug in F-H1. — *Responsible role:* Executor. *Suggested remediation:* Assert the full ordered array of table keys against a reference list, or at minimum assert that `meal_drafts` appears after every table that references it.
- **F-L2 (tests/privacy/tenantAudit.test.ts:78-92):** The `keeps AUDIT_DB_URL out of application skill source imports` test samples only six hard-coded source files. It is not a CI lint check and provides weak coverage. However, `src/shared/config.ts` already contains `AUDIT_DB_URL` in `REQUIRED_CONFIG_NAMES`, which is outside the Executor's scope for this PR. — *Responsible role:* Executor / future ticket. *Suggested remediation:* Convert to an actual ESLint `no-restricted-syntax` rule or a CI script that scans `src/` excluding `src/privacy/`.

## Red-team probes

- **Error paths:**
  - Telegram API failure: not in scope for this PR (no Telegram API calls in the privacy module).
  - DB lock timeout: `lockUserForDeletion` uses `pg_advisory_xact_lock`, which will block indefinitely on a held lock. The ArchSpec does not specify a timeout; this is acceptable for pilot scope but should be documented.
  - Transaction failure mid-deletion: because `hardDeleteUserRows` runs inside `withUserDeletionTransaction`, any single DELETE failure rolls back the entire transaction. This is the correct C3 transaction semantics.
- **Concurrency:**
  - Two messages from the same user: the advisory lock serializes them. The unit test `serializes concurrent delete and meal confirmation on user_id lock` proves the service-level ordering but uses a mock lock, not the real PostgreSQL advisory lock.
- **Input validation:**
  - `telegramUserId` is coerced to `String(request.telegramUserId)` before lookup. No additional sanitization is needed because it is passed as a bound parameter.
  - `parseRussianDeletionConfirmation` accepts `"д"` and `"н"` as abbreviations, which is permissive but acceptable for pilot.
- **Prompt injection:**
  - No external strings reach an LLM inside the privacy module. Safe.
- **Secrets:**
  - No credentials committed in the PR diff. `AUDIT_DB_URL` is read from `deps.env`, not hard-coded.
- **Data exposure:**
  - Tenant audit inserts aggregate `findings` (counts per check) into `tenant_audit_runs`. No user payloads or PII are included. Verified in test `returns aggregate findings without user payloads`.
- **Repeat `/forget_me` after prior deletion:**
  - The service returns `fresh_start` when `findUserByTelegramUserId` returns `null`. The unit test verifies no second transaction is opened and the message is the Russian fresh-start copy. Verified.
- **PII retention after deletion:**
  - The implementation hard-deletes all listed tables. However, because of F-H1, a real PostgreSQL deployment may retain PII due to transaction rollback. This is the core severity of F-H1.

## Red-team closure
- **R-01 (prompt injection):** No LLM call in scope; no external string reaches LLM unsanitised.
- **R-02 (secret leakage):** No secrets in code.
- **R-03 (data exposure):** Tenant audit findings are aggregate counts only.
- **R-04 (concurrency):** Advisory lock mechanism present; unit test covers service-level serialization.

## Scope summary

| # | Check | Status |
|---|---|---|
| 1 | Only allowed files modified | PASS |
| 2 | No changes to NOT-In-Scope items | PASS |
| 3 | No new runtime dependencies | PASS |
| 4 | All ACs verifiably satisfied | **FAIL** — blocked by F-H1 |
| 5 | CI green (lint, typecheck, tests) | PASS |
| 6 | Ticket frontmatter transition | PASS |
| 7 | Hard constraints preserved | **FAIL** — permanent deletion contract violated by F-H1 |

## CI / local verification

```bash
npm test -- tests/privacy/rightToDelete.test.ts tests/privacy/tenantAudit.test.ts
# 12 tests passed (2 files)

npm run lint
# exit 0

npm run typecheck
# exit 0

python3 scripts/validate_docs.py
# validated 60 artifact(s); 0 failed
```

## PO recommendation
**Request changes from Executor.** The implementation is structurally sound and all tests pass locally, but the FK deletion-order bug (F-H1) makes the right-to-delete feature non-functional for any user with confirmed meals linked to drafts on a real PostgreSQL schema. Executor should:
1. Reorder `DELETION_SQL_BY_TABLE` to respect parent-child FK constraints.
2. Strengthen the unit test to assert the complete deletion order.
3. Fix the `isRussianDeletionIntent` false-positive (F-M1).
4. Re-run the full test suite and push an updated commit for re-review.

Once F-H1 is resolved and CI remains green, this PR can move to `pass`.
