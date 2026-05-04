---
id: TKT-016
title: "Boot entrypoint + C1Deps factory + HTTP bridge handler + Dockerfile fix + container smoke test"
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
component: "C1 Access-Controlled Telegram Entrypoint; new sidecar bootstrap"
depends_on: []
blocks: ["TKT-017@0.1.0", "TKT-018@0.1.0", "TKT-020@0.1.0"]
estimate: M
assigned_executor: "codex-gpt-5.5"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-016: Boot entrypoint + C1Deps factory + HTTP bridge handler + Dockerfile fix + container smoke test

## 1. Goal (one sentence, no "and")
Make the KBJU Coach sidecar process bootable end-to-end inside its Docker container — exposing `/kbju/message`, `/kbju/callback`, `/kbju/cron`, `/kbju/health` over the bridge contract — by adding a boot entrypoint, a `C1Deps` factory, an HTTP bridge handler, a corrected Dockerfile, and a container-startup smoke test.

## 2. In Scope
- `src/main.ts` — sidecar boot entrypoint; parses `process.env`, calls `createC1Deps(config)`, starts an HTTP server on `SERVER_PORT`.
- `src/main.factory.ts` — exports `createC1Deps(config: AppConfig): C1Deps` and `parseConfig(env: NodeJS.ProcessEnv): AppConfig`; constructs all transitive C1–C11 dependencies from env vars only (per ARCH-001@0.5.0 §0.6 S2 mitigation).
- `src/telegram/bridgeHandler.ts` — HTTP dispatch that maps `POST /kbju/message`, `POST /kbju/callback`, `POST /kbju/cron`, `GET /kbju/health` to the existing `routeMessage / routeCallbackQuery / routeCronEvent` exports per ARCH-001@0.5.0 §6.1 verbatim contract; rejects requests with missing or unsupported `X-Kbju-Bridge-Version` header (HTTP 400).
- `config/allowlist.json` — initial `{"version": 1, "telegram_user_ids": [<PO_ID>, <PARTNER_ID>]}` seed file (real IDs supplied by PO; sample placeholder committed).
- `Dockerfile` — corrected `CMD ["node", "dist/src/main.js"]` (closes the `tsconfig.json` `rootDir="."` trap that breaks `main`); multi-stage build (build stage `npm ci` + `npm run build`; runtime stage `node:24-alpine`, copies `dist/` + `node_modules/` + `config/`).
- `docker-compose.yml` — add `kbju-sidecar` service on the internal network (no host port-binding); env-var pass-through; `restart: unless-stopped`; `healthcheck` calling `/kbju/health` every 10 s.
- `tests/main.factory.test.ts` — unit tests for `parseConfig` (env-var parsing, range validation, missing-required FAIL FAST) and `createC1Deps` (every C1Deps field non-null; transitive C2–C11 wiring).
- `tests/telegram/bridgeHandler.test.ts` — unit tests for the HTTP dispatch (4 endpoints × 2-3 request shapes each); 4xx on missing version header; 4xx on malformed body; 200 with `RussianReplyEnvelope` body on happy path.
- `tests/deployment/main.smoke.test.ts` — container-startup smoke test (per BACKLOG-011 §process-retro mandate; ARCH-001@0.5.0 §11.1): `docker build` + `docker compose up -d kbju-sidecar` + `curl /kbju/health` 200 + `docker logs | grep kbju_sidecar_ready` + `docker compose down`.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- C12 breach detector wiring — belongs to TKT-017@0.1.0.
- C13 stall watchdog wiring — belongs to TKT-018@0.1.0.
- C14 PR-Agent CI telemetry — belongs to TKT-019@0.1.0.
- C15 allowlist reload service implementation — belongs to TKT-020@0.1.0; this ticket only ships a static-load `AllowlistChecker` whose `reload()` method is a stub returning `false` (TKT-020@0.1.0 wires `fs.watch` + polling).
- The OpenClaw Gateway-side bridge adapter (gateway dispatching to `POST /kbju/message`) — out of repo (PR-D notes this in ARCH-001@0.5.0 §10.4 grammY fallback contingency); this ticket validates only the **sidecar** side of the bridge.
- Any change to `src/store/`, `src/meals/`, `src/history/`, `src/onboarding/`, `src/observability/` modules — wire them, do not modify them.
- Any new runtime dependencies other than `dotenv` (optional; already permitted in `package.json`).

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §2 (Architecture Overview), §3.1 (C1), §6.1 (HTTP bridge contract verbatim), §9 (env vars), §10.1 (boot path), §10.3 (gateway-sidecar health check), §11.1 (boot-smoke test mandate).
- ADR-011@0.1.0 (HYBRID integration shape; D2 bridge contract, D3 sidecar boot path, D4 reliability).
- ADR-013@0.1.0 (allowlist architecture; D5 env-var compatibility — legacy `TELEGRAM_PILOT_USER_IDS` fallback at boot).
- `src/index.ts`:1-30 — current barrel export list (must stay stable).
- `src/telegram/entrypoint.ts`:1-200 — `routeMessage`, `routeCallbackQuery`, `routeCronEvent` shapes.
- `src/telegram/types.ts`:1-200 — `C1Deps`, `RussianReplyEnvelope`, `TelegramMessage`, `TelegramCallbackQuery`, `CronEventKind`.
- `src/store/tenantStore.ts`, `src/meals/mealOrchestrator.ts`, `src/history/historyService.ts` — for transitive wiring discovery only.
- `src/observability/events.ts` — `buildRedactedEvent`, `emitLog` for boot logs.
- `Dockerfile` (current), `docker-compose.yml` (current), `tsconfig.json` (current `rootDir="."`).
- `package.json` — `npm run build` and `npm test` script names.
- BACKLOG-011 §process-retro (boot-smoke test mandate).

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/main.ts` exporting `startServer(): Promise<http.Server>`; on success logs `kbju_sidecar_ready` with `bridge_version=1.0`, `port=$SERVER_PORT`, `tenant_count`, `allowlist_version`.
- [ ] `src/main.factory.ts` exporting `parseConfig(env): AppConfig` and `createC1Deps(config): C1Deps`.
- [ ] `src/telegram/bridgeHandler.ts` exporting `createBridgeHandler(deps: C1Deps): http.RequestListener`.
- [ ] `config/allowlist.json` (placeholder seed `{"version": 1, "telegram_user_ids": ["0"], "comment": "replace with real IDs at deploy time"}`).
- [ ] `Dockerfile` corrected to multi-stage build with `CMD ["node", "dist/src/main.js"]`.
- [ ] `docker-compose.yml` extended with `kbju-sidecar` service.
- [ ] `tests/main.factory.test.ts` (coverage ≥80% on `src/main.factory.ts`).
- [ ] `tests/telegram/bridgeHandler.test.ts` (coverage ≥80% on `src/telegram/bridgeHandler.ts`).
- [ ] `tests/deployment/main.smoke.test.ts` (container-startup smoke test; PRD-002@0.2.1 §11.1 mandate).
- [ ] No README / CONTRIBUTING / AGENTS.md edits in this ticket.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean.
- [ ] `npm test -- tests/main.factory.test.ts` passes; coverage ≥80%.
- [ ] `npm test -- tests/telegram/bridgeHandler.test.ts` passes; coverage ≥80%.
- [ ] `docker build -t kbju-sidecar:tkt-016 .` exits 0.
- [ ] `docker compose up -d kbju-sidecar` starts the service; `docker compose ps kbju-sidecar` reports `running (healthy)` within 30 s.
- [ ] `curl -fsS -H "X-Kbju-Bridge-Version: 1.0" http://kbju-sidecar:3001/kbju/health` (from a sibling container on the internal network) returns HTTP 200 with body matching `{"status":"ok",…}`.
- [ ] `curl -fsS http://kbju-sidecar:3001/kbju/health` (without version header) returns HTTP 400 with `{"error":"missing X-Kbju-Bridge-Version"}`.
- [ ] `docker logs kbju-sidecar 2>&1 | grep 'kbju_sidecar_ready'` matches.
- [ ] `POST /kbju/message` with body `{"telegram_update":{...}, "telegram_user_id":"<allowlisted>"}` and `X-Kbju-Bridge-Version: 1.0` returns HTTP 200 with `RussianReplyEnvelope` body.
- [ ] `POST /kbju/message` with body `{"telegram_update":{...}, "telegram_user_id":"<not-allowlisted>"}` returns HTTP 200 with body `{"reply":null,"silent_drop":true}`.
- [ ] `tests/deployment/main.smoke.test.ts` passes in CI (boot-smoke mandate per BACKLOG-011 §process-retro).
- [ ] `docker compose down` cleanly stops the sidecar without orphan processes.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies except `dotenv` (already in package.json or already permitted). No `grammy`, no `telegraf`, no `openclaw`, no `chokidar`.
- `C1Deps.sendMessage` MUST return `RussianReplyEnvelope` as the HTTP response body — NEVER open a direct connection to the Telegram Bot API from the sidecar.
- Dockerfile `CMD` MUST match `tsconfig.json`'s `rootDir="."` → output `dist/src/main.js` → `CMD ["node", "dist/src/main.js"]`.
- `C1Deps` construction MUST be runtime, not import-time — `createC1Deps(config)` is invoked from `startServer()`, which is invoked from `main.ts` only when `require.main === module`. This enables tests to import `main.factory` without booting a server.
- `C1Deps` MUST NOT cache raw Telegram messages or raw transcripts; correlate by `request_id` only.
- All env vars referenced MUST be documented in ARCH-001@0.5.0 §9; if a new env var is needed, return a Q-TKT instead of editing the ArchSpec.
- The HTTP bridge handler MUST reject requests with `X-Kbju-Bridge-Version != "1.0"` (HTTP 400 with explicit error body).
- The sidecar MUST FAIL FAST on boot if `ALLOWLIST_CONFIG_PATH` is missing AND legacy `TELEGRAM_PILOT_USER_IDS` is also missing (no silent default).
- The boot path MUST emit one structured `kbju_sidecar_ready` log line (PRD-002@0.2.1 §7 redaction rules apply: no token values, no Telegram usernames).
- Do NOT modify any file under `docs/`, `scripts/`, or `.github/`.
- Do NOT modify the existing 15 merged TKT-001@0.1.0..015 modules' public exports.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass.
- [ ] PR opened with link to TKT-016@0.1.0 in description (version-pinned).
- [ ] No `TODO` / `FIXME` left in committed code without a follow-up TKT suggestion logged in the PR body.
- [ ] Executor filled §10 Execution Log.
- [ ] Ticket frontmatter `status: in_review` in a separate commit after the implementation commit.

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-016-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-04 (architect-4 synthesizer claude-opus-4.7-thinking): synthesized this ticket from PR-B's TKT-016 (boot+factory+Dockerfile+smoke-test) + PR-C's TKT-016 (bridge-handler subagent test surface). PR-A's TKT-016-runnable-telegram-integration-layer.md (raw grammY adapter) was rejected because it violates ADR-011@0.1.0 (HYBRID, not REPLACE). Estimate kept at M. assigned_executor escalated to codex-gpt-5.5 because: (1) this is the unblocking ticket for the entire v0.5.0 release; (2) Dockerfile+tsconfig interaction is a known foot-gun on this repo (BACKLOG-011 §process-retro); (3) GLM-5.1 has no prior Codex track record on multi-file boot-path changes in this repo. -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions (single atomic deliverable: a bootable sidecar).
- [x] NOT-In-Scope has ≥1 explicit item (5 items listed).
- [x] Acceptance Criteria are machine-checkable (every AC has a concrete shell command or test name).
- [x] Constraints explicitly list forbidden actions.
- [x] All ArchSpec / ADR references are version-pinned (ARCH-001@0.5.0, ADR-011@0.1.0, ADR-013@0.1.0, TKT-017@0.1.0, TKT-018@0.1.0, TKT-020@0.1.0).
- [x] `depends_on` accurately reflects prerequisites (none — this is the unblocker); `blocks` lists the three downstream observability tickets; no cycles.
- [x] `assigned_executor: codex-gpt-5.5` justified — see Execution Log seed.
