---
id: TKT-017
title: "G1 C12 Tenant-Isolation Breach Detector — per-op proxy + hourly drift scan"
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
component: "C12 Tenant-Isolation Breach Detector"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "glm-5.1"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-017: G1 C12 Tenant-Isolation Breach Detector — per-op proxy + hourly drift scan

## 1. Goal (one sentence, no "and")
Implement C12 as a two-role detector — a per-op proxy that wraps `tenantStore` writes (PRD-002@0.2.1 §2 G1 fast-path) plus an hourly drift scan over user-owned tables (PRD-002@0.2.1 §2 G1 batch-path) — emitting `breach_event` rows + PO Telegram alerts on cross-user references.

## 2. In Scope
- `src/observability/breachDetector/proxy.ts` — per-operation proxy that wraps `tenantStore.write*` calls, invariant-checks `caller_user_id == row.user_id` before commit; on mismatch, throws `TenantIsolationBreachError`, persists `breach_event` (`detection_mode="proxy"`), increments `kbju_breach_count_total{detection_mode="proxy",source_table}`.
- `src/observability/breachDetector/driftScan.ts` — `breachDriftScan(auditPool): BreachResult[]` — enumerates user-owned tables from ARCH-001@0.5.0 §5 schema, runs `SELECT s.user_id AS source, t.user_id AS target FROM <src_table> s JOIN <fk_table> t ON …` cross-user reference queries per table; uses the `kbju_audit` BYPASSRLS role exclusively (no caller-context bleeding).
- `src/observability/breachDetector/scheduler.ts` — `startBreachDriftScan(auditPool, deps)`; `setInterval(breachDriftScan, BREACH_SCAN_INTERVAL_MS)` (default `3600000` ms); persists findings as `breach_event` rows (`detection_mode="drift_scan"`); sends PO alert via the gateway send-message bridge (NOT direct Telegram API); logs each scan run with `scan_started_at`, `scan_completed_at`, `findings_count`.
- `migrations/017_breach_events.sql` — creates `breach_events` table per ARCH-001@0.5.0 §5.1.
- `config/breachScanConfig.json` — declarative list of user-owned tables to scan (loaded at boot; rejects empty list with FAIL FAST).
- `tests/observability/breachDetector.proxy.test.ts` — proxy invariant unit tests (5 scenarios per ARCH-001@0.5.0 §11.2).
- `tests/observability/breachDetector.driftScan.test.ts` — drift-scan integration tests (synthetic cross-user-reference injection; empty-scan-no-breach; DB-unreachable retry).
- `tests/observability/breachDetector.twoRoleBoundary.test.ts` — Rule-1-violation guard test per ARCH-001@0.5.0 §0.6 S3 mitigation: assert proxy uses `tenantStore` connection role, drift scan uses `kbju_audit` BYPASSRLS role, **never share a pg.Pool**.
- Wire `startBreachDriftScan` into `src/main.ts` boot sequence (right after `tenantStore` init; before HTTP server `listen()`).

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- Fixing detected breaches (alert-only at v0.5.0; remediation belongs to TKT-012@0.1.0 right-to-delete).
- Real-time streaming breach detection (event-stream subscription) — hourly drift batch + per-op proxy is sufficient at PRD-002@0.2.1 §2 G1 scope.
- End-of-pilot K4 cross-user audit — already exists per TKT-012@0.1.0 §10 audit query; this ticket's drift scan is a complement, not a replacement.
- PostgreSQL RLS policy changes — already established by ADR-001@0.1.0; drift scan reads through the audit role with `BYPASSRLS`, not through RLS.
- Breach remediation UI / dashboard.
- Sidecar boot entrypoint — that is TKT-016@0.1.0; this ticket only registers a `startBreachDriftScan` call into the existing entrypoint.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.12 (C12), §4.9 (data flow inbound), §5.1 (breach_events schema), §8.1 (G1 metric names), §9.2 (env-var access control), §10.2 (sidecar restart procedure), §11.2 (component-level tests).
- ADR-001@0.1.0 (User-scoped PostgreSQL Store with RLS).
- ADR-011@0.1.0 (HYBRID integration shape — establishes that the sidecar owns C12).
- PRD-002@0.2.1 §2 G1, §A.5 §A.6 (red-team tenant-isolation probes), §7 (5% overhead budget).
- `src/store/tenantStore.ts` — current write-path (proxy attaches here).
- `src/store/queries.ts` — list of user-owned table names (proxy must enumerate).
- `src/observability/events.ts` — `buildRedactedEvent`, `emitLog` for redaction-rule reuse.
- BACKLOG-009 §tenant-isolation-breach-detection-required.

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/observability/breachDetector/proxy.ts` exporting `wrapTenantStore(tenantStore: TenantStore, deps): TenantStore` (Proxy that intercepts every write).
- [ ] `src/observability/breachDetector/driftScan.ts` exporting `breachDriftScan(auditPool: pg.Pool, config: BreachScanConfig): Promise<BreachResult[]>`.
- [ ] `src/observability/breachDetector/scheduler.ts` exporting `startBreachDriftScan(auditPool, deps): { stop: () => void }`.
- [ ] `src/observability/breachDetector/types.ts` exporting `TenantIsolationBreachError`, `BreachResult`, `BreachScanConfig`.
- [ ] `migrations/017_breach_events.sql` creating `breach_events` table.
- [ ] `config/breachScanConfig.json` (boot-loaded list of user-owned tables; non-empty).
- [ ] `tests/observability/breachDetector.proxy.test.ts` (≥80% coverage).
- [ ] `tests/observability/breachDetector.driftScan.test.ts` (≥80% coverage; includes synthetic cross-user injection).
- [ ] `tests/observability/breachDetector.twoRoleBoundary.test.ts` (Rule-1-violation guard test).
- [ ] `src/main.ts` updated to invoke `wrapTenantStore` + `startBreachDriftScan` (no other changes).

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean.
- [ ] `npm test -- tests/observability/breachDetector.proxy.test.ts` passes; coverage ≥80%.
- [ ] `npm test -- tests/observability/breachDetector.driftScan.test.ts` passes; coverage ≥80%.
- [ ] `npm test -- tests/observability/breachDetector.twoRoleBoundary.test.ts` passes (assertion: proxy and drift scan use distinct `pg.Pool` instances).
- [ ] Migration runs without error: `psql "$DATABASE_URL" -f migrations/017_breach_events.sql`.
- [ ] Synthetic breach test: injecting a row with `caller_user_id != row.user_id` via the proxy raises `TenantIsolationBreachError` AND inserts a `breach_events` row with `detection_mode='proxy'` within 1 s.
- [ ] Synthetic drift breach test: inserting a cross-user reference via the audit role and triggering `breachDriftScan(auditPool, config)` returns at least one `BreachResult` AND inserts a `breach_events` row with `detection_mode='drift_scan'`.
- [ ] PO alert test: with `PO_ALERT_CHAT_ID` set, a synthetic breach causes a Telegram alert dispatched via the gateway bridge (asserted via mock); alert body contains `table_name`, `source_column`, `findings_count` and contains NO raw user payloads.
- [ ] Empty scan emits `kbju_breach_count_total{...,findings_count=0}` and `kbju_breach_scan_completed_total` increments without inserting any row.
- [ ] DB-unreachable test: `breachDriftScan` with a poisoned audit pool emits an error event to C10, does NOT crash the sidecar process, and the next scheduled interval still runs.
- [ ] Out-of-range `BREACH_SCAN_INTERVAL_MS` (e.g. `60000`) clamps to the `[300000, 86400000]` bounds and logs a `kbju_breach_scan_interval_clamped` warn.
- [ ] Per-op overhead micro-benchmark: proxy adds ≤1 ms p95 to a `tenantStore.write*` call (PRD-002@0.2.1 §7 budget).

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- The proxy's invariant-check is alert-only — it MUST throw on breach (preventing the bad write) but MUST NOT attempt to "fix" the row.
- `breach_events.findings` column MUST be a JSON array of breach references with column/ref_count keys ONLY — NEVER raw user payloads (meal text, full Telegram usernames, prompts, transcripts).
- `PO_ALERT_CHAT_ID` env var: if unset, log a `kbju_breach_alert_skipped_no_po_chat` warning at boot and continue (the breach event row is still persisted; only the Telegram alert is skipped).
- `BREACH_SCAN_INTERVAL_MS` default 3600000 ms; valid range [300000, 86400000]. Out-of-range clamps + warns.
- The drift-scan path MUST use the `kbju_audit` BYPASSRLS role connection (`AUDIT_DB_URL` env var) — the proxy path MUST use the per-tenant connection — NEVER share a `pg.Pool` between the two roles (Rule-1 architectural-Frankenstein guard per ARCH-001@0.5.0 §0.6 S3).
- Do NOT modify `src/store/tenantStore.ts` directly — the proxy wraps it without changing the underlying class.
- Do NOT extend the `breach_events` schema beyond what ARCH-001@0.5.0 §5.1 declares.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass.
- [ ] PR opened with link to TKT-017@0.1.0 in description (version-pinned).
- [ ] No `TODO` / `FIXME` left in committed code without a follow-up TKT suggestion logged in the PR body.
- [ ] Executor filled §10 Execution Log.
- [ ] Ticket frontmatter `status: in_review` in a separate commit after the implementation commit.

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-017-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-04 (architect-4 synthesizer claude-opus-4.7-thinking): synthesized this ticket from PR-A's TKT-017 (per-op proxy invariant-check) + PR-B's TKT-017 (hourly drift scan + breach_events schema) + PR-C's TKT-017 (two-role boundary test). The composite per-op-proxy + drift-scan design is a non-load-bearing splice (Rule 2; both paths are independent observability surfaces). The two-role-boundary test (§5 Outputs item 8) is the explicit mitigation for ARCH-001@0.5.0 §0.6 S3 weakest-assumption (Rule-1-violation risk). assigned_executor=glm-5.1 — implementation is straightforward DB layer with clear contract. -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions (single atomic deliverable: a two-role tenant-isolation breach detector for C12).
- [x] NOT-In-Scope has ≥1 explicit item (6 items listed).
- [x] Acceptance Criteria are machine-checkable (every AC has a concrete shell command, test name, or metric assertion).
- [x] Constraints explicitly list forbidden actions.
- [x] All ArchSpec / ADR references are version-pinned (ARCH-001@0.5.0, ADR-001@0.1.0, ADR-011@0.1.0, TKT-012@0.1.0, TKT-016@0.1.0).
- [x] `depends_on: [TKT-016@0.1.0]` correct (sidecar must be bootable before C12 can be wired in); no cycles.
- [x] `assigned_executor: glm-5.1` justified — straightforward DB layer with clear contract; no Codex-tier complexity.
