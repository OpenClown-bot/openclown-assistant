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
