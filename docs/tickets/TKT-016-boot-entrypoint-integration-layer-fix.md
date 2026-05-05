---
id: TKT-016
title: "Boot entry point + OpenClaw bridge integration layer"
version: 0.1.0
status: done
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-001@0.2.0; PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "codex-gpt-5.5"
created: 2026-05-04
updated: 2026-05-05
completed_at: 2026-05-05
completed_by: "juarespresswood75 (PO)"
completed_note: |
  TKT-016 closed after Executor PR #116 and Kimi RV-CODE-016 review PR #117 were both merged on 2026-05-05. Implementation final head before squash was 26d0fb165eb188a2452f4c1ebffc7d29d792b1ec after four Executor iterations: iter-1 delivered the boot bridge skeleton but left the C1 seam and cron restricted-context proof incomplete; iter-2 closed the C1 sidecar seam and cron allowlist proof; iter-3 closed the callback tenant-allowlist bypass; iter-4 closed the request-body DoS finding with a 64 KiB limit and 413 payload_too_large tests. Local verification before merge passed: npm run build, npm test (35 files / 678 tests), npm run lint, npm run typecheck, docker compose config, and python3 scripts/validate_docs.py. Qodo PR-Agent final-head review reported tests present, no security concerns, and no major issues. Kimi K2.6 RV-CODE-016 verdict was pass. Model deviation is recorded: ticket assigned codex-gpt-5.5, but PO used DeepSeek V4 Pro fallback because GPT was unavailable; the deviation was accepted only after heightened Devin/Kimi/PR-Agent security scrutiny.
---

# TKT-016: Boot entry point + OpenClaw bridge integration layer

## 1. Goal
Make the Dockerized KBJU sidecar boot and accept versioned HTTP bridge calls from a deterministic OpenClaw bridge plugin.

## 2. In Scope
- Add `src/main.ts` as the sidecar HTTP entrypoint for ADR-011@0.1.0.
- Expose `POST /kbju/message`, `POST /kbju/callback`, `POST /kbju/cron`, and `GET /kbju/health` with `X-Kbju-Bridge-Version: 1.0`.
- Add a repo-owned OpenClaw `kbju-bridge` plugin with `openclaw.plugin.json` manifest and `register(api: PluginApi)` entry point.
- The plugin claims Telegram text/voice/photo messages with `api.on("inbound_claim", handler)`, POSTs to `/kbju/message`, and returns the sidecar reply without invoking the agent.
- Register `kbju_message`, `kbju_cron`, and `kbju_callback` bridge commands/tools for tool-policy allowlists, metrics, and bounded fallback dispatch.
- Cron dispatch MUST run in `DELEGATE_BLOCKED_TOOLS` or an equivalent no-tool/allowlist context that permits only `kbju_cron`.
- Reuse existing business modules behind C1 through HTTP request/response envelopes; do not route Telegram through `src/telegram/entrypoint.ts` in the bridge path.
- Fix Docker runtime command path to the actual TypeScript output path, currently `dist/src/main.js` because `tsconfig.json` has `rootDir: "."`.
- Add process-startup boot-smoke tests in `tests/deployment/**`.

## 3. NOT In Scope
- No raw grammY adapter unless TKT-016 proves OpenClaw Gateway cannot bridge without an ADR amendment.
- No PRD-002@0.2.1 G1/G2/G3/G4 feature implementation beyond endpoint/health seams.
- No OpenClaw source fork.
- No direct Telegram Bot API calls from the KBJU sidecar.
- No OpenClaw skill `handle(input, ctx)` bridge; the bridge is a plugin with hooks/tools.
- No files outside the Executor outputs below.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §2, §6, §10, §11.
- ADR-011@0.1.0.
- PRD-001@0.2.0 §7 and PRD-002@0.2.1 §2 G1-G4.
- `src/index.ts`, `src/telegram/types.ts`, `src/shared/config.ts`, existing business modules behind onboarding/meal/history/summary handlers.
- `Dockerfile`, `docker-compose.yml`, `package.json`, `tsconfig.json`.

## 5. Outputs
- [ ] `src/main.ts` sidecar server entrypoint.
- [ ] `packages/kbju-bridge-plugin/**` or equivalent repo-owned OpenClaw plugin source with `openclaw.plugin.json` and `register(api: PluginApi)`.
- [ ] Sidecar dependency factory module if needed, scoped under `src/`.
- [ ] Tests under `tests/deployment/**` proving startup, health, bridge version header, and failure-on-bad-config.
- [ ] Tests under `tests/telegram/**` or `tests/integration/**` proving `inbound_claim` → `/kbju/message`, `kbju_message` tool registration exists for policy/metrics, `kbju_cron` → `/kbju/cron`, and `kbju_callback` or plugin callback hook → `/kbju/callback` reach the C1 route seams.
- [ ] `Dockerfile` command points to the compiled sidecar entrypoint path.
- [ ] `docker-compose.yml` adds or renames services only as required for `openclaw-gateway` → `kbju-sidecar` internal networking.
- [ ] `package.json` scripts updated only if required to run the compiled sidecar.

## 6. Acceptance Criteria
- [ ] `npm run build` creates the file named by Dockerfile `CMD`, and that file is not `dist/index.js` unless `src/index.ts` has become executable.
- [ ] `npm test -- tests/deployment/bootEntrypoint.test.ts` or an equivalent deployment boot-smoke test passes.
- [ ] The boot-smoke test starts the sidecar process or HTTP server and `GET /kbju/health` returns HTTP 200 with `X-Kbju-Bridge-Version: 1.0`.
- [ ] `POST /kbju/message` with a missing `telegram_id` returns HTTP 400 and a JSON body containing `error: "invalid_request"`.
- [ ] `POST /kbju/message` for a blocked Telegram ID returns HTTP 403 and a JSON body containing `error: "tenant_not_allowed"` without invoking meal/onboarding handlers.
- [ ] A valid mocked Telegram text message is claimed by `inbound_claim`, skips agent dispatch, reaches the C1 sidecar seam exactly once, and returns a Russian reply envelope.
- [ ] Plugin registration test proves `register(api: PluginApi)` installs `inbound_claim`, `kbju_message`, `kbju_cron`, and `kbju_callback`.
- [ ] Cron dispatch is covered by a test where `DELEGATE_BLOCKED_TOOLS` or equivalent restricted bridge context invokes only `kbju_cron` and the sidecar receives exactly one `/kbju/cron` request.
- [ ] Callback dispatch is covered by either a plugin-level callback interception test or a restricted `kbju_callback` tool test; the chosen path is documented in the PR body.
- [ ] `docker compose config` succeeds.
- [ ] `npm run lint`, `npm run typecheck`, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Codex GPT-5.5 is assigned because this ticket touches boot and deployment files.
- Boot-path changes without a process-startup test violate BACKLOG-011 process-retro and are not reviewable.
- Do not log Telegram bot tokens, usernames, raw prompts, raw transcripts, raw media, provider keys, or provider responses.
- If OpenClaw Gateway cannot bridge through public plugin hooks/tools, stop and raise an ADR amendment instead of silently shipping raw grammY.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-016@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-016-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets, then patched with SPIKE-001 inbound_claim plugin findings and SPIKE-002 community ecosystem findings. Executor appends timestamped entries below this line.

<!-- 2026-05-05 Devin Orchestrator closure: PR #116 merged after iter-4 final head 26d0fb165eb188a2452f4c1ebffc7d29d792b1ec and PR #117 merged with Kimi K2.6 RV-CODE-016 verdict pass. TKT-016@0.1.0 is closed as done; next implementation ticket in ARCH-001@0.5.0 sequence is TKT-017@0.1.0 G1 tenant-isolation breach detector. -->

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.
