# OpenClaw — reference for agents

> Required reading for: **Architect** (Phase 0: Recon), **Executor** (before writing skill code), **Reviewer** (SPEC mode — to spot capability mismatches).
> NOT for **Business Planner** beyond constraint awareness — openclaw is implementation infra, not a product feature.

OpenClaw is a self-hosted gateway / agent-runtime that hosts "skills" written in **TypeScript on Node 24**. The PO has locked openclaw as the production runtime for `openclown-assistant`. Architects design *within* this runtime; they do not revisit it.

## Sources of truth (always cite when you reference openclaw behaviour)

- Docs: <https://docs.openclaw.ai>
- Source: <https://github.com/openclaw/openclaw>
- Skill catalogue: <https://github.com/VoltAgent/awesome-openclaw-skills> (audited separately in `awesome-skills.md`)

If a claim about openclaw isn't backed by one of these (or a follow-up doc you cite), treat it as unverified.

## What openclaw closes (≈60–70% of v0.1 infrastructure)

The Architect MUST map each PRD Goal to whichever of these built-ins covers it. If a built-in covers a Goal, **do not re-implement it** — call it through the skill API.

| Capability | What openclaw provides | What we still build |
|---|---|---|
| Telegram channel | Bot adapter, update loop, message routing | Per-user state, business logic for our slash-commands |
| Voice transcription wake-word | Pre-routes voice messages to a transcription skill via `VoiceWake` | The skill itself (we either fork or write — see `awesome-skills.md`) |
| Sandbox / process isolation | Each skill runs in a sandboxed Node 24 process | — |
| Multi-agent routing | Routes a single user input through a chain of skills | The chain config (declarative) |
| Cron / scheduled triggers | `cron-tools` plugin for periodic skill invocation | Schedule definitions for daily / weekly summaries |
| Model failover | Built-in retry across providers when one returns error | Provider list (we feed OmniRoute as the primary; see `llm-routing.md`) |
| Observability hooks | Per-skill logs, latency metrics, token spend | Concrete log format (ArchSpec §8) |
| Secret injection | Env-var based, no in-code keys | `.env.example` schema (ArchSpec §9) |

## Skill anatomy (what the Executor will write)

A skill is a TypeScript class exporting:

- `metadata` — name, version, capability tags.
- `init(ctx)` — receives openclaw context (config, secrets, log, db handle if requested).
- `handle(input, ctx)` — the actual handler; receives a typed input event (text, voice, photo, etc.) and returns a structured response.
- Optional `cron(ctx)` — scheduled handler if the skill manifest declares a cron trigger.

Skills are **stateless across calls** unless they declare a persistent store via openclaw (we declare SQLite for KBJU history — pending ADR).

## Hard constraints openclaw imposes on our design

- **Language:** TypeScript on Node 24. No Python, Go, Rust skills. (Polyglot via subprocess is technically possible but adds an ADR's worth of trade-off — Architect must justify if proposed.)
- **Skill granularity:** one skill = one cohesive capability. A single skill that does "log meal + summarise day + send weekly report" is wrong. Split.
- **No long-running daemons inside a skill.** If you need a long task, schedule it via `cron-tools` or expose a webhook endpoint.
- **Secret access** is via `ctx.secrets`, not `process.env` directly.
- **Logs** are emitted via `ctx.log`, not `console.log`. Otherwise observability hooks miss them.

## Testing skills

OpenClaw provides a local harness (`openclaw run --skill .`) that boots the skill in dev mode with mocked Telegram input. Executor tickets that touch skills should use this harness in their AC, not a full openclaw deployment.

## What openclaw does NOT close

- Domain logic (KBJU calculation, food lookup, photo macro estimation).
- The food database (we add OpenFoodFacts client in our own code — pending ADR).
- Per-user data model (we own the schema — pending ADR).
- Daily / weekly summary content generation (LLM prompt is ours).

These are exactly the components we audit `awesome-skills.md` for fork-candidates against.

## Known gotchas (cite a source before adding to this list)

- *(empty — append entries with citation as we hit them in development)*

## KBJU Coach Bridge Adapter (ADR-011@0.1.0 HYBRID topology)

As of May 2026, the KBJU Coach does NOT run as an openclaw skill. It runs as an **independent Node 24 process** (sidecar) bridged to the OpenClaw Gateway via HTTP. This architecture was chosen because:

1. OpenClaw skills are `.md` instruction files, not TypeScript classes — our PostgreSQL, KBJU estimation, and stateful onboarding logic cannot be expressed as markdown.
2. OpenClaw's `ChannelPlugin` interface is an internal API, not a documented external surface — implementing it breaks on OpenClaw upgrades.
3. The PO mandates `«не отказываться от опенкло 100%»` — OpenClaw must remain load-bearing.

### Bridge contract

| Endpoint | Direction | Payload |
|---|---|---|
| `POST /kbju/message` | Gateway → Sidecar | Telegram text/voice/photo/sticker update → `RussianReplyEnvelope` |
| `POST /kbju/callback` | Gateway → Sidecar | Inline keyboard callback → `RussianReplyEnvelope` |
| `POST /kbju/cron` | Gateway → Sidecar | Cron trigger (daily summary) → `RussianReplyEnvelope` |
| `GET /kbju/health` | Gateway → Sidecar | `200 {"status":"ok"}` / `503` |

### Access control (two-layer)

1. **Bridge adapter** (OpenClaw Gateway side): checks `config/allowlist.json` → `Set<string>` — silently drops non-allowlisted updates before forwarding.
2. **C1 entrypoint** (KBJU sidecar side): redundantly checks `allowlist.isAllowed(telegramUserId)` before dispatching to handlers.

### What KBJU sidecar NEVER does
- Never calls Telegram Bot API directly (all outbound goes through bridge adapter → OpenClaw outbound).
- Never reads raw `FIREWORKS_API_KEY` — all LLM calls go through OmniRoute via `llmRouter.call()`.
- Never stores raw prompts, raw audio, or raw photos in logs or durable storage.
- Never persists data without `user_id` scoping.

### Key constraints for Executor tickets
- Bridge payload is synchronous HTTP (no queueing, no buffering). Sidecar-down = message lost.
- KBJU sidecar is `restart: unless-stopped` in Docker Compose. Recovery time ~5–10 s.
- All env vars are injected via Docker environment, not `.env` files at runtime.
- HTTP port is `SERVER_PORT` (default 3001). Internal Docker network only.
- `C1Deps.sendMessage` returns `RussianReplyEnvelope` as HTTP response body.

### Known gotchas (May 2026)

- **Dockerfile rootDir trap**: `tsconfig.json` `rootDir="."` compiles to `dist/src/main.js`, not `dist/main.js`. A mismatched Dockerfile `CMD` produces `MODULE_NOT_FOUND`. (Source: BACKLOG-009, ADR-011@0.1.0 Q3)
- **Skills are markdown, not TypeScript**: The `openclaw gateway` routes Telegram messages to its embedded LLM agent, not to our `routeMessage()` handler. Even with a correct `src/index.ts`, the handler is never called unless a bridge adapter explicitly proxies calls. (Source: PO forensics 2026-05-04, ADR-011@0.1.0 §0)
- **Allowlist fs.watch reliability**: Docker overlay2/ext4 may not reliably propagate inotify events. The KBJU sidecar ALWAYS includes a 5 s polling fallback checking `fs.stat.mtime`. If you skip this, allowlist changes may never take effect. (Source: ADR-013@0.1.0 Q4)
- **C10b is a detection overlay, not a replacement for RLS**: The breach detector is an alert-only mechanism. If PostgreSQL RLS fails AND C10b also fails, the only fallback is the end-of-pilot K4 audit. Do not rely on C10b as a primary guard. (Source: ARCH-001@0.5.0 §3.10b)
