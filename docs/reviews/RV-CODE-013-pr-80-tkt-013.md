---
id: RV-CODE-013
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/80"
ticket_ref: TKT-013@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-02
---

# Code Review — PR #80 (TKT-013@0.1.0)

## Summary
PR #80 delivers TKT-013 Deployment Packaging with 14/14 passing tests, clean lint/typecheck, and valid Docker Compose configuration. However, two high-severity findings block merge: (1) the rollback script’s health-check curl targets `127.0.0.1:9464` on the Docker host, but the `metrics` container binds to its own internal loopback with no port mapping, so the health check will always fail; (2) the ACs explicitly mandate test assertions for shell-script failure paths, yet no such tests exist. Two medium findings (unused `openclaw_state` volume; migration script references non-existent Compose service names) also require remediation.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: The rollback health check is functionally unreachable from the host, guaranteeing a false-negative failure on every rollback, and two AC-mandated shell-script test assertions are entirely absent.

Recommendation to PO: Request changes from Executor. Re-review required after fixes.

## Contract compliance
- [x] PR modifies ONLY files listed in TKT §5 Outputs
  - Plus allowed `docs/tickets/TKT-013-deployment-packaging.md` frontmatter `status: in_review` and append-only §10 Execution Log edits. No disallowed fields touched.
- [x] No changes to TKT §3 NOT-In-Scope items
  - No application feature implementation beyond health checks; no production secrets; no K8s, systemd, or host-network paths.
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
  - `pg` was already in `package.json`; no additions.
- [ ] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
  - **AC 8 (rollback tests) and AC 9 (migration tests) are NOT satisfied** — see F-H2.
- [x] CI green (lint, typecheck, tests, coverage)
  - `npm test` 14/14 pass; `npm run lint` / `npm run typecheck` exit 0; `docker compose config` exits 0; `python3 scripts/validate_docs.py` passes.
- [ ] Definition of Done complete
  - Blocked by missing AC-mandated shell-script tests and rollback reachability defect.
- [x] Ticket frontmatter `status: in_review` in a separate commit
  - Verified in diff: `status: ready` → `status: in_review`; execution log appended.

## Findings

### High (blocking)

- **F-H1 (docker-compose.yml:48–62, scripts/rollback-kbju.sh:66):** Rollback health check is unreachable from the host. The `metrics` service binds `METRICS_HOST=127.0.0.1` inside its own container network namespace with **no `ports:` mapping** in `docker-compose.yml`. The rollback script then runs `curl -fsS --max-time 2 http://127.0.0.1:9464/metrics` from the **Docker host**, where port 9464 is not listening. This will always return connection-refused, causing the script to abort with exit code 1 and send a false “rollback FAILED” alert to the PO even when the stack is healthy. — *Responsible role:* Executor. *Suggested remediation:* Change `scripts/rollback-kbju.sh:66` to use `docker compose exec metrics curl -fsS --max-time 2 http://127.0.0.1:9464/metrics > /dev/null 2>&1` so the curl executes inside the container where the metrics server is actually listening. Alternatively, expose the port via `ports: ["127.0.0.1:9464:9464"]` and adjust `healthCheck.ts` to permit `0.0.0.0` binding inside the container (while remaining loopback-only on the host).

- **F-H2 (tests/deployment/ — missing files):** TKT-013 §6 ACs 8 and 9 explicitly require automated test assertions for shell-script failure paths:
  - AC 8: “tests assert the script aborts non-zero when health checks fail”
  - AC 9: “tests assert the script fails fast if `getWebhookInfo` reports an error”
  
  The PR contains **zero** tests for `scripts/rollback-kbju.sh` or `scripts/migrate-vps-kbju.sh`. `tests/deployment/` only holds `compose.test.ts` and `envExample.test.ts`. The Executor self-reports these ACs as PASS in the PR body, but provides no test evidence. This is an AC violation. — *Responsible role:* Executor. *Suggested remediation:* Add test files (e.g. `tests/deployment/rollbackShell.test.ts` and `tests/deployment/migrateShell.test.ts`) that stub `child_process.exec` or mock `curl`/`docker`/`ssh` invocations to assert:
  1. When the health-check curl returns non-zero, `rollback-kbju.sh` exits 1 and sends the failure Telegram message.
  2. When mocked `getWebhookInfo` JSON contains a numeric `last_error_date`, `migrate-vps-kbju.sh` exits 1 before the migration proceeds.

### Medium

- **F-M1 (docker-compose.yml:65–66):** `openclaw_state` named volume is declared but **never mounted into any service**. ARCH-001@0.4.0 §10.1 requires persistent named volumes for both PostgreSQL (`kbju_pgdata`) and OpenClaw runtime state (`openclaw_state`). While `compose.test.ts:28` checks that the string `openclaw_state:` exists, it does not verify that a service actually mounts it. The current `app` service has no `volumes:` block at all. — *Responsible role:* Executor. *Suggested remediation:* Mount `openclaw_state` into the `app` service (e.g. `volumes: - openclaw_state:/app/state`) and strengthen `compose.test.ts` to assert the mount line appears under a service block, not merely as a top-level volume declaration.

- **F-M2 (scripts/migrate-vps-kbju.sh:42–47):** The migration script runs `docker compose stop kbju-telegram-entrypoint kbju-onboarding kbju-meal-logging kbju-history-privacy kbju-summary`. These five service names **do not exist** in `docker-compose.yml`, which only defines `app`, `postgres`, and `metrics`. Because the script uses `set -euo pipefail`, `docker compose stop` on a non-existent service exits with an error, causing the entire migration to abort at step 1/5. — *Responsible role:* Executor. *Suggested remediation:* Replace the five non-existent service names with `app` (the actual unified skill container in the current Compose file), or dynamically determine running user-facing services via `docker compose ps --services` before stopping.

### Low

- **F-L1 (src/deployment/healthCheck.ts:12):** `const startTime = Date.now()` is evaluated at module-load time, not when `startMetricsServer()` is called. The `/healthz` endpoint’s `uptimeSeconds` therefore reports time-since-module-require rather than time-since-server-start. Under TKT-013 this is a packaging placeholder, but the metric is misleading if the metrics server is started lazily or the module is imported early. — *Responsible role:* Executor. *Suggested remediation:* Initialize `startTime` inside `startMetricsServer()` or use `process.uptime()`.

- **F-L2 (scripts/migrate-vps-kbju.sh:110):** The manual checklist at the end of the migration script references `docker compose logs --since=2m kbju-telegram-entrypoint`, but `kbju-telegram-entrypoint` is not a service defined in `docker-compose.yml`. — *Responsible role:* Executor. *Suggested remediation:* Replace with `docker compose logs --since=2m app`.

## Red-team probes

- **Error paths / Telegram API failure:** Rollback and migration scripts already `set -euo pipefail` and use `curl -fsS`, so Telegram POST failures propagate correctly. Good.
- **Concurrency:** Not applicable; packaging ticket with no application concurrency changes.
- **Input validation:** `.env.example` values are blank or safe default (`10`). `envExample.test.ts` enforces no plausible secret patterns. Good.
- **Prompt injection:** Not applicable; no new LLM call paths.
- **Secrets:** No real secrets committed. `PLAUSIBLE_SECRET_PATTERNS` in `envExample.test.ts` guards against accidental paste-ins. Good.
- **Host bind mounts:** `compose.test.ts` rejects absolute/relative/tilde-prefixed volume sources. Verified no host bind mounts in `docker-compose.yml`. Good.
- **Service name drift:** Migration and rollback scripts reference future ArchSpec service names (`kbju-telegram-entrypoint`, etc.) that do not yet exist in the current Compose file. This is acceptable for documentation comments (F-L2) but dangerous for live `docker compose` commands (F-M2).

## AC-by-AC verification summary

| # | AC text | Status | Evidence / Notes |
|---|---------|--------|------------------|
| 1 | `npm test -- tests/deployment/compose.test.ts tests/deployment/envExample.test.ts` passes | **PASS** | 14/14 tests pass at HEAD `5cacba88`. |
| 2 | `npm run lint` passes | **PASS** | `tsc --noEmit` exits 0. |
| 3 | `npm run typecheck` passes | **PASS** | `tsc --noEmit` exits 0 (identical to lint). |
| 4 | `docker compose config` succeeds | **PASS** | Exits 0 with valid YAML (warnings only for unset env vars). |
| 5 | Tests prove `.env.example` contains every required variable from §9.1 and no plausible secret values | **PASS** | `envExample.test.ts` checks all 12 vars and rejects secret patterns. |
| 6 | Tests prove `docker-compose.yml` uses named volumes for PostgreSQL/OpenClaw state and no host bind mounts | **PARTIAL** | `kbju_pgdata` is mounted. `openclaw_state` is declared but **unused** by any service (F-M1). |
| 7 | Tests prove metrics bind to loopback/internal network only and Docker logs have bounded rotation | **PASS (with caveat)** | `metrics` binds to `127.0.0.1` and no wildcards appear. **Caveat:** this binding makes the endpoint unreachable from the host, breaking the rollback health check (F-H1). |
| 8 | Scripts include backup, rollback, and VPS migration command sequences from §10 | **PASS** | All three scripts present and match ARCH-001 §10.4–10.6 structure. |
| 9 | `scripts/rollback-kbju.sh` runs §10.5.1 pre-flight, §10.5.2 health-check loop on `http://127.0.0.1:9464/metrics`, posts Telegram PO ping on success; tests assert the script aborts non-zero when health checks fail | **FAIL** | Script implements the three phases, but **no tests exist** that assert the abort-on-failure behavior (F-H2). Additionally, the host-level curl is unreachable (F-H1). |
| 10 | `scripts/migrate-vps-kbju.sh` calls Telegram `setWebhook` and verifies `getWebhookInfo` returns the new URL with `last_error_date: null`; tests assert the script fails fast if `getWebhookInfo` reports an error | **FAIL** | Script correctly verifies both conditions and exits 1 on failure, but **no tests exist** that assert this fail-fast behavior (F-H2). Also references non-existent service names (F-M2). |

## Appendices

### A. Scope compliance detail
PR diff modifies exactly the files listed in TKT-013 §5 Outputs, plus the allowed carve-out in `docs/tickets/TKT-013-deployment-packaging.md` for `status` frontmatter and append-only §10 Execution Log. No other application code, schema, or ADRs were changed. Scope compliance: **PASS**.

### B. Executor HEAD reviewed
`5cacba885cf0ec47ad0bf87d9c042ed254d6eb29` (verified via `git rev-parse HEAD` on `origin/tkt/TKT-013-deployment-packaging`).

### C. Commands run
```bash
npm test -- tests/deployment/compose.test.ts tests/deployment/envExample.test.ts   # 14/14 pass
npm run lint                    # exit 0
npm run typecheck               # exit 0
docker compose config           # exit 0
python3 scripts/validate_docs.py # validated 58 artifact(s); 0 failed
```
