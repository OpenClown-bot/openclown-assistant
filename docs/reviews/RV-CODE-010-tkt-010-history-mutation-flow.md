---
id: RV-CODE-010
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/69"
ticket_ref: TKT-010@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-01
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
