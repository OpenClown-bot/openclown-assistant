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
