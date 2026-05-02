---
id: TKT-014
title: "Pilot KPI Smoke Suite"
status: ready
arch_ref: ARCH-001@0.4.0
component: "End-to-end pilot readiness / K1-K7"
depends_on: ["TKT-003@0.1.0", "TKT-005@0.1.0", "TKT-009@0.1.0", "TKT-010@0.1.0", "TKT-011@0.1.0", "TKT-012@0.1.0", "TKT-013@0.1.0"]
blocks: []
estimate: M
assigned_executor: "qwen-3.6-plus"
created: 2026-04-26
updated: 2026-05-02
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

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
