---
id: TKT-019
title: "G3 PR-Agent CI tail-latency telemetry"
version: 0.1.0
status: in_progress
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-05
---

# TKT-019: G3 PR-Agent CI tail-latency telemetry

## 1. Goal
Measure PR-Agent CI latency phases exactly as PRD-002@0.2.1 G3 defines them.

## 2. In Scope
- Add a CI-side telemetry script or wrapper that records CI-step-setup latency, TTFT, TTLT, and total CI-stage wall-clock duration.
- Emit machine-readable JSON as a CI artifact/log line.
- Add tests for phase calculations and missing PR-Agent comment/log cases.

## 3. NOT In Scope
- No modification in this Architect PR to `.github/**`; Executor may touch workflow files only because this ticket explicitly requires CI wiring.
- No generated telemetry committed under `docs/telemetry/**` unless PO separately approves a docs artifact location.
- No `gh` CLI dependency; use CI-provided token and GitHub REST API or existing PR-Agent log files.
- No PR comments from the telemetry script.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §3.14, §8.
- PRD-002@0.2.1 §2 G3 and §5 US-3.
- RV-SPEC-006@0.1.0 F-M1 and RV-SPEC-007@0.1.0 closure record.
- Existing GitHub Actions / PR-Agent workflow files during Executor implementation.

## 5. Outputs
- [ ] `scripts/pr-agent-telemetry.ts` or equivalent script.
- [ ] Tests for phase calculation, no-comment/no-log fallback, malformed timestamps, and JSON schema.
- [ ] Workflow integration that uploads or prints `pr-agent-stats.json` for merged PRs and telemetry test PRs.
- [ ] Documentation in the ticket §10 Execution Log of the first successful dummy/draft telemetry run.

## 6. Acceptance Criteria
- [ ] Output JSON includes `ci_step_setup_ms`, `ttft_ms`, `ttlt_ms`, `total_ci_stage_ms`, `pr_number`, `repo`, `model`, and `schema_version`.
- [ ] The script computes TTFT from PR-Agent LLM request emission to first token and does not remap it to PR creation/comment timestamps.
- [ ] If token-level timestamps are unavailable, the script emits `reason: "token_phase_unavailable"` and fails the telemetry validation step rather than substituting unrelated timers.
- [ ] For a mocked rolling 10-PR dataset, the script computes p50 and p100 for total CI-stage duration exactly.
- [ ] No telemetry output includes secrets, PR body text, raw prompts, review text, or user PII.
- [ ] `npm run lint`, `npm run typecheck`, targeted tests, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Source: synthesized from PR-B/PR-C CI-side telemetry, patched to respect RV-SPEC-006@0.1.0 phase taxonomy.
- Do not rely on `gh` because CI and GHES environments may not have authenticated CLI state.
- Generated metrics are artifacts/logs unless a later ArchSpec/PRD creates a durable docs location.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-019@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-019-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets. Executor appends timestamped entries below this line.

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.

