# Agent Runtime Comparison — Architect-3 Alternatives Evaluation

> Produced by Architect-3 (DeepSeek V4 Pro #2) as part of the 4-architect uncorrelated-judgment pipeline for ARCH-001@0.5.0.
> Compares 6 runtimes: OpenClaw (TypeScript/Node 24, incumbent) + 5 alternatives evaluated empirically.

## 1. Comparison Matrix

| Axis | OpenClaw | hermes-agent | nanobot | picoclaw | zeroclaw | ironclaw |
|---|---|---|---|---|---|---|
| **Language** | TypeScript, Node 24 | Python 3.11+ | Python 3.11+ | Go 1.25 | Rust 1.87+ | Rust + Monty Python |
| **Telegram channel** | Native gateway, webhook | `python-telegram-bot` webhooks | `python-telegram-bot` polling | `telego` long-polling | Feature-gated `channel-telegram` | User-mode MTProto (not bot API) |
| **Subagent delegation** | None built-in | `delegate_tool.py` L1836-1878, thread-pool children | `SubagentManager` + `AgentRunner` per subtask | `SubTurn` max depth 3, 5 concurrent | None explicit (channel orch only) | `LoopDelegate` trait, `JobDelegate`/`ContainerDelegate` |
| **Channel discovery** | Declarative manifest | `BaseChannel` subclass + entry-points | `BaseChannel` subclass + entry-points | `init()` self-registration factory | Static `channels_except_webhook()` + features | WASM router with secret/signature validation |
| **HTTP bridge** | None (monolith) | WhatsApp bridge (Node→Python HTTP), API server, ACP JSON-RPC | `WebSocketChannel` with token auth | Managed gateway subprocess, pico protocol | `SkillHttpTool` (GET-only), `HttpRequestTool` (full), ACP bridge | `WasmChannel` system via Axum web server |
| **Model-stall detection** | **None** | None | None | None | `stall_watchdog.rs` L29-124 — **only** detection across all runtimes | None |
| **Skill registry** | OpenClaw skill manifest | None (agent-centric) | None | None | Custom `~/.zeroclaw/skills/`, plugin WASM | 4-source: workspace/user/installed/bundled, max 100 |
| **Dependency weight** | Light (~20 npm deps via openclaw) | Heavy (21 core + messaging extras, 20k+ lines) | Moderate (focused agent lib) | Heavy (full Go agent stack + gateway) | Heavy (16 Rust crates, WASM plugins) | Heavy (Rust kernel + Monty VM + WASM router) |
| **Stars/community** | ~65k | ~132k | ~41k | ~28k | ~30k | ~12k |
| **Language match** | **Matches** (TypeScript/Node 24) | **Mismatch** (Python) | **Mismatch** (Python) | **Mismatch** (Go) | **Mismatch** (Rust) | **Mismatch** (Rust) |
| **Telegram bot mode** | Native bot API | bot API | bot API | bot API | bot API | **User mode only** (MTProto) — wrong mode |

## 2. Build-vs-Fork-vs-Skip Verdicts

| Framework | Verdict | Rationale |
|---|---|---|
| **hermes-agent** | **REFERENCE** | Subagent delegation pattern (`delegate_tool.py:1836-1878`) is the richest, most production-ready design — forking into TypeScript is architecturally valuable but rewriting 20k+ Python lines is unjustified. HTTP bridge pattern (`whatsapp-bridge/bridge.js`) is precedent for Node→Python HTTP IPC. Reference for: subagent lifecycle, `DELEGATE_BLOCKED_TOOLS` pattern, parallel batch spawn. |
| **nanobot** | **REFERENCE** | `SubagentManager` + phased status tracking (`initializing|awaiting_tools|...`) provides clean subagent state model. `WebSocketChannel` token auth is a simpler bridge pattern than hermes-agent's ACP. Channel plugin entry-point discovery is lighter than picoclaw's Go init(). Reference for: subagent status phases, channel plugin registration. |
| **picoclaw** | **SKIP** | Go language mismatch is insurmountable (would require gRPC/protobuf bridge or Go subprocess, defeating simplicity). `SubTurn` depth/concurrency limits (3/5) provide useful reference caps. ToolFeedbackAnimator is a nice UX touch but not worth cross-language cost. |
| **zeroclaw** | **FORK (stall_watchdog only)** | `stall_watchdog.rs:29-124` is the **only** model-stall detection mechanism across all 6 runtimes. Algorithm: `AtomicU64` timestamp + background Tokio task polling at `timeout/2` + callback on stall. Porting the algorithm (not the Rust impl) to TypeScript middleware is a direct PRD-002@0.2.1 G2 solution. Nothing else forkable — Rust/TypeScript FFI is not justified. |
| **ironclaw** | **REFERENCE** | 4-source skill registry (`registry.rs:1-41`: workspace/user/installed/bundled, max 100, SHA256 hashing) is the richest discovery mechanism — useful for future KBJU skill composition. `WasmChannelRouter` secret/signature validation pattern is a reference for secure bridge ingress. But user-mode Telegram (MTProto, `lib.rs:1-90`) is wrong mode — KBJU Coach requires bot API. |

## 3. Hybrid Hypothesis Evaluation

**PO's hypothesis:** "OpenClaw gateway + N subagents from alternatives as sidecar processes"

**Empirical evidence:**

| Claim | Evidence | Verdict |
|---|---|---|
| Subagent delegation possible across runtimes | hermes-agent `delegate_tool.py:1836` shows clean `goal+context+toolsets+tasks` contract; nanobot `SubagentManager` shows per-subtask `AgentRunner` | **Proven viable** |
| HTTP bridge between TypeScript gateway and subagents possible | hermes-agent WhatsApp bridge (`bridge.js→express HTTP→Python`: lines 1-18); zeroclaw `SkillHttpTool` (`skill_http.rs:90`); ironclaw `WasmChannelRouter` (`router.rs:293-633`) | **Proven viable — multiple precedents** |
| Drop-in subagent exists (no custom bridge needed) | **None** — every alternative requires custom bridge construction; no alternative provides "spawn TypeScript subagent via HTTP" out of the box | **FALSE — every bridge is custom-built** |
| Subagent in compatible language available | **None** — all 5 alternatives are Python/Go/Rust, incompatible with TypeScript/Node 24 | **FALSE — all alternatives cross-language** |

**Hybrid viability verdict: PARTIALLY VIABLE WITH CAVEATS**

```
User voice → OpenClaw Telegram channel → routes to subagent X via HTTP POST /kbju/message → returns to user
```

The pattern works given HTTP bridge construction, but:
- Every subagent requires a custom HTTP bridge contract (not a drop-in)
- Cross-language process management adds operational surface (sidecar lifecycle, health checks, restart policy)
- Subagent isolation is at process level (good) but no subagent provides multi-tenancy (must add at bridge layer)

## 4. Three Weakest Assumptions

1. **(A1) OpenClaw Gateway can route HTTP to the KBJU sidecar without native subagent support.** OpenClaw's `cron-tools` and channel plugins provide internal dispatch points, but an HTTP POST routing from a Telegram handler to an external process has no documented precedent in openclaw source/docs. The bridge adapter must be custom-built at the OpenClaw skill level.

2. **(A2) A single KBJU sidecar process handles concurrent users without per-tenant process isolation.** All 5 alternatives provide subagent pools at the agent level, not at the HTTP server level. A single Express/Fastify sidecar serving N tenants reintroduces multi-tenancy as a runtime concern (shared heap, shared connection pool) that the existing ARCH-001@0.4.0 C3 tenant store + PostgreSQL RLS solves at the data layer but not at the process layer.

3. **(A3) zeroclaw's Rust `stall_watchdog.rs` ports cleanly to TypeScript middleware at the LLM router layer.** The Rust impl monitors channel-level transport stalls (Discord websocket keepalive, `discord.rs:1060-1084`). PRD-002@0.2.1 G2 requires monitoring LLM-call-level token output, which is a different abstraction layer (provider call vs channel transport). The `AtomicU64.touch()` pattern ports, but the trigger condition and monitoring scope differ fundamentally.

## 5. DeepSeek Family Blind-Spot Patterns

- **TypeScript/Node ecosystem bias**: Architect-2 (DeepSeek V4 Pro #1) and Architect-3 (DeepSeek V4 Pro #2) share the same model family; both may overweight the TypeScript-native OpenClaw path and underweight the operational patterns proven in Python/Rust alternatives that don't map cleanly to Node 24.
- **Architect-4 (Opus) and Kimi (Moonshot) must compensate** for: (a) under-evaluation of zeroclaw's full WASM plugin ecosystem for future extensibility, (b) over-reliance on HTTP bridges when a native OpenClaw-channel-plugin might be simpler for some subagents.
- **Hybrid is the DeepSeek consensus** (both A2 and A3 independently converged on HYBRID) — but A1 (GPT-5.5 xHigh, abandoned OpenClaw) and A4 (Opus) are from different families and may reach different conclusions.