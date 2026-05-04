---
id: TKT-018
title: "Model-Stall Detector + Synthetic Stall Test Harness (G2)"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C10c Model-Stall Watchdog"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-018: Model-Stall Detector + Synthetic Stall Test Harness (G2)

## 1. Goal
Implement C10c as a streaming token-watchdog wrapping llmRouter.call() that detects zero-token-output stalls at a per-role configurable threshold and emits stall_events + PO alerts.

## 2. In Scope
- `src/observability/stall-watchdog.ts` — streaming token-watchdog implementation
- `migrations/018_stall_events.sql` — stall_events table
- `tests/observability/stall-watchdog.test.ts` — unit tests + synthetic stall test harness
- Wire into `src/main.ts` boot sequence (wraps llmRouter.call)

## 3. NOT In Scope
- Modifying llmRouter internals (watchdog wraps llmRouter.call(), not inside it)
- Provider-side stall detection (our watchdog is client-side in KBJU sidecar)
- Model selection or model-switching on stall (alert-only)
- Stale response to user without manual fallback path (handled by existing MSG_GENERIC_RECOVERY)

## 4. Inputs
- ARCH-001@0.5.0 §3.10c (C10c), §4.9 (stall detection flow), §5 (stall_events schema), §8 (telemetry), §9.1 (env vars)
- ADR-012@0.1.0 (stall detection mechanism)
- PRD-002@0.2.1 §2 G2
- `docs/knowledge/llm-routing.md` (llmRouter.call signature)
- `src/observability/events.ts` (buildRedactedEvent, emitLog)

## 5. Outputs
- [ ] `src/observability/stall-watchdog.ts` — `watchStall<T>(promise: () => Promise<T>, options: StallOptions): Promise<T>` with streaming token-watchdog (resets timer on each stream chunk)
  - `StallOptions`: `{ requestId, role: 'text_llm'|'vision_llm'|'transcription', promptTokenCount, providerAlias, modelAlias, thresholdMs, streamReader?: ReadableStream }`
  - On timer fire: emit stall_events row, send PO alert, deduplicate by request_id
  - On stale response: check `Date.now() - startTime > thresholdMs`, discard if stale, log `stale_response_discarded`
- [ ] `src/observability/stall-watchdog.wrapper.ts` — `wrapLlmRouterCall(llmRouter)` — wraps `llmRouter.call()` with `watchStall`, reads threshold from env per call role
- [ ] `migrations/018_stall_events.sql` — creates `stall_events` table per ARCH-001@0.5.0 §5
- [ ] `tests/observability/stall-watchdog.test.ts`:
  - Zero-output stall: promise never resolves → assert stall event fires between `threshold + 5s` and `threshold + 15s`
  - Delayed recovery stall: streaming with zero data for `threshold + 2s`, then emits tokens → assert stall event fires, stale response discarded
  - Normal completion: streaming with regular data within 1 s → no stall event
  - Batch fallback: non-streaming call exceeds total threshold → stall event fires
  - Dedup: same request_id fires twice → only one stall_events row
  - Threshold override: env var `STALL_THRESHOLD_MS_TEXT_LLM=60000` → assert 60 s threshold
  - Clamping: env var set to 30000 → clamped to 60000
  - Coverage test: enumerate all call sites that use llmRouter.call() → assert each is wrapped
- [ ] Update `src/main.ts` to call `wrapLlmRouterCall` before any LLM invocations

## 6. Acceptance Criteria
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test -- tests/observability/stall-watchdog.test.ts` passes (≥80 % coverage)
- [ ] Migration runs: `psql $DATABASE_URL -f migrations/018_stall_events.sql`
- [ ] Synthetic stall at 120 s detected within `125–135 s` (±5 s margin around ≤15 s emission target for test timing)
- [ ] Synthetic stall at 300 s detected within `305–315 s`
- [ ] Synthetic stall at 600 s detected within `605–615 s`
- [ ] PO alert sent for each detected stall with correct role, elapsed, prompt_tokens (no raw prompt)
- [ ] Stale response discarded after stall (recovered model response not delivered)
- [ ] All C5/C6/C7/C9 call sites wrapped (coverage test asserts)

## 7. Constraints
- Do NOT add new runtime dependencies.
- Watchdog MUST NOT block or delay normal LLM responses — timer operations only.
- PO alert MUST contain: call_id (first 8 chars), role, elapsed time, prompt token count. MUST NOT contain: raw prompt text, user data, provider keys.
- Per-role thresholds from env vars: `STALL_THRESHOLD_MS_TEXT_LLM` / `_VISION_LLM` / `_TRANSCRIPTION`. Default 120000.
- Synthetic stall tests MUST use mocked promises (no real LLM calls) to keep test runtime bounded.
- Dedup window: 5 min, in-memory Set, resets on sidecar restart (acceptable per PRD-002@0.2.1 NG).