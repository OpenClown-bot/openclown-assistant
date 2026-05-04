---
id: TKT-019
title: "PR-Agent CI Tail-Latency Telemetry"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C14 PR-Agent CI Tail-Latency Telemetry"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: S
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-019: PR-Agent CI Tail-Latency Telemetry

## 1. Goal (one sentence, no "and")
Measure PR-Agent CI phase latency deterministically.

## 2. In Scope
- Add CI/script instrumentation for the four PRD-002@0.2.1 G3 PR-Agent phase metrics.
- Emit per-PR telemetry tagged by PR number, commit SHA, and runner identifier hash.
- Add tests proving phase definitions are not remapped to other timers.
- Add invocation-failure telemetry for missing model calls or credentials.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No PR-Agent model/provider swap.
- No `.pr_agent.toml` policy changes unless strictly required to emit timestamps.
- No SDLC pipeline token-cost, per-role cost, or prompt-content telemetry.
- No product-runtime telemetry changes.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.14
- ARCH-001@0.5.0 §4.10
- ARCH-001@0.5.0 §5 `pr_agent_ci_metrics`
- ARCH-001@0.5.0 §8.5
- PRD-002@0.2.1 §2 G3
- PRD-002@0.2.1 §5 US-3
- PRD-002@0.2.1 §8 R9
- `docs/knowledge/llm-model-evaluation-2026-05.md`
- Existing GitHub Actions PR-Agent workflow files discovered by Glob.

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] PR-Agent CI workflow file updated only to capture phase timestamps and publish telemetry artifacts.
- [ ] `scripts/pr-agent-telemetry.sh` or existing equivalent script adding C14 timing capture.
- [ ] `tests/ci/prAgentTelemetry.test.ts` validating phase calculations and forbidden-field exclusion.
- [ ] Main ArchSpec file remains untouched unless a Q-file is filed; this ticket implements ARCH-001@0.5.0 only.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/ci/prAgentTelemetry.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Telemetry output contains CI-step-setup latency, TTFT, TTLT, and total-CI-stage wall-clock duration exactly as PRD-002@0.2.1 §2 G3 defines them.
- [ ] Telemetry output contains PR number, commit SHA, and runner identifier hash.
- [ ] Telemetry output does not contain prompt text, model output text, provider keys, SDLC token cost, per-role cost, Telegram identifiers, or user payload.
- [ ] Tests cover successful invocation, invocation failure before first model call, and timeout/cancellation classification.
- [ ] The rolling-10-PR p50/p100 calculation uses total-CI-stage wall-clock duration only.

## 7. Constraints (hard rules for Executor)
- Do NOT add runtime application dependencies.
- Do NOT change PR-Agent selected model, provider routing, or review policy.
- Do NOT collect token-cost or role-attribution telemetry.
- Do NOT modify product `src/**` files.
- Do NOT modify files outside §5 Outputs.
- GLM is appropriate because this is deterministic CI/script instrumentation with narrow tests.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-019-NN.md -->

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
