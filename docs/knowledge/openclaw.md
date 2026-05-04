# OpenClaw — reference for agents

> Required reading for: **Architect** (Phase 0: Recon), **Executor** (before writing any boot-path or sidecar code), **Reviewer** (SPEC mode — to spot capability mismatches).
> NOT for **Business Planner** beyond constraint awareness — openclaw is implementation infra, not a product feature.

OpenClaw is a self-hosted gateway / agent-runtime. As of `ARCH-001@0.5.0` HYBRID synthesis (May 2026), the KBJU Coach **does NOT run as an OpenClaw skill** — it runs as an independent Node 24 sidecar bridged to the OpenClaw Gateway via HTTP. The PO has locked OpenClaw as the production gateway for `openclown-assistant` per PRD-001@0.2.0 §7. Architects design *around* this gateway; they do not revisit it. PR-A's empirical recon (May 2026) refuted the long-standing assumption that OpenClaw skills are TypeScript classes — they are AgentSkills-compatible markdown + YAML manifests. PR-B and PR-C converged independently on the HYBRID gateway-plus-sidecar topology canonical in `ARCH-001@0.5.0`.

## Sources of truth (always cite when you reference openclaw behaviour)

- Docs: <https://docs.openclaw.ai>
- Source: <https://github.com/openclaw/openclaw>
- Skill catalogue: <https://github.com/VoltAgent/awesome-openclaw-skills> (audited separately in `awesome-skills.md`)
- Six-runtime alternatives audit: `docs/knowledge/agent-runtime-comparison.md` (PR-C original; preserved verbatim for v0.6+ extensibility).

If a claim about openclaw isn't backed by one of these (or a follow-up doc you cite), treat it as unverified.

## What OpenClaw closes (≈55–60% of v0.1 infrastructure under the HYBRID topology)

The Architect MUST map each PRD Goal to whichever of these built-ins covers it. If a built-in covers a Goal, **do not re-implement it** — call it through the gateway-bridge contract.

| Capability | What openclaw provides | What we still build |
|---|---|---|
| Telegram channel | TLS termination, bot adapter, update loop, message routing to gateway-side handlers | Bridge adapter that forwards updates to the KBJU sidecar via `POST /kbju/message` |
| Voice transcription wake-word | Pre-routes voice messages via `VoiceWake` plugin | The transcription skill body (we either fork or write — see `awesome-skills.md`) |
| Sandbox / process isolation | Each skill runs in a sandboxed Node 24 process | — |
| Multi-agent routing | Routes a single user input through a chain of skills | The chain config (declarative) |
| Cron / scheduled triggers | `cron-tools` plugin for periodic skill invocation | Cron-payload bridge call to `POST /kbju/cron` |
| Model failover | Built-in retry across providers when one returns error | Provider list (fed to OmniRoute via `llmRouter.call()`; see `llm-routing.md`) |
| Observability hooks | Per-skill logs, latency metrics, token spend | Concrete log format (ArchSpec §8) emitted from the sidecar back through the gateway |
| Secret injection | Env-var based, no in-code keys | `.env.example` schema (ArchSpec §9) |

## What OpenClaw does NOT close (HYBRID-aware list)

- Domain logic (KBJU calculation, food lookup, photo macro estimation) — KBJU sidecar.
- Per-user data model and PostgreSQL RLS — KBJU sidecar (ADR-001@0.1.0).
- Tenant-isolation breach detection (G1, C12) — KBJU sidecar (TKT-017@0.1.0).
- Model stall watchdog (G2, C13) — KBJU sidecar (TKT-018@0.1.0).
- Allowlist hot-reload (G4, C15) — KBJU sidecar (TKT-020@0.1.0).
- The food database (we add OpenFoodFacts client in our own code — pending ADR).
- Daily / weekly summary content generation (LLM prompt is ours).

These are exactly the components we audit `awesome-skills.md` (and `agent-runtime-comparison.md`) for fork-candidates against.

## KBJU Coach Bridge Adapter (ADR-011@0.1.0 HYBRID topology)

As of `ARCH-001@0.5.0` (May 2026), the KBJU Coach runs as an **independent Node 24 process** (sidecar) bridged to the OpenClaw Gateway via HTTP. This architecture was chosen because:

1. OpenClaw skills are AgentSkills-compatible `.md` instruction files plus YAML manifests, **not** TypeScript classes — KBJU's PostgreSQL access, KBJU estimation logic, and stateful onboarding cannot be expressed as markdown.
2. OpenClaw's `ChannelPlugin` interface is an undocumented internal API, **not** a documented external surface — implementing it directly breaks on every OpenClaw upgrade (verified via `npm pack openclaw@2026.5.3-1` source inspection — PR-B Recon Report).
3. The PO mandates `«не отказываться от опенкло 100%»` — OpenClaw must remain load-bearing for Telegram + cron + provider failover.

### Bridge contract (verbatim — pinned in `ARCH-001@0.5.0` §6.1)

| Endpoint | Direction | Payload | Required header |
|---|---|---|---|
| `POST /kbju/message` | Gateway → Sidecar | Telegram text/voice/photo/sticker update → `RussianReplyEnvelope` | `X-Kbju-Bridge-Version: 1.0` |
| `POST /kbju/callback` | Gateway → Sidecar | Inline keyboard callback → `RussianReplyEnvelope` | `X-Kbju-Bridge-Version: 1.0` |
| `POST /kbju/cron` | Gateway → Sidecar | Cron trigger (daily/weekly/monthly summary) → `RussianReplyEnvelope` or null | `X-Kbju-Bridge-Version: 1.0` |
| `GET /kbju/health` | Gateway → Sidecar | `200 {"status":"ok"|"degraded", uptime_seconds, ...}` / `503` | `X-Kbju-Bridge-Version: 1.0` |

Unrecognized bridge versions return HTTP 400. The bridge contract is ArchSpec-owned, not OpenClaw-owned — OpenClaw upgrades are non-breaking provided the gateway-side bridge adapter still POSTs the documented payload shape.

### Access control (two-layer)

1. **Bridge adapter** (OpenClaw Gateway side, OUT-OF-REPO): checks `config/allowlist.json` → silently drops non-allowlisted updates before forwarding.
2. **C1 entrypoint** (KBJU sidecar side): redundantly checks `deps.allowlist.isAllowed(telegramUserId)` before dispatching to handlers (per TKT-020@0.1.0).

### What the KBJU sidecar NEVER does
- Never calls the Telegram Bot API directly. All outbound goes through the gateway send-message bridge endpoint.
- Never reads `FIREWORKS_API_KEY` directly — all LLM calls go through OmniRoute via `llmRouter.call()`.
- Never stores raw prompts, raw audio, or raw photos in logs or durable storage.
- Never persists data without `user_id` scoping.

### Key constraints for Executor tickets
- Bridge payload is synchronous HTTP (no queueing, no buffering). Sidecar-down = message lost (accepted at v0.5.0 per PRD-002@0.2.1 §A.10 R7).
- KBJU sidecar is `restart: unless-stopped` in Docker Compose. Recovery time target ≤10 s.
- All env vars are injected via Docker environment, not `.env` files at runtime.
- HTTP port is `SERVER_PORT` (default 3001). Internal Docker network only — no host port binding.
- `C1Deps.sendMessage` returns `RussianReplyEnvelope` as the HTTP response body.

### §10.4 grammY fallback contingency (ADR-011@0.1.0)

If TKT-016@0.1.0 §6 AC validates the **sidecar** side of the bridge but the **gateway** side fails to reach `POST /kbju/message` with real Telegram updates during VPS migration, the design includes a fallback path: a project-owned grammY adapter (PR-A's design, preserved as a contingency) becomes a parallel Telegram channel that POSTs to the same `/kbju/message` endpoint. OpenClaw remains responsible for non-Telegram channels + cron + provider failover, satisfying the PO Rule 4 «keep OpenClaw» constraint. This contingency is documented in `ARCH-001@0.5.0` §10.4 but NOT executed at v0.5.0; activation requires a follow-on ADR-014.

## Hard constraints OpenClaw imposes on our design (HYBRID-aware)

- **Language:** TypeScript on Node 24 for the KBJU sidecar; OpenClaw Gateway itself is a separate runtime (no language constraint imposed on KBJU).
- **No long-running daemons inside the gateway.** Long tasks live in the sidecar; gateway routes events.
- **Secret access** in the sidecar is via `process.env` (Docker-injected); never embed in code; PRD-002@0.2.1 §7 redaction rules apply to all logs.
- **Logs** are emitted via `src/observability/events.ts:emitLog` (structured JSON to stdout); Docker's `json-file` driver captures them.
- **Bridge versioning:** the sidecar enforces `X-Kbju-Bridge-Version: 1.0` strictly. Future bridge versions require an ADR + a parallel-run window.

## Testing skills (legacy — superseded by HYBRID smoke test)

The pre-HYBRID `openclaw run --skill .` harness is no longer the test surface. The canonical boot-smoke test is `tests/deployment/main.smoke.test.ts` (TKT-016@0.1.0) — it builds the Dockerfile, starts the kbju-sidecar container, hits `/kbju/health`, and asserts a `kbju_sidecar_ready` log line. This is the BACKLOG-011 §process-retro mandate: **any TKT touching boot-path files MUST include a process-startup test**.

## Known gotchas (cite a source before adding to this list)

- **Dockerfile rootDir trap**: `tsconfig.json` `rootDir="."` compiles to `dist/src/main.js`, not `dist/main.js`. A mismatched `Dockerfile` `CMD` produces `MODULE_NOT_FOUND` on container start. (Source: BACKLOG-009 §runtime-integration-gating-discovery; ADR-011@0.1.0 D3; resolved by TKT-016@0.1.0.)
- **Skills are markdown, not TypeScript**: The `openclaw gateway` routes Telegram messages to its embedded LLM agent — NOT to KBJU's `routeMessage()` handler. Even with a correct `src/index.ts`, the handler is never called unless the gateway-side bridge adapter explicitly proxies updates to the sidecar's `POST /kbju/message`. (Source: PO forensics 2026-05-04, `npm pack openclaw@2026.5.3-1` source inspection in PR-B Recon Report.)
- **Allowlist `fs.watch` reliability**: Docker's `overlay2` storage driver and `ext4` bind-mounts may not reliably propagate inotify events. The KBJU sidecar ALWAYS includes a 5 s polling fallback comparing `fs.statSync(path).mtime` to last-loaded mtime. If you skip this, allowlist edits made from outside the container may never take effect. (Source: ADR-013@0.1.0 §D3; <https://docs.docker.com/engine/storage/drivers/overlayfs-driver/>.)
- **C12 is a detection overlay, not a replacement for RLS**: The breach detector is alert-only. If PostgreSQL RLS fails AND C12 also fails, the only fallback is the end-of-pilot K4 audit. Do not rely on C12 as a primary guard. (Source: ADR-001@0.1.0; ARCH-001@0.5.0 §3.12.)
- **C13 stall watchdog wraps `llmRouter.call()` only**: There is no parallel LLM call site to wrap. If you add a new LLM call site that bypasses `llmRouter.call()`, you will silently disable G2 stall detection on that path. The TKT-018@0.1.0 `tests/llm/stallWatchdog.streaming.test.ts` matrix does NOT cover bypassed paths — REVIEW this if introducing a new call site. (Source: ADR-012@0.1.0; ARCH-001@0.5.0 §3.13.)
- **Bridge-adapter on the gateway side is unproven** (synthesis-time S1 — `ARCH-001@0.5.0` §0.6): The sidecar side of the bridge is fully testable in isolation (TKT-016@0.1.0 §6 AC), but the gateway side has no working reference implementation on the OpenClaw runtime. The §10.4 grammY fallback contingency mitigates this risk. (Source: ARCH-001@0.5.0 §0.6 S1; ADR-011@0.1.0 D6.)

## Skill anatomy (legacy reference — KEPT for historical clarity)

> **NOTE:** The pre-HYBRID skill anatomy below is preserved for historical clarity and for any future v0.6+ work that may revisit the in-process-skill option. None of the v0.5.0 components are skills.

A pre-HYBRID skill was envisioned as a TypeScript class exporting `metadata`, `init(ctx)`, `handle(input, ctx)`, optional `cron(ctx)`. PR-A's empirical recon (May 2026) refuted this assumption. Skills in OpenClaw `2026.5.3-1` are AgentSkills-compatible `.md` instruction files plus YAML manifests; the OpenClaw Gateway dispatches messages to its embedded LLM agent which interprets the markdown, not to a TypeScript handler.
