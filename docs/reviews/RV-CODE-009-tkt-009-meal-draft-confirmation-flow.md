---
id: RV-CODE-009
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/59"
ticket_ref: TKT-009@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-01
---

# Code Review — PR #59 (TKT-009@0.1.0: Meal Draft Confirmation Flow)

## Summary
PR #59 implements the C4 Meal Logging Orchestrator with deterministic Russian draft messages, optimistic-version confirmation, manual-entry fallback, and K1/K2/K5 metric emission. Scope and dependency compliance are clean, tests pass, lint/typecheck are green. One high-severity concurrency defect in `confirmDraft` (unhandled `OptimisticVersionError` under concurrent duplicate confirms) blocks approval. Two medium-severity contract divergences (draft creation bypasses `estimating` status; `meal_local_date` ignores user timezone) and several low-severity gaps (append-vs-replace semantics, dead code, missing direct `handleManualEntry` tests, no rollback procedure in PR body) must be resolved or triaged before closure.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: `confirmDraft` throws an unhandled `OptimisticVersionError` when two confirm callbacks race on the same draft, violating AC #7 idempotency under true concurrency.
Recommendation to PO: request changes from Executor (fix F-H1; triage F-M1 / F-M2 in iter-2 or spin to BACKLOG if bandwidth-limited).

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
- [x] No changes to TKT §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
- [x] CI green (lint, typecheck, tests, coverage)
- [ ] Definition of Done complete — PR body lacks rollback command / procedure (F-L4)
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
- **F-H1 (`src/meals/mealOrchestrator.ts:229-284`):** `confirmDraft` does not catch `OptimisticVersionError` thrown by `repo.updateMealDraftWithVersion` inside the `withTransaction` block. If two confirm callbacks for the same awaiting-confirmation draft are processed concurrently, the second thread reads the old version, passes the pre-transaction `isStaleVersion` check, then hits an optimistic-lock failure inside the transaction and propagates an unhandled exception instead of returning an idempotent `already_confirmed` or `stale_version` envelope. This violates AC #7 under true concurrency and can crash the request handler. — *Responsible role:* Executor. *Suggested remediation:* Wrap the `withTransaction` block in `confirmDraft` with a `try/catch` for `OptimisticVersionError`; return `buildAlreadyConfirmedEnvelope(chatId)` when the draft is already confirmed, or `buildStaleDraftRejectedEnvelope(chatId)` when the version mismatched, matching the pattern already used in `applyCorrection` (`src/meals/mealOrchestrator.ts:353-357`). Add a concurrent-race unit test that simulates an `OptimisticVersionError` from `updateMealDraftWithVersion` during confirm and asserts the returned envelope text.

### Medium
- **F-M1 (`src/meals/mealOrchestrator.ts:150-162`, `384-394`):** C4 creates `meal_drafts` rows with `status="awaiting_confirmation"` directly for text, voice, and photo sources. ARCH-001@0.4.0 §4.2 step 1 and §4.4 step 1 mandate that C1 creates the initial draft with `status="estimating"`; C4 is then expected to update the existing draft to `awaiting_confirmation` after C6/C7 returns results. The current implementation skips the `estimating` state entirely, which removes the in-flight estimation audit trail and breaks the C1→C4 state-handoff contract. — *Responsible role:* Executor / Architect. *Suggested remediation:* Either (a) accept that C1 draft creation belongs to a downstream C1-integration ticket and add a `CONTEXT-FINDING` note for Architect to amend the ArchSpec if `awaiting_confirmation` creation by C4 is the intended interim contract, or (b) refactor `handleMealInput` to accept a pre-existing `draftId` and update the row rather than creating it. If (a) is chosen, document the deviation explicitly in TKT-009@0.1.0 §10 and file a BACKLOG TKT for C1/C4 state reconciliation.
- **F-M2 (`src/meals/mealOrchestrator.ts:246`, `src/meals/mealOrchestrator.ts:95-97`):** `confirmDraft` persists `meal_local_date` using `todayLocalDate()`, which returns `new Date().toISOString().slice(0, 10)` (UTC midnight). ARCH-001@0.4.0 §5 schema names the column `meal_local_date`, and `users.timezone` exists for pilot users. Logging a UTC date for a user in `Europe/Moscow` will shift evening meals to the previous day, corrupting K1 per-day aggregation and future summary deltas. — *Responsible role:* Executor. *Suggested remediation:* Inject a `timezoneResolver` dependency that reads `users.timezone` from C3 (or receives it from C1 in the `MealOrchestratorRequest`) and compute `meal_local_date` with the user's IANA timezone (e.g. `Intl.DateTimeFormat(..., { timeZone, ... })` or `date-fns-tz` if a date library is ever allowlisted). At minimum, add a `TODO(timezone)` comment with a follow-up TKT if the fix is deferred.
- **F-M3 (`src/meals/mealOrchestrator.ts:286`, `434-456`):** Metric emission (`emitK1K2`, `emitK1K5`) is awaited synchronously after the confirmation transaction commits. If `emitMetric` rejects (e.g., C10 DB write failure), the already-persisted meal is not rolled back, but the user-visible confirmation envelope is lost and an exception propagates to the caller. This makes a non-critical observability path block the critical user response. — *Responsible role:* Executor. *Suggested remediation:* Wrap `await this.emitK1K2(...)` and `await this.emitK1K5(...)` in `try/catch` inside the orchestrator; log the metric failure via `this.deps.logger.error(...)` but still return the confirmation envelope. Update the relevant tests to assert that metric rejection does not throw.

### Low
- **F-L1 (`src/meals/mealOrchestrator.ts:327-339`, `tests/meals/mealOrchestrator.test.ts:657-686`):** `applyCorrection` inserts new `meal_draft_items` rows via `repo.createMealDraftItem` without first deleting the old items for that draft. ARCH-001@0.4.0 §4.5 does not specify replace-vs-append semantics for draft corrections. The test at `mealOrchestrator.test.ts:657-686` only asserts that `updateMealDraftWithVersion` was called once and that the rendered message contains the corrected item name; it does not assert the final item count or that stale items are absent. — *Responsible role:* Architect (for replace-vs-append contract) / Executor (for test gap). *Suggested remediation:* Route a `CONTEXT-FINDING` to the Architect: clarify in a future ArchSpec amendment whether draft corrections must replace or append items. Executor: once clarified, either (a) add `repo.deleteMealDraftItems(draftId)` before the insert loop, or (b) if append is permitted, document the behavior in a code comment. Add a test assertion that `listMealDraftItems(draftId)` returns exactly `correction.correctedItems.length` rows after a correction.
- **F-L2 (`src/meals/mealOrchestrator.ts:124-126`):** Dead code: `transcriptId` is assigned `undefined` in both branches of a ternary and is never consumed afterward. The variable was likely intended to link voice drafts to the `transcripts` table (`ARCH-001@0.4.0 §5 schema: meal_drafts.transcript_id`), but the orchestrator never populates it. — *Responsible role:* Executor. *Suggested remediation:* Remove the dead assignment. If `transcript_id` traceability is desired, populate it from `request.transcriptResult?.transcriptId` (or equivalent field) when `source === "voice"` and pass it to `repo.createMealDraft`.
- **F-L3 (`src/meals/mealOrchestrator.ts:361-419`, `tests/meals/mealOrchestrator.test.ts`):** `handleManualEntry` is a public method on `MealOrchestrator` but has zero direct unit-test coverage; it is only exercised indirectly through `handleMealInput({ source: "manual" })`. Future C1 fallback paths could call it directly, bypassing the indirect test paths. — *Responsible role:* Executor. *Suggested remediation:* Add direct tests for `handleManualEntry` covering: (a) `mealText` missing → prompt envelope, (b) invalid format → invalid envelope, (c) valid format → draft created with correct totals, (d) zero-values edge case. Alternatively, log a BACKLOG follow-up TKT if bandwidth-limited.
- **F-L4 (PR #59 body):** The PR body omits a rollback command / procedure. CONTRIBUTING.md and prior TKT closures require a documented rollback path (e.g., `git revert cae5c03` or database migration reversal steps). — *Responsible role:* Executor. *Suggested remediation:* Append a "Rollback" section to the PR body stating: "Revert commit `c1d756a` and `cae5c03` on main; no DB schema migration is required because this PR is purely additive TypeScript code. Reversion removes the `src/meals/` and `tests/meals/` files without affecting existing C1–C3 tables."

## PR-Agent Findings Triage

| ID | Location | Decision | Severity in this review | Rationale |
|---|---|---|---|---|
| F-PA-12 | `mealOrchestrator.ts:295-359` | **CONTEXT-FINDING + F-L1** | Low | ArchSpec §4.5 is silent on draft-correction item replace-vs-append semantics. Routed to Architect for clarification. Test gap added as F-L1. |
| F-PA-13 | `mealOrchestrator.ts:124-126` | **VALID → F-L2** | Low | Confirmed both branches return `undefined`; variable is unused. Dead-code removal or transcript linkage deferred to Executor. |
| F-PA-14 | `mealOrchestrator.ts:361-419` | **VALID → F-L3** | Low | No direct tests on public `handleManualEntry`. Coverage gap acceptable for iter-1 but should be backlogged or fixed in iter-2. |

## Red-team probes (Reviewer must address each)
- **Error paths — Telegram/OpenFoodFacts/Whisper API failure, DB lock, LLM timeout:** C4 does not call external APIs directly; it consumes results from C5/C6/C7. On `estimatorResult === MANUAL_ENTRY_FAILURE_RESULT`, C4 emits K5 and returns the manual-entry prompt envelope (AC #8 verified). DB transaction failures inside `withTransaction` propagate as unhandled exceptions; C1 is expected to catch and return `MSG_GENERIC_RECOVERY`. This is acceptable because C4 is not the top-level handler, but the unhandled `OptimisticVersionError` in `confirmDraft` (F-H1) is a C4-level gap.
- **Concurrency — two messages from the same user processed simultaneously:** `confirmDraft` has a race condition between the pre-transaction `isAlreadyConfirmed` / `isStaleVersion` checks and the transaction commit (F-H1). `applyCorrection` handles `OptimisticVersionError` correctly. Draft creation (`handleMealInput`) is not idempotent — a duplicate Telegram message delivery would create two drafts. Idempotency on `meal_drafts` is not mandated by TKT-009@0.1.0, but a follow-up TKT should add a `request_id` deduplication index or C1-level idempotency key.
- **Input validation — malformed voice / corrupt photo / huge text / unicode edge cases:** Malformed voice/photo is handled upstream by C5/C7; C4 only sees structured `TranscriptionResult` / `PhotoRecognitionResult`. `parseManualKBJU` rejects non-numeric and negative input (tested). No upper bound on numeric values (e.g., `999999999 999999999 999999999 999999999` is accepted). The ArchSpec does not define manual-entry KBJU ranges, so this is not a finding against the Executor, but a candidate for Architect to specify in a future ADR or ticket.
- **Prompt injection — does any external string reach an LLM unsanitised?** C4 does not call LLMs directly. `mealText` from the user is passed to the estimator externally (by C1 → C6), which is outside TKT-009@0.1.0 scope. The ArchSpec §4.2 step 2 already mandates the ADR-006@0.1.0 prompt-injection boundary at C6. C4 is clean.
- **Secrets — any credential committed, logged, or leaked?** No secrets in the diff. `buildDraftMessage` and `buildDraftReplyEnvelope` only emit deterministic Russian strings and system-generated IDs. No raw user text or media bytes are logged inside C4.

## Test evidence
| Test file | Test name | AC | Result |
|---|---|---|---|
| `tests/meals/manualEntry.test.ts` | `parseManualKBJU` suite (11 tests) | — | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `creates draft and returns reply envelope (text)` | #4 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `creates draft with voice source` | #4 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `creates draft with photo source and low confidence label` | #4, #5 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `does not auto-save photo draft as confirmed` | #5 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `falls back to manual entry on estimator failure` | #8 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `persists confirmed_meal and meal_items on confirm` | #1, #6 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `emits K1 and K2 metrics on confirm` | #9 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `rejects stale version confirmation idempotently` | #6 | ✅ pass |
| `tests/meals/mealOrchestrator.test.ts` | `rejects duplicate confirm idempotently` | #7 | ✅ pass (sequential only; concurrent race not tested) |
| `tests/meals/mealOrchestrator.test.ts` | `creates a manual draft and returns reply envelope` | #4 | ✅ pass |
| `npm test -- tests/meals/` | all 33 tests | #1 | ✅ pass |
| `npm run lint` | `tsc --noEmit` | #2 | ✅ pass |
| `npm run typecheck` | `tsc --noEmit` | #3 | ✅ pass |

## Verdict (repeated for clarity)
- **Verdict:** `fail`
- **Justification:** F-H1 (unhandled `OptimisticVersionError` in `confirmDraft` under concurrent duplicate confirms) is a blocking correctness defect that violates AC #7 idempotency.
- **PO recommendation:** Request changes from Executor. Fix F-H1 in iter-2; triage F-M1 and F-M2 as either iter-2 fixes or BACKLOG follow-up TKTs. F-L1 through F-L4 can be deferred to BACKLOG if bandwidth is constrained, but must be documented in the review closure PR.

---

## Iter-2 review (head: 1b0d553)

### Per-finding outcomes
- **F-H1**: **RESOLVED** — `confirmDraft` now wraps `this.deps.store.withTransaction(...)` in a `try/catch` block (`src/meals/mealOrchestrator.ts:241-278`). On `OptimisticVersionError`, it re-fetches the draft to distinguish "already confirmed by concurrent caller" (`reason: "already_confirmed"`) from "stale version" (`reason: "stale_version"`), returning the appropriate envelope in both cases. Two new unit tests simulate concurrent-race scenarios and assert correct envelope text (`tests/meals/mealOrchestrator.test.ts:569-621`).
- **F-M1**: **RESOLVED-AS-DEFERRED** — Executor explicitly deferred in commit message ("defer F-M1"). Functional behavior is correct; the `estimating` intermediate state is skipped. A follow-up BACKLOG TKT must be filed for C1/C4 draft-state reconciliation per ARCH-001@0.2.0 §4.2 / §4.4. No new functional defect introduced.
- **F-M2**: **RESOLVED** — `todayLocalDate()` replaced with `localDateInZone(timeZone)` using `Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })` (`src/meals/mealOrchestrator.ts:100-105`). `TimezoneResolver` dependency injected into `MealOrchestratorDeps` (`src/meals/mealOrchestrator.ts:53-58`). `confirmDraft` calls `await this.todayLocalDate(userId)` which resolves timezone via `deps.timezoneResolver.getTimezone(userId)` with graceful UTC fallback on failure (`src/meals/mealOrchestrator.ts:511-516`). New tests verify Moscow timezone local date and fallback behavior (`tests/meals/mealOrchestrator.test.ts:636-681`).
- **F-M3**: **RESOLVED** — `emitK1K2` and `emitK1K5` calls are now wrapped in `try/catch` with `logger.error` logging, ensuring the confirmation envelope is always returned even when metric emission fails (`src/meals/mealOrchestrator.ts:284-292`, `src/meals/mealOrchestrator.ts:126-130`). New tests assert confirmation envelope returned despite `emitMetric` rejection (`tests/meals/mealOrchestrator.test.ts:662-692`).
- **F-L1**: **RESOLVED** — `applyCorrection` test now asserts `postCorrectionItems.length === correctedItems.length` (`tests/meals/mealOrchestrator.test.ts:739`). The test verifies that the new draft contains exactly the corrected items. Architect follow-up for replace-vs-append semantics remains a CONTEXT-FINDING.
- **F-L2**: **RESOLVED** — Dead `transcriptId` assignment removed from `handleMealInput` (`src/meals/mealOrchestrator.ts` diff; lines 124-126 from iter-1 removed).
- **F-L3**: **RESOLVED** — Four new direct unit tests added for `handleManualEntry`: missing `mealText` returns prompt, invalid format returns invalid envelope, valid format creates draft with correct KBJU totals, and zero-values edge case (`tests/meals/mealOrchestrator.test.ts:747-812`).
- **F-L4**: **RESOLVED** — PR #59 body now contains "## Rollback Instructions" section with `git revert <merge-sha>` command and note that no DB migration is involved (`src/meals/` and `tests/meals/` are pure code additions).

### Iter-2 metrics
- `npm test -- tests/meals/manualEntry.test.ts tests/meals/mealOrchestrator.test.ts`: **44/44 passed** (11 manualEntry + 33 mealOrchestrator; up from 33 in iter-1)
- `npm run lint`: zero errors
- `npm run typecheck`: zero errors
- `python3 scripts/validate_docs.py`: 51 artifact(s), 0 failed

### Iter-2 verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: F-H1 (blocking concurrency defect) is fully resolved with defensive try/catch, race-condition envelope routing, and concurrent-race unit tests; all Medium and Low findings from iter-1 are resolved except F-M1 which is deferred with commit-message documentation and requires a BACKLOG TKT for C1/C4 state reconciliation before the next integration milestone.

Recommendation to PO: **Approve for merge.** File a BACKLOG follow-up TKT to reconcile C1/C4 `meal_drafts.status` lifecycle (C1 creates `estimating` → C4 updates to `awaiting_confirmation` per ARCH-001@0.2.0 §4.2 / §4.4). No additional code iteration required.

---

## Iter-3 review (head: db96ec4)

### Per-finding outcomes
- **F-PA-18 (PR-Agent, importance 8 — promoted to iter-3 by orchestrator):** **RESOLVED** — `applyCorrection` now calls `await repo.deleteMealDraftItemsByDraftId(userId, correction.draftId)` (`src/meals/mealOrchestrator.ts:362`) before the insert loop, inside the same `withTransaction(...)` callback (atomic replace-semantics). New repo method `deleteMealDraftItemsByDraftId(userId, draftId): Promise<number>` added to `TenantScopedRepository` interface (`src/store/types.ts:522`) with proxy (`src/store/tenantStore.ts:212-214`) and implementation (`src/store/tenantStore.ts:580-587`) using `DELETE FROM meal_draft_items WHERE user_id = $1 AND draft_id = $2`. Test rewritten at `tests/meals/mealOrchestrator.test.ts:705-762`: setup now creates 3 `preExistingItems` for `DRAFT_ID` before calling `applyCorrection` with 2 corrected items; assertion `expect(repo.deleteMealDraftItemsByDraftId).toHaveBeenCalledWith(USER_ID, DRAFT_ID)` (line 761) verifies the deletion was actually invoked; the post-correction `createdDraftItems.filter(...).length === 2` exercises the replace invariant — without the deletion step the count would be `5 ≠ 2` and the test would fail.

- **Iter-2 F-L1 retraction:** the iter-2 RESOLVED status was incorrect — the test setup omitted pre-existing items and the assertion passed by coincidence. Iter-3 corrects this. CONTEXT-FINDING for Architect: ARCH-001@0.4.0 §4.5 should be amended in @0.5.0 to make replace-semantics explicit (per Executor's §10 ratification ask).

- **Tenant-store contract test (`tests/store/tenantStore.test.ts:47`):** `expectedTenantStoreMethods` array updated to include `"deleteMealDraftItemsByDraftId"`; this is a contract-completeness check that prevents future regressions if the method is removed from the proxy.

- **Claim (d) note — TKT-009@0.1.0 §10 Execution Log:** **PARTIAL** — §5 Outputs correctly expanded to list `src/store/types.ts` and `src/store/tenantStore.ts` (lines 52-53), but §10 Execution Log remains empty. The "Architect ratification ask" for ARCH-001@0.4.0 §4.5 (replace-vs-append) exists in the commit message (`db96ec4`) but was not written into the TKT file's §10. This is a Definition of Done gap (TKT-009@0.1.0 §8 item 4). Executor should append the iter-3 entry to §10 before closure-PR merge.

### Iter-3 metrics
- `npm test -- tests/meals/`: 44/44 passed (no net delta; F-L1 test rewritten in place)
- `npm test` (full): 418/418 passed (no net delta; existing tests preserved)
- `npm run lint`: zero errors
- `npm run typecheck`: zero errors
- `python3 scripts/validate_docs.py`: 50/0 on tkt branch (51/0 with rv-branch review file)

### Iter-3 verdict
- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: F-PA-18 fully resolved with atomic replace-semantics inside the transaction boundary, test setup honestly exercises the replace invariant (fails without the deletion step), no new functional defects introduced; §10 Execution Log DoD gap is procedural and can be resolved in closure-PR.

Recommendation to PO: **Approve for merge.** Architect ratification of ARCH-001@0.4.0 §4.5 (replace-vs-append) and C1/C4 `meal_drafts.status` lifecycle reconciliation (F-M1 from iter-2) are follow-up TKT-NEW items to be filed in BACKLOG-005, not blockers.
