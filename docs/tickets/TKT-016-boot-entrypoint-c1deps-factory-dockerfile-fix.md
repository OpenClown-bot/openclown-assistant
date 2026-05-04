---
id: TKT-016
title: "Boot Entry Point + C1Deps Factory + Dockerfile Fix + Container Smoke Test"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C1 Access-Controlled Telegram Entrypoint; C10d Allowlist Reload Service"
depends_on: []
blocks: ["TKT-017@0.1.0", "TKT-018@0.1.0", "TKT-020@0.1.0"]
estimate: M
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-016: Boot Entry Point + C1Deps Factory + Dockerfile Fix + Container Smoke Test

## 1. Goal
Make the KBJU Coach process runnable end-to-end by creating a boot entry point that constructs C1Deps, starts an HTTP server, dispatches to routeMessage/routeCallbackQuery/routeCronEvent, and builds+starts inside a Docker container with a smoke-test assertion.

## 2. In Scope
- `src/main.ts` — boot entry point
- `src/main.factory.ts` — C1Deps construction from env vars
- `src/telegram/bridge-handler.ts` — HTTP dispatch layer
- `config/allowlist.json` — initial 2-entry allowlist
- `Dockerfile` — multi-stage build, fix CMD path
- `docker-compose.yml` — add `kbju-sidecar` service
- `tests/main.smoke.test.ts` — container start + health check smoke test
- `tests/main.factory.test.ts` — unit tests for factory
- `BACKLOG-011` `process-retro` — post-merge boot-smoke mandate update

## 3. NOT In Scope
- OpenClaw Gateway bridge adapter implementation (separate project/ticket)
- Stall watchdog wiring (TKT-018@0.1.0)
- Breach detector (TKT-017@0.1.0)
- Allowlist load tests (TKT-020@0.1.0)
- KBJU sidecar horizontal scaling (future PRD)
- Durable message queue (future PRD)

## 4. Inputs
- ARCH-001@0.5.0 §2 (Architecture Overview), §3.1 (C1), §3.10d (C10d), §4.9–§4.10, §10.1–§10.3, §11
- ADR-011@0.1.0 (HYBRID topology), ADR-013@0.1.0 (allowlist architecture)
- `src/telegram/entrypoint.ts` (routeMessage, routeCallbackQuery, routeCronEvent)
- `src/telegram/types.ts` (C1Deps, handler interfaces)
- `Dockerfile` (current single-stage, CMD `dist/index.js`)
- `tsconfig.json` (rootDir `"."`)
- `docker-compose.yml` (current service topology)
- `src/observability/events.ts` (buildRedactedEvent, emitLog)

## 5. Outputs
- [ ] `src/main.ts` — exports `startServer`, calls config parser, constructs deps via factory, starts HTTP server, logs `kbju_sidecar_ready`
- [ ] `src/main.factory.ts` — exports `createC1Deps(env): C1Deps`, handles env var parsing, constructs handlers, AllowlistChecker
- [ ] `src/telegram/bridge-handler.ts` — exports HTTP handler dispatching POST body to routeMessage/routeCallbackQuery/routeCronEvent based on endpoint path
- [ ] `config/allowlist.json` — `{ "version": 1, "telegram_user_ids": ["<PO_ID>", "<PARTNER_ID>"] }` (real IDs from PO)
- [ ] `Dockerfile` — multi-stage: (1) build stage: npm ci + build, (2) runtime: copy dist/, CMD `node dist/src/main.js`
- [ ] `docker-compose.yml` — add `kbju-sidecar` service with env vars, health check, depends_on postgres, internal network
- [ ] `tests/main.smoke.test.ts` — builds Docker image, starts container, curls `/kbju/health`, asserts 200, stops container
- [ ] `tests/main.factory.test.ts` — tests C1Deps factory with all env var combinations, invalid env var handling
- [ ] `tests/telegram/bridge-handler.test.ts` — tests HTTP dispatch to correct handlers for each endpoint
- [ ] `README.md` — update deploy instructions if needed

## 6. Acceptance Criteria
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test -- tests/main.factory.test.ts tests/telegram/bridge-handler.test.ts` passes (≥80 % coverage)
- [ ] `docker build -t kbju-sidecar .` succeeds
- [ ] `docker compose up -d kbju-sidecar` starts service
- [ ] `curl -fsS http://127.0.0.1:3001/kbju/health` returns `200 {"status":"ok"}`
- [ ] `docker logs kbju-sidecar 2>&1 | grep 'kbju_sidecar_ready'` matches
- [ ] `docker compose down` cleanly stops
- [ ] `/kbju/message` with allowlisted user routes to routeMessage
- [ ] `/kbju/message` with non-allowlisted user returns null reply (silent drop)
- [ ] `docker compose stop kbju-sidecar && sleep 2 && curl http://127.0.0.1:3001/kbju/health` fails (sidecar is down)
- [ ] `docker compose start kbju-sidecar && sleep 5 && curl http://127.0.0.1:3001/kbju/health` recovers

## 7. Constraints
- Do NOT add new runtime deps except: `dotenv` (if needed for env parsing). No grammY, no openclaw, no telegram libraries in KBJU sidecar.
- C1Deps.sendMessage MUST return RussianReplyEnvelope as HTTP response — NEVER call Telegram Bot API directly.
- Dockerfile CMD MUST match rootDir: `tsconfig.json` `rootDir="."` → output `dist/src/main.js` → CMD `node dist/src/main.js`.
- C1Deps construction at runtime, not at import time — enables testing with mock deps.
- C1Deps MUST NOT cache raw Telegram messages; request_id correlation only.
- BACKLOG-011 `process-retro` boot-smoke mandate: post-merge, add a note to BACKLOG-011 documenting that this ticket closed the boot-smoke gap from the BACKLOG-011 retro.