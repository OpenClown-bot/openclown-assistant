---
id: ADR-011
title: "OpenClaw integration shape (HYBRID gateway + sidecar + HTTP bridge)"
status: proposed
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-001@0.2.0; PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
synthesis_inputs:
  - "PR-A: arch/ARCH-001-v0.5.0-integration-layer-and-observability — option-c raw grammY (abandon-OpenClaw)"
  - "PR-B: arch/ARCH-001-v0.5.0-deepseek-deep-context-design — HYBRID gateway + sidecar + HTTP bridge"
  - "PR-C: arch/ARCH-001-v0.5.0-alternatives-design — HYBRID gateway + sidecar + HTTP bridge (5-alternatives evaluated)"
created: 2026-05-04
updated: 2026-05-04
superseded_by: null
---

# ADR-011: OpenClaw integration shape (HYBRID gateway + sidecar + HTTP bridge)

## Context

`ARCH-001@0.4.0` placed C1–C11 inside an OpenClaw skill runtime under the assumption that OpenClaw skills are TypeScript classes hosting `routeMessage()`. Empirical Recon (PR-A §0, PR-B §0, PR-C §0; reproducible via `npm pack openclaw@2026.5.3-1`) refuted the assumption: **OpenClaw skills are AgentSkills-compatible markdown + YAML manifests, not TypeScript classes**, and the OpenClaw Gateway routes Telegram messages to its embedded LLM agent — not to KBJU's `routeMessage()` handler. PR-B's recon further established that the `openclaw gateway` HTTP server's `ChannelPlugin` interface is internal/undocumented and unstable across upgrades. Without a gateway-to-handler bridge, the existing 15-TKT codebase is unreachable on the deploy-VPS.

PRD-001@0.2.0 §7 locks Telegram channel transport, sandboxing, cron dispatch, secret injection, and provider failover to OpenClaw. PRD-002@0.2.1 §3 NG1 forbids vendor-API workarounds for these concerns. The PO constraint (chat 2026-05-04) is «не отказываться от опенкло 100%» — keep OpenClaw in some load-bearing capacity unless all alternatives are categorically superior, which PR-C's 33-citation 6-runtime audit (`docs/knowledge/agent-runtime-comparison.md`) empirically establishes is not the case.

Two of three independent architect dispatches (PR-B and PR-C) converged on a **HYBRID** topology: OpenClaw Gateway owns Telegram transport + cron + provider failover; a separate KBJU sidecar Node 24 process hosts the existing `src/` modules and is bridged via HTTP on a Docker internal network. PR-A diverged toward an abandon-OpenClaw + raw-grammY adapter design, which violates the PO constraint without empirical justification.

## Options Considered (≥3 real options, no strawmen)

### Option A: NATIVE — implement `ChannelPlugin` inside the OpenClaw process
- Description: Author a TypeScript class that implements OpenClaw Gateway's `ChannelPlugin` interface and registers KBJU's handlers as the Telegram channel's destination.
- Pros: Single process. Zero bridge latency. No new container.
- Cons: `ChannelPlugin` is an undocumented internal API per PR-B's `npm pack openclaw@2026.5.3-1` source inspection. Upgrades break the integration silently. The KBJU code becomes co-resident with OpenClaw's embedded LLM agent and competes for the same event loop, RAM, and crash blast radius. No process boundary at which to enforce G1 tenant-isolation breach detection (C12).
- Cost / latency / ops burden: ~0 ms latency; high upgrade-fragility ops cost.

### Option B: REPLACE — drop OpenClaw, raw grammY adapter
- Description: PR-A's design. Add `grammy` as a runtime dependency; author `src/main.ts` as a long-running grammY-based Telegram bot; remove OpenClaw from the deploy. Re-implement cron and provider failover in KBJU.
- Pros: Direct control of Telegram update handling. No bridge latency. Familiar grammY abstractions.
- Cons: Violates PO Rule 4 («keep OpenClaw»). Requires re-implementing OpenClaw's cron-tools, provider failover, voice wake-word routing, sandbox isolation, and secret-injection ergonomics. Drops the platform that PRD-001@0.2.0 §7 explicitly locks. PR-A's Recon Report does not establish that all alternatives are categorically superior — it establishes only the (true) finding that OpenClaw skills are not TypeScript classes, which is solvable without abandoning the platform.
- Cost / latency / ops burden: ~0 ms latency; high engineering cost (re-implement 4 OpenClaw features); high regression risk.

### Option C: HYBRID — OpenClaw Gateway + KBJU sidecar + HTTP bridge (CHOSEN)
- Description: Keep OpenClaw Gateway as the production Telegram channel + cron dispatcher + provider-failover hook. Add a separate KBJU sidecar Node 24 process (`src/main.ts` HTTP server on port `SERVER_PORT=3001`) that hosts the existing C1–C11 modules. The two communicate over a Docker internal network via a versioned HTTP bridge contract: `POST /kbju/message`, `POST /kbju/callback`, `POST /kbju/cron`, `GET /kbju/health`; header `X-Kbju-Bridge-Version: 1.0`; response body `RussianReplyEnvelope`. The sidecar never opens an outbound connection to the Telegram Bot API; all replies are returned to the gateway as the HTTP response body.
- Pros: PO Rule 4 satisfied. Zero rewrite cost on the 15 merged TKT-001@0.1.0..015 modules — the sidecar imports them directly. Sidecar process boundary creates a natural isolation point for G1 breach detection (C12) at the HTTP edge, not just at the data layer. Bridge contract is versioned independently of OpenClaw's internal plugin API → OpenClaw upgrades are non-breaking. Independent rollback of the sidecar without touching gateway. PR-B and PR-C converged on this topology independently.
- Cons: +10–50 ms HTTP bridge latency (Docker internal network, no TLS termination). +128–256 MiB RAM for the sidecar container. Sidecar-down → message lost (no durable queue at v0.5.0; documented as accepted per PRD-002@0.2.1 §A.10 R7). The bridge adapter on the **gateway** side is unproven on the openclaw runtime (synthesis-time §0.6 weakest assumption S1).
- Cost / latency / ops burden: 10–50 ms bridge latency; +128–256 MiB RAM; medium ops cost (one extra container in Docker Compose).

### Option D: MESH — co-run OpenClaw + a second runtime (hermes-agent / nanobot) and cross-route
- Description: PR-C Option C. Run OpenClaw + nanobot or hermes-agent simultaneously; route messages between them.
- Pros: Allows experimenting with subagent-delegation patterns from the alternatives audit.
- Cons: Cross-runtime contracts do not exist out-of-the-box in any alternative (PR-C §3.2 finding). Doubles operational surface. Each subagent still needs a custom bridge — same work as HYBRID but with 3× complexity. No engineering merit at v0.1 / 2-user scale.
- Cost / latency / ops burden: high; rejected without further analysis.

### Option E: KEEP-MONOLITH — same architecture as v0.4.0, no sidecar
- Description: Trust the v0.4.0 ArchSpec assumption that C1–C11 run inside an OpenClaw skill, no bridge needed.
- Pros: Zero new components.
- Cons: Empirically falsified by all three input PRs (skills are markdown manifests, not TypeScript classes). Deploy is currently broken on `main` (Dockerfile `CMD ["node", "dist/index.js"]` MODULE_NOT_FOUND-fails per `tsconfig.json` `rootDir` trap). Does not satisfy PRD-002@0.2.1 §2 G1 (no process boundary for breach detection).
- Cost / latency / ops burden: free in dev; broken in prod.

## Decision

We will use **Option C: HYBRID gateway + sidecar + HTTP bridge**.

Why the losers lost:
- A: `ChannelPlugin` is an unstable undocumented internal API (PR-B's empirical recon); upgrade-fragility makes it unfit for production.
- B: Violates PO Rule 4 without empirical justification; re-implements 4 OpenClaw platform features that PRD-001@0.2.0 §7 explicitly locks.
- D: Triples operational complexity vs HYBRID for no engineering benefit at v0.1 scale.
- E: Empirically falsified; the deploy is currently broken on this assumption.

## Decision Detail

### D1: Topology
Docker Compose internal network with three services: `openclaw-gateway` (Telegram-facing TLS termination + cron + provider failover); `kbju-sidecar` (KBJU business logic on `SERVER_PORT=3001`, internal-only); PostgreSQL (existing). The sidecar exposes no host port-binding.

### D2: Bridge contract
- `POST /kbju/message` — Telegram update (text / voice / photo) → `RussianReplyEnvelope`.
- `POST /kbju/callback` — callback query → `RussianReplyEnvelope`.
- `POST /kbju/cron` — cron trigger (`daily_summary | weekly_summary | monthly_summary`) → `RussianReplyEnvelope` (or null body if user not yet onboarded).
- `GET /kbju/health` — `{status: "ok"|"degraded", uptime_seconds, tenant_count, breach_count_last_hour, stall_count_last_hour}`. Used by gateway healthcheck and Docker.
- Required header on every request: `X-Kbju-Bridge-Version: 1.0`. Sidecar rejects unrecognized versions with HTTP 400.
- Verbatim request/response shapes are pinned in `ARCH-001@0.5.0` §6.1.

### D3: Sidecar boot path
`Dockerfile` `CMD ["node", "dist/src/main.js"]` (the `dist/src/main.js` path corrects the `tsconfig.json` `rootDir="."` trap that currently breaks `main`). `src/main.ts` calls `parseConfig(process.env)` → `createC1Deps(config)` factory → starts HTTP server on `SERVER_PORT`. `C1Deps.sendMessage` returns `RussianReplyEnvelope` as the HTTP response body; no outbound Telegram Bot API connection is opened.

### D4: Reliability and timeouts
30-second HTTP timeout on every bridge call. Sidecar-down → message lost (no durable queue at v0.5.0; accepted per PRD-002@0.2.1 §A.10 R7). Docker Compose `restart: unless-stopped`. Recovery time target ≤10 s.

### D5: Upgrade path
The bridge contract is ArchSpec-owned, not OpenClaw-owned. OpenClaw can be upgraded without breaking the sidecar provided the gateway's bridge adapter still POSTs to `/kbju/message` etc. with the documented payload shape.

### D6: Failure-fallback contingency
If TKT-016@0.1.0 §6 AC validates the **sidecar** side of the bridge but the **gateway** side fails to reach `POST /kbju/message` with real Telegram updates during VPS migration, fall back to a project-owned grammY adapter (PR-A's design) as a parallel Telegram channel that POSTs to the same `/kbju/message` endpoint. OpenClaw remains responsible for non-Telegram channels + cron + provider failover, satisfying PO Rule 4. This contingency is documented in `ARCH-001@0.5.0` §10.4 but NOT executed at v0.5.0; activating it requires a follow-on ADR (not authored at v0.5.0; will be assigned the next free ADR number when needed).

## Consequences

- Positive: PO constraint satisfied; zero rewrite cost on the 15 merged tickets; sidecar boundary enables G1 breach detection at the HTTP edge; bridge contract independently versioned; staged rollout possible (deploy sidecar alongside gateway, toggle via gateway config).
- Negative / trade-offs accepted: +10–50 ms bridge latency; +128–256 MiB RAM; sidecar-down = message loss; gateway-side bridge adapter unproven (synthesis-time S1) — mitigated by §10.4 fallback contingency.
- Follow-up work: TKT-016@0.1.0 (boot entrypoint + bridge handler + Dockerfile fix); TKT-017@0.1.0 (G1 C12 wired into sidecar); TKT-018@0.1.0 (G2 C13 wired into sidecar); TKT-020@0.1.0 (G4 C15 wired into sidecar); a follow-on ADR (not authored at v0.5.0) if the §10.4 grammY fallback contingency is activated.

## Synthesis Citation

This ADR is the canonical synthesis of three independent input ADRs:
- **PR-B** `arch/ARCH-001@0.5.0-v0.5.0-deepseek-deep-context-design` `ADR-011-openclaw-integration-shape.md` — same Decision (Option C HYBRID); contributed the bridge endpoint set, the Q5 reliability stance, and the empirical recon that `ChannelPlugin` is internal/unstable.
- **PR-C** `arch/ARCH-001@0.5.0-v0.5.0-alternatives-design` `ADR-011-runtime-architecture-choice.md` — same Decision (Option E HYBRID); contributed the 5-alternatives evaluation that establishes "all alternatives categorically superior" is empirically false (table preserved in `docs/knowledge/agent-runtime-comparison.md`); contributed the `X-Kbju-Bridge-Version: 1.0` header per Disagreement #5 in `ARCH-001@0.5.0` §0.5.
- **PR-A** `arch/ARCH-001@0.5.0-v0.5.0-integration-layer-and-observability` `ADR-011-runtime-telegram-channel.md` — Option B (REPLACE / abandon-OpenClaw) — **rejected** per PO Rule 4 + lack of empirical proof; preserved as the §10.4 fallback contingency.

## References

- `npm pack openclaw@2026.5.3-1` source inspection (PR-B Recon Report).
- `docs/knowledge/openclaw.md` (synthesis update; §What openclaw closes + §Known gotchas).
- `docs/knowledge/agent-runtime-comparison.md` (PR-C 6-runtime evaluation; preserved verbatim for v0.6+ extensibility).
- `Dockerfile`:10 — `CMD ["node", "dist/index.js"]` (broken; corrected to `dist/src/main.js` by TKT-016@0.1.0).
- `tsconfig.json`:14-15 — `rootDir="."` (the trap that misroutes the `dist/` output).
- `src/telegram/types.ts` — `C1Deps`, `RussianReplyEnvelope`, `TelegramMessage`, `TelegramCallbackQuery`.
- `src/telegram/entrypoint.ts`:35-38 — current `Array.includes()` allowlist (replaced by C15 in TKT-020@0.1.0).
- BACKLOG-009 §runtime-integration-gating-discovery.
- PRD-001@0.2.0 §7 (OpenClaw lock), PRD-002@0.2.1 §2 G1–G4, §A.10 R7, §3 NG1.
- ARCH-001@0.5.0 §0.4 Synthesis Decision Matrix decisions #1, #2, #10, #11, #12, #15.
