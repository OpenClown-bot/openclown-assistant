---
id: ADR-013
title: "Scale-ready Telegram allowlist (JSON file + in-memory Set + fs.watch + 5 s polling fallback)"
status: proposed
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
synthesis_inputs:
  - "PR-B: arch/ARCH-001-v0.5.0-deepseek-deep-context-design — JSON + Set + fs.watch + 5s polling fallback (Docker overlayfs gotcha cited)"
  - "PR-C: arch/ARCH-001-v0.5.0-alternatives-design — JSON + Set + fs.watchFile (1s polling-by-default; rejected: pays polling overhead always)"
  - "PR-A: arch/ARCH-001-v0.5.0-integration-layer-and-observability — JSON + Set + chokidar (rejected: adds runtime dep without merit)"
created: 2026-05-04
updated: 2026-05-04
superseded_by: null
---

# ADR-013: Scale-ready Telegram allowlist (JSON file + in-memory Set + fs.watch + 5 s polling fallback)

## Context

PRD-002@0.2.1 §2 G4 mandates a config-driven Telegram allowlist that supports `N = 2 / 10 / 100 / 1 000 / 10 000` users with ≤2 % per-update overhead and ≤30 s reload propagation. The current implementation at `src/telegram/entrypoint.ts:35-38` uses `Array.includes()` on `C1Deps.pilotUserIds: readonly string[]` populated from the env var `TELEGRAM_PILOT_USER_IDS` — `O(n)` lookup, no hot reload, capped at whatever fits in an env var.

PRD-002@0.2.1 §A.5 red-team probes include concurrent-edit races (two actors writing the file simultaneously) and stale-version regression (an older version overwrites a newer one). PRD-002@0.2.1 §7 forbids new external dependencies (Redis, message-bus) for v0.1 / 2-user pilot scope.

PR-B's empirical Recon Report (`docs/knowledge/openclaw.md` §Known gotchas in PR-B) recorded a decisive Docker-runtime finding: **inotify events on `overlayfs` (Docker's default storage driver) and `ext4` bind-mounts are unreliable** — `fs.watch` push notifications can drop silently when the file is edited from outside the container. Polling (`stat.mtime` comparison) is a robust fallback because it does not depend on inotify delivery. PR-A's `chokidar` add was rejected because `chokidar` internally also uses `fs.watch` and adds a runtime dep without solving the Docker overlayfs flake. PR-C's `fs.watchFile`-only approach was rejected because `fs.watchFile` polls at 1 s by default and pays the polling overhead always, never using the cheap inotify path on Linux native filesystems.

## Options Considered (≥3 real options, no strawmen)

### Option A: JSON file + in-memory Set + `fs.watch` + 5 s polling fallback (CHOSEN)
- Description: `config/allowlist.json` parsed at boot into `Set<string>`. `fs.watch(configPath)` push-notifies on file change → debounce 500 ms → re-parse → validate `version > prev` → atomic Set swap. `setInterval(5000, pollMtime)` fallback compares `fs.statSync(configPath).mtime` to last-loaded mtime; reloads if changed (covers Docker overlayfs/ext4 inotify-flake gotcha). `isAllowed(userId): boolean` is `Set.has(userId)` — O(1).
- Pros: O(1) lookup at every N up to 10 000. Push-based reload on Linux native filesystems (≤500 ms debounced); polling fallback bounded at 5.5 s (5 s poll + 500 ms debounce); both within 30 s PRD-002@0.2.1 §5 US-4 AC2 target. Zero new runtime dependency. Covers PR-B's Docker overlayfs gotcha. Version-monotonicity check rejects stale-version regressions.
- Cons: Two reload paths to maintain (push + polling); race between simultaneous edits is last-writer-wins (PRD-002@0.2.1 §A.5 documented as accepted at v0.5.0).
- Cost / latency / ops burden: zero new deps; ~50 ms boot-time JSON.parse for N = 10 000; ~5 µs/lookup for `Set.has`; ≤5.5 s reload propagation.

### Option B: PostgreSQL table + in-memory cache — rejected
- Description: Store the allowlist in `kbju_app.allowlist_users` table; cache in memory; refresh via NOTIFY/LISTEN or periodic poll.
- Pros: Strongly consistent across multi-replica future. Easy admin UI later.
- Cons: +1 DB round-trip per cache miss + LISTEN setup + connection-pool coupling with C12. No ergonomic edit story for the PO without a UI. Overkill at v0.1 / 2-user scale; PRD-002@0.2.1 §3 NG6 forbids gold-plated v0.1 features.
- Cost / latency / ops burden: medium DB load + LISTEN connection; rejected on YAGNI.

### Option C: Redis Set + pub/sub — rejected
- Description: Allowlist lives in Redis; sidecar subscribes to invalidation pub/sub.
- Pros: Designed for this exact pattern.
- Cons: Adds a new external dependency (Redis container). Violates PRD-002@0.2.1 §7 v0.1 deployment-envelope constraint.
- Cost / latency / ops burden: +1 container, +ops surface; rejected.

### Option D: `fs.watchFile` only (PR-C's choice) — rejected
- Description: Use Node's `fs.watchFile` which polls at 1 s by default; no `fs.watch` at all.
- Pros: Simpler — one mechanism, not two. Robust against inotify flakiness by construction.
- Cons: Pays polling cost always (every 1 s, even when the file never changes); does not use the cheap push-based inotify path on Linux native filesystems; reload latency floored at 1 s rather than ≤500 ms.
- Cost / latency / ops burden: same as Option A but worse latency floor; rejected.

### Option E: `chokidar` (PR-A's choice) — rejected
- Description: Add `chokidar` as a runtime dependency; use its abstracted file-watch API.
- Pros: Polished cross-platform abstraction.
- Cons: Internally uses `fs.watch` on Linux — does not solve the Docker overlayfs flake any better than direct `fs.watch`. Adds a runtime dependency without engineering merit. Increases bundle size.
- Cost / latency / ops burden: +1 runtime dep; rejected.

## Decision

We will use **Option A: JSON file + in-memory Set + `fs.watch` + 5 s polling fallback**.

Why the losers lost:
- B: Overkill at v0.1; PRD-002@0.2.1 §3 NG6.
- C: New external dep; PRD-002@0.2.1 §7.
- D: 1 s polling floor wastes the cheap inotify path on Linux native filesystems.
- E: `chokidar` does not solve Docker overlayfs flake; adds runtime dep without merit.

## Decision Detail

### D1: File schema
```
{ "version": 1, "telegram_user_ids": ["123456789", "987654321"], "comment": "optional human note" }
```
- `version`: monotonically increasing integer; reload with `version <= currentVersion` is rejected with `kbju_allowlist_reload_rejected_total{reason=stale_version}` increment.
- `telegram_user_ids`: array of decimal-string Telegram numeric IDs.
- `comment`: optional, ignored at runtime.

### D2: AllowlistChecker interface
```
interface AllowlistChecker {
  isAllowed(telegramUserId: string): boolean;   // Set.has — O(1)
  getCount(): number;                            // Set.size
  getVersion(): number;                          // last-loaded version
}
```

### D3: Reload mechanism
1. **Push path (fs.watch):** `fs.watch(configPath)` callback → debounce 500 ms → `fs.readFileSync` → `JSON.parse` → validate `version > currentVersion` → construct new `Set<string>` → atomic ref swap (`currentSet = newSet`). Emits `kbju_allowlist_reload_total` on success.
2. **Polling fallback (setInterval):** `setInterval(5000, pollMtime)` → `fs.statSync(configPath).mtime > lastMtime` → trigger same parse-and-swap path. Emits the same metric.
3. **Failure modes:**
   - File missing at boot: FAIL FAST with `[boot] FATAL: ALLOWLIST_CONFIG_PATH not found`.
   - Malformed JSON on reload: keep current Set; log + `kbju_allowlist_reload_rejected_total{reason=malformed_json}`.
   - I/O error on reload: keep current Set; log + `kbju_allowlist_reload_rejected_total{reason=io_error}`.
   - Stale version on reload: keep current Set; log + `kbju_allowlist_reload_rejected_total{reason=stale_version}`.
   - Concurrent-edit race (two writers, mtime collision): last-writer-wins per filesystem mtime ordering. Documented as accepted at v0.5.0 per PRD-002@0.2.1 §A.5; future work tracked in `docs/backlog/observability-followups.md` if PO chooses to elevate.

### D4: Latency budget
| Path | Budget | PRD-002@0.2.1 §5 US-4 AC2 target |
|---|---|---|
| `fs.watch` push (Linux native FS) | ≤500 ms debounce | 30 s |
| Polling fallback (Docker overlayfs) | ≤5 000 ms poll + ≤500 ms debounce | 30 s |

Both well within the 30 s target.

### D5: Env-var compatibility
At boot, the loader prefers `ALLOWLIST_CONFIG_PATH` (default `config/allowlist.json`). If the file is absent **and** legacy `TELEGRAM_PILOT_USER_IDS` env is present, the loader synthesizes a v=1 allowlist from the env var (with `kbju_allowlist_legacy_env_used_total` incremented at boot). If both are absent, FAIL FAST. This contains the v0.4.0 → v0.5.0 deploy migration without forcing all environments to migrate atomically.

### D6: Revocation semantics
Removing a `telegram_user_id` from the file is effective ≤30 s (per the latency budget). Once revoked, subsequent `isAllowed()` calls return `false` and the user is silently dropped per ARCH-001@0.5.0 §3.1 (no error reply; the user sees nothing — same UX as the v0.4.0 allowlist drop). PRD-001@0.2.0 §5 US-8 right-to-delete is independent: `/forget_me` deletes user data unconditionally; allowlist entry is deleted by the PO editing the file.

### D7: Load-test gates (TKT-020@0.1.0 §6 AC)
Synthetic load tests at `N = 2 / 10 / 100 / 1 000 / 10 000`:
- `Set.has` p95 < 10 µs at every N.
- `JSON.parse` + `Set` construction wall-clock: < 50 ms at N = 10 000.
- File size: ~256 KB at N = 10 000 (33 chars per ID, including JSON quoting/comma).
- End-to-end `isAllowed()` overhead in the C1 hot path: ≤2 % vs no-check baseline (per PRD-002@0.2.1 §7 budget).

A code-path audit document (TKT-020@0.1.0 deliverable) must be filed before each load-test run.

## Consequences

- Positive: O(1) lookup at any N; ≤500 ms reload on healthy Linux + ≤5.5 s on Docker overlayfs; zero new runtime deps; legacy env var path keeps the v0.4.0 deploy migration smooth; version-monotonicity check rejects stale-version regressions; revocation is bounded ≤30 s per PRD-002@0.2.1 §5 US-4 AC2.
- Negative / trade-offs accepted: two reload paths to maintain; concurrent-edit race is last-writer-wins (PRD-002@0.2.1 §A.5 accepted); PO must edit the JSON file directly (no admin UI at v0.5.0).
- Follow-up work: TKT-020@0.1.0 (implementation + load tests + code-path audit doc).

## Synthesis Citation

- **PR-B** `arch/ARCH-001@0.5.0-v0.5.0-deepseek-deep-context-design` `ADR-013-scale-ready-telegram-allowlist.md` — same Decision (Option A); contributed the Docker overlayfs/ext4 inotify-flake empirical finding that drove the polling-fallback choice. Adopted verbatim.
- **PR-C** `arch/ARCH-001@0.5.0-v0.5.0-alternatives-design` `ADR-013-scale-ready-telegram-allowlist.md` — same JSON + Set approach; **rejected** the `fs.watchFile`-only mechanism (1 s polling floor wastes inotify path).
- **PR-A** `arch/ARCH-001@0.5.0-v0.5.0-integration-layer-and-observability` `TKT-020@0.1.0-allowlist-config-watch.md` — equivalent JSON + Set approach with `chokidar`; **rejected** the `chokidar` runtime dep.

## References

- PRD-002@0.2.1 §2 G4, §5 US-4 AC1–AC4, §7 (load-test budget), §A.5 (red-team concurrent-edit), §3 NG6 (no gold-plated v0.1 features).
- ARCH-001@0.5.0 §3.15 (C15 component spec), §8.4 (G4 metric names), §11.2 (component test), §11.4 (load-test gates).
- `src/telegram/entrypoint.ts:35-38` — current `Array.includes()` allowlist (replaced by C15).
- `src/telegram/types.ts:88-95` — `C1Deps.pilotUserIds` type (replaced by `C1Deps.allowlist: AllowlistChecker`).
- Docker storage drivers / overlay2 inotify limitations: <https://docs.docker.com/engine/storage/drivers/overlayfs-driver/>.
- Node.js `fs.watch` vs `fs.watchFile` reference: <https://nodejs.org/api/fs.html#fswatchfilename-options-listener>.
- TKT-020@0.1.0 (implementation ticket).
- ADR-011@0.1.0 (HYBRID integration shape — establishes that the sidecar owns the allowlist, not the gateway).
