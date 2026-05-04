---
id: ADR-012
title: "Model-stall detection mechanism — per-call streaming token watchdog"
version: 0.1.0
status: proposed
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
approved_at: null
approved_by: null
---

# ADR-012: Model-stall detection mechanism

## 0. Recon Report

PRD-002@0.2.1 G2 requires automated detection of LLM call stalls (motivated by BACKLOG-009 Qwen 3.6 Plus
128K context exhaustion, 5-of-5 cancellation pattern). Only one model-stall detection mechanism exists
across all 6 evaluated runtimes: zeroclaw's `stall_watchdog.rs:29-124`.

The zeroclaw implementation uses `AtomicU64` timestamp + background Tokio task polling at `timeout/2`
+ callback on stall. It monitors channel transport stalls (Discord websocket keepalive, `discord.rs:1060-1084`).
For KBJU Coach, we need the same algorithm pattern but applied at the LLM call layer (provider call token output),
not the channel transport layer.

## 1. Decision

**Chosen: Per-call streaming token watchdog as TypeScript middleware (algorithm forked from zeroclaw
`stall_watchdog.rs:29-124`, ported to LLM router layer).**

Each LLM provider call is wrapped in a `StallWatchdog` that monitors streaming token output velocity:
- Records `lastTokenAt` timestamp on each received delta chunk
- Background `setInterval` at `STALL_THRESHOLD_MS / 2` checks elapsed time since last token
- If `now - lastTokenAt > STALL_THRESHOLD_MS`: fires `onStall` callback, aborts the fetch, falls back
  to OpenClaw's primary provider (GPT-5.3 via OmniRoute)

## 2. Options evaluated

| Option | Description | Verdict | Rationale |
|---|---|---|---|
| A: Transport-level watchdog (Rust port) | Port zeroclaw's Rust `stall_watchdog.rs` as-is to TypeScript transport layer | **Rejected** | Monitors channel keepalive, not LLM token velocity. Different abstraction. TypeScript WebSocket layer doesn't have zeroclaw's Tokio task model. |
| B: Response-level timeout (deadline) | Simple `Promise.race([fetch, timeout])` on entire response | **Rejected** | Cannot detect mid-response stalls — an LLM that stops outputting tokens at byte 100 won't be caught until the full timeout expires, wasting resources. |
| C: Background provider ping | Spawn separate "ping" LLM call to verify provider health | **Rejected** | Wastes additional LLM tokens for health checking. Adds latency to detection (ping cadence must be conservative). Doesn't detect per-call stalls with the same precision. |
| D: Streaming token watchdog (per-call) | Wrap each LLM call with token-velocity monitor | **Chosen** | Directly addresses PRD-002@0.2.1 G2. Algorithm proven in zeroclaw, ported to the right abstraction layer. Fine-grained: catches stalls at ~5s, not full request timeout (30s+). |

## 3. Design

```
LLM call start → StallWatchdog.start()
  └─ setInterval(STALL_THRESHOLD_MS / 2): check now - lastTokenAt
  └─ on each delta chunk: lastTokenAt = Date.now()
  └─ if stalled: abort fetch → fallback provider → log kbju_llm_call_stalled
```

**Config knobs:**
- `STALL_THRESHOLD_MS`: 15000 (default, 15s without a token = stalled)
- `STALL_POLL_INTERNAL_MS`: `STALL_THRESHOLD_MS / 2` (7.5s)
- `STALL_MAX_RETRIES`: 2 (per call: primary provider → fallback → fast-fail)

**Metric:** `kbju_llm_call_stalled{provider, model, tenant_id}` — counter, emitted on each stall fire.

## 4. Consequences

**Positive:**
- Catches mid-response stalls ~15s, not full-timeout ~60s — saves compute on hung LLM calls
- Single algorithm port; no new Rust dependency, no WASM FFI
- Reuses OpenClaw's provider failover for stalled calls

**Negative:**
- Algorithm ports from Rust (zeroclaw Tokio task model) to TypeScript (setInterval model) — different concurrency model
- Does NOT detect provider-level stalls (e.g., provider completely down, no response at all) — covered by existing request timeout