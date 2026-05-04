---
id: TKT-019
title: "PR-Agent CI Tail-Latency Telemetry (G3)"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C10 Cost, Degrade, and Observability Service"
depends_on: []
blocks: []
estimate: M
assigned_executor: "qwen-3.6-plus"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-019: PR-Agent CI Tail-Latency Telemetry (G3)

## 1. Goal
Build a telemetry scraper and 4-phase load-test harness to empirically validate GPT-5.3 Codex PR-Agent tail-latency against BACKLOG-009's 5-of-5 cancellation pattern baseline, and publish results as a metric-backed pass/fail gate.

## 2. In Scope
- `scripts/pr-agent-telemetry.sh` — fetch PR-Agent CI data from GitHub API
- `docs/observability/PR-AGENT-LATENCY-2026-05.md` — 4-phase load-test report
- `.github/workflows/pr-agent-telemetry-check.yml` — optional CI check or manual trigger

## 3. NOT In Scope
- PR-Agent configuration changes (`.pr_agent.toml` is owned by PO)
- Model swapping (GPT-5.3 Codex is locked by PR #93/#94)
- Automated PR-Agent optimization (human analysis of telemetry)
- KBJU sidecar or OpenClaw runtime telemetry

## 4. Inputs
- ARCH-001@0.5.0 §1 (trace matrix G3), §8 (observability)
- PRD-002@0.2.1 §2 G3, §7, §8 R2
- BACKLOG-009 §pr-agent-ci-tail-latency-investigation-CRITICAL
- RV-SPEC-007@0.1.0 (review of PRD-002@0.2.1)
- `docs/knowledge/llm-model-evaluation-2026-05.md` §4 (GPT-5.3 Codex evaluation)
- GitHub Actions PR-Agent logs from past 7 days

## 5. Outputs
- [ ] `scripts/pr-agent-telemetry.sh` — bash script that:
  - Fetches PR-Agent workflow runs from last 7 days via `gh api`
  - Extracts per-job durations (queue time, run time, total)
  - Computes p50/p95/p99/max latency
  - Counts cancellations and identifies patterns (5-of-5 Qwen 3.6 Plus pattern baseline)
  - Outputs JSON telemetry report to `docs/observability/` directory
- [ ] `docs/observability/PR-AGENT-LATENCY-2026-05.md` — report with:
  1. Baseline: past 7 days telemetry (post-swap to GPT-5.3 Codex)
  2. Phase 1 (cold-start): 5 fresh PRs submitted in rapid succession, measure time-to-first-comment
  3. Phase 2 (steady-state): 20 PRs over 2 hours, measure tail latency
  4. Phase 3 (tail-spike): 3 large-diff PRs (>500 lines changed), measure latency and cancellation
  5. Phase 4 (concurrent-stress): 5 PRs opened simultaneously, measure serialization head-of-line blocking
  6. Final gate: comparison against BACKLOG-009 Qwen 3.6 Plus 5-of-5 baseline; metric-backed pass/fail
- [ ] (Optional) `.github/workflows/pr-agent-telemetry-check.yml` — manual trigger workflow that calls the script

## 6. Acceptance Criteria
- [ ] `bash scripts/pr-agent-telemetry.sh` completes without errors
- [ ] Output JSON validates against a defined schema (valid JSON, all required fields present)
- [ ] Telemetry report includes p50/p95/p99 for all 4 phases
- [ ] Cancellation count and rate computed and compared to BACKLOG-009 5-of-5 baseline
- [ ] Pass/fail gate clearly stated with metric justification
- [ ] Report references specific PR URLs, dates, and job IDs for reproducibility

## 7. Constraints
- Do NOT add new runtime deps to the KBJU sidecar or Dockerfile.
- `gh` CLI must be available. Script should assert and fail with clear message if not.
- GitHub token must have `repo` scope for workflow run access.
- Report MUST NOT expose provider keys, raw PR-Agent prompts, or user data from PR bodies.
- Telemetry script is run manually by PO or Architect, not as an automated CI gate (it requires human evaluation of the report).