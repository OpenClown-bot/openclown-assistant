---
id: TKT-020
title: "Config-Driven Telegram Allowlist + Load-Test Gates (G4)"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C10d Allowlist Reload Service"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-020: Config-Driven Telegram Allowlist + Load-Test Gates (G4)

## 1. Goal
Implement config/allowlist.json with in-memory Set + file-watch reload, deprecate TELEGRAM_PILOT_USER_IDS, and run load tests at N = 2/10/100/1 000/10 000 validating per-update overhead ≤2% and reload propagation ≤30 s.

## 2. In Scope
- `src/observability/allowlist-reloader.ts` — file-watch + Set reload
- `src/telegram/allowlist-checker.ts` — AllowlistChecker interface + impl
- Update `src/telegram/types.ts` — replace C1Deps.pilotUserIds with AllowlistChecker
- Update `src/telegram/entrypoint.ts` — migrate isAllowlisted to AllowlistChecker
- `scripts/allowlist-load-test.sh` — load-test harness
- `docs/architecture/audit/AUDIT-001-allowlist-code-path.md` — code-path audit doc
- PostgreSQL-backed allowlist (ADR-013@0.1.0 rejected Option B)
- Redis-backed allowlist (ADR-013@0.1.0 rejected Option C)

## 4. Inputs
- ARCH-001@0.5.0 §3.10d (C10d), §4.10 (allowlist flow), §9.1–§9.2
- ADR-013@0.1.0 (allowlist architecture)
- PRD-002@0.2.1 §2 G4, §4 P3, §7, §8 R4/R8
- `src/telegram/entrypoint.ts:35-38` (current isAllowlisted)
- `src/telegram/types.ts:88-95` (current C1Deps.pilotUserIds)
- Existing `config/` directory structure

## 5. Outputs
- [ ] `src/observability/allowlist-reloader.ts` — `startAllowlistReloader(configPath, initialData)`:
  - Parses `config/allowlist.json`, validates `{ version: number, telegram_user_ids: string[] }`
  - Creates in-memory `Set<string>` from `telegram_user_ids`
  - Starts `fs.watch` on configPath; on change: debounce 500 ms, re-parse, validate version > previous, atomically swap Set
  - Polling fallback: `setInterval(checkAndReload, 5000)` — checks `fs.statSync(configPath).mtime`, re-parses if changed
  - On parse failure: log error, retain current Set, retry on next event/interval
  - Exports: `currentSet`, `version`, `count`, `onReload` callback
- [ ] `src/telegram/allowlist-checker.ts` — `AllowlistChecker`:
  - `isAllowed(telegramUserId: number): boolean` → `allowlistSet.has(String(telegramUserId))`
  - `getCount(): number` → `allowlistSet.size`
  - `getVersion(): number` → current version from config
- [ ] Update `src/telegram/types.ts`: replace `pilotUserIds: readonly string[]` with `allowlist: AllowlistChecker`
- [ ] Update `src/telegram/entrypoint.ts`: `isAllowlisted(telegramUserId, deps.allowlist)` uses `deps.allowlist.isAllowed()`
- [ ] Update `src/main.factory.ts`: construct `AllowlistChecker` from `config/allowlist.json` or `TELEGRAM_PILOT_USER_IDS` fallback
- [ ] Update all test mocks that use `pilotUserIds`: replace with mock `AllowlistChecker`
- [ ] `scripts/allowlist-load-test.sh` — bash script:
  - Generates `config/allowlist.json` with N entries (deterministic: `["1001", ..., "1000+N"]` + prepended real PO/partner IDs)
  - Starts KBJU sidecar, waits for health check
  - Benchmark: `ab -n 100000 -c 10 -p message.json http://127.0.0.1:3001/kbju/message` (or Node benchmark script)
  - Records: p50/p95/p99 access-check overhead (set.has time), end-to-end overhead vs baseline (N=2)
  - Records: file size, JSON.parse + Set construction duration
  - Records: reload latency (file modification → new Set active)
  - Assertions: overhead ≤2% of PRD-001@0.2.0 §7 text budget (≤100 ms p95 overhead), reload ≤30 s
- [ ] `docs/architecture/audit/AUDIT-001-allowlist-code-path.md` — code-path audit:
  - Enumerates every access-check layer (bridge adapter, C1 entrypoint, handler guard)
  - Documents data structure (Set), complexity (O(1)), cache (in-memory)
  - Documents reload path (file-watch → debounce → parse → Set swap; polling fallback)
  - Documents linear scans (none — Set.has all the way down)
  - Documents store round-trips (one file read per reload, zero per access check)
  - Reviewer sign-off line
- [ ] `tests/observability/allowlist-reloader.test.ts` — tests:
  - File parse success → Set created, count correct
  - File change → Set reloaded within polling interval (+ 500 ms debounce + 500 ms poll)
  - Version skip (same version) → no reload
  - File missing → TELEGRAM_PILOT_USER_IDS fallback
  - Both missing → startup error
  - Corrupted file → retain current Set, log error
  - fs.watch error → falls back to polling
- [ ] `tests/telegram/allowlist-checker.test.ts` — O(1) Set.has tests at N = 2/10/100/1 000/10 000

## 6. Acceptance Criteria
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test -- tests/observability/allowlist-reloader.test.ts tests/telegram/allowlist-checker.test.ts` passes (≥80 % coverage)
- [ ] Allowlisted user's message routes to handler (integration test)
- [ ] Non-allowlisted user's message returns null reply (integration test)
- [ ] Adding a user ID to `config/allowlist.json` → effective within ≤30 s (polling path) or ≤5 s (file-watch path)
- [ ] `bash scripts/allowlist-load-test.sh` passes all gates at N = 2/10/100/1 000/10 000
- [ ] Per-update overhead ≤2 % at all N values (p95)
- [ ] Code-path audit document published and signed by Reviewer
- [ ] All existing tests pass after `pilotUserIds` → `allowlist` migration (backward compat: tests that mock `pilotUserIds` must be updated)

## 7. Constraints
- Do NOT add new runtime dependencies.
- `config/allowlist.json` must be volume-mounted in production for live-reload (not COPY in Dockerfile).
- Deprecation: `TELEGRAM_PILOT_USER_IDS` still works at startup if `config/allowlist.json` is missing. Deprecation warning logged but no error.
- AllowlistChecker must be fully mockable in tests (interface-based, not singleton).
- O(1) access check must use Set.has, not Array.includes.
- Load-test gates are blocking: if any gate fails at a given N, the user-count growth path pauses. Gate failures must be logged with specific metric numbers.
- Reload on parse failure: MUST retain current Set, must not reject all users.