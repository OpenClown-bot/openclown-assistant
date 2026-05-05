---
id: RV-CODE-018
type: code_review
status: in_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/125"
ticket_ref: TKT-018@0.1.0
reviewer_model: "kimi-k2.6"
author_model: "glm-5.1"
created: 2026-05-05
updated: 2026-05-05
---

# Code Review — PR #125 (TKT-018@0.1.0)

## Summary
PR #125 delivers a clean, well-tested C13 stall-watchdog middleware (`StallWatchdog`, `executeWithStallWatchdog`, `checkKillSwitch`) and integrates it into `callOmniRoute` with a kill-switch fail-closed path. All TKT-018@0.1.0 §6 Acceptance Criteria are structurally satisfied by verifiable tests. Scope is clean (8 files touched), no new runtime dependencies, no secrets in metric labels, CI green. Two LOW integration-completeness notes are recorded but neither blocks merge.

## Verdict
- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: All ACs covered by passing tests, middleware contract matches ADR-012 constants and bounded labels, scope clean, no blockers or medium+ findings.

Recommendation to PO: approve & merge.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
  - `src/observability/stallWatchdog.ts` (new C13 module)
  - `src/llm/omniRouteClient.ts` (+stall watchdog wiring, kill-switch, outcome expansion)
  - `src/observability/events.ts` (+`threshold_ms`, `actual_stall_ms`, `retry_count`, `kill_switch_path` in ALLOWED_EXTRA_KEYS)
  - `src/observability/kpiEvents.ts` (+`llm_call_stalled`, `runtime_kill_switch_active`, +Prometheus metric names)
  - `src/shared/types.ts` (+`"C13"` ComponentId — see F-N1)
  - `tests/observability/stallWatchdog.test.ts` (new, 10 tests)
  - `tests/llm/omniRouteClient.test.ts` (+kill-switch AC6 integration test)
  - `docs/tickets/TKT-018-g2-model-stall-detector-synthetic-tests.md` (status + execution log)
- [x] No changes to TKT §3 NOT-In-Scope items
  - No Rust/WASM dependency.
  - No provider-health ping calls.
  - No wrapping of image/batch non-streaming calls.
  - No model-selection policy changes.
  - No SecureClaw source vendoring.
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
  - `package.json` unchanged; uses only `setInterval` / `AbortController` / `DOMException` (built-ins).
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
  - **AC1** (120 s stall detected ≤15 s after threshold): `tests/observability/stallWatchdog.test.ts:24` — "AC1: emits kbju_llm_call_stalled within 15s after 120s threshold with no token".
  - **AC2** (300 s and 600 s thresholds): `tests/observability/stallWatchdog.test.ts:64` (300 s) + `:101` (600 s).
  - **AC3** (zero stall events with regular token deltas): `tests/observability/stallWatchdog.test.ts:138` — "AC3: emits zero stall events when token deltas arrive every threshold/4".
  - **AC4** (abort + one fallback on first stall): `tests/observability/stallWatchdog.test.ts:174` — "AC4: on first stall, aborts the original request and invokes fallback once".
  - **AC5** (exhaustion after max retries): `tests/observability/stallWatchdog.test.ts:226` — "AC5: throws StallExhaustedError after STALL_MAX_RETRIES fallback stalls with no stale response".
  - **AC6** (kill-switch fail-closed): `tests/observability/stallWatchdog.test.ts:270` (unit) + `tests/llm/omniRouteClient.test.ts:128` (integration).
  - **AC7** (lint / typecheck / tests / validate_docs): all green locally (13 targeted tests pass, full suite 704 tests pass, validate_docs OK).
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
  - Ticket frontmatter `status: in_review` in a separate commit (`0c7a76e`).
- [x] ADR-012@0.1.0 §1 Decision honoured
  - `STALL_THRESHOLD_MS = 120000` (`stallWatchdog.ts:1`).
  - `STALL_POLL_INTERVAL_MS = min(15000, threshold/2)` (`stallWatchdog.ts:2`).
  - `STALL_MAX_RETRIES = 2` (`stallWatchdog.ts:3`).
  - `kbju_llm_call_stalled` event with bounded labels (`tenant_id`, `provider`, `model`, `threshold_ms`, `actual_stall_ms`, `retry_count`, `timestamp_utc`); no raw prompt or full user identifier in labels.
- [x] ARCH-001@0.5.0 §3.13 component spec honoured
  - `touch()` updates `lastTokenAt` (`stallWatchdog.ts:104`).
  - `AbortController` on stall (`stallWatchdog.ts:99`, `omniRouteClient.ts:163`).
  - Fallback path present (`executeWithStallWatchdog.ts:231`, `omniRouteClient.ts:188`/`282`).
  - Bridge-triggered fail-closed via kill-switch (`omniRouteClient.ts:60`–`85`, `stallWatchdog.ts:270`–`287`).

## Findings

### High (blocking)
_None._

### Medium
_None._

### Low
- **F-LOW-1 — `src/llm/omniRouteClient.ts` integration touches once after full HTTP response, not per delta chunk.**
  The current router uses a non-streaming `/v1/chat/completions` POST (no `stream: true`, no `ReadableStream` chunk reader). `stallWatchdog.touch()` is invoked once after `fetch` resolves (`omniRouteClient.ts:201`), not on each received delta. The middleware API (`executeWithStallWatchdog`'s `onToken` callback) is designed for per-delta touching and is validated by AC3; a future streaming refactor should wire `touch()` into the chunk reader loop. **Responsible role:** future Architect streaming ticket. **Impact:** no runtime defect today; watchdog monitors total round-trip latency rather than inter-token velocity.

- **F-LOW-2 — Pre-existing `LLM_TIMEOUT_MS = 15000` client abort masks the default 120 s stall threshold in `callOmniRoute`.**
  The fetch timer (`omniRouteClient.ts:137`, `retryOnce.ts:350`) aborts at 15 s, which always fires before the default `STALL_THRESHOLD_MS = 120000`. Consequently the C13 stall path in `callOmniRoute` is unreachable at default settings for non-streaming calls. The middleware is fully validated in isolation by fake-timer tests; it will activate automatically if `LLM_TIMEOUT_MS` is later increased or when streaming adoption removes the hard 15 s ceiling. **Responsible role:** future Architect streaming / timeout-unification ticket. **Impact:** no runtime defect today; the 15 s timeout already covers the dominant stall scenario for non-streaming fetches.

- **F-LOW-3 — PR-body AC-by-AC table lacks precise line-number citations (orchestrator-clerical-deferred per F-PR1).**
  The PR description lists "test: tests/observability/stallWatchdog.test.ts" without line numbers. The actual tests are explicitly AC-tagged in the test file (see AC mapping in this review). A tighter table improves traceability for the PO and future reviewers. **Responsible role:** Devin Orchestrator. **Suggested remediation:** patch PR body with the AC↔line mapping from this review.

- **F-NIT — `src/shared/types.ts` ComponentId extension C11 → C11|C12|C13.**
  Pre-flagged by Devin Orchestrator (F-N1). Structurally required for typecheck of the C13 integration. Architect oversight (TKT-017 also missed C12). No action needed.

## Red-team probes (Reviewer must address each)
- **Error paths / LLM timeout:**
  - Stall → `AbortController.abort()` → fetch `AbortError` → `isStallAbort` detected via `watchdog.isStalled()` → `retryOnce` fallback or `stall_detected` outcome returned. Correct.
  - Non-stall timeout (`LLM_TIMEOUT_MS` timer abort) → treated as `errorCode: "timeout"` → `retryOnce` called. Correct.
  - `retryOnce` internal failure → caught in its own try/catch, returns `provider_failure`. No unhandled exception leak.
- **Concurrency:**
  - `StallWatchdog` is per-call instance with no shared mutable state. Concurrent calls each get independent `Date.now()`, `AbortController`, and interval timer. Safe.
- **Input validation / prompt injection:**
  - No external strings reach the stall-watchdog logic beyond bounded metric labels (`tenant_id`, `provider`, `model`). No prompt injection surface.
- **Secrets / PII in logs:**
  - `buildRedactedEvent` + `ALLOWED_EXTRA_KEYS` allowlist strips unbounded keys. Stall event fields (`threshold_ms`, `actual_stall_ms`, `retry_count`, `kill_switch_path`) are all bounded scalars. No raw prompt or credential leakage.
- **Resource exhaustion / unbounded loops:**
  - `executeWithStallWatchdog` loop is bounded by `maxRetries`. `StallWatchdog.stop()` clears `setInterval`. No memory leaks under normal or error paths.
- **Race conditions:**
  - In `omniRouteClient.ts`, if `fetch` resolves after the watchdog has already fired, `isStalled()` is checked before the response is consumed; the potentially stale response is discarded in favor of fallback. Safe fail-closed behavior.
- **Off-by-one in retry counters:**
  - `maxRetries = 2` yields up to 3 total attempts in `executeWithStallWatchdog` (`attempt` 0 → fallback → `attempt` 2). `omniRouteClient.ts` tracks `stallRetryCount` independently and respects the same bound. Correct.
- **Missing authz / tenant isolation:**
  - `tenant_id` is used as a bounded metric label, not for access control. The existing C12 breach detector (TKT-017) handles tenant isolation separately.
