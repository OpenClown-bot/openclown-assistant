---
id: TKT-020
title: "G4 C15 Allowlist Reload Service — JSON file + in-memory Set + fs.watch + 5s polling fallback + load tests"
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
component: "C15 Allowlist Reload Service"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "glm-5.1"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-020: G4 C15 Allowlist Reload Service — JSON file + in-memory Set + fs.watch + 5s polling fallback + load tests

## 1. Goal (one sentence, no "and")
Implement C15 by replacing the static `Array.includes()` allowlist at `src/telegram/entrypoint.ts:35-38` with a config-file-backed `AllowlistChecker` (`Set<string>` + `fs.watch` push reload + 5 s `stat.mtime` polling fallback + version-monotonicity check) and validate it against the PRD-002@0.2.1 §2 G4 load-test gates at `N = 2 / 10 / 100 / 1 000 / 10 000`.

## 2. In Scope
- `src/telegram/allowlistChecker.ts` — exports `AllowlistChecker` class (`isAllowed`, `getCount`, `getVersion`, `start`, `stop`); loads `ALLOWLIST_CONFIG_PATH` (default `config/allowlist.json`); falls back to legacy `TELEGRAM_PILOT_USER_IDS` env var if file is absent (per ADR-013@0.1.0 §D5); FAIL FAST if both are absent.
- `src/telegram/allowlistReload.ts` — `fs.watch` debounced (500 ms) push reload + `setInterval(5000, pollMtime)` polling fallback; both invoke a single `tryReload()` function that re-parses, validates `version > currentVersion`, swaps the Set atomically; on failure, keeps current Set + emits the appropriate `kbju_allowlist_reload_rejected_total{reason=...}` metric.
- `tests/telegram/allowlistChecker.test.ts` — unit tests: file-load happy path, env-var fallback, FAIL FAST when both absent, malformed JSON rejected (current Set preserved), stale-version rejected, valid reload accepted, atomic Set swap (no torn read mid-reload).
- `tests/telegram/allowlistReload.fsWatch.test.ts` — push-path test: write to the file → `fs.watch` callback → reload occurs within 500 ms.
- `tests/telegram/allowlistReload.polling.test.ts` — polling-path test: write to the file with `fs.watch` mocked-down (simulates Docker overlayfs flake) → polling timer detects mtime change → reload occurs within 5.5 s.
- `tests/telegram/allowlistReload.versionMonotonicity.test.ts` — write a v=2 file, then a v=1 file → second write rejected.
- `tests/telegram/allowlistChecker.load.test.ts` — synthetic load tests at `N = 2 / 10 / 100 / 1 000 / 10 000`; benchmarks `Set.has` p95, `JSON.parse` + Set construction time, file size, end-to-end `isAllowed` overhead vs no-check baseline.
- `docs/observability/ALLOWLIST-LOADTEST-AUDIT-2026-05.md` — code-path audit doc filed before each load-test run (per PRD-002@0.2.1 §A.5 §A.6 mandate).

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- C12 breach detector — that is TKT-017@0.1.0.
- C13 stall watchdog — that is TKT-018@0.1.0.
- Sidecar boot entrypoint — that is TKT-016@0.1.0; this ticket only replaces the allowlist construction inside `createC1Deps`.
- Admin UI for editing the JSON file — out of scope at v0.5.0; PO edits the file directly.
- Multi-replica synchronization (DB-backed allowlist with NOTIFY/LISTEN) — rejected by ADR-013@0.1.0; future PRD if v0.6+ scales.
- `/forget_me` integration — already exists per TKT-012@0.1.0; allowlist removal is a separate manual action.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.15 (C15), §4.10 (data flow inbound text → allowlist check), §5.5 (allowlist_config schema), §8.4 (G4 metric names), §9 (env vars), §11.2 (component-level tests), §11.4 (load-test gates).
- ADR-013@0.1.0 (full mechanism: file schema, reload algorithm, env-var fallback, latency budget, load-test gates).
- PRD-002@0.2.1 §2 G4, §5 US-4 AC1–AC4 (revocation propagation ≤30 s), §7 (≤2% per-update overhead budget), §A.5 §A.6 (red-team probes).
- `src/telegram/entrypoint.ts:35-38` — the `Array.includes()` check that this ticket replaces.
- `src/telegram/types.ts:88-95` — `C1Deps.pilotUserIds` type (replaced by `C1Deps.allowlist: AllowlistChecker`).
- BACKLOG-009 §allowlist-scale-readiness.

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/telegram/allowlistChecker.ts` exporting `AllowlistChecker` class.
- [ ] `src/telegram/allowlistReload.ts` exporting `startAllowlistReload(checker, configPath): { stop: () => void }`.
- [ ] `src/telegram/types.ts` updated: replace `pilotUserIds: readonly string[]` field with `allowlist: AllowlistChecker` on `C1Deps`.
- [ ] `src/telegram/entrypoint.ts:35-38` updated: replace `Array.includes(telegramUserId)` with `deps.allowlist.isAllowed(telegramUserId)`.
- [ ] `tests/telegram/allowlistChecker.test.ts` (≥80% coverage on `allowlistChecker.ts`).
- [ ] `tests/telegram/allowlistReload.fsWatch.test.ts` (push-path test).
- [ ] `tests/telegram/allowlistReload.polling.test.ts` (polling-path test).
- [ ] `tests/telegram/allowlistReload.versionMonotonicity.test.ts` (stale-version rejection test).
- [ ] `tests/telegram/allowlistChecker.load.test.ts` (load tests at 5 N values).
- [ ] `docs/observability/ALLOWLIST-LOADTEST-AUDIT-2026-05.md` (code-path audit; required by §A.5 §A.6 before load-test runs).
- [ ] No README / CONTRIBUTING / AGENTS.md edits.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean.
- [ ] `npm test -- tests/telegram/allowlistChecker.test.ts` passes; coverage ≥80%.
- [ ] `npm test -- tests/telegram/allowlistReload.fsWatch.test.ts` passes; reload completes within 500 ms after file write.
- [ ] `npm test -- tests/telegram/allowlistReload.polling.test.ts` passes; reload completes within 5500 ms after file write (with `fs.watch` mocked-down).
- [ ] `npm test -- tests/telegram/allowlistReload.versionMonotonicity.test.ts` passes; v=1-after-v=2 write is rejected and current Set retained.
- [ ] `npm test -- tests/telegram/allowlistChecker.load.test.ts` passes at every `N ∈ {2, 10, 100, 1000, 10000}`:
  - `Set.has` p95 < 10 µs.
  - `JSON.parse` + Set construction p95 < 50 ms at N=10000.
  - End-to-end `isAllowed` overhead in the C1 routing hot path is ≤2% vs no-check baseline (PRD-002@0.2.1 §7).
- [ ] FAIL-FAST test: with neither `ALLOWLIST_CONFIG_PATH` file nor `TELEGRAM_PILOT_USER_IDS` env var set, sidecar boot exits with `[boot] FATAL: ALLOWLIST_CONFIG_PATH not found and TELEGRAM_PILOT_USER_IDS unset` and non-zero exit code.
- [ ] Legacy-env-fallback test: with no `ALLOWLIST_CONFIG_PATH` file but `TELEGRAM_PILOT_USER_IDS=111,222` set, the loader synthesizes a v=1 allowlist; `kbju_allowlist_legacy_env_used_total` is incremented at boot.
- [ ] Metric-emission test: each reload-rejected branch (`malformed_json`, `io_error`, `stale_version`) increments `kbju_allowlist_reload_rejected_total{reason=...}` exactly once.
- [ ] `docs/observability/ALLOWLIST-LOADTEST-AUDIT-2026-05.md` exists and contains: declared scope, test environment specs (Node version, OS, FS type), load-test command lines, and an explicit pre-run sign-off.
- [ ] Revocation-propagation test: removing a user from the file makes `isAllowed(removedUser)` return `false` within 5.5 s (polling-path) or 500 ms (push-path).

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies — `fs.watch` is in the Node 24 standard library; no `chokidar`.
- The polling-fallback `setInterval` MUST run at 5000 ms exactly — not 1000 ms (avoids the `fs.watchFile` polling-floor that ADR-013@0.1.0 explicitly rejected).
- The Set swap MUST be atomic (a single `this.currentSet = newSet` assignment in JS is atomic at the language level; do NOT use a transitional dual-Set state).
- The `version` field MUST be a positive integer; reject non-integers + reject `version <= currentVersion` (where `currentVersion` is stored alongside the Set).
- Malformed JSON / IO errors / stale versions: keep the current Set + log the rejection + increment the metric — NEVER throw / crash the sidecar.
- The version-monotonicity check is the front-line defense against PRD-002@0.2.1 §A.5 stale-version regression — it MUST be implemented; tests in §6 enforce.
- Concurrent-edit race (two writers, mtime collision) is last-writer-wins per PRD-002@0.2.1 §A.5 — documented as accepted at v0.5.0; this ticket does NOT implement file-locking.
- Load tests MUST run against the synthesized allowlist file (not against a real Telegram allowlist with PII).
- The audit doc (`ALLOWLIST-LOADTEST-AUDIT-2026-05.md`) MUST be filed before the load tests are run, per PRD-002@0.2.1 §A.5 §A.6 — NOT after.
- Do NOT modify any other field on `C1Deps` beyond replacing `pilotUserIds: readonly string[]` with `allowlist: AllowlistChecker`.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass.
- [ ] PR opened with link to TKT-020@0.1.0 in description (version-pinned).
- [ ] No `TODO` / `FIXME` left in committed code without a follow-up TKT suggestion logged in the PR body.
- [ ] Executor filled §10 Execution Log.
- [ ] Ticket frontmatter `status: in_review` in a separate commit after the implementation commit.

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-020-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-04 (architect-4 synthesizer claude-opus-4.7-thinking): synthesized this ticket from PR-B's TKT-020 (file schema + version monotonicity + load-test gates) + PR-C's TKT-020 (audit doc requirement; concurrent-edit race documented as accepted). PR-A's TKT-020 (chokidar runtime dep) was rejected by ADR-013@0.1.0 §E. assigned_executor=glm-5.1 — straightforward Node fs API + Set semantics; no Codex-tier complexity. -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions (single atomic deliverable: a config-driven hot-reloading allowlist for C15).
- [x] NOT-In-Scope has ≥1 explicit item (6 items listed).
- [x] Acceptance Criteria are machine-checkable (every AC has a concrete shell command, test name, latency target, or metric assertion).
- [x] Constraints explicitly list forbidden actions.
- [x] All ArchSpec / ADR / TKT references are version-pinned.
- [x] `depends_on: [TKT-016@0.1.0]` correct (sidecar must boot with the new `C1Deps.allowlist` field); no cycles.
- [x] `assigned_executor: glm-5.1` justified — see Execution Log seed.
