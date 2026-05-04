# OpenClaw — reference for agents

> Required reading for: **Architect** (Phase 0: Recon), **Executor** (before writing skill code), **Reviewer** (SPEC mode — to spot capability mismatches).
> NOT for **Business Planner** beyond constraint awareness — openclaw is implementation infra, not a product feature.

OpenClaw is a self-hosted gateway / agent-runtime. As of empirical recon on 2026-05-04 against `openclaw@latest` (`OpenClaw 2026.5.3-1`), its `skills` surface is an AgentSkills-compatible instruction/catalog system, not a TypeScript class runtime that directly hosts this repository's KBJU handlers. The PO has locked openclaw as production infrastructure for `openclown-assistant`, but Architects must distinguish OpenClaw gateway/agent capabilities from this repo's Node 24 TypeScript application runtime.

## Sources of truth (always cite when you reference openclaw behaviour)

- Docs: <https://docs.openclaw.ai>
- Source: <https://github.com/openclaw/openclaw>
- Skill catalogue: <https://github.com/VoltAgent/awesome-openclaw-skills> (audited separately in `awesome-skills.md`)

If a claim about openclaw isn't backed by one of these (or a follow-up doc you cite), treat it as unverified.

## What openclaw closes

The Architect MUST map each PRD Goal to whichever of these built-ins covers it. If a built-in covers a Goal, do not re-implement the infrastructure blindly; first verify the current CLI/docs expose a stable integration seam for this repository's application code.

| Capability | What openclaw provides | What we still build |
|---|---|---|
| Telegram channel | Production-ready Telegram gateway/channel backed by grammY, started through `openclaw gateway` when using OpenClaw agent turns | The KBJU v0.1 handler binding is not exposed through the `skills` CLI; use a project-owned Telegram adapter unless a later plugin ADR chooses OpenClaw agent-turn integration |
| Skills | AgentSkills-compatible `SKILL.md` folders discoverable by `openclaw skills list/check/info/install` | Skills are instructions/resources for agents, not this repo's TypeScript class entrypoint contract |
| Plugins | Plugin SDK, manifests, channel plugins, and channel-turn kernel | Native plugin integration is possible but requires a plugin package and routes user events into OpenClaw's agent-turn kernel unless carefully kept plugin-local |
| Gateway | WebSocket gateway with auth/bind/config helpers and channel support | Gateway is operational infrastructure; it does not by itself instantiate `src/telegram/entrypoint.ts` or `C1Deps` |
| Model failover / routing | Agent runtime can be configured for providers; repository model calls still use the project LLM router contract | Keep OmniRoute as the KBJU application boundary per `llm-routing.md` |
| Secret/config handling | Config helpers and env/ref-provider support | `.env.example`, Docker Compose, and application config validation remain project-owned |

## Skill anatomy

OpenClaw AgentSkills are folders containing `SKILL.md` with YAML frontmatter and instruction text. Skill roots include workspace-local `skills/`, `.agents/skills/`, user-level skill folders, and configured extra directories. The CLI commands are `openclaw skills check`, `openclaw skills info`, `openclaw skills install`, `openclaw skills list`, `openclaw skills search`, and `openclaw skills update`.

The following older assumption is **invalid for this repository until a future ADR proves otherwise**:

```text
A skill is a TypeScript class exporting metadata/init/handle/cron.
```

That shape is not supported by the observed `openclaw skills --help` or bundled skills documentation in `openclaw@latest` on 2026-05-04.

## Plugin anatomy

OpenClaw plugins can extend runtime behavior through manifests and SDK subpaths such as `openclaw/plugin-sdk/plugin-entry` and `openclaw/plugin-sdk/channel-core`. Bundled docs distinguish channel-turn ownership: events that may become agent text turns are owned by the channel-turn kernel, while non-message events may remain plugin-local. A KBJU-native OpenClaw plugin would therefore be a separate architectural choice with explicit tests proving Telegram updates reach project handlers without leaking into generic agent turns.

## Historical invalid shape (do not copy into new tickets)

A skill is a TypeScript class exporting:

- `metadata` — name, version, capability tags.
- `init(ctx)` — receives openclaw context (config, secrets, log, db handle if requested).
- `handle(input, ctx)` — the actual handler; receives a typed input event (text, voice, photo, etc.) and returns a structured response.
- Optional `cron(ctx)` — scheduled handler if the skill manifest declares a cron trigger.

This section is retained only so Reviewers can recognize stale ticket language. New tickets must not ask Executors to implement this class shape.

## Hard constraints openclaw imposes on our design

- Do not assume `openclaw skills` can execute repository TypeScript handlers.
- If a future design chooses native OpenClaw plugins/channel integration, it must create an ADR that pins plugin SDK docs and proves whether events are plugin-local or agent-turn-owned.
- If the v0.1 deploy-blocker is only that Telegram updates do not reach `src/telegram/entrypoint.ts`, raw grammY inside this app is the smaller fix than inventing a plugin bridge.
- Node 24 remains the project runtime because the repository already builds as TypeScript on Node 24 and Docker uses `node:24-slim`.
- Secrets and logs still follow ARCH-001 §8/§9 and Docker runtime handling, not undocumented `ctx.secrets` / `ctx.log` assumptions.

## Testing skills

Do not use a nonexistent `openclaw run --skill .` harness in acceptance criteria. For this repo, runtime tests must build or execute the Node entrypoint that actually ships in Docker and must prove a mocked Telegram update reaches `routeMessage` / `routeCallbackQuery` through the real adapter selected by ADR-011.

## What openclaw does NOT close

- Domain logic (KBJU calculation, food lookup, photo macro estimation).
- The runnable KBJU Telegram application adapter for the current TypeScript handlers.
- The food database and lookup adapters.
- Per-user data model.
- Daily / weekly summary content generation (LLM prompt is ours).

These are exactly the components we audit `awesome-skills.md` for fork-candidates against.

## Known gotchas (cite a source before adding to this list)

- 2026-05-04 empirical recon: `openclaw skills --help` exposes AgentSkills catalogue commands only; no TypeScript handler class runtime is advertised.
- 2026-05-04 empirical recon: `openclaw plugins --help` exists, while singular `openclaw plugin --help` is invalid.
- Bundled `docs/channels/telegram.md` in `openclaw@latest` states Telegram support is production-ready via grammY and run through `openclaw gateway`; this is a gateway/channel path, not proof that KBJU's current `src/telegram/entrypoint.ts` is wired.
