---
id: TKT-017
title: "Continuous Tenant Breach Detector"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C3 Tenant-Scoped Store; C10 Cost, Degrade, and Observability Service; C12 Continuous Tenant Breach Detector"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "codex-gpt-5.5"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-017: Continuous Tenant Breach Detector

## 1. Goal (one sentence, no "and")
Detect cross-principal storage references continuously.

## 2. In Scope
- Add a C12 detector around user-scoped C3 repository operations.
- Add durable breach-event storage that remains right-to-delete compatible.
- Add redacted structured logs, Prometheus metrics, and PO Telegram alert hooks for breach events.
- Add synthetic breach-injection tests proving PRD-002@0.2.1 G1 latency and zero false-negative parity against the K4 audit.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No model-stall detection; see TKT-018@0.1.0.
- No PR-Agent CI telemetry; see TKT-019@0.1.0.
- No Telegram allowlist scaling; see TKT-020@0.1.0.
- No weakening of RLS, C3 user scoping, or C10 redaction.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.3
- ARCH-001@0.5.0 §3.10
- ARCH-001@0.5.0 §3.11
- ARCH-001@0.5.0 §3.12
- ARCH-001@0.5.0 §4.10
- ARCH-001@0.5.0 §5
- ARCH-001@0.5.0 §8.5
- PRD-002@0.2.1 §2 G1
- PRD-002@0.2.1 §5 US-1
- PRD-002@0.2.1 §5 US-5
- `src/store/tenantStore.ts`
- `src/store/schema.sql`
- `src/observability/events.ts`
- `src/observability/kpiEvents.ts`
- `src/telegram/entrypoint.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/observability/tenantBreachDetector.ts` exporting the C12 detector.
- [ ] `src/store/tenantStore.ts` wrapping user-scoped operations with principal/reference checks.
- [ ] `src/store/schema.sql` adding only C12 durable event storage needed for right-to-delete compatibility.
- [ ] `src/observability/events.ts` adding redacted C12 event emission.
- [ ] `src/observability/kpiEvents.ts` adding `kbju_tenant_breach_events_total` constants.
- [ ] `tests/observability/tenantBreachDetector.test.ts` covering detection, redaction, metrics, alerts, and parity assertions.
- [ ] `tests/store/tenantBreachStore.test.ts` covering persistence and right-to-delete deletion behavior.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/observability/tenantBreachDetector.test.ts tests/store/tenantBreachStore.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] A synthetic storage operation with `referenced_user_id != requesting_user_id` emits a C12 event.
- [ ] The synthetic breach test proves the offending operation is blocked or flagged before commit according to ARCH-001@0.5.0 §3.12.
- [ ] A breach event increments `kbju_tenant_breach_events_total`.
- [ ] A breach event triggers a PO alert call without meal text, usernames, raw transcripts, raw prompts, raw media, provider keys, provider responses, or full Telegram identifiers.
- [ ] The test suite proves C12 catches every synthetic breach that the C11 K4 audit fixture catches.
- [ ] Right-to-delete removes user-scoped C12 rows in the same transaction boundary as existing user-scoped data.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT create a cross-tenant payload query path in application runtime.
- Do NOT log raw payloads or unredacted user identifiers.
- Do NOT weaken PostgreSQL RLS or the dedicated `kbju_audit` role boundaries.
- Do NOT modify files outside §5 Outputs.
- Codex is required because this ticket is tenant-isolation security-critical.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-017-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- YYYY-MM-DD HH:MM model-id: started -->
<!-- YYYY-MM-DD HH:MM model-id: opened PR #NN -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
