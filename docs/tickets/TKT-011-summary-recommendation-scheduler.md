---
id: TKT-011
title: "Summary Recommendation Scheduler"
status: done
arch_ref: ARCH-001@0.4.0
component: "C9 Summary Recommendation Service"
depends_on: ["TKT-002@0.1.0", "TKT-003@0.1.0", "TKT-005@0.1.0", "TKT-006@0.1.0", "TKT-010@0.1.0"]
blocks: ["TKT-012@0.1.0", "TKT-014@0.1.0"]
estimate: L
assigned_executor: "glm-5.1"
created: 2026-04-26
updated: 2026-05-02
completed_at: 2026-05-02
completed_by: "yourmomsenpai (PO)"
completed_note: "TKT-011 reached Reviewer (Kimi K2.6) verdict pass on iter-2 (Executor commit f195017). Iter-3..8 were Executor commits responding to PR-Agent inline findings (NFKC normalization, zero-width stripping, persona <persona> delimiters, homoglyph normalization, persona cache path, persona-text escape against </persona> breakout) plus one Devin Review correctness fix on iter-7 (actual month-length targets + persisted delta JSON aligned to KBJUValues keys) — all defensive guardrail hardening + one correctness fix; no behavioral regressions vs Acceptance Criteria. Reviewer (Kimi K2.6) was not formally re-engaged after iter-2 pass; PR-Agent persistent review and Devin Review covered iter-3..8 with verdict no-major-issues + no-security-concerns. This procedural gap (Reviewer pass on iter-N but Executor pushed substantive code on iter-N+1..M without Reviewer re-engagement) is captured as a structural lesson in BACKLOG-008 §TKT-NEW-reviewer-reengagement-after-substantive-pushes. Frontmatter assigned_executor was qwen-3.6-plus per original ticket; actual run was glm-5.1 (PO-confirmed deviation: 'это формальность, ТО почему-то указывал квен, хотя мы делаем и я делал на глм'). Frontmatter bumped post-hoc to glm-5.1 to match reality; structural lesson captured in BACKLOG-008 §TKT-NEW-launcher-asserts-frontmatter-executor. PR-Agent persistent review settled to final HEAD 4e3e818 with verdict ⚡no major issues + 🔒no security concerns + 2 informational findings (F-PA-1 Misleading Error Context, F-PA-2 Synchronous File Read in Async Flow) deferred to BACKLOG-008. PR-Agent workflow run 25240991302 was formally stuck IN_PROGRESS on the final HEAD (after a prior CANCELLED run after 9 min) — Devin Orchestrator treated as CI infrastructure tail-latency per session-4 §6.6 OmniRoute outlier precedent (TKT-010 had a 22-min tail-latency outlier on its final HEAD; TKT-011 stuck/cancelled on its final HEAD; 2 of 2 final-HEAD runs across 2 TO pilots show pattern, captured as TKT-NEW in BACKLOG-008) and approved merge under ratification authority. Cross-reviewer audit pass-1 (Ticket Orchestrator, GPT-5.5 thinking on opencode): all PR-Agent findings classified non-blocking; closure-ready hand-back to Devin Orchestrator with PR-Agent CI status flagged as strategic blocker. Cross-reviewer audit pass-2 (Devin Orchestrator ratification per docs/meta/devin-session-handoff.md §11.4): independent re-verification confirmed Reviewer iter-2 pass valid + iter-3..8 substantive changes covered by PR-Agent + Devin Review (procedural anomaly captured as BACKLOG-008 lesson, not substance blocker); PR-Agent stuck CI ruled infra failure under DO authority; merge-safe sign-off issued. PR #75 + PR #76 squash-merged to main 2026-05-02 by PO. RV-CODE artifact was incorrectly numbered RV-CODE-016 by Reviewer at iter-1 (next-sequential instead of TKT-aligned); renamed to RV-CODE-011 in this closure-PR per TKT-N↔RV-CODE-N convention. Second TO pilot, end-to-end. Structural lessons (4× TKT-NEW + 2× F-PA carry-over) captured in BACKLOG-008."
---

# TKT-011: Summary Recommendation Scheduler

## 1. Goal (one sentence, no "and")
Implement scheduled KBJU summary generation with guarded recommendations.

## 2. In Scope
- Add C9 due-schedule selection using user timezone, local period boundaries, and idempotency key `(user_id, period_type, period_start)`.
- Aggregate confirmed non-deleted meals into daily, weekly, and monthly totals.
- Compute deltas vs targets and previous-period comparisons.
- Load PO persona from `PERSONA_PATH` at startup and fail closed when missing.
- Generate Russian summary recommendations through OmniRoute with ADR-006@0.1.0 prompt/validator/fallback rules.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No onboarding schedule creation; that belongs to TKT-005@0.1.0.
- No meal edit/delete implementation; that belongs to TKT-010@0.1.0.
- No right-to-delete hard deletion; that belongs to TKT-012@0.1.0.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.4.0 §3.9 C9 Summary Recommendation Service
- ARCH-001@0.4.0 §4.6 Scheduled summaries
- ARCH-001@0.4.0 §5 `summary_schedules`, `summary_records`, `confirmed_meals`, `meal_items`, `user_targets`
- ARCH-001@0.4.0 §8 Observability
- ARCH-001@0.4.0 §9.4 LLM Prompt-Injection Mitigations
- ADR-002@0.1.0
- ADR-006@0.1.0
- ADR-009@0.1.0
- docs/knowledge/llm-routing.md
- `src/shared/types.ts`
- `src/store/tenantStore.ts`
- `src/kbju/kbjuEstimator.ts`
- `src/llm/omniRouteClient.ts`
- `src/observability/costGuard.ts`
- `src/observability/events.ts`
- `src/history/historyService.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/summary/types.ts` exporting summary period, aggregate, and recommendation types
- [ ] `src/summary/personaLoader.ts` exporting startup persona loading
- [ ] `src/summary/recommendationGuard.ts` exporting prompt builder, output validator, and deterministic fallback
- [ ] `src/summary/summaryScheduler.ts` exporting C9 schedule processing
- [ ] `src/summary/messages.ts` exporting Russian no-meal nudge and deterministic fallback copy
- [ ] `tests/summary/personaLoader.test.ts`
- [ ] `tests/summary/recommendationGuard.test.ts`
- [ ] `tests/summary/summaryScheduler.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/summary/personaLoader.test.ts tests/summary/recommendationGuard.test.ts tests/summary/summaryScheduler.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove duplicate cron events produce one `summary_records` row per idempotency key.
- [ ] Tests prove zero-meal periods send a deterministic Russian nudge without an LLM call.
- [ ] Tests prove validator blocks Russian and English forbidden terms for medical/clinical advice, vitamins, supplements, drugs, hydration, glycemic index, meal timing, micronutrients, diagnosis, treatment, and exercise.
- [ ] Tests prove blocked recommendations send deterministic numeric KBJU fallback and emit `summary_recommendation_blocked`.
- [ ] Tests prove missing `PERSONA_PATH` fails startup for C9.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT pass raw full meal text into the recommendation model unless it is a numeric correction note required by ARCH-001@0.4.0 §3.9.
- Do NOT retry suspicious recommendation output.
- Recommendations must be limited to calories, protein, fat, and carbs relative to targets.
- Qwen assignment is appropriate because this ticket is independent after dependencies and heavily language/guardrail oriented.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-011-NN.md -->

## 11. Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)

## 10. Execution Log

| Timestamp (UTC) | Event | Detail |
|---|---|---|
| 2026-05-02T00:38Z | iter-1 started | glm-5.1 on opencode (frontmatter said qwen-3.6-plus; actual run on glm-5.1 per PO; frontmatter bumped post-hoc in this closure-PR) |
| 2026-05-02T00:40Z | PR opened | https://github.com/OpenClown-bot/openclown-assistant/pull/75 |
| 2026-05-02T00:51Z | iter-2 started | kimi-k2.6 iter-1 verdict pass_with_changes — F-M1 (timezone), F-L1 (dead code), F-L2 (test assertion specificity) |
| 2026-05-02T00:53Z | iter-2 fixes pushed | F-M1: timezone-aware pure-calendar period bounds; F-L1: removed unused DETERMINISTIC_FALLBACK_RU; F-L2: assert summary_recommendation_blocked event name (Executor commit f195017) |
| 2026-05-02T00:55Z | iter-2 review verdict | kimi-k2.6 verdict pass on f195017; F-M1 / F-L1 / F-L2 all RESOLVED; no further Reviewer iters formally invoked |
| 2026-05-02T01:01Z | iter-3 fix pushed | PR-Agent: blocked_reason → error_code (allowlisted observability key) so blocked reason survives log redaction |
| 2026-05-02T01:10Z | iter-4 fix pushed | PR-Agent: harden recommendation guard with NFKC normalization + zero-width stripping |
| 2026-05-02T01:18Z | iter-5 fix pushed | PR-Agent: isolate persona in summary prompt with `<persona>` delimiters |
| 2026-05-02T01:33Z | iter-6 fix pushed | PR-Agent: close homoglyph bypass (Cyrillic↔Latin) + persona cache by path |
| 2026-05-02T01:39Z | iter-7 fix pushed | Devin Review correctness fix: actual month-length targets + align persisted delta JSON to KBJUValues keys |
| 2026-05-02T01:59Z | iter-8 fix pushed | PR-Agent: escape persona prompt delimiters (prevent `</persona>` breakout) — final Executor HEAD 4e3e818 |
| 2026-05-02T02:08Z | pr-agent (qwen-3.6-plus) settle | Persistent-review block updated_until_commit = 4e3e818; verdict ⚡no major issues + 🔒no security concerns + 🔀no PR themes; 2 informational findings (F-PA-1 Misleading Error Context @ summaryScheduler.ts:286, F-PA-2 Synchronous File Read @ personaLoader.ts:12) deferred to BACKLOG-008 |
| 2026-05-02T02:14Z | pr-agent CI workflow | Run 25240991302 formally IN_PROGRESS on final HEAD (after a prior CANCELLED run after 9 min); persistent-review CONTENT settled but workflow check status stuck — Devin Orchestrator treated as CI infrastructure tail-latency per session-4 §6.6 OmniRoute outlier precedent (2 of 2 final-HEAD runs across 2 TO pilots show pattern; structural TKT-NEW in BACKLOG-008) |
| 2026-05-02T02:20Z | ticket-orchestrator (gpt-5.5-thinking) | Cross-reviewer audit pass-1 — Reviewer iter-2 verdict pass valid; PR-Agent persistent review on final HEAD non-blocking; closure-ready hand-back to Devin Orchestrator with PR-Agent CI status flagged as strategic blocker |
| 2026-05-02T02:30Z | devin-orchestrator | Ratification audit pass-2 — independent re-classification confirmed Reviewer iter-2 pass valid + iter-3..8 substantive changes covered by PR-Agent + Devin Review (procedural anomaly captured as BACKLOG-008 lesson, not substance blocker); PR-Agent stuck CI ruled infra failure under DO authority; merge-safe sign-off issued |
| 2026-05-02T02:35Z | PO | Merged PR #75 (TKT-011 code, squash to main 73c4f96) and PR #76 (RV-CODE-011 née RV-CODE-016, squash to main 4847e9b); two-phase audit invariant (TO pass-1 + Devin pass-2) satisfied per CONTRIBUTING.md Hard rule + docs/meta/devin-session-handoff.md §11.4 |
| 2026-05-02T02:45Z | devin-orchestrator | Opening closure-PR (this PR): TKT-011 status flip in_review→done + assigned_executor formality fix qwen-3.6-plus→glm-5.1 + §10 closure fill + §10/§11 H2 deduplication + RV-CODE-016→RV-CODE-011 rename + frontmatter status flip in_review→approved + new BACKLOG-008 summary-followups (F-PA-1 + F-PA-2 + 4 structural TKT-NEW entries) + CONTRIBUTING.md clarification (closure-PR fields enumeration) per PO verbatim authorization |
