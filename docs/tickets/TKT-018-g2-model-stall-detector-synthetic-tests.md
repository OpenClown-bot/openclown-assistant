---
id: TKT-018
title: "G2 Model-stall detector + synthetic integration tests"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "deepseek-v4-pro"
assigned_executor: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-018: G2 Model-stall detector (C13)

## Scope

PRD-002@0.2.1 §2 G2 requires automated model-stall detection (motivated by BACKLOG-009 Qwen 3.6 Plus
5-of-5 cancellation). This ticket builds C13, the per-call streaming token watchdog middleware
(ADR-012@0.1.0, algorithm forked from zeroclaw `stall_watchdog.rs:29-124`).

## Acceptance Criteria

1. `src/observability/stallWatchdog.ts` exists with `StallWatchdog` class:
   - Constructor takes `thresholdMs` (default 15000), `onStall` callback
   - `start()` begins monitoring; `touch()` updates `lastTokenAt` on each LLM delta chunk
   - Background `setInterval` at `thresholdMs / 2` checks `now - lastTokenAt > thresholdMs`
   - On stall: calls `onStall()`, which aborts the LLM fetch and triggers fallback

2. `StallWatchdog` integrated into the LLM provider call path:
   - Injected as middleware before every `fetch()` call to the LLM API
   - On stall: logs `kbju_llm_call_stalled{provider, model}`, aborts, falls back to
     OpenClaw's primary provider (GPT-5.3 via OmniRoute)

3. Config:
   - `STALL_THRESHOLD_MS` env var (default 15000)
   - `STALL_MAX_RETRIES` env var (default 2)

4. Synthetic integration tests (`tests/integration/stallWatchdog.test.ts`):
   - Test 1: Normal streaming — no stall, test passes
   - Test 2: Simulated stall (no tokens for thresholdMs+1) — stall fired, fallback invoked
   - Test 3: Stall + fallback also stalls — fast-fail after STALL_MAX_RETRIES
   - Test 4: Very fast streaming (tokens at ~100ms) — watchdog never fires

5. Metric: `kbju_llm_call_stalled{provider, model, retry_count}` — counter

## Implementation Notes

- Use `AbortController` to cancel hung fetches
- `touch()` is O(1) — single `Date.now()` assignment, no I/O
- Watchdog is per-call (not shared) — each LLM request gets its own watchdog instance
- Do NOT wrap non-streaming calls (image analysis, batch operations) — watchdog only for streaming