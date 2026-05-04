---
id: TKT-018
title: "Automated Model-Stall Detector"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C10 Cost, Degrade, and Observability Service; C13 Model-Stall Detector"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "codex-gpt-5.5"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-018: Automated Model-Stall Detector

## 1. Goal (one sentence, no "and")
Surface stalled routed-model calls automatically.

## 2. In Scope
- Add C13 in-flight model-call tracking for routed-model and direct-provider failover paths.
- Emit stall events when no token output is observed for the configured threshold.
- Add durable user-scoped stall-event storage that remains right-to-delete compatible.
- Add synthetic stall tests for 120 second, 300 second, and 600 second scenarios.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No tenant-breach detector changes; see TKT-017@0.1.0.
- No PR-Agent CI tail-latency telemetry; see TKT-019@0.1.0.
- No SDLC pipeline token-cost or per-role spend telemetry.
- No model/provider routing topology change.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.6
- ARCH-001@0.5.0 §3.7
- ARCH-001@0.5.0 §3.9
- ARCH-001@0.5.0 §3.10
- ARCH-001@0.5.0 §3.13
- ARCH-001@0.5.0 §4.10
- ARCH-001@0.5.0 §5
- ARCH-001@0.5.0 §8.5
- PRD-002@0.2.1 §2 G2
- PRD-002@0.2.1 §5 US-2
- `docs/knowledge/llm-routing.md`
- `src/observability/events.ts`
- `src/observability/kpiEvents.ts`
- `src/meals/mealOrchestrator.ts`
- `src/history/historyService.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/observability/modelStallDetector.ts` exporting the C13 detector.
- [ ] `src/observability/events.ts` adding redacted C13 event emission.
- [ ] `src/observability/kpiEvents.ts` adding C13 stall metric constants.
- [ ] `src/store/schema.sql` adding only C13 durable event storage needed for right-to-delete compatibility.
- [ ] Existing routed-model call sites updated minimally to register start/token/end lifecycle events with C13.
- [ ] `tests/observability/modelStallDetector.test.ts` covering threshold, latency, redaction, coverage, and right-to-delete behavior.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/observability/modelStallDetector.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] A synthetic no-token call at threshold 120 seconds emits a stall event within 15 seconds of threshold crossing.
- [ ] Synthetic 300 second and 600 second elapsed scenarios emit exactly one stall event each.
- [ ] Stall alert metadata includes call identifier, role, elapsed time, and prompt-token count.
- [ ] Stall alert/log output excludes raw prompt text, model output text, meal text, usernames, raw transcripts, raw media, provider keys, and provider responses.
- [ ] Detector coverage is asserted against enumerated routed-model and direct-provider failover call paths with coverage >=95%.
- [ ] Right-to-delete removes user-scoped C13 rows in the same transaction boundary as existing user-scoped data.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT collect SDLC token-cost telemetry or per-role spend telemetry.
- Do NOT change selected models, providers, OmniRoute topology, or direct-provider fallback rules.
- Do NOT log raw prompts or model outputs.
- Do NOT modify files outside §5 Outputs except the minimal existing routed-model call sites listed by the tests.
- Codex is required because this ticket touches model-call lifecycle interception and redaction-critical telemetry.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-018-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- YYYY-MM-DD HH:MM model-id: started -->
<!-- YYYY-MM-DD HH:MM model-id: opened PR #NN -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
