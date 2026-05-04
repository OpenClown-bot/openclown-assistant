---
id: TKT-016
title: "Boot entry point + OpenClaw bridge integration layer"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-001@0.2.0; PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "codex-gpt-5.5"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-016: Boot entry point + OpenClaw bridge integration layer

## 1. Goal
Make the Dockerized KBJU sidecar boot and accept versioned HTTP bridge calls from OpenClaw Gateway.

## 2. In Scope
- Add `src/main.ts` as the sidecar HTTP entrypoint for ADR-011@0.1.0.
- Expose `POST /kbju/message`, `POST /kbju/callback`, `POST /kbju/cron`, and `GET /kbju/health` with `X-Kbju-Bridge-Version: 1.0`.
- Wire existing C1 routing seams from `src/telegram/entrypoint.ts` through HTTP request/response envelopes.
- Fix Docker runtime command path to the actual TypeScript output path, currently `dist/src/main.js` because `tsconfig.json` has `rootDir: "."`.
- Add process-startup boot-smoke tests in `tests/deployment/**`.

## 3. NOT In Scope
- No raw grammY adapter unless TKT-016 proves OpenClaw Gateway cannot bridge without an ADR amendment.
- No PRD-002@0.2.1 G1/G2/G3/G4 feature implementation beyond endpoint/health seams.
- No OpenClaw source fork.
- No direct Telegram Bot API calls from the KBJU sidecar.
- No files outside the Executor outputs below.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §2, §6, §10, §11.
- ADR-011@0.1.0.
- PRD-001@0.2.0 §7 and PRD-002@0.2.1 §2 G1-G4.
- `src/index.ts`, `src/telegram/entrypoint.ts`, `src/telegram/types.ts`, `src/shared/config.ts`.
- `Dockerfile`, `docker-compose.yml`, `package.json`, `tsconfig.json`.

## 5. Outputs
- [ ] `src/main.ts` sidecar server entrypoint.
- [ ] Sidecar dependency factory module if needed, scoped under `src/`.
- [ ] Tests under `tests/deployment/**` proving startup, health, bridge version header, and failure-on-bad-config.
- [ ] Tests under `tests/telegram/**` or `tests/integration/**` proving `/kbju/message` and `/kbju/callback` reach the C1 route seams.
- [ ] `Dockerfile` command points to the compiled sidecar entrypoint path.
- [ ] `docker-compose.yml` adds or renames services only as required for `openclaw-gateway` → `kbju-sidecar` internal networking.
- [ ] `package.json` scripts updated only if required to run the compiled sidecar.

## 6. Acceptance Criteria
- [ ] `npm run build` creates the file named by Dockerfile `CMD`, and that file is not `dist/index.js` unless `src/index.ts` has become executable.
- [ ] `npm test -- tests/deployment/bootEntrypoint.test.ts` or an equivalent deployment boot-smoke test passes.
- [ ] The boot-smoke test starts the sidecar process or HTTP server and `GET /kbju/health` returns HTTP 200 with `X-Kbju-Bridge-Version: 1.0`.
- [ ] `POST /kbju/message` with a missing `telegram_id` returns HTTP 400 and a JSON body containing `error: "invalid_request"`.
- [ ] `POST /kbju/message` for a blocked Telegram ID returns HTTP 403 and a JSON body containing `error: "tenant_not_allowed"` without invoking meal/onboarding handlers.
- [ ] A valid mocked text message reaches `routeMessage` or the C1 adapter seam exactly once and returns a Russian reply envelope.
- [ ] `docker compose config` succeeds.
- [ ] `npm run lint`, `npm run typecheck`, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Codex GPT-5.5 is assigned because this ticket touches boot and deployment files.
- Boot-path changes without a process-startup test violate BACKLOG-011 process-retro and are not reviewable.
- Do not log Telegram bot tokens, usernames, raw prompts, raw transcripts, raw media, provider keys, or provider responses.
- If OpenClaw Gateway cannot bridge without unstable internals, stop and raise an ADR amendment instead of silently shipping raw grammY.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-016@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-016-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets. Executor appends timestamped entries below this line.

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.

