---
id: TKT-019
title: "G3 PR-Agent CI tail-latency telemetry emitter"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "deepseek-v4-pro"
assigned_executor: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-019: G3 PR-Agent CI tail-latency telemetry (C14)

## Scope

PRD-002@0.2.1 §2 G3 requires empirical validation of the Qwen 3.6 Plus → GPT-5.3 Codex reviewer swap
(2026-05-02, per BACKLOG-009). This ticket builds C14, a CI-side telemetry emitter that measures PR-Agent
end-to-end latency per PR and emits structured metrics, enabling the PO to compare models empirically.

## Acceptance Criteria

1. `scripts/pr-agent-telemetry.ts` exists (standalone TS script, invoked from GitHub Actions):
   - Reads `GITHUB_EVENT_PATH` for PR number + repo
   - Calls `gh pr view <N> --json createdAt,closedAt` + `gh api /repos/:owner/:repo/pulls/:N/comments`
   - Computes: `review_latency_ms = first_comment_at - pr_created_at`
   - Computes: `tail_latency_p95_ms` from `pr-agent-response-seconds` log entries
   - Emits structured telemetry to stderr + a JSON file

2. Emitted metrics (`scripts/pr-agent-stats.json`):
   ```json
   {
     "pr_number": 95,
     "pr_created_at": "ISO-8601",
     "first_pr_agent_comment_at": "ISO-8601",
     "review_latency_ms": 45231,
     "comment_count": 12,
     "model": "gpt-5.3-codex",
     "repo": "OpenClown-bot/openclown-assistant"
   }
   ```

3. GitHub Actions workflow step added to `.github/workflows/` that runs this script post-merge
   (triggered on `pull_request.closed` with `merged == true`)

4. Collected telemetry files committed to `docs/telemetry/pr-agent/` for model comparison

5. Does NOT run in draft PRs, only on merged PRs

## Implementation Notes

- Script is read-only — never modifies PR contents or comments
- Graceful handling: if PR has no PR-Agent comments yet, emit `{ review_latency_ms: null, reason: "no_pr_agent_comment" }`
- Script is self-contained (single file, no project deps beyond `gh` CLI)
- Model detection: parse PR-Agent comment for `model:` footer or infer from PR date vs model-swap date