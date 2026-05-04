---
id: TKT-019
title: "G3 C14 PR-Agent CI Tail-Latency Telemetry — 4-phase load-test harness"
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
component: "C14 PR-Agent CI Telemetry"
depends_on: []
blocks: []
estimate: M
assigned_executor: "qwen-3.6-plus"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-019: G3 C14 PR-Agent CI Tail-Latency Telemetry — 4-phase load-test harness

## 1. Goal (one sentence, no "and")
Build a telemetry scraper plus a 4-phase load-test harness that empirically validates GPT-5.3 Codex PR-Agent tail-latency against the BACKLOG-009 5-of-5 cancellation-pattern baseline, publishing results as a metric-backed pass/fail gate report.

## 2. In Scope
- `scripts/pr-agent-telemetry.sh` — bash scraper that fetches PR-Agent workflow runs from the past 7 days via `gh api`, extracts per-job durations, computes p50/p95/p99/max, counts cancellations, identifies the 5-of-5 cancellation-pattern baseline, and writes a JSON telemetry report.
- `docs/observability/PR-AGENT-LATENCY-2026-05.md` — 4-phase load-test report (cold-start / steady-state / tail-spike / concurrent-stress) with explicit pass/fail gate vs the BACKLOG-009 baseline.
- `.github/workflows/pr-agent-telemetry-check.yml` — manual-trigger (`workflow_dispatch`) workflow that runs the scraper script and uploads the JSON output as an artifact.
- A schema doc `docs/observability/pr-agent-telemetry.schema.json` declaring the JSON output shape.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- PR-Agent configuration changes — `.pr_agent.toml` is owned by the PO; this ticket reads CI telemetry, does not tune the agent.
- Model swapping — GPT-5.3 Codex is locked by PR #93/#94; the telemetry only measures it.
- Automated remediation of high-tail-latency PRs — human evaluation of the report is the v0.5.0 gate.
- KBJU sidecar runtime telemetry — that is C13's stall watchdog (TKT-018@0.1.0), not C14.
- Modifying any KBJU sidecar TypeScript source — this ticket lives entirely in `scripts/`, `.github/workflows/`, and `docs/observability/`.
- Real-time alerting — out of scope at v0.5.0; the telemetry is offline batch.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §1.1 (Trace matrix G3 → C14), §3.14 (C14 PR-Agent CI Telemetry), §8.3 (G3 metric names), §11 (test strategy).
- PRD-002@0.2.1 §2 G3, §7 (overhead budget), §8 R2 (CI tail-latency risk).
- BACKLOG-009 §pr-agent-ci-tail-latency-investigation-CRITICAL.
- RV-SPEC-007@0.1.0 (review of PRD-002@0.2.1).
- `docs/knowledge/llm-model-evaluation-2026-05.md` §4 (GPT-5.3 Codex evaluation).
- `gh` CLI documentation for `api repos/{owner}/{repo}/actions/workflows/{id}/runs`.

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `scripts/pr-agent-telemetry.sh` (bash; uses `gh api`, `jq`, `awk`).
- [ ] `docs/observability/pr-agent-telemetry.schema.json` declaring the JSON output shape (top-level keys: `report_window`, `phases`, `baseline_5_of_5`, `gate_verdict`).
- [ ] `docs/observability/PR-AGENT-LATENCY-2026-05.md` — 4-phase load-test report containing:
  1. Baseline: past 7-day telemetry post-swap to GPT-5.3 Codex.
  2. Phase 1 (cold-start): 5 fresh PRs submitted in rapid succession; measure time-to-first-comment p50 / p95.
  3. Phase 2 (steady-state): 20 PRs over 2 hours; measure tail latency p95 / p99 / max.
  4. Phase 3 (tail-spike): 3 large-diff PRs (>500 changed lines); measure latency and cancellation.
  5. Phase 4 (concurrent-stress): 5 PRs opened simultaneously; measure head-of-line blocking serialization.
  6. Final gate: explicit pass/fail comparison against BACKLOG-009 5-of-5 Qwen 3.6 Plus baseline; metric-backed verdict.
- [ ] `.github/workflows/pr-agent-telemetry-check.yml` (manual-trigger only; uploads JSON artifact).

## 6. Acceptance Criteria (machine-checkable)
- [ ] `bash scripts/pr-agent-telemetry.sh --window 7d` exits 0 on a repo with PR-Agent activity.
- [ ] Output JSON validates against `docs/observability/pr-agent-telemetry.schema.json` (validate via `ajv-cli` or equivalent JSON Schema validator in CI).
- [ ] Telemetry report includes `p50_ms`, `p95_ms`, `p99_ms`, `max_ms` for each of the 4 phases.
- [ ] Cancellation count and cancellation-rate are computed and compared to the BACKLOG-009 baseline; the report's `gate_verdict` field is one of `pass | fail | inconclusive`.
- [ ] Report references at least 3 specific PR URLs, dates, and CI job IDs per phase for reproducibility.
- [ ] Script fails with a clear error message if `gh` CLI is unavailable: `[telemetry] FATAL: gh CLI not found. Install via brew/apt.`.
- [ ] Script fails with a clear error message if the GitHub token lacks `repo` or `workflow` scope.
- [ ] Report's redaction guard test: `grep -E 'sk_live|fpkk_|github_pat_|raw_prompt' docs/observability/PR-AGENT-LATENCY-2026-05.md` returns no matches.
- [ ] `.github/workflows/pr-agent-telemetry-check.yml` validates as YAML AND parses as a valid GitHub Actions workflow (`actionlint` clean).

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies to the KBJU sidecar or `Dockerfile` — this ticket lives outside the sidecar runtime.
- `gh` CLI MUST be a hard prerequisite of the script — the script MUST assert and fail fast with a copy-pasteable install hint.
- The GitHub token used MUST have `repo` + `workflow` scopes; the script MUST detect insufficient scope and fail fast.
- The report MUST NOT expose provider keys, raw PR-Agent prompts, full PR bodies, or user data from PR descriptions — only durations, status codes, and PR URLs.
- The telemetry script is run manually by the PO or Architect-4 follow-on session — NOT auto-scheduled. The `.github/workflows/pr-agent-telemetry-check.yml` workflow MUST use `workflow_dispatch` only, never `schedule` or `pull_request`.
- Pass/fail gate criteria MUST be metric-backed (numeric thresholds vs the BACKLOG-009 baseline) — NOT subjective.
- Do NOT modify `.pr_agent.toml`, any other `.github/workflows/*.yml`, or any KBJU TypeScript source.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass.
- [ ] PR opened with link to TKT-019@0.1.0 in description (version-pinned).
- [ ] No `TODO` / `FIXME` left in committed code without a follow-up TKT suggestion logged in the PR body.
- [ ] Executor filled §10 Execution Log.
- [ ] Ticket frontmatter `status: in_review` in a separate commit after the implementation commit.

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-019-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-04 (architect-4 synthesizer claude-opus-4.7-thinking): synthesized this ticket from PR-B's TKT-019 (4-phase load-test harness + JSON schema) + PR-C's TKT-019 (workflow_dispatch trigger + redaction guard test). PR-A's variant did not address tail-latency-against-baseline gating — rejected. assigned_executor=qwen-3.6-plus because: (1) bash + gh + jq + awk scripting is well within Qwen 3.6 Plus's competence; (2) no streaming-LLM context-exhaustion risk on this ticket (it's offline scripting); (3) frees DeepSeek V4 Pro for TKT-018@0.1.0 and Codex GPT-5.5 for TKT-016@0.1.0. -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions (single atomic deliverable: a 4-phase telemetry harness with a metric-backed gate report).
- [x] NOT-In-Scope has ≥1 explicit item (6 items listed).
- [x] Acceptance Criteria are machine-checkable.
- [x] Constraints explicitly list forbidden actions.
- [x] All ArchSpec / ADR / TKT references are version-pinned.
- [x] `depends_on: []` correct (TKT-019 is independent of the sidecar boot path).
- [x] `assigned_executor: qwen-3.6-plus` justified — see Execution Log seed.
