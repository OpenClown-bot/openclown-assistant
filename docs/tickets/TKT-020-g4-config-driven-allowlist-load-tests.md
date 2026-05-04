---
id: TKT-020
title: "G4 Config-driven allowlist + load tests"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-020: G4 Config-driven allowlist + load tests (C15)

## Scope

PRD-002@0.2.1 §2 G4 requires the existing env-var allowlist (`TELEGRAM_PILOT_USER_IDS`) to be replaced
with a hot-reloadable, scale-ready mechanism (ADR-013: JSON config file + in-memory `Set<number>` +
`fs.watchFile` reload). This ticket builds C15 and validates it with load tests up to 10k users.

## Acceptance Criteria

1. `src/security/allowlist.ts` exists with `Allowlist` class:
   - Constructor takes `configPath` (default `config/allowlist.json`)
   - `load(path)`: reads JSON, parses `users: number[]`, replaces internal `Set<number>`
   - `isAllowed(telegramId: number): boolean` — O(1) Set lookup
   - Hot-reload: `fs.watchFile(configPath, { interval: 1000 }, () => this.load(configPath))`
   - On load failure (missing file, bad JSON): keep existing Set, log `allowlist_reload_failed`

2. `config/allowlist.json` schema:
   ```json
   { "users": [111111111, 222222222], "comment": "Telegram user IDs. Edit + hot-reloaded in ≤2s." }
   ```

3. Deprecation migration:
   - If `config/allowlist.json` does NOT exist on startup, read `TELEGRAM_PILOT_USER_IDS` env var,
     split on comma, seed `config/allowlist.json`, then log `allowlist_migrated_from_env` and
     continue using the file-based allowlist from that point forward
   - `TELEGRAM_PILOT_USER_IDS` env var support removed after this migration window

4. Load tests (`tests/load/allowlist.test.ts`):
   - Test 1: 10k `isAllowed()` calls on 10k-user allowlist — p99 < 1μs (Set lookup is O(1))
   - Test 2: Concurrent `isAllowed()` during hot-reload (atomic Set replacement) — no blocking, no
     stale reads mid-reload
   - Test 3: Bad JSON in reload — allowlist retains prior valid state, logs error
   - Test 4: File deletion — allowlist retains prior state, logs warning

5. Metrics:
   - `kbju_allowlist_reload{count}` — counter, on each successful reload
   - `kbju_allowlist_blocked{telegram_id}` — counter, on each blocked access
   - `kbju_allowlist_size` — gauge, current Set size

6. Blocked users receive: `"Извините, бот пока в закрытом тестировании."` (not `"access denied"` —
   user-facing, Russian, polite)

## Implementation Notes

- `fs.watchFile` polls `fs.stat` at 1007ms (Node default), not `fs.watch` (inotify, flaky on Docker
  overlayfs). Acceptable: ~2s max propagation for non-critical access control.
- Atomic file write recommendation: write `allowlist.json.tmp` then `fs.rename` to avoid partial reads.
  Document this in `CONTRIBUTING.md` or `config/allowlist.json` comment field.
- The `isAllowed()` check runs on the hot path (every `POST /kbju/message` call) — must be sub-microsecond.
- No Redis, no PostgreSQL table, no HTTP fetch — zero new infrastructure per PRD-002@0.2.1 §3 NG.