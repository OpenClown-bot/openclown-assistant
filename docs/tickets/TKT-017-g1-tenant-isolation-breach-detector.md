---
id: TKT-017
title: "G1 tenant-isolation breach detector"
version: 0.1.0
status: done
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-05
completed_at: 2026-05-05
completed_by: "lindwurm.22.shane (PO)"
completed_note: |
  TKT-017@0.1.0 closed after Executor PR #120 (squash sha c9a441c4) and Kimi RV-CODE-017 review PR #121 (squash sha af0e98e0) were both merged to main on 2026-05-05. Implementation final head before PR #120 squash was d227b6bf1314ab6b480827254dcad448b5885902 after two Executor iterations: iter-1 (HEAD ed20f5dd) delivered the C12 BreachDetector + BreachDetectingTenantStore wrapper with all six §6 ACs covered by tests, but Kimi's iter-1 verdict was pass_with_changes on three findings (F-M1 production wiring gap in `createSidecarDeps()`, F-M2 transaction-internal detection bypass via the unwrapped inner TenantScopedRepository, F-L1 unbounded `breachTimestamps[]` if `getBreachCountLastHour()` is never called). Iter-2 (HEAD d227b6b) resolved F-L1 via inline `pruneBreachTimestamps()` extraction called from both `checkTenantAccess()` and `getBreachCountLastHour()` plus a regression test under fake-timers, and resolved F-M2 via a JSDoc block on `BreachDetectingTenantStore.withTransaction` documenting the accepted RLS fallback per ADR-001@0.1.0 §Decision and ARCH-001@0.5.0 §3.12 + §9.2 plus a vitest case asserting transaction-internal cross-tenant repo calls are RLS-denied without firing a breach event. F-M1 was accepted as BACKLOG-deferred per Devin Orchestrator triage on the rationale that TKT-017@0.1.0 §5/§6 only require synthetic detection, health-endpoint structure, and unit tests; production boot-bridge wiring (`createSidecarDeps()` instantiating `BreachDetector` and wrapping the inner TenantStore) is a separate ticket and was filed as a new BACKLOG entry under `docs/backlog/observability-followups.md` § "TKT-NEW-wire-breach-detector-into-production-boot-path". Local pre-merge re-verification on d227b6b passed: `npm run build` clean, `npm run lint` clean, `npm run typecheck` clean, `npm test` 36/36 test files and 693/693 tests passed (iter-1 691 + 2 new iter-2 tests), `python3 scripts/validate_docs.py` 80 artifacts 0 failed. Kimi K2.6 RV-CODE-017 verdict on iter-2 HEAD d227b6b was pass (rv-branch HEAD 8a3e76e). Qodo PR-Agent (DeepSeek V4 Pro on OmniRoute) was green on iter-1 HEAD ed20f5d with no findings; on iter-2 HEAD d227b6b CI hit a GitHub Actions hosted-runner provisioning flake (three consecutive retries timed out at 15 minutes each in the queue with no logs and conclusion=cancelled-promoted-to-failure). Devin Orchestrator declared merge-safe on the basis of (1) iter-1 PR-Agent green plus iter-2 being four purely additive commits with zero changes to the docs-ci validation surface (no `docs/architecture/`, `docs/prd/`, `docs/adr/`, `scripts/validate_docs.py`, or `package.json` modifications), (2) Kimi's load-bearing iter-2 pass verdict, and (3) full local re-verification. PO chose option A (merge now with documented CI infra flake) over option B (wait for runners to recover). Executor model deviation: ticket assigned glm-5.1, executed by glm-5.1 successfully on iter-2 after iter-1 stalled three consecutive times mid-stream around the 105K-token / 52% context point (the same G2 model-stall pattern that TKT-018 will detect automatically); recovered on iter-1 via a locked-design continuation prompt with per-step commit-and-push discipline. No code defect remains; F-M1 is the only outstanding BACKLOG item.
---

# TKT-017: G1 tenant-isolation breach detector

## 1. Goal
Detect and alert on every synthetic or real cross-tenant storage access within PRD-002@0.2.1 G1 timing bounds.

## 2. In Scope
- Add C12 breach detector at the C3 repository boundary or the narrowest equivalent data-access boundary.
- Emit redacted structured breach events and metrics.
- Surface sidecar health count `breach_count_last_hour`.
- Add synthetic breach tests for read and write paths.

## 3. NOT In Scope
- No new database table unless Executor proves durable storage is required; ARCH-001@0.5.0 treats `breach_events` as ephemeral logged/metered events.
- No `AUDIT_DB_URL` import in application request handlers.
- No broad Proxy magic if explicit typed wrappers are clearer and safer.
- No remediation or data repair for detected breaches.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §3.3, §3.12, §5.1, §8, §9.2.
- ADR-001@0.1.0 and PRD-002@0.2.1 §2 G1.
- `src/store/tenantStore.ts`, `src/store/types.ts`, `src/privacy/tenantAudit.ts`.
- `src/observability/events.ts`, `src/observability/kpiEvents.ts`.
- Tests under `tests/store/**`, `tests/privacy/**`, and `tests/observability/**`.

## 5. Outputs
- [ ] `src/observability/breachDetector.ts` or equivalent C12 implementation.
- [ ] Metric name added to `src/observability/kpiEvents.ts` if absent.
- [ ] Sidecar health integration exposing `breach_count_last_hour`.
- [ ] Tests proving same-tenant access passes, cross-tenant read fires a breach, and cross-tenant write fires a breach.
- [ ] Tests proving breach logs/metrics do not include raw meal text, usernames, transcripts, or provider payloads.

## 6. Acceptance Criteria
- [ ] Synthetic cross-tenant read emits one `kbju_tenant_breach_detected` event within 5 minutes p95 in the test clock or within 30 seconds in a deterministic fake-timer test.
- [ ] Synthetic cross-tenant write emits one `kbju_tenant_breach_detected` event and returns/propagates `tenant_not_allowed` or an equivalent typed denial.
- [ ] Same-tenant read/write emits zero breach events.
- [ ] `GET /kbju/health` includes numeric `breach_count_last_hour`.
- [ ] No serialized breach event contains raw user payload fields; tests assert forbidden fields are absent.
- [ ] `npm run lint`, `npm run typecheck`, targeted tests, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Source: synthesized from PR-C C12 boundary and PR-B G1 timing; PR-A's runtime telemetry naming was retained only as non-load-bearing input.
- C12 is a bug alarm; it must not become a user-facing recovery workflow.
- Prefer typed wrappers over `getattr`/dynamic property traversal.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-017@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-017-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets. Executor appends timestamped entries below this line.

### 2026-05-05T13:15Z — glm-5.1 via opencode+OmniRoute

**Files changed:**
- `src/observability/breachDetector.ts` (new) — C12 BreachDetector, TenantNotAllowedError, RedactedBreachEvent, sha256Half
- `src/observability/kpiEvents.ts` — added `tenant_breach_detected` KPI event name + `kbju_tenant_breach_detected` Prometheus metric name
- `src/store/tenantStore.ts` — added BreachDetectingTenantStore wrapper class + import of BreachDetector type
- `src/telegram/types.ts` — added optional `breachDetector` field to C1Deps
- `src/main.ts` — wired `breach_count_last_hour` to detector.getBreachCountLastHour()
- `tests/observability/breachDetector.test.ts` (new) — 13 test cases

**Verification commands and results:**
- `npm run build` — clean
- `npm test` — 598 tests passed, 0 failed
- `npm run lint` — clean
- `npm run typecheck` — clean
- `python3 scripts/validate_docs.py` — 80 artifacts, 0 failed

**C12 boundary location:** `BreachDetectingTenantStore` in `src/store/tenantStore.ts:109` wraps any `TenantStore` instance. Each public method calls `detector.checkTenantAccess(authenticatedUserId, userId, operation, entityType)` before delegating to the inner store.

**breach_count_last_hour computation:** `BreachDetector.getBreachCountLastHour()` maintains an in-memory array of breach timestamps; on each call it prunes entries older than 1 hour and returns the surviving count. Ephemeral — resets on process restart, no DB table. Safe because it only stores timestamps, never raw payloads.

**Redaction proof:** `RedactedBreachEvent` contains only `requesting_user_id_hash` and `data_owner_user_id_hash` (SHA-256 truncated to 16 hex chars), plus `operation`, `entity_type`, `event_name`, `timestamp_utc`. Test asserts no keys matching meal_text, username, transcript, prompt, provider_payload, telegram_id, user_id exist in serialized JSON.

**Deviations from locked design:** None.

**Follow-up suggestions:** None beyond what the ticket already excludes.

### 2026-05-05T13:30Z — glm-5.1 via opencode+OmniRoute (iter-2, RV-CODE-017 pass_with_changes)

**Findings addressed:**
- F-L1 (Low): Unbounded breach timestamp array — extracted `pruneBreachTimestamps()` private method, called inline after `push()` in `checkTenantAccess` AND at start of `getBreachCountLastHour`. Array now self-prunes on every breach insertion, no longer requires a `getBreachCountLastHour` call to bound growth.
- F-M2 (Medium): Transaction-internal detection bypass — added JSDoc on `BreachDetectingTenantStore.withTransaction` documenting that transaction-internal cross-tenant repository calls are RLS-denied at the SQL layer without firing C12 breach events. Added test verifying zero breach events + RLS-error propagation for in-transaction cross-tenant access.

**Files changed:**
- `src/observability/breachDetector.ts` — extracted `pruneBreachTimestamps()`, called from `checkTenantAccess` and `getBreachCountLastHour`
- `src/store/tenantStore.ts` — added 20-line JSDoc on `BreachDetectingTenantStore.withTransaction`
- `tests/observability/breachDetector.test.ts` — added 2 new test cases (15 total)

**Verification commands and results:**
- `npm run build` — clean
- `npm test` — 600 tests passed, 0 failed
- `npm run lint` — clean
- `npm run typecheck` — clean
- `python3 scripts/validate_docs.py` — 80 artifacts, 0 failed

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.
