---
id: RV-CODE-017
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/120"
ticket_ref: TKT-017@0.1.0
status: changes_requested
reviewer_model: "kimi-k2.6"
created: 2026-05-05
---

# Code Review — PR #120 (TKT-017@0.1.0)

## Summary
PR #120 delivers a clean, well-tested C12 breach detector (`BreachDetector`, `BreachDetectingTenantStore`) and the `kbju_tenant_breach_detected` metric/kpi event name. All TKT-017@0.1.0 §6 Acceptance Criteria are structurally satisfied by verifiable tests. Scope is clean: 7 files touched, no new runtime dependencies, no secrets, no `TODO`/`FIXME` leaks, CI green. A hostile-reader pass found two MEDIUM design gaps: (1) the detector is never instantiated in the production boot path, so `/kbju/health` will always report `breach_count_last_hour: 0` until a follow-up ticket wires it; (2) `withTransaction` delegates the unguarded inner `TenantScopedRepository` to the action callback, leaving a detection bypass for transaction-internal cross-tenant calls (mitigated by PostgreSQL RLS). These are not code defects in this PR but are architectural gaps that should be documented or resolved before merge to avoid silent inoperability.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: All ACs are covered by passing tests and the implementation is correct, but two MEDIUM gaps—production-path inertness and a transaction-internal detection bypass—require Executor documentation or remediation so the PO is not surprised by a detector that never fires in production.
Recommendation to PO: request changes from Executor (address F-M1 and F-M2 below; F-L1 and F-L2 are acceptable as nits if documented).

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
  - `docs/tickets/TKT-017-g1-tenant-isolation-breach-detector.md` (status promotion)
  - `src/observability/breachDetector.ts` (new)
  - `src/observability/kpiEvents.ts` (+`tenant_breach_detected`, +`kbju_tenant_breach_detected`)
  - `src/store/tenantStore.ts` (+`BreachDetectingTenantStore`)
  - `src/main.ts` (+`breach_count_last_hour` wiring)
  - `src/telegram/types.ts` (+optional `breachDetector?: BreachDetector`)
  - `tests/observability/breachDetector.test.ts` (new)
- [x] No changes to TKT §3 NOT-In-Scope items
  - No new DB table (ephemeral in-memory counter, per TKT §3).
  - No `AUDIT_DB_URL` in request handlers.
  - No broad Proxy magic; uses explicit typed wrapper (`BreachDetectingTenantStore`).
  - No remediation or data repair logic.
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
  - `node:crypto` is built-in; `package.json` unchanged.
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
  - **AC-1** (cross-tenant read emits `kbju_tenant_breach_detected`): `tests/observability/breachDetector.test.ts` — "cross-tenant read emits exactly one kbju_tenant_breach_detected event and throws".
  - **AC-2** (cross-tenant write emits event + `tenant_not_allowed`): `tests/observability/breachDetector.test.ts` — "cross-tenant write emits exactly one kbju_tenant_breach_detected event and throws" + "TenantNotAllowedError has code tenant_not_allowed".
  - **AC-3** (same-tenant zero events): `tests/observability/breachDetector.test.ts` — "same-tenant read emits zero breach events" + "same-tenant write emits zero breach events" + BreachDetectingTenantStore same-tenant suites.
  - **AC-4** (`GET /kbju/health` numeric `breach_count_last_hour`): `tests/observability/breachDetector.test.ts` — "/kbju/health breach_count_last_hour" suite (live `http.request` to running server, asserts `typeof res.breach_count_last_hour === 'number'` and value `1`). Verified independently; this exercises the live endpoint.
  - **AC-5** (no raw user payload in breach events): `tests/observability/breachDetector.test.ts` — "redacted event JSON contains no forbidden raw payload fields"; asserts JSON.stringify absence of `meal_text`, `username`, `transcript`, `prompt`, `provider_payload`, `telegram_id`, `user_id`, `raw_prompt`, `raw_transcript`.
  - **AC-6** (lint/typecheck/tests/validate green): Verified independently — `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (598 passed, 0 failed), `python3 scripts/validate_docs.py` (80 artifacts, 0 failed).
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
  - All §6 ACs pass.
  - PR references TKT-017@0.1.0.
  - No `TODO`/`FIXME` left without backlog note (none found in changed files).
  - Executor filled §10 Execution Log.
  - Ticket frontmatter `status: in_review` promoted in separate commit.
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
None.

### Medium
- **F-M1 (src/sidecar/factory.ts:53):** `createSidecarDeps()` does not instantiate `BreachDetector` and does not wrap the inner store with `BreachDetectingTenantStore`. In the production boot path (`src/main.ts:268` → `createServer()` with no explicit `deps`), `effectiveDeps` falls back to `createSidecarDeps(pilotUserIds)`, leaving `deps.breachDetector` `undefined`. Consequently, `/kbju/health` will always report `breach_count_last_hour: 0` and no real cross-tenant access will ever trigger a breach event. The detector is correct but inert in production. — *Responsible role:* Executor / Architect. *Suggested remediation:* File a follow-up ticket (e.g., TKT-018 or boot-bridge) to instantiate `BreachDetector` and wrap the `TenantStore` with `BreachDetectingTenantStore` in the production initialization path. Until then, add a code comment in `src/sidecar/factory.ts:53` and `src/main.ts:258` documenting that `breachDetector` is intentionally unpopulated pending boot-bridge wiring.
- **F-M2 (src/store/tenantStore.ts:925):** `BreachDetectingTenantStore.withTransaction` guards the transaction entry (`this.guard(userId, "write", "transaction")`) but delegates the raw inner `TenantScopedRepository` to the action callback. If the action calls inner repository methods with a different `userId` (e.g., `repo.getUser(OTHER_USER)`), the detector will not fire. PostgreSQL RLS (`set_config('app.user_id', ...)` in the inner `withTransaction`) provides defense-in-depth, so data access is still blocked, but the alarm is silent—violating the G1 promise of detecting *every* cross-tenant access. — *Responsible role:* Executor. *Suggested remediation:* Either (a) wrap the `repository` passed to `action` with a thin `TenantScopedRepository` proxy that re-invokes `detector.checkTenantAccess` on every method, or (b) document the accepted limitation in a JSDoc comment on `BreachDetectingTenantStore.withTransaction` stating that intra-transaction tenant isolation relies on PostgreSQL RLS and that the action must not call inner methods with a mismatched `userId`.

### Low
- **F-L1 (src/observability/breachDetector.ts:75):** `checkTenantAccess` pushes breach timestamps to `this.breachTimestamps` but only `getBreachCountLastHour` prunes stale entries. If the health endpoint is not polled (or under a sustained attack), the array grows unbounded until the process restarts. — *Responsible role:* Executor. *Suggested remediation:* Prune stale entries inside `checkTenantAccess` before pushing, or cap `breachTimestamps.length` to a safe maximum (e.g., 10,000).
- **F-L2 (src/telegram/types.ts:95):** `breachDetector?: BreachDetector` is added to `C1Deps` solely to support `src/main.ts:78` health-endpoint wiring. This is justified because `main.ts` is a TKT-017 §5 output and the field is optional, but it slightly widens the C1 dependency surface for a C12 concern. Acceptable because it avoids a broader refactor of the sidecar seam. No action required.

## Red-team probes (Reviewer must address each)
- **Error paths:** The detector has no external I/O and no async calls. `TenantNotAllowedError` carries typed fields for observability. No Telegram/OpenFoodFacts/Whisper/DB-lock/LLM-timeout exposure. N/A.
- **Concurrency:** `BreachDetector` stores state in an in-memory array (`breachTimestamps`). In Node's single-threaded event loop, `push()` and the pruning loop in `getBreachCountLastHour` are atomic with respect to each other unless `WorkerThreads` are used (they are not). No async gaps between `push` and array access. Concurrent `checkTenantAccess` calls could interleave but will not corrupt the array. Minor concern: if `getBreachCountLastHour` is called concurrently with `checkTenantAccess`, a newly-pushed timestamp could be pruned immediately if it falls on the cutoff boundary, resulting in a transient under-count of 1. Acceptable for a rolling-hour approximate metric. See F-L1 for memory-growth concern.
- **Input validation:** `requesterUserId` and `dataOwnerUserId` are compared with strict equality (`===`). No UUID validation inside `BreachDetector`; malformed strings are treated as opaque tokens. This is correct because the detector is a downstream guard, not a validator.
- **Prompt injection:** The detector does not interact with LLMs. N/A.
- **Secrets:** No credential committed, logged, or leaked. `sha256Half` uses `node:crypto`. No hard-coded tokens or keys. PASS.
- **Observability under incident:** `BreachDetector` is pure in-memory; a process crash loses breach history. This is by design per TKT §3 (ephemeral logged/metered events, no DB table). The `emit` dep is injectable, so production wiring can forward events to durable logs. The current PR leaves `emit` unwired in production (F-M1).

## AC-by-AC verification detail

| AC | TKT §6 text | Evidence | Verdict |
|---|---|---|---|
| 1 | Synthetic cross-tenant read emits one `kbju_tenant_breach_detected` event within 5 min p95 OR 30 s in deterministic fake-timer test. | `breachDetector.test.ts:50-60` "cross-tenant read emits exactly one kbju_tenant_breach_detected event and throws" | PASS |
| 2 | Synthetic cross-tenant write emits one `kbju_tenant_breach_detected` event and returns/propagates `tenant_not_allowed`. | `breachDetector.test.ts:62-72` "cross-tenant write emits exactly one kbju_tenant_breach_detected event and throws" + `breachDetector.test.ts:74-83` "TenantNotAllowedError has code tenant_not_allowed" | PASS |
| 3 | Same-tenant read/write emits zero breach events. | `breachDetector.test.ts:36-48` same-tenant read/write tests + `breachDetector.test.ts:85-125` BreachDetectingTenantStore same-tenant suite | PASS |
| 4 | `GET /kbju/health` includes numeric `breach_count_last_hour`. | `breachDetector.test.ts:245-275` "/kbju/health breach_count_last_hour" — spins up `http.Server`, calls live endpoint via `http.request`, asserts `typeof res.breach_count_last_hour === 'number'` and value `1`. | PASS |
| 5 | No serialized breach event contains raw user payload fields. | `breachDetector.test.ts:127-148` "redacted event JSON contains no forbidden raw payload fields" — asserts absence of `meal_text`, `username`, `transcript`, `prompt`, `provider_payload`, `telegram_id`, `user_id`, `raw_prompt`, `raw_transcript`. | PASS |
| 6 | Build, lint, typecheck, tests, validate_docs green. | Independent run: `npm run build` clean; `npm run lint` clean; `npm run typecheck` clean; `npm test` 598 passed 0 failed; `python3 scripts/validate_docs.py` 80 artifacts 0 failed. | PASS |

## Scope evaluation

- **`src/telegram/types.ts` (1-line slot):** Justified. `src/main.ts` needs to read `deps?.breachDetector?.getBreachCountLastHour()`. Without the typed slot on `C1Deps`, the health-endpoint wiring would not compile. The field is optional, so it does not force C1 consumers to instantiate a detector. Not scope creep.

## Boundary evaluation

- **C12 location:** `BreachDetectingTenantStore` sits at the `TenantStore` / `TenantScopedRepository` boundary (`src/store/tenantStore.ts:910`), exactly as required by ARCH-001@0.5.0 §3.12. It is NOT at the Telegram ingress / HTTP edge. The HTTP bridge already has a 403 for non-allowlisted Telegram IDs (`src/main.ts:130-135`), which is a separate concern. PASS.

## Redaction / PII evaluation

- **`RedactedBreachEvent` fields:** `event_name`, `requesting_user_id_hash`, `data_owner_user_id_hash`, `operation`, `entity_type`, `timestamp_utc`. No raw user payload (`meal_text`, `username`, `transcript`, `prompt`, `provider_payload`, `telegram_id`, `user_id`, `raw_prompt`, `raw_transcript`) is present. The test's `FORBIDDEN_JSON_KEYS` list aligns with ARCH-001@0.5.0 §8.1 intent (raw prompt text, raw transcript text, full Telegram usernames, raw provider responses, raw meal text) and is broader in a safe direction. PASS.

## Deterministic timing evaluation

- **Rolling-hour pruning:** `breachDetector.test.ts:156-168` "getBreachCountLastHour prunes entries older than one hour" uses a controlled `now` Date object (`new Date("2026-05-05T12:00:00Z")`) passed as a factory to `deps.now`, then mutates `now.setTime(...)` to advance by 61 minutes. This is a deterministic fake-timer test satisfying TKT-017 §6 AC-1 timing requirements. PASS.

## Dependency evaluation

- **No new runtime dependency:** `package.json` is unchanged. `node:crypto` (`createHash`) is a built-in Node.js module. PASS.

## Typing evaluation

- **`src/`:** No `as any`, no `getattr`-style dynamic access, no untyped `Proxy` found in `src/`.
- **`tests/`:** Two `as any` casts on `CreateUserRequest` fixtures (`breachDetector.test.ts:190`, `breachDetector.test.ts:215`). These are test-only minimal stubs and acceptable per repo conventions. PASS.

## PII pattern coverage

- The `RedactedBreachEvent` is emitted via an injectable `emit` function; the event structure itself contains no PII. It does not pass through `src/observability/events.ts` `emitLog` in this PR, so the existing `PII_PATTERNS` are not directly exercised. The `emit` dep should be wired to the observability pipeline in the follow-up production-wiring ticket so that downstream logging still respects the forbidden-field list. PASS for this PR's scope.

## Production wiring opinion

`BreachDetectingTenantStore` is implemented and tested, but `createSidecarDeps()` does not instantiate `BreachDetector` and does not wrap the inner store. In the production path (`startServer` → `createServer` with fallback to `createSidecarDeps`), `/kbju/health` will report `breach_count_last_hour: 0` always.

**Verdict:** This is **(a) acceptable for TKT-017** because TKT-017 §5/§6 only require synthetic detection, the health endpoint structure, and unit tests. The ticket does not list `src/sidecar/factory.ts` as an output and does not mandate production boot-path wiring. However, it is a **MEDIUM** correctness gap (F-M1) because a G1 detector that is never armed in production silently fails its purpose. I recommend the PO file a follow-up ticket (e.g., TKT-0XX "Wire BreachDetector into sidecar production boot path") before the next release, and the Executor add a short code comment documenting the unpopulated `breachDetector` field.

## Qodo PR-Agent cross-check

- PR-Agent verdict: clean, no security concerns, no major issues detected.
- My independent findings (F-M1, F-M2, F-L1) are not contradicted by PR-Agent; they are design/scope gaps beyond the PR-Agent's surface-level scan. I remain the load-bearing reviewer.

## SHA reviewed
`ed20f5dd879e7246781edaeb8943691b06426622`
