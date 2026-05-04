---
id: ADR-013
title: "Scale-ready Telegram allowlist architecture"
version: 0.1.0
status: proposed
arch_ref: ARCH-001@0.5.0
author_model: "deepseek-v4-pro"
reviewer_models: []
review_refs: []
created: 2026-05-04
updated: 2026-05-04
approved_at: null
approved_by: null
approved_note: null
superseded_by: null
---

# ADR-013: Scale-ready Telegram allowlist architecture

## 0. Recon Report

Resolves PRD-002@0.2.1 G4. Replaces static `TELEGRAM_PILOT_USER_IDS` env var (ARCH-001@0.4.0 §3.1).

| Artifact | Finding |
|---|---|
| PRD-002@0.2.1 G4 | Config-driven. Load tests at N = 2/10/100/1 000/10 000. Per-update overhead ≤2 %. Propagation ≤30 s. |
| `src/telegram/entrypoint.ts:35-38` | `isAllowlisted`: `includes()` — O(n). Fine at N=2. |
| `src/telegram/types.ts:88-95` | `C1Deps.pilotUserIds: readonly string[]` — static, no reload. |

## 1. Options

### Option A: JSON file + in-memory Set + file-watch — chosen
`config/allowlist.json` parsed into `Set<string>`. `fs.watch` + polling fallback (5 s). O(1) lookup.

### Option B: PostgreSQL table + cache — rejected
+1 DB round-trip per message. Overkill for current scale.

### Option C: Redis Set + pub/sub — rejected
New external dependency. Violates PRD-002@0.2.1 §7 constraint.

## 2. Decision

**Option A: JSON config file + in-memory Set + file-watch reload.**

## 3. Decision Detail

### Q1: File format
```json
{ "version": 1, "telegram_user_ids": ["123456789", "987654321"] }
```

### Q2: AllowlistChecker interface
`isAllowed(userId): boolean` (Set.has), `getCount(): number`, `getVersion(): number`.

### Q3: Reload
`fs.watch` → debounce 500 ms → re-parse → validate version > prev → atomic Set swap.
Polling fallback: `setInterval(5000)` → `stat.mtime` check. Max latency: 5.5 s ≤ 30 s.

### Q4: Env var compatibility
Prefer file. Fall back to `TELEGRAM_PILOT_USER_IDS`. Fail if both absent.

### Q5: Revocation
Removed from file → effective ≤30 s. No `/forget_me` without temporary re-add.

### Q6: Load-test gates
Benchmark Set.has, JSON.parse + Set construction, file size, e2e overhead. Gate at each N. Code-path audit doc required before each run.

## 4. Consequences
- Follow-up: TKT-020@0.1.0 (implementation + load tests + audit).

## 5. References
- PRD-002@0.2.1 G4
- ARCH-001@0.5.0 §3.10d, §4.10
- `src/telegram/entrypoint.ts:35-38`, `src/telegram/types.ts:88-95`