---
id: RV-CODE-010
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/69"
ticket_ref: TKT-010@0.1.0
status: approved
reviewer_model: "kimi-k2.6"
created: 2026-05-01
updated: 2026-05-01
approved_at: 2026-05-01
approved_after_iters: 3
approved_by: "yourmomsenpai (PO)"
approved_note: "RV-CODE-010 reached verdict pass on iter-3 (Executor commit 5127bf1, Reviewer Kimi K2.6 on the same opencode session). First Ticket Orchestrator (TO) pilot review cycle, end-to-end. Iter-1 verdict was fail blocked on F-H1 (HistoryDeps lacks transaction primitive — non-atomic editMeal/deleteMeal violates TKT-010 §7 + ARCH-001 §4.5 step 3) + F-H2 (unhandled version-mismatch exceptions leak meal existence on TOCTOU race) + F-M1 (summary-record immutability not actually asserted by tests) + F-M2 (deleteMeal removedCount uses possibly-stale meal.items.length instead of authoritative beforeItems.length) + F-M3 (newest-first sort delegated to dependency, not enforced by service) + F-M4 (countConfirmedMeals declared but never called) + F-L1 (offset cursor fragility) + F-L2 (dead button-message exports). Iter-2 (Executor commit a6b2aac8) RESOLVED F-H1 by adding withTransaction<T> to HistoryDeps and refactoring editMeal/deleteMeal to wrap all writes in a single transaction callback; RESOLVED F-H2 by introducing HistoryMutationConflictError, catching it inside the transaction body, and returning the uniform `{ kind: \"not_found\" }` envelope; RESOLVED F-M1 by seeding SummaryRecord rows in the fake store fixtures and asserting fields unchanged + no new summary records emitted post-mutation; RESOLVED F-M2 by switching to beforeItems.length; RESOLVED F-M3 by adding a service-level sort by mealLoggedAt desc with id tie-breaker before returning the page + a passthrough-fake test that proves the service sorts an unsorted dependency response; RESOLVED F-M4 by removing countConfirmedMeals from HistoryDeps. Iter-2 verdict was pass_with_changes after PR-Agent flagged a sourceRef omission in audit-snapshot serialization (correctness/data-integrity class), classified medium and promoted into iter-3 scope. Iter-3 (Executor commit 5127bf1) RESOLVED the sourceRef omission at historyService.ts:193 (snapshotToJson now preserves source_ref through item serialization in before/after audit snapshots) + added a regression assertion that source_ref is present in both before and after audit snapshot items; Reviewer iter-3 verdict pass on the same opencode session per the iter-N continuation rule. F-L1 offset-cursor fragility deferred low-severity to BACKLOG-007 §TKT-NEW-pagination-keyset-cursor per Reviewer-accepted rationale (pilot meal volume bound; replace with keyset cursor when traffic outgrows the 2-user pilot scope). F-L2 dead button-message exports deferred implicitly to TKT-FOLLOWUP-3 (C8 routes through Telegram bot router will consume them once UX wire-up is staged). PR-Agent supplementary review on PR #69 final HEAD 5127bf1: ⚡ No major issues detected, no security concerns, no code suggestions; settle latency ~22 min on the final push (OmniRoute / Fireworks tail-latency outlier; normal 3–9 min). Cross-reviewer audit pass-1 (Ticket Orchestrator, GPT-5.5 thinking on opencode): all Reviewer findings RESOLVED in current HEAD, F-L1 deferred per Reviewer-accepted rationale, PR-Agent on final HEAD shows no major issues; hand-back closure-ready with PR-Agent state on final Executor HEAD documented per docs/prompts/ticket-orchestrator.md § PR-Agent settle-on-final-HEAD requirement. Cross-reviewer audit pass-2 (Devin Orchestrator ratification per docs/meta/devin-session-handoff.md §11.4): independent re-classification confirmed all RESOLVED, no disagreement on substance, PR-Agent settle-on-final-HEAD independently re-verified (workflow run conclusion success on 5127bf1, persistent-review updated_until_commit matches final HEAD); merge-safe sign-off issued. PR #69 + PR #70 squash-merged to main 2026-05-01 by PO. The two-phase audit lesson is the structural fix to the F-PA-17 miss (docs/session-log/2026-05-01-session-3.md §6.7); this cycle was the first end-to-end TO pilot validating the contract and produced PR #71 (iter-N continuation rule + PR-Agent settle-on-final-HEAD requirement + PR-Agent perf tweaks) as a derived pipeline-integrity improvement."
---

# Code Review — PR #69 (TKT-010@0.1.0: History Mutation Flow)

## Summary
PR #69 adds the C8 `HistoryService` behind dependency interfaces with 25 passing tests, clean lint and typecheck. However, the `HistoryDeps` interface lacks a transaction primitive, making it impossible for `editMeal` and `deleteMeal` to satisfy TKT-010@0.1.0 §7 "Use C3 transactions for edit/delete mutations" and ArchSpec §4.5 step 3 "in one transaction". Additionally, unhandled exceptions from versioned mutation dependencies leak meal existence on concurrent TOCTOU races. These are blocking defects.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: The `HistoryDeps` interface design makes edit/delete mutations non-atomic across multiple independent async calls, directly violating TKT-010@0.1.0 §7 and ArchSpec §4.5 step 3; plus version-race throws propagate as unhandled exceptions instead of `not_found`, leaking existence.
Recommendation to PO: Request changes from Executor — add a transaction primitive to `HistoryDeps` and wrap edit/delete mutations atomically, and catch dependency version-mismatch throws to return uniform `not_found`.

## Contract compliance
- [x] PR modifies ONLY files listed in TKT §5 Outputs (`src/history/types.ts`, `src/history/messages.ts`, `src/history/historyService.ts`, `tests/history/historyService.test.ts`) plus the ticket file with allowed `status` frontmatter and append-only §10 Execution Log changes.
- [x] No changes to TKT §3 NOT-In-Scope items (no confirmation flow, no scheduled summaries, no right-to-delete hard deletion).
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist.
- [ ] All Acceptance Criteria from TKT §6 are verifiably satisfied — PARTIAL (see F-H1, F-H2, F-M1, F-M3 below).
- [x] CI green (lint, typecheck, tests pass, validate_docs 54/0).
- [x] Definition of Done complete.
- [x] Ticket frontmatter `status: in_review` in a separate commit.

## Findings

### High (blocking)

- **F-H1 `src/history/types.ts:77-113` + `src/history/historyService.ts:31-68` + `src/history/historyService.ts:82-117`:** `HistoryDeps` exposes only fine-grained single-operation methods (`getConfirmedMeal`, `updateConfirmedMealWithVersion`, `replaceMealItems`, `createAuditEvent`, `softDeleteMeal`). It provides no `withTransaction` or transaction-scoped equivalent. Consequently, `editMeal` performs three independent async calls (`updateConfirmedMealWithVersion` → `replaceMealItems` → `createAuditEvent`) and `deleteMeal` performs two (`softDeleteMeal` → `createAuditEvent`). If any call after the first throws, the database is left in an inconsistent state (meal updated/deleted but no audit event, or meal updated but items not replaced). This violates TKT-010@0.1.0 §7 constraint "Use C3 transactions for edit/delete mutations" and ArchSpec §4.5 step 3 which explicitly requires "updates the meal version in one transaction". The Executor's framing that "C3 integration is a follow-up" does not absolve this ticket-level constraint; the interface must be designed so the C3 adapter can provide transactional atomicity.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Add `withTransaction<T>(action: (txDeps: HistoryDeps) => Promise<T>): Promise<T>` to `HistoryDeps`. The C3 adapter would implement it by delegating to `TenantStore.withTransaction` and returning a transaction-bound `HistoryDeps` instance. Refactor `editMeal` and `deleteMeal` to perform all writes inside a single `withTransaction` block.

- **F-H2 `src/history/historyService.ts:45-50` + `src/history/historyService.ts:99-104`:** `editMeal` and `deleteMeal` pre-check version equality before calling the mutation dependency, but they do **not** catch exceptions thrown by `updateConfirmedMealWithVersion`, `replaceMealItems`, `softDeleteMeal`, or `createAuditEvent`. In a concurrent scenario, another request could increment the meal version between the `getConfirmedMeal` read and the `updateConfirmedMealWithVersion` write. The real C3 repository (`TenantStore.softDeleteConfirmedMealWithVersion` using `expectVersionedRow`) would then throw a version-mismatch exception. This unhandled exception propagates to the caller, distinguishing it from the `not_found` envelope returned for non-existent or other-user meals. This leaks the fact that the meal exists (an error was thrown *during* mutation, not during lookup), violating TKT-010@0.1.0 §7 "Do NOT expose another user's meal existence through error messages".
  - *Responsible role:* Executor.
  - *Suggested remediation:* Wrap all dependency mutation calls in `try/catch`. If the dependency throws a version-mismatch or not-found error, return `{ kind: "not_found" }` uniformly. Add tests that simulate concurrent-race throws from fake dependencies to verify this path.

### Medium

- **F-M1 `tests/history/historyService.test.ts:539-579`:** The tests "delivered summary records are not modified by edit" and "delivered summary records are not modified by delete" only assert that `auditEvents.length === 1` and the correct `eventType` is written. They do **not** seed any `summary_records` in the fake store, nor do they assert that pre-existing summary records remain unchanged. AC #8 requires "Tests prove already delivered summary records are not modified." The current tests prove nothing about summary records.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Add a `summaryRecords` Map to the fake store. Seed a `SummaryRecord` row referencing the meal before the mutation. After the mutation, assert the seeded summary record's fields are unchanged and no new summary record was created.

- **F-M2 `src/history/historyService.ts:133`:** `deleteMeal` computes `removedCount: meal.items.length` using the `items` array from `getConfirmedMeal`, but it also fetches `beforeItems` via `listMealItems`. If the `ConfirmedMealView` returned by `getConfirmedMeal` is a denormalized or stale view (e.g., empty `items` when the real C3 repository doesn't JOIN `meal_items`), the correction delta will undercount removed items. The authoritative count is `beforeItems.length`, which is fetched separately and included in the audit snapshot.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Change `removedCount: meal.items.length` to `removedCount: beforeItems.length`.

- **F-M3 `src/history/historyService.ts:20-29` + `tests/history/historyService.test.ts:244-254`:** `listHistory` delegates all sorting, filtering, and page-size enforcement to the dependency. The service does not sort the returned page itself. The tests prove the fake dependency returns data sorted by `mealLoggedAt` descending, but they do **not** prove the service enforces newest-first semantics. If the real C3 repository returns rows in insertion order (or any non-sorted order), the service would pass them through unchanged. AC #4 requires "Tests prove pagination returns 5 meals per page newest-first."
  - *Responsible role:* Executor.
  - *Suggested remediation:* Either (a) add a service-level sort by `mealLoggedAt` descending with `id` tie-breaker before returning the page, or (b) document in `HistoryDeps` JSDoc that `listConfirmedMealsPage` MUST return newest-first. Add a test that feeds an unsorted array through a passthrough fake dependency and asserts the service sorts it correctly.

- **F-M4 `src/history/types.ts:86`:** `countConfirmedMeals` is declared in `HistoryDeps` but never called by `HistoryService` or `messages.ts`.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Remove `countConfirmedMeals` from `HistoryDeps`. If it is needed for a future total-pages feature, add it back with a TODO referencing the follow-up ticket.

### Low

- **F-L1 `src/history/types.ts:6-8`:** `HistoryCursor` uses an integer `offset`, which is fragile under concurrent insertions (a newly inserted meal shifts offsets for subsequent pages, causing duplication or skips). A keyset cursor (`mealLoggedAt`, `id`) would be more robust for v0.1 pagination. Acceptable for a 2-user pilot but should be tracked for a future pagination follow-up.
  - *Responsible role:* Executor or Architect.
  - *Suggested remediation:* Add a note/TODO referencing a future pagination robustness ticket.

- **F-L2 `src/history/messages.ts:16-18`:** `MSG_HISTORY_NEXT_BUTTON`, `MSG_HISTORY_EDIT_BUTTON`, and `MSG_HISTORY_DELETE_BUTTON` are exported but never consumed by any function in `messages.ts`. They appear to be reserved for Telegram routing (TKT-FOLLOWUP-3). Harmless dead exports.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Either use them in `buildHistoryPageMessage` / `buildMealDetailMessage`, or remove them until the routing follow-up is implemented.

## Red-team probes

- **Error paths — Telegram/OpenFoodFacts/Whisper API failure, DB lock, LLM timeout:** Not applicable to C8; no external API calls.
- **Concurrency — two messages from the same user processed simultaneously:** YES, F-H2 identifies a TOCTOU race between `getConfirmedMeal` and `updateConfirmedMealWithVersion`/`softDeleteMeal`. An unhandled exception leaks existence and leaves the user with a crash instead of a graceful `not_found`.
- **Input validation — malformed voice / corrupt photo / huge text / unicode:** Not applicable to C8; inputs are structured `EditMealInput`/`DeleteMealInput` with validated IDs and numbers.
- **Prompt injection — external string reaches LLM unsanitised:** Not applicable; C8 does not call LLMs.
- **Secrets — credential committed, logged, or leaked through error messages:** No secrets in diff. Error messages are hardcoded Russian strings or `not_found` envelopes.
- **HTML injection:** `messages.ts` correctly applies `escapeHtml` to `itemNameRu` and `portionTextRu` before rendering (`F-H2` from RV-CODE-009 pattern learned and applied correctly). Numbers and system-generated dates are safe.

## PR-Agent cross-check
- PR-Agent `/improve` and `/review` results are pending (GitHub Actions `Run PR Agent` status `IN_PROGRESS`). If PR-Agent independently flags the transactionality or TOCTOU race, those findings should be promoted to the same severity tier as above. If PR-Agent surfaces new issues (e.g., dead code, test coverage gaps), they should be triaged into this review on the next iteration.

## Notes
- Executor AC table claims all ACs pass. This review disagrees on AC #8 (summary immutability tests are insufficient per F-M1) and notes weaknesses in AC #4 proof (F-M3) and AC #5 existence-leakage coverage (F-H2 lacks concurrent-race test).
- The Executor's follow-up framing (TKT-FOLLOWUP-1 through TKT-FOLLOWUP-3) is appropriate for production wiring and Telegram routing, but it cannot defer the transactionality constraint (TKT-010@0.1.0 §7) or the atomic-edit contract (ArchSpec §4.5) to a later ticket.

---

### iter-2 verify (2026-05-01, kimi-k2.6)

Executor iter-2 HEAD: `a6b2aac8e62551ab210946e77c950c179446a8d6`
Previous reviewed Executor HEAD: `1df2bd8caa6c3901ddc168dfff3fb2e5f2df1b71`
Review branch HEAD at verify start: `a93a3e07a94240625e5b9581c74a2c5c36f28ed5`

#### Verification results

| Finding | Resolution | Evidence |
|---|---|---|
| **F-H1** (transaction primitive / atomic edit-delete) | **RESOLVED** | `HistoryDeps` now declares `withTransaction<T>(action: (tx: HistoryTransactionalDeps) => Promise<T>): Promise<T>` (`src/history/types.ts:124-126`). Both `editMeal` and `deleteMeal` execute all reads and writes inside a single `withTransaction` callback (`historyService.ts:42-102`, `104-167`). Fake dependency implements snapshot/rollback semantics verified by tests: "editMeal → rolls back store on transaction failure" and "deleteMeal → rolls back store on transaction failure" assert `transactionLog` contains `"rollback"` and store state is restored to pre-mutation values. "successful edit/delete runs inside transaction with commit" assert `transactionLog` equals `["begin", "commit"]`. |
| **F-H2** (uniform `not_found` for version-conflict errors) | **RESOLVED** | `HistoryMutationConflictError` added (`types.ts:77-85`). Both `editMeal` and `deleteMeal` wrap the `withTransaction` call in `try/catch` and map `HistoryMutationConflictError` to `{ kind: "not_found" }` (`historyService.ts:96-101`, `161-166`). Tests explicitly verify: "catches HistoryMutationConflictError from dependency version mismatch and returns not_found" for both edit and delete paths. No unhandled exceptions leak existence. |
| **F-M1** (summary_records immutability tests) | **RESOLVED** | `FakeStore` now includes `summaryRecords: SummaryRecordFixture[]` array and `seedSummaryRecord` helper (`tests/history/historyService.test.ts:77-88`, `271-286`). Tests "delivered summary records are not modified by edit" and "delivered summary records are not modified by delete" seed a fixture, perform the mutation, and assert `store.summaryRecords` length remains 1 and all original fields (`totalCaloriesKcal`, `totalProteinG`, `totalFatG`, `totalCarbsG`, `deliveredAt`) are unchanged. |
| **F-M2** (`deleteMeal` removedCount uses `beforeItems.length`) | **RESOLVED** | `deleteMeal` now computes `removedCount: beforeItems.length` (`historyService.ts:155`). |
| **F-M3** (newest-first pagination proof/enforcement) | **RESOLVED** | `sortMealsNewestFirst` added at service level (`historyService.ts:19-25`) sorting by `mealLoggedAt` descending with `id` tie-breaker. Test "enforces newest-first even when dependency returns unsorted meals" explicitly reverses the fake dependency output and asserts the service re-sorts to `meal-new` → `meal-mid` → `meal-old`. |
| **F-M4** (dead `countConfirmedMeals`) | **RESOLVED** | `countConfirmedMeals` removed from `HistoryDeps`/`HistoryTransactionalDeps` interfaces. |
| **F-L1** (offset cursor fragility) | **NOT RESOLVED** — acceptable defer | `HistoryCursor` still uses integer `offset`. No TODO or note added. Low severity; acceptable for a 2-user pilot but should be addressed in a future pagination robustness ticket (e.g., keyset cursor). |
| **F-L2** (unused message exports) | **RESOLVED** | Unused `MSG_HISTORY_NEXT_BUTTON`, `MSG_HISTORY_EDIT_BUTTON`, `MSG_HISTORY_DELETE_BUTTON` removed from `messages.ts`. |
| **PR-Agent pre-iter-2 "Transactional Consistency Gap"** | **RESOLVED** | Same issue as F-H1; resolved by `withTransaction` primitive and transaction-scoped mutation. |
| **PR-Agent pre-iter-2 "Missing Failure-Path Coverage"** | **RESOLVED** | Same issue as F-H2; resolved by `HistoryMutationConflictError` catch-and-map plus explicit tests. |
| **PR-Agent current-head "Data Loss in Audit" (`snapshotToJson` omits `sourceRef`)** | **VALID — Medium** | `snapshotToJson` (`types.ts:177-195`) serializes `source: item.source` but omits `source_ref: item.sourceRef`. `MealItemView` includes `sourceRef: string | null` which carries the original data-source identifier (e.g., OpenFoodFacts barcode). Losing this in audit snapshots breaks item-level traceability for corrected items. This is a data-loss concern in audit fidelity but not explicitly required by TKT-010@0.1.0 §6 ACs or ArchSpec §4.5 step 3, which only mandate "before/after KBJU totals" snapshots. Verdict impact: non-blocking medium; recommend adding `source_ref: item.sourceRef` to the item mapping in a follow-up patch or next iteration. |

#### Verdict for iter-2 verify

- [ ] pass
- [x] pass_with_changes
- [ ] fail

All prior high-severity findings (F-H1, F-H2) are resolved. All prior medium findings (F-M1–F-M4) are resolved. Low F-L2 resolved; F-L1 deferred. A new medium finding from PR-Agent cross-check (`snapshotToJson` `sourceRef` omission) remains non-blocking. No new high-severity issues.

One-sentence justification: All blocking transactionality and existence-leakage defects are resolved with proven rollback/commit semantics and uniform `not_found` mapping; one non-blocking audit-data-loss medium finding (`sourceRef` omission in snapshots) remains.
Recommendation to PO: Approve after Executor adds `source_ref: item.sourceRef` to `snapshotToJson` item mapping, or accept as a known medium for a follow-up patch.

---

### iter-3 narrow verify (2026-05-01, kimi-k2.6)

Executor iter-3 HEAD: `5127bf11b817ed1c91dacd5a62ebfc14729b33e8`
Previous iter-2 reviewed HEAD: `a6b2aac8e62551ab210946e77c950c179446a8d6`
Review branch HEAD at verify start: `237da8c40e7b5adaaaa8f824eb96fc0f7f0312ed`

#### Narrow verify scope
Only the remaining `pass_with_changes` medium finding from iter-2: `snapshotToJson` omitted `sourceRef` from audit snapshot item serialization.

#### Verification results

| Finding | Resolution | Evidence |
|---|---|---|
| **PR-Agent/Kimi `sourceRef` audit data-loss** (`snapshotToJson` omission) | **RESOLVED** | `snapshotToJson` now includes `source_ref: item.sourceRef` at line 193 (`src/history/types.ts:183-194`). Audit snapshot item mapping now serializes both `source` (line 192) and `source_ref` (line 193). Test `editMeal → writes before/after audit snapshots and increments meal version` asserts `beforeItems[0].source_ref` equals `"123456"` and `afterItems[0].source_ref` is defined (`tests/history/historyService.test.ts:483-486`). |
| **Prior F-H1** (transaction primitive) | **RESOLVED** (unchanged from iter-2) | `withTransaction` primitive present; edit/delete atomic. |
| **Prior F-H2** (uniform `not_found`) | **RESOLVED** (unchanged from iter-2) | `HistoryMutationConflictError` catch-and-map present. |
| **Prior F-M1** (summary immutability) | **RESOLVED** (unchanged from iter-2) | Seeded fixtures + assertions present. |
| **Prior F-M2** (`removedCount`) | **RESOLVED** (unchanged from iter-2) | `beforeItems.length` used. |
| **Prior F-M3** (newest-first sort) | **RESOLVED** (unchanged from iter-2) | Service-level sort + test present. |
| **Prior F-M4** (dead `countConfirmedMeals`) | **RESOLVED** (unchanged from iter-2) | Removed from interfaces. |
| **Prior F-L1** (offset cursor fragility) | **DEFERRED** (unchanged from iter-2) | Low severity; acceptable defer. |
| **Prior F-L2** (unused exports) | **RESOLVED** (unchanged from iter-2) | Dead exports removed. |
| **PR-Agent status** | **STALE** — persistent review comment still references iter-2 HEAD `a6b2aac8e62551ab210946e77c950c179446a8d6`. No updated persistent review available for iter-3 at time of verify. | No new high or medium findings from PR-Agent at current HEAD; stale comment alone does not block. |

#### Verdict for iter-3 verify

- [x] pass
- [ ] pass_with_changes
- [ ] fail

All remaining iter-2 `pass_with_changes` findings are resolved. No new high or medium findings from Kimi or PR-Agent at current HEAD. F-L1 offset cursor remains a low-severity deferred item.

One-sentence justification: The remaining medium `sourceRef` audit-data-loss finding is resolved with `source_ref` now serialized in `snapshotToJson` and asserted in audit snapshot tests; all prior high and medium findings remain resolved; no new blocking issues.
Recommendation to PO: Approve for merge.
