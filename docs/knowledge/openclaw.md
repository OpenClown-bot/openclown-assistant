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

### Architect-3 empirical findings (v0.5.0 alternatives-design, 2026-05-04)

**G1: No built-in subagent delegation or external HTTP routing from Telegram handler.**
OpenClaw's skill anatomy (^ §Skill anatomy) routes Telegram updates to a single skill's `handle()` method.
There is no documented pattern for a skill to POST to an external HTTP endpoint and await a response
mid-handler. The HYBRID architecture (ADR-011) requires building a custom bridge adapter within the
OpenClaw Gateway's ChannelPlugin adapter — this is unproven on the openclaw runtime.
Source: openclaw.md §Skill anatomy (`handle(input, ctx)` interface); §Hard constraints ("No long-running
daemons inside a skill").

**G2: Skills are stateless across calls — sidecar process boundary is a separate concern.**
openclaw sandbox per skill (^ §What openclaw closes) provides process isolation at the skill level,
but does NOT provide HTTP-server lifecycle management for a sidecar process. Docker Compose must
manage the KBJU sidecar as a separate service (ADR-011 §4).
Source: openclaw.md:24 "Each skill runs in a sandboxed Node 24 process" — sandbox is per-skill invocation,
not per-HTTP-server.

**G3: `ctx.log` vs `console.log` — observability hooks require the former.**
The KBJU sidecar, running outside openclaw's sandbox, cannot use `ctx.log`. Structured JSON logging
to stdout (captured by Docker logging driver) is the equivalent pattern for the sidecar.
Source: openclaw.md:48 "Logs are emitted via `ctx.log`, not `console.log`."

**G4: Cron triggers are openclaw-internal (`cron-tools` plugin) — sidecar cron must route through Gateway.**
KBJU sidecar daily summaries are triggered by OpenClaw Gateway POSTing to `/kbju/cron` on schedule,
not by the sidecar's own cron. Sidecar has no direct Telegram Bot API access.
Source: openclaw.md:26 "`cron-tools` plugin for periodic skill invocation."

### HTTP Bridge Contract (designed by Architect-3, ADR-011)

The KBJU sidecar exposes four endpoints on an internal Docker network:

- `POST /kbju/message` — primary endpoint. Accepts `{telegram_id, text, source, message_id, chat_id}`, returns `{reply_text, needs_confirmation, reply_to_message_id}`. Error codes: 400 (invalid), 403 (not allowed), 500 (internal), 503 (degraded).
- `POST /kbju/callback` — async callback handler. Accepts `{callback_data, telegram_id, message_id}`, returns `{reply_text, edit_message_id}`.
- `POST /kbju/cron` — cron trigger endpoint. Accepts `{trigger, timezone}`, returns `{summary_sent_to, skipped_count}`.
- `GET /kbju/health` — health check. Returns `{status, uptime_seconds, tenant_count, breach_count_last_hour, stall_count_last_hour}`.

All endpoints include header `X-Kbju-Bridge-Version: 1.0`. Versioning is independent of openclaw's internal plugin API.

### Subagent-Delegation Pattern (forked from hermes-agent)

Source: hermes-agent `delegate_tool.py:1836-1878` (thread-pool children with `goal+context+toolsets` contract).

Forked into KBJU sidecar as: the `POST /kbju/message` JSON body is the delegation contract —
`telegram_id` = identity, `text` = goal+context, `source` = capability selector. The sidecar internally
routes to C4 (meal logging) / C2 (onboarding) / C8 (history) / C9 (summary) based on `source` +
message content. Subagent status tracking (`initializing|awaiting_llm|final_response|done|error`)
is derived from nanobot's `SubagentManager` status phases (`agent/subagent.py:1-47`).

### Model-Stall Algorithm (forked from zeroclaw)

Source: zeroclaw `stall_watchdog.rs:29-124` (AtomicU64 timestamp + background Tokio task polling at
`timeout/2` + callback on stall).

Ported to TypeScript as C13 StallWatchdog middleware (ADR-012):
- `lastTokenAt = Date.now()` — equivalent to `AtomicU64.touch()`
- `setInterval(STALL_THRESHOLD_MS / 2, checkStall)` — equivalent to background Tokio task
- On stall: `AbortController.abort()` + fallback to OpenClaw's primary provider (GPT-5.3 via OmniRoute)

The Rust impl monitors channel transport stalls (Discord websocket keepalive, `discord.rs:1060-1084`).
The TypeScript port monitors LLM call token velocity — a different abstraction layer but same algorithmic
pattern.


### Architect-4 synthesis update (ARCH-001@0.5.0 PR-D, 2026-05-04)

Architect-4 preserves the PR-C empirical gotcha but makes the canonical decision explicit: OpenClaw remains load-bearing as Telegram/channel/cron gateway, while KBJU business logic runs in a Node 24 sidecar over a versioned HTTP bridge. This does **not** assume OpenClaw AgentSkills are TypeScript handler classes; TKT-016@0.1.0 must prove a gateway bridge adapter or stop for an ADR amendment. If the bridge cannot be built without unstable internals, Executor must not silently fall back to raw grammY.

Canonical bridge endpoints from ADR-011@0.1.0:
- `POST /kbju/message`
- `POST /kbju/callback`
- `POST /kbju/cron`
- `GET /kbju/health`

All bridge requests/responses carry `X-Kbju-Bridge-Version: 1.0`; the sidecar stays on the internal Docker network only.
