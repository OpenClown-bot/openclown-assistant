---
id: RV-CODE-012
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/84"
ticket_ref: TKT-012@0.1.0
status: approved
reviewer_model: "kimi-k2.6"
created: 2026-05-02
approved_at: 2026-05-02
approved_after_iters: 3
approved_by: kimi-k2.6
approved_note: "Iter-3 verdict pass on Executor final HEAD `24e0c42469b3d02217f614e9b15b0242863147aa`; F-H1 (deletion-order FK violation) + F-M1 (negated-phrase false positive) + F-L1 (weak deletion-order test) all RESOLVED in Executor iter-2; F-L2 (weak AUDIT_DB_URL lint scan) DEFERRED to BACKLOG-010 \u2014 fix needs repo-wide ESLint or CI script outside TKT-012@0.1.0 \u00a75 outputs; PR-Agent F-PA-1 (Privacy Compliance Risk on mixed-intent ambiguity) classified NOT A FINDING in iter-3 (PRD-001@0.2.0 US-8 establishes explicit `/forget_me` as canonical right-to-delete; ambiguous mixed-intent messages correctly errs toward caution); PR-Agent F-PA-2 (flaky concurrency test) classified REAL/LOW but does not undermine AC proof (production serialization is PostgreSQL `pg_advisory_xact_lock`, unit test only verifies service-level call ordering) \u2014 DEFERRED to BACKLOG-010. Reviewer re-engaged on every substantive Executor push (iter-1 \u2192 Kimi iter-1 fail; iter-2 \u2192 Kimi iter-2 verify-fixes \u2192 Kimi iter-3 verify-PR-Agent-final-head-findings-and-pass) per BACKLOG-008 \u00a7reviewer-reengagement-after-substantive-pushes \u2014 zero post-pass substantive commits. RV-CODE-012 numbering AND canonical filename `RV-CODE-012-tkt-012-right-to-delete-audit.md` correct from first iteration per BACKLOG-008 \u00a7reviewer-rv-code-numbering-convention + BACKLOG-009 \u00a7rv-code-file-naming-canonical \u2014 no rename needed in closure-PR (first pilot to enforce both id + filename in TO Reviewer NUDGE)."
---

# Code Review — PR #84 (TKT-012@0.1.0)

## Summary
Executor PR #84 correctly implements the Russian-language `/forget_me` handler, hard-deletion transaction runner, and end-of-pilot tenant audit runner within the allowed file scope. All 15 unit tests pass, lint and typecheck are green, and the ticket frontmatter was updated to `in_review`. One high-severity data-integrity issue (deletion order) and one medium-severity UX false-positive (intent detection) were identified in iter-1 and resolved by the Executor in iter-2. The review now finds no blocking issues.

## Verdict
- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: The FK deletion-order bug and intent-detection false-positive identified in iter-1 have been resolved; all acceptance criteria are verifiably satisfied and CI is green.
Recommendation to PO: **Approve & merge** — TKT-012@0.1.0 is ready for closure.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs (7 files observed)
- [x] No changes to TKT §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
- **F-H1 (src/privacy/rightToDelete.ts:74-93, iter-1):** `createDeletionSqlByTable` deleted `meal_drafts` before `confirmed_meals`, violating the FK relationship `confirmed_meals.draft_id -> meal_drafts.id`. — **RESOLVED in iter-2** — Executor reordered deletes so `confirmed_meals` (now line 89) precedes `meal_drafts` (line 90), and `meal_items` / `kbju_accuracy_labels` (lines 78-79) precede `confirmed_meals`. Child-before-parent order is now FK-safe for all dependent pairs visible in the ArchSpec cross-user checks.

### Medium
- **F-M1 (src/privacy/messages.ts:35-37, iter-1):** `isRussianDeletionIntent` used substring `.includes()` which triggered false positives on negated sentences. — **RESOLVED in iter-2** — Executor added `NEGATED_DELETION_PATTERNS_RU` (lines 13-18) with anchored regex patterns for common Russian negation forms (`не удаляй`, `не удали`, `не удалить`, `не хочу удал`), tested in `tests/privacy/rightToDelete.test.ts:190-193`.

### Low
- **F-L1 (tests/privacy/rightToDelete.test.ts:130-135, iter-1):** Deletion-order test only asserted first and last table names. — **RESOLVED in iter-2** — Test now asserts the complete ordered array of 17 tables (lines 133-151) and explicitly checks child-before-parent relationships for `confirmed_meals` vs `meal_drafts`, `meal_items` vs `confirmed_meals`, and `kbju_accuracy_labels` vs `confirmed_meals` (lines 152-154).
- **F-L2 (tests/privacy/tenantAudit.test.ts:78-92, iter-1):** `AUDIT_DB_URL` import scan used a hard-coded sample of six files, providing weak coverage. — **DEFERRED** — Fixing this properly requires a CI-wide lint rule or script scan, which is outside TKT-012@0.1.0 §5 Outputs. The current test does not violate any TKT-012@0.1.0 AC. Recommend a follow-up backlog item or a general codebase hygiene ticket.

## Iter-2 Verification

| Finding | Severity | Status | Evidence |
|---|---|---|---|
| F-H1 deletion-order FK violation | High | **RESOLVED** | `src/privacy/rightToDelete.ts:89` (`confirmed_meals`) now precedes `:90` (`meal_drafts`); test asserts full 17-table order and three child-before-parent pairs |
| F-M1 negated-phrase false positive | Medium | **RESOLVED** | `src/privacy/messages.ts:13-18` adds `NEGATED_DELETION_PATTERNS_RU`; tests verify `/forget_me` still accepted and `"не удаляй мои данные"` / `"я не хочу удалить мои данные"` rejected |
| F-L1 weak deletion-order test | Low | **RESOLVED** | `tests/privacy/rightToDelete.test.ts:133-154` asserts exact array order and three specific FK-safe index checks |
| F-L2 weak AUDIT_DB_URL lint scan | Low | **DEFERRED** | Still hard-coded six-file sample; no TKT-012@0.1.0 AC violated; recommend follow-up |

## Red-team probes

- **Error paths:**
  - Telegram API failure: not in scope for this PR (no Telegram API calls in the privacy module).
  - DB lock timeout: `lockUserForDeletion` uses `pg_advisory_xact_lock`, which will block indefinitely on a held lock. The ArchSpec does not specify a timeout; this is acceptable for pilot scope.
  - Transaction failure mid-deletion: because `hardDeleteUserRows` runs inside `withUserDeletionTransaction`, any single DELETE failure rolls back the entire transaction. This is the correct C3 transaction semantics per TKT-012@0.1.0 §2.
- **Concurrency:**
  - Two messages from the same user: the advisory lock serializes them. The unit test `serializes concurrent delete and meal confirmation on user_id lock` proves service-level ordering.
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
  - The FK-safe deletion order ensures all user-scoped rows are hard-deleted in one transaction before the `users` row is removed.

## Red-team closure
- **R-01 (prompt injection):** No LLM call in scope; no external string reaches LLM unsanitised.
- **R-02 (secret leakage):** No secrets in code.
- **R-03 (data exposure):** Tenant audit findings are aggregate counts only.
- **R-04 (concurrency):** Advisory lock mechanism present; unit test covers service-level serialization.
- **R-05 (PR-Agent focus — false positive intent):** Addressed by F-M1 resolution; negation patterns tested.
- **R-06 (PR-Agent focus — transaction safety assumption):** C3 contract preserved via `withUserDeletionTransaction` + `lockUser` + `hardDeleteUserRows` callback; types enforce repository-method-only access.

## Scope summary

| # | Check | Status |
|---|---|---|
| 1 | Only allowed files modified | PASS |
| 2 | No changes to NOT-In-Scope items | PASS |
| 3 | No new runtime dependencies | PASS |
| 4 | All ACs verifiably satisfied | PASS |
| 5 | CI green (lint, typecheck, tests) | PASS |
| 6 | Ticket frontmatter transition | PASS |
| 7 | Hard constraints preserved | PASS |

## CI / local verification (iter-2)

```bash
npm test -- tests/privacy/rightToDelete.test.ts tests/privacy/tenantAudit.test.ts
# 15 tests passed (2 files)

npm run lint
# exit 0

npm run typecheck
# exit 0

python3 scripts/validate_docs.py
# validated 60 artifact(s); 0 failed
```

## Iter-3 PR-Agent Finding Verification

### F-PA-1 Privacy Compliance Risk — NOT A FINDING

**PR-Agent claim:** `isRussianDeletionIntent` returns `false` if any negated pattern matches, even when a clear deletion intent is also present. Example: "удали мои данные, но не удаляй пока" would be blocked.

**Evaluation:** The negation patterns in `NEGATED_DELETION_PATTERNS_RU` (lines 13-18) are narrowly targeted at specific Russian deletion verbs (`не удаляй`, `не удали`, `не удалить`, `не хочу удал`). They do NOT match general negation particles like "не волнуйся" or "не шучу". The example message "удали мои данные, но не удаляй пока" literally translates to "delete my data, BUT don't delete yet" — a textbook mixed-intent message containing both an affirmative and a countermanding clause. It is correctly classified as ambiguous and should not trigger the deletion confirmation flow. PRD-001@0.2.0 US-8 establishes `/forget_me` as the single explicit right-to-delete command; natural-language detection is a convenience layer that appropriately errs toward caution on ambiguous input. Blocking genuinely ambiguous mixed-intent messages is correct behavior, not a privacy compliance failure.

### F-PA-2 Flaky Concurrency Test — REAL, LOW, accepted for pilot scope

**PR-Agent claim:** `waitForCall` (lines 200-207) uses a 10-iteration `await Promise.resolve()` polling loop instead of fake timers or deterministic promise-based synchronization. Could cause intermittent CI failures under load.

**Evaluation:** The concern is technically valid. Under extreme CPU pressure, 10 microtask turns may not suffice for the mock `confirmMeal` promise to resolve before the polling loop exhausts. However: (a) Vitest runs tests sequentially by default, so cross-test contention is minimal; (b) the mock `MemoryDeletionRepository` is entirely in-memory with no I/O; (c) the real concurrency guarantee is provided by PostgreSQL `pg_advisory_xact_lock`, not this unit test, which only verifies service-level call ordering. This is a test-quality issue that does not undermine TKT-012@0.1.0 AC proof because the production locking mechanism is database-native. Recommended follow-up: replace the polling loop with `vi.useFakeTimers()` or a deterministic `Promise`-based barrier in a future hygiene ticket.

## PO recommendation
**Approve & merge.** TKT-012@0.1.0 iter-2 resolves all iter-1 blocking findings, and the two PR-Agent focus areas raised on the final HEAD (F-PA-1, F-PA-2) are independently assessed as non-blocking. F-PA-1 is a correctly handled ambiguity edge case; F-PA-2 is an acceptable test-quality limitation for pilot scope that does not undermine the AC proof. One low-severity lint-coverage gap (F-L2) remains deferred as out-of-scope; recommend a future hygiene ticket for a repo-wide `no-restricted-syntax` ESLint rule or CI script to enforce `AUDIT_DB_URL` isolation.
