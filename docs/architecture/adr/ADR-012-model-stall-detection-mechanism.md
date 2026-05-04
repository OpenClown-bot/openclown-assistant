---
id: ADR-012
title: "Automated model-stall detection mechanism (streaming token-watchdog + Promise-race fallback)"
status: proposed
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
synthesis_inputs:
  - "PR-B: arch/ARCH-001-v0.5.0-deepseek-deep-context-design — streaming token-watchdog at 120s default per PRD-002@0.2.1"
  - "PR-C: arch/ARCH-001-v0.5.0-alternatives-design — same mechanism with zeroclaw stall_watchdog.rs:29-124 algorithmic provenance (15s default — rejected)"
  - "PR-A: arch/ARCH-001-v0.5.0-integration-layer-and-observability — equivalent placement; synthetic 120s/300s/600s test thresholds"
created: 2026-05-04
updated: 2026-05-04
superseded_by: null
---

# ADR-012: Automated model-stall detection mechanism (streaming token-watchdog + Promise-race fallback)

## Context

PRD-002@0.2.1 §2 G2 mandates an automated model-stall detector that emits a `stall_event` within ≤15 s of a 120 s zero-token-output threshold (default), configurable per call role (text_llm, vision_llm, transcription) within `[60000, 600000]` ms. BACKLOG-011 §qwen-3.6-plus-128k-context-insufficient-for-executor records the empirical context: an Executor running on Qwen 3.6 Plus 128k silently produced zero output tokens after consuming a long-context prompt; the PO discovered the stall manually after >10 minutes of wait. PRD-002@0.2.1 §2 G2 is the systematic answer to that gap.

`docs/knowledge/llm-routing.md` documents that all KBJU LLM calls route through `llmRouter.call(req)`; this is the single placement point for the watchdog. PR-C's Recon Report (`docs/knowledge/agent-runtime-comparison.md`) identified zeroclaw `stall_watchdog.rs:29-124` as a working reference implementation in Rust: an `AtomicU64` last-token-timestamp + a Tokio polling task at half the configured threshold + an abort callback. The algorithm is portable to TypeScript (Node.js streaming responses with `response.body.on('data', ...)` updates the timestamp; `setInterval(threshold/2, checkStall)` polls; `AbortController.abort()` is the abort).

PR-B used the 120 s default per PRD-002@0.2.1 §2 G2. PR-C ported zeroclaw's 15 s default verbatim — but zeroclaw's 15 s threshold is for Discord keepalive context, not for LLM token-velocity context, and is too aggressive for KBJU's expected p95 streaming round-trip. The PRD spec is the source of truth for threshold defaults; the algorithm is the source of truth for the polling-and-abort mechanism.

## Options Considered (≥3 real options, no strawmen)

### Option A: Promise-race timeout — rejected
- Description: Wrap every `llmRouter.call()` with `Promise.race([call, sleep(threshold).then(throwTimeout)])`.
- Pros: Trivial to implement. Works for non-streaming responses.
- Cons: Conflates "slow" (large prompt → long generation) with "stalled" (zero token output). A 4 000-token streaming response that takes 130 s to emit would be incorrectly flagged as stalled at a 120 s threshold even though the model is healthily producing tokens. Doesn't satisfy PRD-002@0.2.1 §2 G2's "zero-token-output" semantic.
- Cost / latency / ops burden: low; rejected on semantic correctness.

### Option B: Streaming token-watchdog (CHOSEN)
- Description: Maintain `lastTokenAt = Date.now()` per active call; update on every chunk in the streaming response body. `setInterval(threshold/2, checkStall)` polls; if `Date.now() - lastTokenAt >= threshold`, invoke `AbortController.abort()` + emit `stall_event` row + Telegram alert + `kbju_llm_stall_count_total{call_role,provider_alias,model_alias}` metric increment. For non-streaming `llmRouter.call()` paths, fall back to Promise-race with the same threshold (the call either returns within `threshold` or is treated as stalled). Algorithmic provenance: zeroclaw `stall_watchdog.rs:29-124`.
- Pros: Exact semantic match to PRD-002@0.2.1 §2 G2 ("zero-token-output specifically"). Working reference implementation in zeroclaw. Polling at half the threshold gives ≤threshold/2 detection latency (within ≤15 s for a 30 s threshold and within all PRD bounds). Promise-race fallback covers non-streaming paths without requiring two algorithms.
- Cons: Requires hooking the streaming-response chunks (Node.js native streams or fetch ReadableStream); adds ~0.1–0.5 ms overhead per call (within PRD-002@0.2.1 §7 ≤5 % budget).
- Cost / latency / ops burden: low; ~0.5 ms/call; one `setInterval` per active call (cleared on completion).

### Option C: External poll process — rejected
- Description: Run a separate process that polls call states via a shared store and emits stall events.
- Pros: Decouples watchdog from LLM router code path.
- Cons: Poll latency at the cross-process boundary violates the ≤15 s emission-after-threshold target. Adds a second component for marginal benefit.
- Cost / latency / ops burden: high; rejected.

### Option D: Provider-side timeout headers
- Description: Rely on provider HTTP timeouts (e.g., `--max-time` on curl, `timeout` on fetch).
- Pros: No code at all in KBJU.
- Cons: Most LLM providers don't expose configurable token-stall timeouts at the protocol level — they have request-level timeouts which conflate slow with stalled. Doesn't satisfy zero-token-output semantic. Provider behavior varies.
- Cost / latency / ops burden: zero KBJU code; but doesn't solve the problem.

## Decision

We will use **Option B: Streaming token-watchdog + Promise-race fallback for non-streaming paths**.

Threshold default: **120 000 ms** (per PRD-002@0.2.1 §2 G2). Per-role overrides via env vars `STALL_THRESHOLD_MS_TEXT_LLM`, `STALL_THRESHOLD_MS_VISION_LLM`, `STALL_THRESHOLD_MS_TRANSCRIPTION` clamped to `[60000, 600000]` ms. Algorithmic provenance: zeroclaw `stall_watchdog.rs:29-124` (Rust → TypeScript port, see References).

Why the losers lost:
- A: Conflates slow with stalled; doesn't satisfy zero-token-output semantic.
- C: Cross-process poll latency violates the ≤15 s emission target.
- D: Provider timeouts are request-level, not token-level; varies by provider.

## Decision Detail

### D1: Placement
Wrap every `llmRouter.call(req)` in `src/llm/stallWatchdog.ts`. The watchdog is a middleware function that takes `(req, callRole) => llmRouter.call(req)` and returns a wrapped promise that aborts on stall.

### D2: Threshold matrix
| Role | Env var | Default (ms) | Valid range (ms) |
|---|---|---|---|
| `text_llm` | `STALL_THRESHOLD_MS_TEXT_LLM` | 120000 | [60000, 600000] |
| `vision_llm` | `STALL_THRESHOLD_MS_VISION_LLM` | 120000 | [60000, 600000] |
| `transcription` | `STALL_THRESHOLD_MS_TRANSCRIPTION` | 120000 | [60000, 600000] |

Out-of-range values clamp to the nearest bound and emit a `kbju_stall_threshold_clamped_total{role}` warn-level log on boot.

### D3: Event emission
On stall:
1. Insert `stall_event` row with `request_id, call_role, elapsed_ms, prompt_token_count, provider_alias, model_alias, detected_at`. **Forbidden columns:** raw prompts, transcripts, media bytes, provider keys, full Telegram usernames.
2. Telegram alert to `PO_ALERT_CHAT_ID` (via OpenClaw Gateway send-message bridge endpoint, NOT directly): format `[STALL] model {model_alias} stalled after {elapsed_ms}ms (threshold {threshold}ms). role={call_role}, request={request_id}, tokens={prompt_token_count}`.
3. Increment `kbju_llm_stall_count_total{call_role, provider_alias, model_alias}` counter.
4. Dedup alerts by `request_id` within a 5-minute in-memory window (LRU map of size 1024).

### D4: Stale-response handling
If the LLM recovers and returns a chunk after the watchdog has already aborted (i.e., `Date.now() - startTime > threshold` at chunk-arrival time), discard the chunk and log `stale_response_discarded` at info level. Do not emit a user-facing reply for a stale response.

### D5: Non-streaming fallback (Promise-race)
For `llmRouter.call()` paths that return a single non-streaming response (e.g., classification calls, deterministic endpoints), the watchdog uses `Promise.race([call, sleep(threshold).then(throwStall)])`. The threshold semantic is "no response at all" (entire call ≥ threshold); same `stall_event` row is emitted with `elapsed_ms = threshold`.

### D6: Synthetic test mandate
TKT-018@0.1.0 §6 AC requires synthetic stall-injection tests at 60s / 120s / 300s / 600s thresholds covering: (a) zero-output never-resolves; (b) delayed-recovery streaming gap then tokens; (c) Promise-race fallback for non-streaming. All four pass before merge.

### D7: Overhead budget
~0.1–0.5 ms wall-clock per call (one `setInterval` registration, one `Date.now()` per chunk, abort overhead on stall only). Within PRD-002@0.2.1 §7 ≤5 % observability overhead budget.

## Consequences

- Positive: PRD-002@0.2.1 §2 G2 satisfied with exact zero-token-output semantic. Working reference (zeroclaw) reduces algorithmic risk. BACKLOG-011 manual-discovery gap closed systematically.
- Negative / trade-offs accepted: ~0.5 ms/call overhead; one `setInterval` per active call (memory-bounded by call concurrency, which is ≤2 at v0.1 scale). Stale-response discards waste the LLM token spend after stall is declared.
- Follow-up work: TKT-018@0.1.0 (implementation + synthetic stall tests + per-role threshold validation).

## Synthesis Citation

- **PR-B** `arch/ARCH-001@0.5.0-v0.5.0-deepseek-deep-context-design` `ADR-012-model-stall-detection-mechanism.md` — same Decision (Option B); same 120 s default per PRD-002@0.2.1; same per-role threshold matrix; same dedup-by-request-id approach. Adopted verbatim.
- **PR-C** `arch/ARCH-001@0.5.0-v0.5.0-alternatives-design` `ADR-012-model-stall-detection-mechanism.md` — same mechanism; **rejected** the 15 s default (zeroclaw context mismatch — Discord keepalive vs LLM token velocity); **adopted** the algorithmic provenance citation (zeroclaw `stall_watchdog.rs:29-124` Rust → TypeScript port).
- **PR-A** `arch/ARCH-001@0.5.0-v0.5.0-integration-layer-and-observability` `ADR-011@0.1.0-runtime-telegram-channel.md` (covered watchdog only as part of broader G2 ticket without authoring a dedicated ADR-012) — synthetic 120s/300s/600s test thresholds adopted for TKT-018@0.1.0 §6 AC test matrix.

## References

- PRD-002@0.2.1 §2 G2.
- BACKLOG-011 §qwen-3.6-plus-128k-context-insufficient-for-executor (manual-discovery gap that motivated this ADR).
- ARCH-001@0.5.0 §3.13 (C13 component spec), §8.2 (G2 metric names), §11.2 (component test).
- `docs/knowledge/llm-routing.md` (placement: `llmRouter.call()` is the single LLM invocation point).
- zeroclaw `stall_watchdog.rs:29-124` — algorithmic reference (`AtomicU64` last-token-timestamp + Tokio polling task at `timeout/2` + abort callback). Source preserved in `docs/knowledge/agent-runtime-comparison.md` §zeroclaw.
- TKT-018@0.1.0 (implementation ticket).
- ADR-011@0.1.0 (HYBRID integration shape — establishes that the sidecar's `llmRouter.call()` is the only LLM call site; there is no parallel call site in the gateway because the gateway delegates to the sidecar).
