---
id: TKT-016
title: "Boot entry point + integration layer fix"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "deepseek-v4-pro"
assigned_executor: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-016: Boot entry point + integration layer fix

## Scope

`src/index.ts` is currently a barrel re-export (46 lines), not a runnable entrypoint
(BACKLOG-009 TKT-NEW-v0.1-runnable-entrypoint-missing-CRITICAL). This ticket creates
`src/main.ts` as the KBJU sidecar HTTP server entrypoint and fixes the Dockerfile/Docker
Compose topology for the HYBRID two-process model (ADR-011@0.1.0).

## Acceptance Criteria

1. `src/main.ts` exists and starts an HTTP server (Express + bodyParser.json) exposing:
   - `POST /kbju/message` — primary endpoint (accepts user message, returns KBJU response)
   - `POST /kbju/callback` — async agent callback (for Telegram edit/webhook confirmations)
   - `POST /kbju/cron` — cron trigger endpoint (daily summaries, reminder)
   - `GET /kbju/health` — returns `{ status: "ok", uptime, tenant_count }` and HTTP 200

2. `POST /kbju/message` request schema:
   ```json
   {
     "telegram_id": 123456789,
     "text": "я съел 200 грамм курицы и 100 грамм риса",
     "source": "text",
     "message_id": 1001,
     "chat_id": -100123
   }
   ```
   Response schema:
   ```json
   {
     "reply_text": "Приблизительно: 450 ккал, 45 г белка...",
     "needs_confirmation": true,
     "reply_to_message_id": 1001
   }
   ```
   Error (40x):
   ```json
   { "error": "tenant_not_allowed", "telegram_id": 123456789 }
   ```

3. `Dockerfile` updated with multi-stage build and `CMD ["node", "dist/main.js"]` (not `dist/index.js`)

4. `docker-compose.yml` adds `kbju-sidecar` service with:
   - `restart: unless-stopped`
   - `healthcheck` on `GET /kbju/health`
   - Internal Docker network shared with `openclaw-gateway`

5. `package.json` `scripts.start` entry set to `node dist/main.js`

## Implementation Notes

- Import existing `src/` modules: `telegram/entrypoint.ts`, `meals/mealOrchestrator.ts`,
  `store/tenantStore.ts`, `history/historyService.ts`, `observability/events.ts`
- Do NOT call Telegram Bot API directly — OpenClaw Gateway owns that
- Bridge contract is versioned: include `X-Kbju-Bridge-Version: 1.0` in request/response headers
- Boot-smoke test MUST pass per BACKLOG-011 §process-retro mandate