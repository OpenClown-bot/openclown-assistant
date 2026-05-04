---
id: ADR-011
title: "OpenClaw Integration Shape"
status: proposed
arch_ref: ARCH-001@0.5.0
author_model: "gpt-5.5-xhigh"
created: 2026-05-04
updated: 2026-05-04
superseded_by: null
---

# ADR-011: OpenClaw Integration Shape

## Context
ARCH-001@0.4.0 assumed OpenClaw `skills` were TypeScript handler classes that could directly host KBJU components. Phase-0 recon for ARCH-001@0.5.0 found that assumption false for the observed runtime: `openclaw skills --help` exposes AgentSkills catalogue commands, while `openclaw plugins --help` and bundled plugin/channel docs expose a separate plugin SDK. The repository meanwhile already has TypeScript C1 handlers in `src/telegram/entrypoint.ts`, but `src/index.ts` is a barrel file and Docker currently attempts to run `dist/index.js`, which is not the compiled path produced by the current `tsconfig.json`.

The immediate architectural problem is therefore narrower than a full OpenClaw-native rewrite: the v0.1 container must start an executable Node 24 process and route real Telegram updates to existing KBJU handlers. PRD-002@0.2.1 observability and scale-readiness work depends on that runnable integration layer because breach detection, model-stall detection, PR-Agent telemetry, and allowlist load tests are not meaningful if no runtime update reaches C1.

## Options Considered (>=3 real options, no strawmen)
### Option A: OpenClaw AgentSkill registration
- Description: Treat KBJU components as OpenClaw skills and register them through `openclaw skills`.
- Pros (concrete): Keeps all user-facing dispatch nominally inside OpenClaw; no new Telegram runtime dependency.
- Cons (concrete, with sources): Observed `openclaw skills --help` lists `check`, `info`, `install`, `list`, `search`, and `update` for AgentSkills-style instruction folders, not a TypeScript handler runtime. Bundled `docs/tools/skills.md` describes `SKILL.md` folders, not `metadata/init/handle/cron` exports. This option does not explain how Telegram updates instantiate `C1Deps` or call `routeMessage`.
- Cost / latency / ops burden: High uncertainty and high integration risk because the expected runtime seam is not present.

### Option B: OpenClaw native plugin/channel bridge
- Description: Build an OpenClaw plugin or channel extension that receives Telegram events and invokes KBJU project handlers.
- Pros: Uses a real OpenClaw extension mechanism; could eventually align product dispatch with OpenClaw gateway/channel infrastructure.
- Cons: Bundled plugin docs route message-like events through a channel-turn kernel intended for agent turns unless events are deliberately kept plugin-local. Building a safe bridge is materially larger than the deploy-blocker fix and would need its own plugin package, manifest, lifecycle tests, and proof that KBJU product events do not leak into generic agent context.
- Cost / latency / ops burden: Medium-to-high implementation burden; extra review surface around event ownership and plugin lifecycle.

### Option C: Raw grammY adapter inside the KBJU Node app
- Description: Add a project-owned Node 24 executable entrypoint that starts a grammY bot, normalizes Telegram updates/callbacks, applies C15/C1 access control, and calls existing `routeMessage` / `routeCallbackQuery` handlers.
- Pros: Smallest path from Telegram update to current TypeScript handlers; grammY is the same Telegram library named by bundled OpenClaw Telegram docs; easy to boot-smoke by mocking a Telegram update and asserting the real handler call; keeps existing Docker Compose and C10 logging/metrics contracts.
- Cons: Product Telegram dispatch is not OpenClaw-native in v0.1; a future OpenClaw plugin/gateway integration would require another ADR and migration ticket.
- Cost / latency / ops burden: Low implementation burden; one explicit runtime dependency (`grammy`) and direct tests for startup/update routing.

### Option D: Custom Telegram Bot API client
- Description: Implement long polling or webhook handling directly with `fetch`/HTTPS without a Telegram framework.
- Pros: No third-party Telegram library dependency; complete control over request/response mapping.
- Cons: Reimplements update parsing, callback handling, file metadata handling, retry/rate-limit behavior, and test helpers that grammY already provides. It does not improve OpenClaw alignment and increases bug surface in the product channel.
- Cost / latency / ops burden: Medium burden and higher maintenance risk than grammY.

## Decision
We will use **Option C: Raw grammY adapter inside the KBJU Node app** for v0.1 runnable integration.

Why the losers lost:
- Option A: The observed `skills` surface is an instruction/catalogue system, not a TypeScript handler host.
- Option B: Native plugin/channel integration is plausible but too heavy for the current deploy blocker and needs a separate event-ownership ADR before product use.
- Option D: A custom Bot API client duplicates grammY without buying OpenClaw integration or better testability.

Implementation rules:
- `src/main.ts` is the executable application entrypoint and must emit `[gateway] ready` only after Telegram adapter startup and dependency wiring succeed.
- Docker must run the compiled path that TypeScript actually emits, currently `dist/src/main.js` unless `tsconfig.json` changes.
- Runtime boot-smoke tests are mandatory for changes touching `src/main.ts`, `src/index.ts`, `Dockerfile`, `docker-compose.yml`, `src/deployment/**`, or `src/telegram/entrypoint.ts`.
- TKT-016@0.1.0 may add `grammy` as the only new runtime dependency allowed by this ADR.
- OpenClaw remains production infrastructure and a future plugin/gateway integration candidate, but no ticket may claim OpenClaw AgentSkills host KBJU TypeScript handlers without a new ADR.

## Consequences
- Positive: The next Executor ticket can make the container runnable and prove mocked Telegram updates reach the real C1 routing functions.
- Positive: PRD-002@0.2.1 G1-G4 implementation can build on a real boot path instead of mocked module-level tests.
- Negative / trade-offs accepted: The v0.1 product Telegram path is project-owned rather than OpenClaw-native.
- Follow-up work: A future ADR may revisit OpenClaw native plugin/channel integration after v0.1 has a working runtime and tests can compare behavior.

## References
- ARCH-001@0.5.0 §0.1, §3.1, §4.9, §10.1.
- PRD-001@0.2.0 §7 Technical Envelope.
- PRD-002@0.2.1 §2 G1-G4.
- `docs/knowledge/openclaw.md` 2026-05-04 recon update.
- OpenClaw CLI empirical checks: `openclaw skills --help`, `openclaw plugins --help`, `openclaw gateway --help`, `openclaw config --help` on `OpenClaw 2026.5.3-1`.
- Bundled OpenClaw docs from `openclaw@latest`: `docs/tools/skills.md`, `docs/plugins/sdk-overview.md`, `docs/plugins/sdk-channel-turn.md`, `docs/channels/telegram.md`.
- grammY documentation: <https://grammy.dev>.
