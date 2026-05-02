---
id: BACKLOG-009
title: "Deployment Packaging follow-ups (post TKT-013) + third TO pilot structural lessons"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-02
---

# Deployment Packaging follow-ups + third TO pilot lessons

This file collects the deferred follow-ups from the TKT-013 closure (PR #80 + PR #81 + closure-PR) and the structural lessons learned from the third end-to-end Ticket Orchestrator pilot. The first pilot (TKT-010) generated `BACKLOG-007` and `PR #71`; the second (TKT-011) generated `BACKLOG-008`; this third pilot generates `BACKLOG-009`.

The 7 entries below split into:
- **3× F-L carry-over** from Kimi K2.6 iter-4 review on PR #80 final HEAD `b50443e5` (low-severity, deferred per Reviewer rationale; PR-Agent informational items overlap with these).
- **4× structural TKT-NEW** from anomalies surfaced during this pilot or surfaced while preparing the next pilot (opencode session interrupt resilience, PR-Agent CI tail-latency escalation 3-of-3, AGENTS.md vs llm-routing.md runtime mismatch surfaced during 4th-pilot prep, RV file-naming canonical convention).

## TKT-NEW-migrate-script-cleaner-json-errors

**Source:** Kimi RV-CODE-013 finding `F-L3` on PR #80 final HEAD `b50443e5` (`scripts/migrate-vps-kbju.sh:78–93`); PR-Agent persistent review item #1 overlaps.

**The issue:** The migration script uses `node -e "JSON.parse(...)"` to parse Telegram API responses (`getWebhookInfo` verification). If Telegram returns HTTP 200 with malformed JSON (unlikely but possible), `JSON.parse` throws an uncaught exception inside the `node -e` command, producing a stack trace rather than a clean operator-facing error message. The fail-fast behavior is correct (`set -euo pipefail` ensures non-zero exit) — only the error-message clarity is at stake.

**Proposed fix:** Wrap the `node -e` blocks in a small helper that catches `SyntaxError` and emits a clean `"ERROR: Telegram API returned invalid JSON"` message before exiting 1. Add a corresponding test in `tests/deployment/scripts.test.ts` that stubs `curl` to return a 200 with a malformed body and asserts the cleaner error message.

**Severity:** Low (operator-UX / message clarity, no correctness impact; existing fail-fast behavior is correct). Defer to a future Polish-pass ticket once VPS migration has at least one production run to inform real-world error scenarios.

**ArchSpec dependency:** `ARCH-001@0.4.0 §10.6 VPS Migration Runbook` already specifies the `setWebhook` + `getWebhookInfo` verification surface; this ticket would tighten the error-message contract without changing it.

## TKT-NEW-rollback-success-path-test

**Source:** Kimi RV-CODE-013 finding `F-L4` on PR #80 final HEAD `b50443e5` (`tests/deployment/scripts.test.ts`); PR-Agent persistent review item #2 overlaps.

**The issue:** The TKT-013 test suite covers failure paths for both rollback and migration scripts (rollback aborts on health-check failure; migration fails fast on `last_error_date`), but contains no success-path test for `scripts/rollback-kbju.sh` — i.e., simulating a healthy `curl http://127.0.0.1:9464/metrics` response and asserting exit code 0 plus the success Telegram message. TKT-013@0.1.0 §6 AC 8 mandates the failure-path assertion explicitly but does not mandate success-path coverage, so this is a test-quality follow-up, not an AC violation.

**Proposed fix:** Add a rollback success-path test that stubs `curl` to return HTTP 200 on `/metrics`, asserts `exitCode === 0`, asserts the success Telegram message appears in stdout, and asserts the §10.5.1 pre-flight (DB snapshot + migration check) commands ran in the correct order. Reuse the existing test harness pattern from `scripts.test.ts`.

**Severity:** Low (test-quality / coverage, no correctness impact in production). Defer to the next deployment-area Polish-pass ticket; can be batched with `TKT-NEW-migrate-script-cleaner-json-errors` since both touch the same test file.

**ArchSpec dependency:** `ARCH-001@0.4.0 §10.5 Rollback` is unchanged; this ticket only expands test coverage of the existing contract.

## TKT-NEW-healthcheck-server-error-handler

**Source:** Kimi RV-CODE-013 finding `F-L6` on PR #80 final HEAD `b50443e5` (`src/deployment/healthCheck.ts:20–52`); PR-Agent persistent review item #6 overlaps.

**The issue:** The `http.createServer()` instance in `healthCheck.ts` does not register an `'error'` event listener on the server object. If `server.listen()` fails (e.g., port `9464` already in use, or the `metrics` Docker hostname fails to resolve at startup), the resulting `Error` event on the `server` object is unhandled and will crash the Node process with an opaque stack trace. In the dedicated `metrics` Docker service this is an unlikely race condition (the container is the only listener on port 9464 inside its network), but an unhandled error event is a reliability gap that could surface during VPS migration when the metrics service starts before the port is free, or during local dev when an operator forgets to stop a prior instance.

**Proposed fix:** Add `server.on('error', (err) => { console.error('Metrics server error:', err.message); process.exit(1); });` immediately before `server.listen()`. Add a test in `tests/deployment/healthCheck.test.ts` that simulates a `listen()` failure (port already in use) and asserts the error handler runs + the process exits non-zero with the cleaner message.

**Severity:** Low (reliability / observability gap, low-likelihood failure in dedicated metrics container). Defer; can be batched with the two TKT-NEW above as a single deployment-area Polish-pass ticket.

**ArchSpec dependency:** `ARCH-001@0.4.0 §8.2 metrics endpoint binding` is unchanged; this ticket only hardens the error path of the existing contract.

## TKT-NEW-opencode-session-interrupt-resilience

**Source:** Operational anomaly observed during TKT-013 cycle (PO screenshot 2026-05-02): both Executor and Reviewer opencode sessions were interrupted mid-iter (TUI showed "continue" prompt with non-exhausted token budget — 49% used per the screenshot context indicator). PO confirmation: `"по какой-то причине и экзекутор и ревьюер прерывались"`. The cycle still reached closure-ready state because TO recovered and continued, but the recovery was ad-hoc — there is no codified protocol for resuming an interrupted iter.

**The issue:** Without a documented resume protocol, an interrupted Executor or Reviewer iter risks (a) TO accidentally starting iter-N+1 while iter-N's git state is partially written but uncommitted, (b) TO mis-counting which iter is "in flight" vs "complete", (c) Reviewer-reengagement-after-substantive-pushes constraint (BACKLOG-008) being violated because the substantive iter-N commit-or-not state is ambiguous. The TKT-013 pilot survived by luck (no partial commits left dangling); a stricter pipeline must not depend on luck.

**Proposed fix:** Codify in `docs/prompts/ticket-orchestrator.md` (and reflect in the Executor + Reviewer prompts where they describe iter-N continuation) a short ITER-N RESUME protocol: when the PO reports an interruption mid-iter, TO drafts a 5-line RESUME nudge that asks the Executor / Reviewer to (1) `git status` + `git log -1 --oneline` + show pending tool calls, (2) explicitly classify what was committed vs in-flight, (3) re-read the iter-N contract surface, (4) decide whether to continue from the in-flight state or rewind to the last clean commit, (5) report back before any new write. TO then makes the strategic call (continue vs rewind) before authorizing further work.

**Severity:** Medium (process invariant; not yet a correctness incident, but trusted-pipeline confidence depends on resilience to this class of operational anomaly). Implement before the fourth TO pilot; the launcher-asserts entry from BACKLOG-008 is also still pending and the two should land together for a "TO pipeline hardening" mini-ticket.

**ArchSpec dependency:** None — this is process / prompt-level, not code/ArchSpec.

## TKT-NEW-pr-agent-ci-tail-latency-investigation-CRITICAL

**Source:** TKT-013 closure cross-reviewer audit (Devin Orchestrator ratification pass-2). PR-Agent CI workflow on PR #80 final HEAD `b50443e5` cancelled at 12m12s (PR #71 hard-timeout). PR-Agent CI workflow on PR #81 also cancelled at ~12m. **This is the third pilot in a row exhibiting the pattern: TKT-010 final-HEAD run = 22-min outlier (normal 3–9 min), TKT-011 final-HEAD run = stuck IN_PROGRESS then cancelled, TKT-013 final-HEAD run on both Executor and Reviewer PRs = cancelled at hard-timeout. 3 of 3 final-HEAD runs across 3 pilots = structural, not random.**

**The issue:** `BACKLOG-008 §TKT-NEW-pr-agent-tail-latency` originally classified this as "Medium-High" with "investigate when convenient" tone, on the hypothesis that the pattern might still be coincidental. The third pilot rules that out. The PR #71 12-min hard-timeout mitigates *impact* (workflow does not hang indefinitely; Devin Orchestrator overrides formal CI conclusion under BACKLOG-008 §pr-agent-tail-latency rule when persistent review settles to final HEAD with clean verdict), but does not address the *root cause*. Likely candidates: OmniRoute throughput collapse on long-prompt code-review jobs (TKT-013 had the largest diff of the three pilots — Docker + Compose + scripts + tests + healthCheck — and still hit the same wall as the smaller TKT-011 diff, suggesting the throughput issue is not strictly diff-size-dependent); Qwen 3.6 Plus tail-latency under specific token-shape conditions; PR-Agent action's internal retry behavior on first-token-timeout. Without infrastructure-level investigation we cannot distinguish these.

**Severity:** **Critical** (escalated from Medium-High in BACKLOG-008). This now blocks confidence in the cross-reviewer audit pipeline for production-pace work — the Devin Orchestrator override is currently load-bearing for every closure, which means a single mis-classification of the override would let a real PR-Agent failure slip through. The override should be a fallback, not the steady-state path.

**Proposed fix:**
1. **Short-term (this sprint):** Capture in `docs/session-log/` for next 1–2 pilots the per-PR PR-Agent timing breakdown — which step inside the action is consuming the 12m. If the GitHub Actions log of the cancelled run shows a specific subprocess (e.g. `pr_reviewer.run`) hung on first-token, that narrows the hypothesis.
2. **Medium-term:** Run a controlled experiment — submit a synthetic PR with a known prompt size and re-run PR-Agent against it 3 times back-to-back. If the cancellation is reproducible at that prompt size, the issue is structural; if not, it is OmniRoute load-dependent.
3. **Long-term:** Open a Q-INFRA ticket against the OmniRoute / Qwen-routing layer with the gathered timing data; consider switching PR-Agent's reviewer model to a different OmniRoute backend (Kimi K2.6 is already used by primary Reviewer; PR-Agent could trial GLM 5.1 for the second-reviewer role to test whether the tail-latency is Qwen-specific).

**ArchSpec dependency:** None directly. ADR-002@0.1.0 (OmniRoute-First LLM Routing) governs the routing layer; this investigation may surface an ADR amendment or new ADR if the root cause is in the OmniRoute layer.

## TKT-NEW-agents-md-vs-llm-routing-md-runtime-mismatch

**Source:** Triage performed during 4th-pilot (TKT-012) preparation 2026-05-02. PO asked whether `codex-gpt-5.5` Executor must run via Codex CLI or whether opencode + Codex GPT-5.5 (high) is acceptable. Cross-checked two repo sources of truth and found contradictory answers.

**The issue:**
- `AGENTS.md` row "Code Executor" lists runtime as `opencode + OmniRoute` for ALL three Executor model variants (GLM 5.1 default, Qwen 3.6 Plus parallel, Codex GPT-5.5 specialist). This implies all three route the same way.
- `docs/knowledge/llm-routing.md` is more specific: "Executor (default) GLM 5.1 — opencode + OmniRoute → Fireworks", "Executor (parallel) Qwen 3.6 Plus — opencode + OmniRoute → Fireworks", but **"Executor (specialist) Codex GPT-5.5 — Codex CLI"** (no `opencode`, no `OmniRoute`). The likely root cause is that GLM/Qwen/Kimi all live behind OmniRoute → Fireworks (non-OpenAI providers), whereas Codex GPT-5.5 is OpenAI and reaches the agent through a different path. AGENTS.md was last updated 2026-04-30 (Devin Review deprecation) and may not have synced with the runtime split that llm-routing.md documents.

**Concrete operational impact:** When PO dispatches the TKT-012 4th TO pilot, both BACKLOG-008 §launcher-asserts-frontmatter-executor (frontmatter `codex-gpt-5.5` must match the actual Executor model) and the runtime question (which CLI) are pending. If opencode happens to support routing to OpenAI Codex GPT-5.5 through OmniRoute, AGENTS.md is correct and llm-routing.md is stale; if not, llm-routing.md is correct and AGENTS.md needs a per-model runtime split.

**Proposed fix:** Triage path before TKT-012 dispatch (or as part of its cycle) — PO empirically tries opencode + Codex GPT-5.5 high in a NEW session; (a) if the model is reachable through OmniRoute, update `docs/knowledge/llm-routing.md` row "Executor (specialist)" to `Codex GPT-5.5 | opencode + OmniRoute` to match AGENTS.md; (b) if the model is NOT reachable, update the AGENTS.md "Code Executor" row to split runtime per-model (`GLM 5.1 / Qwen 3.6 Plus → opencode + OmniRoute; Codex GPT-5.5 → Codex CLI`). Either way, the two sources of truth must converge before the 5th pilot to prevent operational drift on TKT-014.

**Severity:** Low (clerical inconsistency, no immediate correctness or security impact; 4th-pilot can proceed empirically). Resolve as part of TKT-012 closure-PR or as a standalone clerical PR — whichever the empirical answer dictates.

**ArchSpec dependency:** None directly. `ADR-002@0.1.0 OmniRoute-First LLM Routing` governs the routing layer; if the resolution shows OmniRoute does NOT reach OpenAI Codex GPT-5.5, an ADR amendment may be warranted.

## TKT-NEW-rv-code-file-naming-canonical

**Source:** TKT-013 closure cross-reviewer audit (Devin Orchestrator ratification pass-2). Reviewer correctly used `RV-CODE-013` for the artifact id (the BACKLOG-008 `§reviewer-rv-code-numbering-convention` guardrail, enforced by TO via explicit Reviewer NUDGE language, prevented the TKT-011 `RV-CODE-016` mis-numbering). However, the **filename** Reviewer chose was `RV-CODE-013-pr-80-tkt-013.md` — a slightly different format from the canonical TKT-009/010/011 closure pattern (`RV-CODE-NNN-tkt-NNN-{title}.md`). The repo currently has both formats live (e.g. `RV-CODE-005-pr-34-tkt-005-onboarding-target-calculator.md` includes both PR# and title; `RV-CODE-007-pr-50-tkt-007.md` has PR# but no title; `RV-CODE-009/010/011-tkt-NNN-{title}.md` has title but no PR#). The 3 most recent closures all converged on the title-only canonical pattern, so the inconsistency is a tail of the older convention.

**The issue:** Inconsistent RV file naming makes `git log` / `gh pr list` / repo-grep less predictable. It also adds a clerical fix step to every closure-PR (the TKT-013 closure-PR renames the file via `git mv`).

**Proposed fix:** Reinforce in `docs/prompts/reviewer.md` and in TO's Reviewer NUDGE template the canonical pattern: `docs/reviews/RV-CODE-NNN-tkt-NNN-{title-slug}.md` where `NNN` matches the target TKT and `{title-slug}` is the lowercase-hyphenated TKT title. Mirror the change in `docs/meta/devin-session-handoff.md` §11 if the section enumerates Reviewer dispatch files. Optionally update `scripts/validate_docs.py` to warn (not fail) on RV files that include `pr-NN` segments — would auto-surface drift.

**Severity:** Low (clerical, no correctness or process impact; closure-PR rename is a 1-line `git mv`). Implement opportunistically; can ride along with the next Reviewer-prompt edit.

**ArchSpec dependency:** None.
