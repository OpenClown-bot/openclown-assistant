---
id: RV-CODE-016
type: code_review
target_pr: "[openclown-assistant#116](https://github.com/OpenClown-bot/openclown-assistant/pull/116) ([Devin Review](/review/OpenClown-bot/openclown-assistant/pull/116))"
ticket_ref: TKT-016@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-05
---

# Code Review — PR #116 (TKT-016@0.1.0)

## Summary
PR #116 delivers the boot entrypoint (`src/main.ts`), OpenClaw bridge plugin (`packages/kbju-bridge-plugin/`), sidecar C1 seam (`src/sidecar/`), deployment tests, and Docker/Compose wiring required by ADR-011@0.1.0. All TKT-016 §6 Acceptance Criteria are satisfied by verifiable tests. Scope is clean: no extraneous files, no new runtime dependencies, no secrets, no TODO/FIXME leaks. The hostile-reader pass found no BLOCKER, MAJOR, or MINOR issues.

## Verdict
- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: All ACs are covered by passing tests, scope is exactly the expected file list, and increased security/typing/boot scrutiny (per PO-approved DeepSeek V4 Pro fallback) revealed no defects.
Recommendation to PO: approve & merge.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
- [x] No changes to TKT §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
None.

### Medium
None.

### Low
None.

Hostile-reader pass found no BLOCKER/MAJOR/MINOR issues.

## AC-by-AC verification

| # | AC | Evidence | Result |
|---|---|---|---|
| 1 | `npm run build` creates `dist/src/main.js` (the Dockerfile CMD target). | `Dockerfile:10` names `dist/src/main.js`; build output exists at that path. | PASS |
| 2 | Deployment boot-smoke test passes. | `tests/deployment/bootEntrypoint.test.ts` (18 tests passed). | PASS |
| 3 | `GET /kbju/health` returns 200 + `X-Kbju-Bridge-Version: 1.0`. | `bootEntrypoint.test.ts:141-147`. | PASS |
| 4 | `POST /kbju/message` missing `telegram_id` → 400 + `error: "invalid_request"`. | `bootEntrypoint.test.ts:149-157`. | PASS |
| 5 | `POST /kbju/message` blocked ID → 403 + `error: "tenant_not_allowed"`, handlers not invoked. | `bootEntrypoint.test.ts:159-168`. | PASS |
| 6 | Valid mocked Telegram text claimed by `inbound_claim`, reaches C1 seam once, returns Russian reply. | `bridgePlugin.test.ts:57-82` (plugin claim + reply); `bootEntrypoint.test.ts:170-195` (sidecar seam single call). | PASS |
| 7 | `register(api: PluginApi)` installs `inbound_claim`, `kbju_message`, `kbju_cron`, `kbju_callback`. | `bridgePlugin.test.ts:35-54`. | PASS |
| 8 | Cron restricted context permits only `kbju_cron`; sidecar receives exactly one `/kbju/cron` request. | `bridgePlugin.test.ts:293-385` (cron filter + single dispatch). | PASS |
| 9 | Callback dispatch covered by restricted `kbju_callback` fallback. | `bridgePlugin.test.ts:233-264` (tool POSTs to `/kbju/callback`); `bootEntrypoint.test.ts:197-216` (handler invocation). | PASS |
| 10 | `POST /kbju/callback` enforces same tenant validation as `/kbju/message` (400 missing, 403 blocked, no handler invoke). | `bootEntrypoint.test.ts:218-246`. | PASS |
| 11 | Oversized `/kbju/message`, `/kbju/callback`, `/kbju/cron` → 413 `payload_too_large` with `X-Kbju-Bridge-Version: 1.0`, no handler invoke. | `bootEntrypoint.test.ts:270-326`. | PASS |
| 12 | `docker compose config` succeeds. | Verified manually; warnings only for unset env vars (expected). | PASS |
| 13 | `npm run lint`, `npm run typecheck`, `python3 scripts/validate_docs.py` pass. | Verified manually; 0 failures, 79 artifacts validated. | PASS |

## Security review

- **Tenant isolation on every bridge endpoint**: `/kbju/message` and `/kbju/callback` validate `telegram_id` against `pilotUserIds` (`src/main.ts:122-128`, `src/main.ts:165-171`). `/kbju/cron` is an internal-only cron trigger (no external tenant ID) and loops over the configured allowlist. `/kbju/health` is a standard health endpoint with no tenant-scoped data.
- **Callback allowlist bypass remains closed**: `handleCallback` performs identical `isAllowlisted` check before routing (`src/main.ts:165-171`).
- **Request-body DoS hardening is real**: `MAX_BODY_SIZE = 64 * 1024` (`src/main.ts:36`). `readBody` measures byte-size per chunk and aborts accumulation early. Tests prove 413 on oversized message, callback, and cron bodies without invoking C1 handlers.
- **Cron restricted context allows only `kbju_cron`**: `CRON_RESTRICTED_TOOLS = ["kbju_cron"]` (`packages/kbju-bridge-plugin/src/cronPolicy.ts:1`). Tests prove `kbju_message` and `kbju_callback` are rejected by the filter.
- **Bridge path does not route through `src/telegram/entrypoint.ts`**: `routeBridgeRequest` (`src/sidecar/seam.ts:37-63`) dispatches directly to stub handlers behind the C1 seam. No import or call to `src/telegram/entrypoint.ts`.
- **OpenClaw plugin uses required hooks/tools**: `api.on("inbound_claim", ...)` and `api.registerCommand(...)` for `kbju_message`, `kbju_cron`, `kbju_callback` (`packages/kbju-bridge-plugin/src/index.ts:78-82`).
- **No secrets, backup dumps, or unrelated docs/tickets in diff**: Confirmed. Diff file list matches expected list exactly.

## Red-team probes (Reviewer must address each)
- **Error paths**: Telegram/API failures are not yet in scope for TKT-016 (stub handlers only). The `.catch` in `createServer` (`src/main.ts:246-253`) returns generic 500 for unhandled exceptions.
- **Concurrency**: `pilotUserIds` and `deps` are module-level but set once at startup; read-only during request handling. No mutable shared state per-request.
- **Input validation**: `toBridgeRequest` checks presence of `telegram_id` and `chat_id` (`src/main.ts:91-93`). Body size is bounded (`src/main.ts:36-73`). Malformed JSON is caught and treated as empty body (`src/main.ts:67-69`).
- **Prompt injection**: No LLM calls in this PR. Stub handlers return static Russian strings.
- **Secrets**: No hardcoded credentials. All secrets are env-var sourced. No tokens or keys logged.
- **Observability**: Sidecar logs plain strings to stdout (Docker json-file driver). Health endpoint exposes uptime and tenant count. Structured JSON logging is deferred to later observability tickets.
