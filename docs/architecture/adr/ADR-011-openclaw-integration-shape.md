---
id: ADR-011
title: "OpenClaw integration shape (hybrid gateway + sidecar)"
version: 0.1.0
status: proposed
arch_ref: ARCH-001@0.5.0
author_model: "deepseek-v4-pro"
reviewer_models: []
review_refs: []
created: 2026-05-04
updated: 2026-05-04
approved_at: null
approved_by: null
approved_note: null
superseded_by: null
---

# ADR-011: OpenClaw integration shape (hybrid gateway + sidecar)

## 0. Recon Report

Resolves runtime-integration gating scope-A of BACKLOG-009 under PO constraint «не отказываться от опенкло 100%».

| Artifact | Finding |
|---|---|
| `openclaw@2026.5.3-1` npm (packed 2026-05-04) | 18 MB / 9280 files. `openclaw gateway` HTTP server + 7 channel plugins. Skills are `.md` files, not TypeScript classes. |
| GitHub `openclaw/openclaw` source | `ChannelPlugin` is internal API — not publicly documented. |
| PO forensics 2026-05-04 | `openclaw gateway` routes to embedded LLM agent, not to our `routeMessage()`. |
| KBJU source (`src/telegram/`) | Barrel `src/index.ts`, uninstantiated `C1Deps`, orphaned handlers. |
| PO constraint | «не отказываться от опенкло 100%» |

## 1. Options

### Option A: NATIVE (channel plugin) — rejected
Implements `ChannelPlugin` inside OpenClaw process. Unstable internal API — breaks on upgrades.

### Option B: REPLACE (grammY-only) — rejected
Drops OpenClaw. Violates PO constraint.

### Option C: HYBRID (gateway + sidecar + HTTP bridge) — chosen
OpenClaw Gateway owns Telegram + cron + agent orchestration. KBJU sidecar is separate Node 24 process bridged via HTTP (`POST /kbju/message`, `/kbju/callback`, `/kbju/cron`, `GET /kbju/health`).

## 2. Decision

**Option C: HYBRID.**

## 3. Decision Detail

### Q1: Topology
Docker Compose internal network: `openclaw-gateway` + `kbju-sidecar` + PostgreSQL.

### Q2: Bridge contract
- `POST /kbju/message` — Telegram update → `RussianReplyEnvelope`
- `POST /kbju/callback` — callback query → `RussianReplyEnvelope`
- `POST /kbju/cron` — cron trigger → `RussianReplyEnvelope`
- `GET /kbju/health` — `200 {"status":"ok"}`

### Q3: KBJU sidecar boot
`src/main.ts` → factory → HTTP server on `SERVER_PORT` (3001).
`C1Deps.sendMessage` returns `RussianReplyEnvelope` as HTTP response body.

### Q4: Dockerfile
`tsconfig.json` `rootDir="."` → output `dist/src/main.js`. CMD: `node dist/src/main.js`.

### Q5: Reliability
30 s timeout. Sidecar-down = message loss (no durable queue — acceptable per PRD-002@0.2.1 NG).

### Q6: Upgrade path
Bridge contract is ArchSpec-owned, not OpenClaw-owned. OpenClaw upgrades non-breaking.

## 4. Consequences
- Positive: PO constraint satisfied. Independent versioning.
- Negative: +10–50 ms latency. +128–256 MiB RAM. No durable queue.
- Follow-up: TKT-016@0.1.0.

## 5. References
- BACKLOG-009
- PRD-001@0.2.0, PRD-002@0.2.1
- ARCH-001@0.5.0
- `openclaw@2026.5.3-1` source
- `Dockerfile`, `tsconfig.json`, `src/telegram/types.ts`