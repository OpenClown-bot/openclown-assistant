---
id: TKT-017
title: "Continuous Tenant-Isolation Breach Detector (G1)"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C10b Tenant-Isolation Breach Detector"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-017: Continuous Tenant-Isolation Breach Detector (G1)

## 1. Goal
Implement C10b as an hourly background scan over all user-owned tables that detects cross-user references and emits breach_events + PO Telegram alerts.

## 2. In Scope
- `src/observability/breach-detector.ts` — scan logic
- `src/observability/breach-detector.scheduler.ts` — setInterval scheduler
- `migrations/017_breach_events.sql` — breach_events table
- `tests/observability/breach-detector.test.ts` — unit + integration tests
- Wire into `src/main.ts` boot sequence

## 3. NOT In Scope
- Fixing detected breaches (alert-only; TKT-012@0.1.0 right-to-delete is the remediation path)
- Real-time streaming breach detection (hourly batch scan is sufficient per PRD-002@0.2.1 G1)
- End-of-pilot K4 cross-user audit (already exists per TKT-012@0.1.0)
- PostgreSQL RLS implementation (already exists per ADR-001@0.1.0)
- KBJU sidecar horizontal scaling

## 4. Inputs
- ARCH-001@0.5.0 §3.10b (C10b), §4.9, §5 (breach_events schema), §8 (telemetry), §9.2 (access control)
- ADR-001@0.1.0 (RLS)
- PRD-002@0.2.1 §2 G1
- `src/observability/events.ts` (buildRedactedEvent, emitLog)
- `src/index.ts` (shared types)
- Existing schema in `migrations/` directory

## 5. Outputs
- [ ] `src/observability/breach-detector.ts` — `breachScan(pgPool): BreachResult[]`, enumerates all user-owned tables from §5, runs cross-user reference query per table, collects findings with table/column/ref_count (no user payloads)
- [ ] `src/observability/breach-detector.scheduler.ts` — `startBreachDetection(pgPool, deps)`, starts `setInterval(breachScan, BREACH_SCAN_INTERVAL_MS)` (default 3600000 = hourly), emits breach_events rows, sends PO alert, logs each scan run
- [ ] `migrations/017_breach_events.sql` — creates `breach_events` table per ARCH-001@0.5.0 §5
- [ ] `tests/observability/breach-detector.test.ts` — mock user-owned tables, inject cross-user reference, assert breach_events row emitted with correct source_table/source_column, assert PO alert sent, test empty scan (no breach found), test scan failure (DB unreachable) emits error event not crash
- [ ] Update `src/main.ts` to call `startBreachDetection` after C3 initialization

## 6. Acceptance Criteria
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test -- tests/observability/breach-detector.test.ts` passes (≥80 % coverage)
- [ ] Migration runs successfully: `psql $DATABASE_URL -f migrations/017_breach_events.sql`
- [ ] Simulated breach (insert cross-user reference in user-owned table) → `breach_events` row within 1 hour + 30 s
- [ ] PO_ALERT_CHAT_ID receives Telegram message with table name, column, reference count
- [ ] No raw user data in breach_events findings or PO alert
- [ ] scan_interval_start / scan_interval_end recorded correctly in breach_events
- [ ] Empty scan (no breaches) emits a metric `kbju_tenant_breach_scan_completed` with `findings=0`
- [ ] DB unreachable during scan → emits error event to C10, does not crash sidecar process, retries next interval

## 7. Constraints
- Do NOT add new runtime dependencies.
- Breach detection does NOT block user traffic — it is alert-only.
- Findings column: JSON array of breached references, redacted — no user payloads (meal text, user IDs in plaintext, personal data).
- PO_ALERT_CHAT_ID env var must be set; if unset, skip alert and log warning at startup.
- BREACH_SCAN_INTERVAL_MS env var (default 3600000). Min 300000 (5 min), max 86400000 (24 h).
- Cross-user reference query MUST use `kbju_audit` BYPASSRLS role connection (AUDIT_DB_URL) per ARCH-001@0.5.0 §9.2.