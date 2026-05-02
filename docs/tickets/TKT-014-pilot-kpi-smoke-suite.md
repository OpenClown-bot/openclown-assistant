---
id: TKT-014
title: "Pilot KPI Smoke Suite"
status: done
arch_ref: ARCH-001@0.4.0
component: "End-to-end pilot readiness / K1-K7"
depends_on: ["TKT-003@0.1.0", "TKT-005@0.1.0", "TKT-009@0.1.0", "TKT-010@0.1.0", "TKT-011@0.1.0", "TKT-012@0.1.0", "TKT-013@0.1.0"]
blocks: []
estimate: M
assigned_executor: "codex-gpt-5.5"
created: 2026-04-26
updated: 2026-05-02
completed_at: 2026-05-02
completed_by: "codex-gpt-5.5"
completed_note: |
  Cycle closed merge-safe under two-phase audit invariant (TO pass-1 + Devin Orchestrator pass-2). Executor PR #89 (final HEAD 3c6ff96) + Reviewer PR #90 (final HEAD 132b84f) merged 2026-05-02. Kimi K2.6 verdict pass on iter-3 verification (covers cumulative Executor iters 3-5). All 13 cross-reviewer findings RESOLVED — 7 Kimi (F-H1 behavioral smoke-test ACs / F-M1 K3 audio_duration filter / F-M2 K5 date-dependent / F-M3 K7 grouped by meal_id / F-L1 ISO timestamps / F-L2 redaction strength / F-L3 K2/K3/K7 failure paths) + 6 PR-Agent (K1 vacuous pass / Cyrillic homoglyph redaction / unused redactK1Report / K7 daily macro tolerance / K2 order dependency / K4 latest audit run); zero deferred (best procedural discipline of all 5 pilots). Status flip skipped intermediate `in_review` because Codex iter-3 commit (`7dc4606`) clobbered the field set by Qwen iter-2 commit (`91d4718`); regression captured as BACKLOG-011 §mid-cycle-executor-takeover-clobbers-frontmatter-status (Low). Frontmatter `assigned_executor` updated post-hoc from `qwen-3.6-plus` to `codex-gpt-5.5` per BACKLOG-008 §launcher-asserts-frontmatter-executor: Qwen iter-1 implementation completed (5m58s, c1c97f2) but Qwen iter-2 stalled on context exhaustion; Codex GPT-5.5 high via OmniRoute took over from iter-2 onward and authored the substantive code on the final HEAD. Architect-original 3-family executor-uncorrelation matrix (3 GLM + 1 Codex + 1 Qwen) thus DEGRADED to 3 GLM + 2 Codex; Qwen 3.6 Plus remains UNVALIDATED as Executor across the 15-TKT pipeline. Qwen-context-fail captured as BACKLOG-011 §qwen-3.6-plus-128k-context-insufficient-for-executor (HIGH/strategic). PR-Agent CI workflow cancellation on final HEAD continues 5-of-5 cancellation pattern (TKT-010 22-min outlier, TKT-011/013/012/014 cancelled @12m); persistent review settled clean to 3c6ff96 with no security / no major issues / no multiple PR themes. Crucially, this final HEAD was authored by Codex GPT-5.5 high, NOT Qwen — confirms BACKLOG-009 §pr-agent-ci-tail-latency-investigation-CRITICAL track #3: tail-latency is PR-Agent (Qwen 3.6 Plus) reviewer-side problem on multi-thousand-line code-diff prompts, INDEPENDENT of Executor authorship. Closure-PR #91 codifies BACKLOG-011 (5 entries: qwen-context, push-auth, mid-cycle-clobber, to-nudge-markdown, to-do-postmortem-loop) + extends BACKLOG-009 with 5-of-5 evidence + introduces TO Operational Notes hand-back format in docs/meta/devin-session-handoff.md §11.3 + mandatory CommonMark/GFM formatting for TO-NUDGE files in docs/prompts/ticket-orchestrator.md + CONTRIBUTING.md hard rule (PO authorisation recorded verbatim per CONTRIBUTING.md row 23 — out-of-DO-write-zone files). Pipeline status: TKT-014 was the FIFTH and FINAL TO pilot; with its closure the 15-TKT KBJU Coach v0.1 multi-LLM pipeline is closed end-to-end.
---

# TKT-014: Pilot KPI Smoke Suite

## 1. Goal (one sentence, no "and")
Implement the pilot KPI smoke suite for end-to-end readiness evidence.

## 2. In Scope
- Add deterministic KPI query helpers for K1-K7 over C3 data and C10 events.
- Add an end-to-end mocked pilot smoke test covering onboarding, text meal, voice fallback, photo low confidence, confirmation, history delete, summary fallback, and right-to-delete.
- Add a CLI/report helper that prints a redacted pilot readiness summary without user payloads.
- Add fixture data for the ADR-005@0.1.0 K7 proposed accuracy calculations.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No new product features or UX copy beyond test fixtures.
- No real provider calls.
- No changes to production flow behavior outside KPI/report helpers.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.4.0 §1.1 Trace matrix
- ARCH-001@0.4.0 §4 Data Flow
- ARCH-001@0.4.0 §8.3 KPI Measurement
- ARCH-001@0.4.0 §12 Risks & Open Questions
- ADR-005@0.1.0
- ADR-009@0.1.0
- `src/shared/types.ts`
- `src/store/tenantStore.ts`
- `src/observability/kpiEvents.ts`
- `src/onboarding/onboardingFlow.ts`
- `src/meals/mealOrchestrator.ts`
- `src/history/historyService.ts`
- `src/summary/summaryScheduler.ts`
- `src/privacy/rightToDelete.ts`
- `src/privacy/tenantAudit.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/pilot/kpiQueries.ts` exporting K1-K7 query helpers
- [ ] `src/pilot/pilotReadinessReport.ts` exporting redacted report formatting
- [ ] `tests/pilot/fixtures.ts` containing synthetic two-user pilot fixtures without real personal data
- [ ] `tests/pilot/kpiQueries.test.ts`
- [ ] `tests/pilot/pilotSmoke.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/pilot/kpiQueries.test.ts tests/pilot/pilotSmoke.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove K1-K7 helpers calculate the ARCH-001@0.4.0 §8.3 KPI values from synthetic data.
- [ ] Smoke test proves no user B receives user A meal, summary, history, transcript, or audit data.
- [ ] Smoke test proves low-confidence photo output is labelled `низкая уверенность` and is not persisted before confirmation.
- [ ] Smoke test proves summary forbidden-topic output is blocked and deterministic fallback is delivered.
- [ ] Smoke test proves right-to-delete removes all user A data and allows fresh onboarding.
- [ ] Readiness report output contains no Telegram IDs, usernames, raw meal text, transcripts, or provider prompts.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT perform real network calls in tests.
- Do NOT include real pilot personal data in fixtures.
- Do NOT alter production behavior merely to make smoke tests pass; raise a Q-TKT if a previous ticket left an untestable seam.
- Qwen assignment is appropriate because this ticket is parallel-review friendly and focused on integration evidence across completed modules.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-014-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-02 14:13 qwen-3.6-plus via OmniRoute: started -->
<!-- 2026-05-02 14:22 qwen-3.6-plus via OmniRoute: npm test — 18/18 pass -->
<!-- 2026-05-02 14:22 qwen-3.6-plus via OmniRoute: npm run lint — PASS -->
<!-- 2026-05-02 14:22 qwen-3.6-plus via OmniRoute: npm run typecheck — PASS -->
<!-- 2026-05-02 14:23 qwen-3.6-plus via OmniRoute: python3 scripts/validate_docs.py — 62/62 OK -->
<!-- 2026-05-02 14:23 qwen-3.6-plus via OmniRoute: status ready -> in_progress commit -->
<!-- 2026-05-02 14:23 qwen-3.6-plus via OmniRoute: implementation commit c1c97f2 -->
<!-- 2026-05-02 14:24 qwen-3.6-plus via OmniRoute: opened PR -->
<!-- 2026-05-02 16:36 Codex GPT-5.5 high via OmniRoute: iter-2 takeover after Qwen stalled; reset local undelivered partial work to origin/PR HEAD 91d4718 -->
<!-- 2026-05-02 16:36 Codex GPT-5.5 high via OmniRoute: npm test -- tests/pilot/kpiQueries.test.ts tests/pilot/pilotSmoke.test.ts — 20/20 pass -->
<!-- 2026-05-02 16:36 Codex GPT-5.5 high via OmniRoute: npm run lint — PASS -->
<!-- 2026-05-02 16:36 Codex GPT-5.5 high via OmniRoute: npm run typecheck — PASS -->
<!-- 2026-05-02 16:36 Codex GPT-5.5 high via OmniRoute: python3 scripts/validate_docs.py — 62/62 OK -->
<!-- 2026-05-02 17:00 Codex GPT-5.5 high via OmniRoute: iter-3 fixes for RV-CODE-014 — K1 vacuous pass fix, K1 regression tests, pilotSmoke.test.ts rewritten with actual production imports (HistoryService, RightToDeleteService, recommendationGuard, photoConfidence, tenantAudit) — npm test tests/pilot/ 26/26 pass, lint PASS, typecheck PASS -->
<!-- 2026-05-02 17:12 Codex GPT-5.5 high via OmniRoute: iter-4 fixes for PR-Agent — Cyrillic homoglyph normalization in redactValue (HOMOGLYPH_MAP а→a е→e о→o р→p с→c х→x у→y + uppercase), merge overlapping ranges, remove dead code redactK1Report; pilotSmoke.test.ts adds Cyrillic homoglyph redaction test with U+0430 — npm test tests/pilot/ 27/27 pass, lint PASS, typecheck PASS, validate_docs.py 62/62 OK -->
<!-- 2026-05-02 17:32 Codex GPT-5.5 high via OmniRoute: iter-5 fixes for PR-Agent final-head findings — expanded Cyrillic homoglyph redaction map, K7 daily macro tolerance enforcement, K2 timestamp-order pairing, K4 latest completed_at selection -->
<!-- 2026-05-02 codex-gpt-5.5 + kimi-k2.6: PR-Agent persistent review settled clean to final HEAD 3c6ff96 (no security, no major issues, no multiple PR themes); CI workflow CANCELLED at ~12m matches BACKLOG-009 §pr-agent-ci-tail-latency-investigation-CRITICAL 5-of-5 final-HEAD pattern; treated as expected infra failure under DO authority -->
<!-- 2026-05-02 kimi-k2.6: Reviewer iter-3 verdict `pass` on cumulative HEAD 3c6ff96 covering Executor iters 3-5; 30/30 tests pass (19 kpiQueries + 11 pilotSmoke), lint+typecheck PASS, validate_docs 63/63; all 7 Kimi findings + 6 PR-Agent final-head findings RESOLVED, zero deferred; RV-CODE-014 at canonical filename docs/reviews/RV-CODE-014-tkt-014-pilot-kpi-smoke-suite.md (no rename needed) -->
<!-- 2026-05-02 to-orchestrator: cross-reviewer audit pass-1 complete; Reviewer re-engagement constraint MET (no post-pass Executor commits; pre-pass batching of 3 substantive iters into Kimi iter-3 acceptable per BACKLOG-008 §reviewer-reengagement-after-substantive-pushes definition); RV-CODE-014 numbering + canonical filename CORRECT from iter-1 (replicates TKT-012@0.1.0 success); hand-back to Devin Orchestrator with operational notes (Qwen iter-2 context exhaustion + 403 push-auth fail + Codex iter-3 frontmatter status regression) -->
<!-- 2026-05-02 devin-orchestrator: ratification audit pass-2 complete; classifications match TO pass-1 100%; PR-Agent persistent review settle on 3c6ff96 verified independently; merge-safe sign-off issued; Codex-authored final HEAD also stalled Qwen PR-Agent CI — narrows BACKLOG-009 track #3 to PR-Agent reviewer-side, NOT Executor-authorship-side; PRs #89 and #90 merged by PO -->
<!-- 2026-05-02 devin-orchestrator: closure-PR #91 opened with TKT-014 status flip ready->done (skipping in_review per Codex iter-3 clobber), assigned_executor post-hoc qwen-3.6-plus->codex-gpt-5.5 per BACKLOG-008 §launcher-asserts; RV-CODE-014 frontmatter promotion in_review->approved; new BACKLOG-011 file with 5 TKT-NEW entries (qwen-context, push-auth, mid-cycle-clobber, to-nudge-markdown, to-do-postmortem-loop); BACKLOG-009 5-of-5 update; docs/meta/devin-session-handoff.md §11.3 TO Operational Notes hand-back format; docs/prompts/ticket-orchestrator.md mandatory CommonMark/GFM TO-NUDGE rule; CONTRIBUTING.md Hard rule for TO-NUDGE markdown formatting (PO authorisation verbatim in PR body per row 23) -->

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
