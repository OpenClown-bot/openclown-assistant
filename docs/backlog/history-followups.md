---
id: BACKLOG-007
title: "History follow-ups (post TKT-010)"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-01
---

# History follow-ups (post TKT-010)

Deferred work surfaced during the TKT-010 (History Mutation Flow) review cycle — the **first Ticket Orchestrator (TO) pilot** — and the carve-outs documented in TKT-010@0.1.0 §5 Outputs (dependency-interface pattern; real C3 wire-up explicitly deferred to follow-ups). Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations:
- Reviewer (Kimi K2.6): `docs/reviews/RV-CODE-010-tkt-010-history-mutation-flow.md`. Iter-1 fail (2H + 4M + 2L), iter-2 pass_with_changes (all six prior findings RESOLVED + PR-Agent-promoted sourceRef finding classified medium), iter-3 pass (sourceRef RESOLVED at `historyService.ts:193`; F-L1 offset cursor fragility deferred low-severity per Reviewer-accepted rationale).
- Supplementary reviewer (PR-Agent / Qwen 3.6 Plus through OmniRoute): persistent-review block on PR #69 (final commit `5127bf1`); verdict ⚡ No major issues detected, no security concerns, no code suggestions; one substantive iter-2 finding (sourceRef omission in audit-snapshot serialization, correctness/data-integrity class) was promoted into Reviewer iter-3 scope as the canonical TO-pilot demonstration of the cross-reviewer audit Hard rule.
- Cross-reviewer audit pass-1 (Ticket Orchestrator, GPT-5.5 thinking on opencode + ChatGPT Plus / Codex CLI): all Reviewer findings RESOLVED in current HEAD; F-L1 deferred per Reviewer-accepted rationale.
- Cross-reviewer audit pass-2 (Devin Orchestrator ratification per `docs/meta/devin-session-handoff.md` §11.4): independent re-classification confirmed all RESOLVED, PR-Agent settle-on-final-HEAD independently re-verified, merge-safe sign-off issued.

Scope of this BACKLOG file:
- **TKT-NEW-pagination-keyset-cursor** carries over the single low-severity Reviewer finding (F-L1) deferred from RV-CODE-010 iter-3.
- **TKT-FOLLOWUP-1 / TKT-FOLLOWUP-2 / TKT-FOLLOWUP-3** carry the three carve-outs explicitly out-of-scope per TKT-010@0.1.0 §5 Outputs: real C3 wire-up of the C8 history surface, the matching `listMealItems` repository method on C3, and Telegram-router wire-up so C8 history is reachable from the bot UX. These were deferred at ticket-creation time, not surfaced as Reviewer findings, but are tracked here so the next Architect cycle can ratify them into a proper TKT (or split them across TKTs) when meal-history UX work is staged.

## TKT-NEW-pagination-keyset-cursor — Replace offset cursor with keyset cursor for `HistoryCursor`

**Source:** RV-CODE-010 iter-3 finding F-L1 (low; offset cursor fragility), classified Reviewer-or-Architect responsibility, deferred low-severity per Reviewer-accepted rationale that the 2-user pilot meal volume does not exercise the pathological case in v0.1.

**The issue.** `src/history/types.ts:6-8` defines `HistoryCursor` with an integer `offset`. Under concurrent insertions (a new meal logged between two paginated reads of the history), offsets shift for subsequent pages — duplicating or skipping rows depending on insertion ordering. The pattern is classic offset-cursor fragility and is well-documented for paginated mutation surfaces. For 2-user pilot traffic, the risk window is negligible (meals are logged at human cadence; pagination requests almost never overlap a write). For post-pilot traffic with concurrent users / batched ingestion / scheduled summary delivery (TKT-011), a keyset cursor is structurally more robust.

**Proposed fix (Architect to ratify).** Replace `offset: number` with a keyset cursor `{ mealLoggedAtBefore: Date; idTieBreaker: string }` (or ISO-string + UUID variant). Update `HistoryDeps.listConfirmedMealsPage` JSDoc + signature so the C3 adapter constructs the SQL `WHERE (meal_logged_at, id) < ($1, $2) ORDER BY meal_logged_at DESC, id DESC LIMIT $3` predicate. Update `historyService.listHistory` to derive the next-page cursor from the last returned row instead of `offset + pageSize`. The dependency-interface pattern from TKT-010 makes this a localized change in `src/history/historyService.ts` + `src/history/types.ts` with the C3 adapter swap landing as part of the TKT-FOLLOWUP-1 wire-up below (so the migration is bundled, not double-spent).

**NOT in scope of the eventual TKT.** Schema changes (the existing `confirmed_meals (meal_logged_at, id)` indices are sufficient); migration of existing pagination call-sites outside C8 (none exist yet — C8 is greenfield); UX changes (the cursor is opaque to Telegram users).

**Estimated size:** S. Tests: keyset cursor returns same meal exactly once across concurrent insertions; cursor stability across page boundaries when inserts arrive between reads; first-page null-cursor returns newest-first; last-page-empty terminates correctly.

**Dependencies:** Should land before, or as part of, TKT-FOLLOWUP-1 below (since both touch the `listConfirmedMealsPage` C3 adapter); do not land in isolation while C8 is still dependency-injected for tests, because the migration would be wasted.

**Severity:** low. Deferred from RV-CODE-010 iter-3 as a pilot-scope acceptable trade-off.

---

## TKT-FOLLOWUP-1 — Wire C8 `HistoryService` into the C3 repository surface

**Source:** TKT-010@0.1.0 §5 Outputs explicit carve-out + TKT-010 §10 Execution Log entry "All ACs satisfied via dependency-interface pattern (C3 integration deferred to follow-up)".

**The issue.** TKT-010 deliberately landed `HistoryService` behind a `HistoryDeps` interface so Reviewer iter-1 could prove correctness without touching the live `TenantStore` in C3. The dependency-interface pattern means C8 is currently only reachable from tests; no production composition root constructs a real `HistoryDeps` from the Postgres-backed `TenantStore`. ARCH-001@0.4.0 §3.8 (C8 History Mutation Service) and §4.5 (Manual entry, edit, and delete history) specify C8 reads/writes through C3, not directly against the database. The wire-up is the gap between `HistoryService` existing and `HistoryService` being callable from `mealOrchestrator` / Telegram routes.

**Proposed fix (Architect to ratify).** Add a C3-adapter module (e.g. `src/history/historyDepsFromTenantStore.ts`) that constructs a `HistoryDeps` instance from a `TenantScopedRepository` handle. Implement `withTransaction` by delegating to `TenantStore.withTransaction` and returning a transaction-bound `HistoryDeps` (the pattern was prescribed in RV-CODE-010 F-H1 remediation and the interface is already designed for it). Implement `getConfirmedMeal`, `listConfirmedMealsPage`, `listMealItems` (see TKT-FOLLOWUP-2 below — this is its pre-condition), `replaceMealItems`, `softDeleteMeal`, `updateConfirmedMealWithVersion`, `createAuditEvent`, `listSummaryRecordsForMeal` against `TenantScopedRepository`. Replace test-only construction in `tests/history/historyService.test.ts` with a thin fake that defers to the same adapter shape (so the contract is still testable in isolation). Add an integration test that drives `editMeal` / `deleteMeal` against an in-memory or Docker-Compose Postgres and asserts atomicity (kill the second mutation mid-transaction; assert rollback).

**NOT in scope.** Telegram-router wire-up (TKT-FOLLOWUP-3); UX copy or button rendering; cursor migration (TKT-NEW-pagination-keyset-cursor) — but bundling that migration into this TKT is encouraged so the C3 adapter is written once.

**Estimated size:** M. Tests: adapter integration test for `withTransaction` rollback semantics; contract test that the fake and the adapter present the same `HistoryDeps` interface; smoke test that `historyService.editMeal` against the adapter writes both meal mutation and audit event atomically.

**Dependencies:** TKT-NEW-pagination-keyset-cursor (encouraged to bundle); TKT-FOLLOWUP-2 (`listMealItems` on C3 surface — pre-condition for the adapter implementation).

---

## TKT-FOLLOWUP-2 — Add `listMealItems(mealId)` to the C3 `TenantScopedRepository` surface

**Source:** TKT-010@0.1.0 §5 Outputs explicit carve-out (test-only `HistoryDeps.listMealItems` consumed by the audit-snapshot pipeline); precondition for TKT-FOLLOWUP-1 above.

**The issue.** `HistoryService` constructs before/after audit-snapshot items by reading `meal_items` rows for the target meal — both `editMeal` (snapshot before mutation, snapshot after mutation) and `deleteMeal` (snapshot before soft-delete; the F-M2 finding fixed this in iter-2). The corresponding read method is currently only declared on the test-side `HistoryDeps` interface (`listMealItems(mealId, txn?): Promise<MealItem[]>`). C3 (`src/store/tenantStore.ts` / `src/store/schema.sql:meal_items` table) does not yet expose this read on its public `TenantScopedRepository` interface; only narrow read paths exist for the meal-orchestrator confirm flow.

**Proposed fix (Architect to ratify).** Add `listMealItems(mealId: string, txn?: Transaction): Promise<MealItem[]>` to `TenantScopedRepository`. Implement against the `meal_items` table with `WHERE meal_id = $1 ORDER BY position ASC` (or whatever ordering ARCH-001 §5 mandates for canonical item ordering — Architect to confirm; if no ordering is mandated, document the call-site assumption explicitly). Tests: ordering stability across calls; empty meal returns empty array; transaction-bound variant participates in the surrounding `withTransaction` callback per the C3 contract.

**NOT in scope.** Pagination of the items list (a single meal has bounded item count by ARCH-001 §4.2 + §4.5 — no pagination needed); soft-deleted item filtering (items inherit meal soft-delete state; no per-item `deleted_at`); cross-meal listing (out of C8 scope).

**Estimated size:** S. The method is a thin SELECT.

**Dependencies:** none. Should land before or as part of TKT-FOLLOWUP-1.

---

## TKT-FOLLOWUP-3 — Wire C8 history routes through the Telegram bot router

**Source:** TKT-010@0.1.0 §5 Outputs explicit carve-out (TKT-010 was service-only; UX wire-up deferred). RV-CODE-010 F-L2 originally flagged dead `MSG_HISTORY_NEXT_BUTTON` / `MSG_HISTORY_EDIT_BUTTON` / `MSG_HISTORY_DELETE_BUTTON` exports drafted speculatively in `src/history/messages.ts`; those exports were **removed in iter-2 per F-L2 remediation** (RV-CODE-010 line 113: "Unused MSG_HISTORY_NEXT_BUTTON, MSG_HISTORY_EDIT_BUTTON, MSG_HISTORY_DELETE_BUTTON removed from messages.ts"). They will need to be re-added — alongside callback-data constants and any inline-keyboard helpers — when this TKT lands and consumers exist for them.

**The issue.** TKT-010 produced `HistoryService` + the deterministic Russian copy that survived F-L2 (header / empty / page-info / item-line / item-deleted / meal-edited / meal-deleted / meal-not-found / meal-detail-header / meal-detail-item) + tests; it did not produce Telegram routes (`/history`, edit/delete inline-button callbacks, paginated next-page navigation), and the next/edit/delete button-label exports were removed under F-L2 because they had no consumers. Without these, the C8 surface is not user-reachable. ARCH-001@0.4.0 §3.8 (C8 History Mutation Service) and §6 (External Interfaces) specify that history is a Telegram-driven flow with `Список` / next-page / edit / delete affordances. This TKT must re-add the button-label copy (and the corresponding callback-data identifiers) at the same time it adds the consumers, so the dead-export pattern does not recur.

**Proposed fix (Architect to ratify).** Add a `historyRouter` (or extend the C1 routing in `src/telegram/entrypoint.ts`) that handles: (a) `/history` text command — calls `historyService.listHistory({ userId, cursor: null, pageSize: 5 })` and renders `buildHistoryPageMessage` with an inline keyboard whose button labels live in newly-re-added `MSG_HISTORY_NEXT_BUTTON` / `MSG_HISTORY_EDIT_BUTTON` / `MSG_HISTORY_DELETE_BUTTON` exports in `src/history/messages.ts` (the F-L2 removals are intentionally re-introduced together with consumers); (b) `next-page` callback — re-paginates with the carried cursor; (c) `edit-meal` / `delete-meal` callbacks — surface confirmation prompts (mirror the TKT-009 confirmation-flow UX), then invoke `historyService.editMeal` / `deleteMeal` and render success / not-found / stale_version envelopes through the appropriate Russian message variants. Add integration tests using the Telegram fake harness that already exists in `tests/telegram/`.

**NOT in scope.** New PRD or ArchSpec sections (the routes are already implied by ARCH-001@0.4.0 §6); manual-entry edit (history edit reuses the same KBJU-recompute pipeline as TKT-009 confirmation; no new manual-entry UX); admin / moderation routes; right-to-delete hard-delete (TKT-012 scope).

**Estimated size:** M. The Telegram-router work is mechanical but exercises every C8 surface end-to-end and will surface any latent C3 wire-up issues (so this should land after TKT-FOLLOWUP-1).

**Dependencies:** TKT-FOLLOWUP-1 (C8 must be reachable from production composition root before the router can call it); TKT-NEW-pagination-keyset-cursor (encouraged to bundle so cursor stability holds under real concurrent traffic).

---

## Cross-cutting note — pipeline integrity improvements derived from this cycle

The TKT-010 cycle was the first end-to-end TO pilot. Three pipeline-integrity improvements landed in PR #71 as a direct consequence (see `docs/session-log/2026-05-01-session-4.md` §6.6):

1. **Iter-N continuation rule.** Iter-1 NUDGE = full `REPO BOOTSTRAP`; iter-N NUDGE on the same opencode session = short `ITER-N CONTINUATION` block (no `rm -rf`). Mirrored in `docs/prompts/executor.md`, `docs/prompts/reviewer.md`, `docs/prompts/ticket-orchestrator.md`.
2. **PR-Agent settle-on-final-HEAD requirement.** TO must verify `conclusion: success` on the PR-Agent workflow run for the current Executor HEAD before drafting hand-back. Devin Orchestrator's ratification audit (handoff §11.4 step #4) independently re-verifies. If PR-Agent runs >25 min on a single HEAD, TO bounces as a strategic blocker.
3. **PR-Agent perf.** Workflow concurrency `cancel-in-progress: true` + `timeout-minutes: 12`; `[pr_code_suggestions] num_code_suggestions_per_chunk` 4→2 + `max_number_of_calls` 4→2. Quality-neutral because `focus_only_on_problems = true` causes the suggestions step to nearly always return "No code suggestions found".

These are repo-wide pipeline rules now in `main` (PR #71 + PR #68 always-fresh-clone protocol) and apply to every future TKT cycle, not just history work; they are listed here only because the TKT-010 pilot surfaced the need.
