---
id: TKT-009
title: "Meal Draft Confirmation Flow"
status: done
arch_ref: ARCH-001@0.2.0
component: "C4 Meal Logging Orchestrator"
depends_on: ["TKT-002@0.1.0", "TKT-003@0.1.0", "TKT-004@0.1.0", "TKT-005@0.1.0", "TKT-006@0.1.0", "TKT-007@0.1.0", "TKT-008@0.1.0"]
blocks: ["TKT-010@0.1.0", "TKT-011@0.1.0", "TKT-014@0.1.0"]
estimate: L
assigned_executor: "glm-5.1"
created: 2026-04-26
updated: 2026-05-01
completed_at: 2026-05-01
completed_by: "yourmomsenpai (PO)"
completed_note: "TKT-009 closed following RV-CODE-009 iter-4 verify verdict pass (Kimi K2.6 commit 8815fef on rv-branch). Implementation merged via PR #59 (squash commit on main 2026-05-01) covering all 9 ACs (npm test 420/420, lint clean, typecheck clean, manualEntry + mealOrchestrator + messages.test.ts; F-H1 OptimisticVersionError handling, F-M2 timezone-aware meal_local_date via injected resolver, F-M3 metric-emission failure isolation, F-PA-18 atomic replace-semantics in applyCorrection via new TenantScopedRepository.deleteMealDraftItemsByDraftId method, F-H2 HTML-escape utility src/shared/escapeHtml.ts mapping &/</> applied at item.itemNameRu and item.portionTextRu interpolation in buildDraftMessage). Review trail: iter-1 (commit cae5c03, fail blocked on F-H1 + 2M + 4L) -> iter-2 (commit 5e3edb3, pass_with_changes after F-H1/F-M1/F-M2/F-M3 RESOLVED, F-L1-4 deferred) -> iter-3 (commit db96ec4, pass after F-PA-18 RESOLVED via deleteMealDraftItemsByDraftId, F-L1 test integrity restored) -> iter-4 (commit 3caaa49 review section pass_with_changes promoting PR-Agent finding F-PA-17/F-H2 missed by orchestrator audit on iter-1 stale-marked comment ids 3172888561/3172894543) -> iter-4 fix (commit c4fb9f2 escapeHtml + tests) -> iter-4 verify (commit 8815fef pass, PR-Agent c4fb9f2 findings A and B ruled non-substantive). Five PR-Agent supplementary findings (F-PA-12 replace-vs-append context-finding, F-PA-13 dead transcriptId, F-PA-14 manual-entry test gap, F-PA-17/F-H2 HTML-escape promoted to iter-4, F-PA-18 atomic replace-semantics promoted to iter-3) all classified or RESOLVED. Three deferrals to BACKLOG-005@0.1.0: TKT-NEW-O (C1/C4 lifecycle reconciliation per F-M1 Architect ask), TKT-NEW-Q (ARCH-001 §4.5 replace-semantics ratification + transcript_id linkage from F-L1/F-L2), TKT-NEW-S (escapeHtml `\"`/`'` defensive depth per Kimi iter-4 verify ruling on PR-Agent finding B). PR-Agent supplementary review on PR #59: 4 distinct findings on iter-1 (commits cae5c03 / db96ec4 / c4fb9f2 / 8815fef across rv- and tkt-branches); informational + cross-reviewer audit catches; Reviewer Kimi K2.6 remains the load-bearing CODE-mode reviewer. Cross-reviewer audit lesson: PR-Agent inline /improve comments marked 'old commit' MUST be re-evaluated on every audit pass — F-PA-17 missed in earlier session because outgoing-Devin audit triage anchored on iter-2+ comments only. Pipeline rule codified for future cycles (next clerical PR)."
---

# TKT-009: Meal Draft Confirmation Flow

## 1. Goal (one sentence, no "and")
Implement the meal draft confirmation orchestration for text, voice, photo, manual sources.

## 2. In Scope
- Add C4 orchestration for text meal input, voice transcript input, photo candidate input, correction edits, and manual KBJU entry.
- Create versioned `meal_drafts` and `meal_draft_items` records before user confirmation.
- Persist `confirmed_meals` and `meal_items` only after explicit confirm callback.
- Apply US-7 manual fallback when transcription, vision, or KBJU estimation returns no usable draft.
- Render Russian itemized draft messages with confirm/edit affordances and low-confidence labels for photo drafts.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No history pagination after confirmation; that belongs to TKT-010@0.1.0.
- No scheduled summaries; that belongs to TKT-011@0.1.0.
- No right-to-delete implementation; that belongs to TKT-012@0.1.0.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.2.0 §3.4 C4 Meal Logging Orchestrator
- ARCH-001@0.2.0 §4.2 Text meal logging
- ARCH-001@0.2.0 §4.3 Voice meal logging
- ARCH-001@0.2.0 §4.4 Photo meal logging
- ARCH-001@0.2.0 §4.5 Manual entry, edit, and delete history
- ARCH-001@0.2.0 §5 `meal_drafts`, `meal_draft_items`, `confirmed_meals`, `meal_items`, `audit_events`
- ARCH-001@0.2.0 §8 Observability
- `src/shared/types.ts`
- `src/store/tenantStore.ts`
- `src/telegram/types.ts`
- `src/telegram/messages.ts`
- `src/onboarding/types.ts`
- `src/kbju/kbjuEstimator.ts`
- `src/voice/transcriptionAdapter.ts`
- `src/photo/photoRecognitionAdapter.ts`
- `src/photo/photoConfidence.ts`
- `src/observability/events.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/store/types.ts` — `deleteMealDraftItemsByDraftId` added to `TenantScopedRepository` interface (iter-3 scope expansion)
- [ ] `src/store/tenantStore.ts` — proxy + impl for `deleteMealDraftItemsByDraftId` (iter-3 scope expansion)
- [ ] `src/meals/types.ts` exporting draft, confirmation, correction, and manual-entry types
- [ ] `src/meals/messages.ts` exporting Russian meal draft/fallback copy
- [ ] `src/meals/manualEntry.ts` exporting guided manual KBJU parsing
- [ ] `src/meals/mealOrchestrator.ts` exporting the C4 orchestrator
- [ ] `tests/meals/manualEntry.test.ts`
- [ ] `tests/meals/mealOrchestrator.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/meals/manualEntry.test.ts tests/meals/mealOrchestrator.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove text, voice, photo, and manual sources create drafts before confirmation.
- [ ] Tests prove photo drafts never create `confirmed_meals` without explicit confirm.
- [ ] Tests prove stale draft versions cannot be confirmed after a correction creates a newer version.
- [ ] Tests prove duplicate confirm callbacks are idempotent.
- [ ] Tests prove KBJU failure opens manual entry and does not persist a confirmed meal.
- [ ] Tests prove K1/K2/K5 metric events are emitted on confirm.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT bypass C3 repository methods for meal, draft, or audit writes.
- Do NOT auto-save any photo-derived estimate.
- Do NOT retry suspicious model output from C6 or C7.
- All Russian UX copy must be deterministic strings or templates, not LLM-generated.
- GLM assignment is acceptable because the ticket integrates existing typed components under direct tests.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-009-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-01 09:00 glm-5.1: started iter-1 implementation -->
<!-- 2026-05-01 09:30 glm-5.1: opened PR #59 (head cae5c03) -->
<!-- 2026-05-01 09:45 kimi-k2.6: iter-1 review verdict fail (1H + 2M + 4L) -->
<!-- 2026-05-01 10:30 glm-5.1: iter-2 fixes pushed (head 5e3edb3) F-H1/F-M1/F-M2/F-M3 RESOLVED -->
<!-- 2026-05-01 11:00 kimi-k2.6: iter-2 review verdict pass_with_changes; F-L1-4 deferred -->
<!-- 2026-05-01 11:30 glm-5.1: iter-3 fixes pushed (head db96ec4) F-PA-18 atomic replace + F-L1 test gap -->
<!-- 2026-05-01 12:00 kimi-k2.6: iter-3 review verdict pass; claim (d) §10 fill PARTIAL (deferred to closure-PR) -->
<!-- 2026-05-01 13:30 kimi-k2.6: iter-4 review pushed (rv-branch 3caaa49) promoting PR-Agent F-PA-17 to F-H2 (HTML-escape gap) per cross-reviewer audit; verdict pass_with_changes -->
<!-- 2026-05-01 14:05 glm-5.1: iter-4 fix pushed (head c4fb9f2) escapeHtml utility + buildDraftMessage application + 2 regression tests; vitest 420/420 -->
<!-- 2026-05-01 14:19 kimi-k2.6: iter-4 verify pushed (rv-branch 8815fef) F-H2 RESOLVED; PR-Agent c4fb9f2 findings A (§5 compliance) and B (\"/' escape) ruled non-substantive; verdict pass -->
<!-- 2026-05-01 14:45 PO: merged PR #58 (TKT-015@0.1.0 code), PR #62 (RV-CODE-015), PR #59 (TKT-009 code), PR #60 (RV-CODE-009) -->
<!-- 2026-05-01 14:50 orchestrator: opening closure-PR-1 (this PR): TKT-009 status flip + §10 fill + RV-CODE-009 status flip + BACKLOG-005 with TKT-NEW-O/Q/S -->

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
