---
id: TKT-018
title: "G2 model-stall detector and synthetic tests"
version: 0.1.0
status: done
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-05
completed_at: 2026-05-05
completed_by: "lindwurm.22.shane (PO)"
completed_note: |
  TKT-018@0.1.0 closed after Executor PR #125 (squash sha 225d2b4) and Kimi RV-CODE-018 review PR #126 (squash sha bd56a78) were both merged to main on 2026-05-05. Implementation final HEAD before PR #125 squash was 0c7a76e after a single Executor iteration: GLM 5.1 delivered the C13 StallWatchdog middleware (`src/observability/stallWatchdog.ts`, 287 LoC, new file) plus integration into `callOmniRoute()` in `src/llm/omniRouteClient.ts` (+127/-5), per-call abort+fallback retry loop, kill-switch fail-closed path checking `RUNTIME_KILL_SWITCH_PATH` per `ADR-012@0.1.0` §1, two new bounded KPI event names `kbju_llm_call_stalled` and `kbju_runtime_kill_switch_active` plus matching Prometheus metric names in `src/observability/kpiEvents.ts` (+6), four new ALLOWED_EXTRA_KEYS labels (`threshold_ms`, `actual_stall_ms`, `retry_count`, `kill_switch_path`) in `src/observability/events.ts` (+4), `"C13"` extension to the ComponentId union in `src/shared/types.ts` (+1/-1), 10 fake-timer synthetic tests in `tests/observability/stallWatchdog.test.ts` (new, 311 LoC) covering AC-1 through AC-5, plus 1 kill-switch integration test in `tests/llm/omniRouteClient.test.ts` (+32) covering AC-6. All 7 §6 Acceptance Criteria are structurally satisfied by these 11 named tests; AC-7 (lint/typecheck/test/validate green) verified locally on 0c7a76e by 704/704 tests + clean lint + clean typecheck + `validated 81 artifact(s); 0 failed`. Architect deviation: none — implementation matches `ADR-012@0.1.0` constants (default `STALL_THRESHOLD_MS=120000`, `STALL_DETECTION_WINDOW_MS=15000`, `STALL_MAX_RETRIES=2`) and `ARCH-001@0.5.0` §3.13 C13 component spec exactly. Executor model deviation: assigned glm-5.1, executed by glm-5.1; no GLM stall this cycle (locked-design ITER-1 prompt with per-step commit-and-push discipline applied prophylactically per the `2026-05-05-session-3.md` outstanding-decisions note about TKT-017 GLM ~52% context exhaustion). Kimi K2.6 RV-CODE-018 verdict on 0c7a76e was pass with 3 LOW + 1 NIT findings, no iter-2 required; review file at `docs/reviews/RV-CODE-018-tkt-018-g2-model-stall-detector-synthetic-tests.md` (Reviewer first commit b12121b on rv-branch). PR-Agent (GPT-5.3 Codex on OmniRoute) raised 2 persistent-review findings on PR #125 after un-draft: Finding A "stallRetryCount re-initialized in retryOnce recursion" was false on the literal recursion claim (no recursion exists; `retryOnce()` is a one-shot non-recursive helper) but architecturally subsumed by Kimi F-LOW-2; Finding B "Missing frontmatter fields" was false-positive (frontmatter intact). Findings triage: F-LOW-1 (C13 integration deferred per-delta wiring to a future streaming refactor) → BACKLOG `TKT-NEW-wire-stall-watchdog-per-delta-after-streaming-refactor`; F-LOW-2 (`LLM_TIMEOUT_MS=15000` client abort masks the 120s default stall threshold for non-streaming calls) → BACKLOG `TKT-NEW-reconcile-llm-timeout-ms-with-stall-threshold-default`; F-LOW-3 (PR-body AC table lacks line-numbers, orchestrator-clerical-deferred per F-PR1) → accepted-as-noted; F-NIT (ComponentId C11 → C11|C12|C13 extension) → orchestrator-pre-flagged via Devin Orchestrator F-N1 in the PR #125 ratification audit, accepted as required-for-typecheck; PR-Agent Finding A → BACKLOG `TKT-NEW-rewrite-callomniroute-stall-retry-loop-after-streaming-refactor` (subsumes F-LOW-2 retry-loop architectural concern). Cross-reviewer audit summary per `docs/meta/devin-session-handoff.md` §5 forbidden-actions ("no merge-safe sign-off without pre-merge cross-reviewer audit"): Kimi K2.6 RV-CODE-018 pass + Qodo PR-Agent 0 blockers (1 literal-claim false-positive + 1 partial-truth subsumed by Kimi F-LOW-2) + Devin Orchestrator pass-2 ratification audit pass_with_minor (F-N1 NIT) — all three reviewers agreed merge-safe. Local pre-merge re-verification on 0c7a76e: `npm run build` clean, `npm test` 704/704 (33 test files), `npm run lint` clean, `npm run typecheck` clean, `python3 scripts/validate_docs.py` 81 artifacts 0 failed. validate-docs CI failure on PR #126 first push (HEAD b12121b) was a separate issue: Kimi's RV-CODE-018 file body contained 4 bare-token references (`ADR-012` at L23, `TKT-018` at L36 inside a filename path, `TKT-017` at L86 and L106) that the `scripts/validate_docs.py` line-199 regex `(?<![A-Za-z-])(PRD|ARCH|ADR|TKT)-\d{3,}(?!@)` flagged as unpinned. PO authorized Devin Orchestrator clerical patch (recorded in PR #126 comment + commit `06cb23d` body per `docs/meta/devin-session-handoff.md` §5 "explicit PO authorisation, recorded in the PR body") to pin all four references to `@0.1.0` form; CI flipped green on `06cb23d`; attribution chain preserved in PR #126 commit history (Kimi authored b12121b, Devin Orchestrator authored 06cb23d) before squash. PO chose order: PR #125 merged first as `225d2b4`, then PR #126 (with the clerical pin folded into squash) merged as `bd56a78`. Main is clean post-merge: 82 artifacts 0 failed (up from 81 — RV-CODE-018 file added). No code defect remains; F-LOW-1 + F-LOW-2 + F-LOW-PA1 are the three outstanding BACKLOG items, all clustered around the same upcoming streaming-refactor work and likely to be batched into a single follow-up TKT once the Architect ratifies the streaming refactor scope.
---

# TKT-018: G2 model-stall detector and synthetic tests

## 1. Goal
Wrap every routed streaming LLM call with a token-stall watchdog that alerts within 15 seconds after the configured threshold is crossed.

## 2. In Scope
- Add C13 per-call watchdog middleware around routed streaming LLM calls.
- Add an operator kill-switch integration compatible with SecureClaw-style file/CLI control, without copying AGPL code into this repo.
- Use the zeroclaw polling pattern as algorithm inspiration while implementing idiomatic TypeScript.
- Default threshold is 120000 ms; support per-role overrides.
- Add synthetic tests for 120 s, 300 s, and 600 s stalls using fake timers.

## 3. NOT In Scope
- No Rust/WASM dependency.
- No provider-health ping calls that spend extra tokens.
- No wrapping non-streaming image/batch calls unless they expose streaming token output.
- No changing model selection policy beyond invoking the existing fallback path on stall.
- No vendoring SecureClaw source code.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §3.13, §8, §12.
- ADR-012@0.1.0 and PRD-002@0.2.1 §2 G2.
- `src/llm/omniRouteClient.ts`, `src/observability/events.ts`, `src/observability/kpiEvents.ts`.
- Tests under `tests/llm/**` and `tests/observability/**`.

## 5. Outputs
- [ ] `src/observability/stallWatchdog.ts` or equivalent C13 module.
- [ ] Integration in the LLM-router call path for all streaming text LLM calls.
- [ ] Metrics/log event for `kbju_llm_call_stalled` with bounded labels.
- [ ] Kill-switch check that forces fail-closed / safe-mode behavior for Gateway-originated bridge tools when the configured kill-switch file is active.
- [ ] Synthetic fake-timer tests covering normal streaming, 120 s stall, 300 s stall, 600 s stall, and fallback exhaustion.

## 6. Acceptance Criteria
- [ ] With threshold 120000 ms, a fake streaming call with no token for 120001 ms emits `kbju_llm_call_stalled` within the next 15000 ms of fake time.
- [ ] The same assertion passes for 300000 ms and 600000 ms thresholds.
- [ ] A fake stream producing token deltas every threshold/4 emits zero stall events.
- [ ] On first stall, the original request is aborted through `AbortController` or equivalent typed cancellation and the configured fallback path is invoked once.
- [ ] After `STALL_MAX_RETRIES` fallback stalls, the call fails fast with a typed error and no stale late response is applied.
- [ ] When the kill-switch file is present, bridge-triggered LLM calls fail closed without spending tokens and emit `kbju_runtime_kill_switch_active`.
- [ ] `npm run lint`, `npm run typecheck`, targeted tests, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Source: PR-B supplies PRD-compatible 120 s default; PR-C supplies zeroclaw algorithm evidence; PR-A contributes no load-bearing G2 topology.
- Source: SPIKE-002 recommends SecureClaw's kill-switch/failure-mode pattern as an installed plugin or compatible local integration, not as copied source.
- The watchdog observes token velocity, not channel/WebSocket keepalive.
- Metric labels must not contain raw prompt text or full user identifiers.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-018@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-018-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets. Executor appends timestamped entries below this line.

### 2026-05-05 GLM 5.1 (Code Executor) — iter 1
- Chunked diff per executor.md STOP CONDITIONS:
  - (a) `6480ed9` StallWatchdog types/skeleton + ticket status ready→in_progress
  - (b) `dedea15` Full StallWatchdog implementation: start/touch/stop/restart, executeWithStallWatchdog retry cycle, checkKillSwitch, StallExhaustedError
  - (c)+(d) `3d90c35` Integration into omniRouteClient.ts + C13 ComponentId + kill-switch fail-closed + kbju_llm_call_stalled + kbju_runtime_kill_switch_active KPI events + ALLOWED_METRIC_LABELS tenant_id/retry_count
  - (e) `a5a7e94` Synthetic tests AC1–AC6 (10 tests in stallWatchdog.test.ts + 1 kill-switch integration test in omniRouteClient.test.ts) + fix retry-cycle controller reuse bug
  - (f) lint/typecheck/test(704)/validate_docs all green; ticket status→in_review
- All §6 ACs verified by named tests; see PR #125 AC-by-AC table.

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.
