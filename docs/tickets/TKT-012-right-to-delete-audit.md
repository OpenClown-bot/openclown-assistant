---
id: TKT-012
title: "Right To Delete Audit"
status: done
arch_ref: ARCH-001@0.4.0
component: "C11 Right-to-Delete and Tenant Audit Service"
depends_on: ["TKT-002@0.1.0", "TKT-003@0.1.0", "TKT-004@0.1.0", "TKT-010@0.1.0", "TKT-011@0.1.0"]
blocks: ["TKT-014@0.1.0"]
estimate: M
assigned_executor: "codex-gpt-5.5"
created: 2026-04-26
updated: 2026-05-02
completed_at: 2026-05-02
completed_by: codex-gpt-5.5
completed_note: "Executor PR #84 + Reviewer PR #85 merged after Kimi K2.6 iter-3 pass on Executor final HEAD `24e0c42469b3d02217f614e9b15b0242863147aa`; Ticket Orchestrator cross-reviewer audit pass-1 + Devin Orchestrator ratification audit pass-2 both clean; PR-Agent CI workflow stalled @12m11s (4-of-4 final-HEAD pilot pattern, escalating BACKLOG-009 §pr-agent-ci-tail-latency-investigation criticality) — classified as infra failure under DO authority per BACKLOG-008 §pr-agent-tail-latency; first non-GLM Executor pilot (codex-gpt-5.5 via opencode + OmniRoute, empirically verified — closes BACKLOG-009 §agents-md-vs-llm-routing-md-runtime-mismatch in favour of AGENTS.md, llm-routing.md aligned in this closure-PR with explicit PO authorisation); 1 Low (F-L2 weak AUDIT_DB_URL lint scan) + 1 Low PR-Agent (F-PA-2 flaky concurrency test barrier) deferred to BACKLOG-010."
---

# TKT-012: Right To Delete Audit

## 1. Goal (one sentence, no "and")
Implement right-to-delete plus the tenant isolation audit runner.

## 2. In Scope
- Add C11 `/forget_me` and Russian natural-language deletion intent handler interface for C1.
- Require a single yes/no Russian confirmation before deletion.
- Hard-delete all user-scoped rows listed in ARCH-001@0.4.0 §5 inside one transaction after locking the user (per-user PostgreSQL advisory lock on `users.id`); the `users` row itself is removed in the same transaction.
- Handle the no-row-to-mark case: a repeat `/forget_me` from a Telegram user with no matching `users` row returns the Russian fresh-start message (ARCH-001@0.4.0 §3.11) without persisting anything.
- Stop future summary schedules before deleting the user row.
- Add end-of-pilot K4 audit runner that opens its own connection using `AUDIT_DB_URL` (the `kbju_audit` `BYPASSRLS` role provisioned in TKT-002@0.1.0); the runner writes only aggregate counts/findings to `tenant_audit_runs.findings`.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No ordinary meal soft-delete behavior; that belongs to TKT-010@0.1.0.
- No backup restore tooling; that belongs to TKT-013@0.1.0.
- No admin web UI or dashboard.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.4.0 §3.11 C11 Right-to-Delete and Tenant Audit Service
- ARCH-001@0.4.0 §4.7 Right-to-delete and tenant audit
- ARCH-001@0.4.0 §5 Data Model / Schemas
- ARCH-001@0.4.0 §9.2 Access Control and Tenant Isolation
- ARCH-001@0.4.0 §9.5 PII Handling and Deletion
- ADR-001@0.1.0
- ADR-009@0.1.0
- `src/shared/types.ts`
- `src/store/tenantStore.ts`
- `src/telegram/types.ts`
- `src/observability/events.ts`
- `src/history/historyService.ts`
- `src/summary/summaryScheduler.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/privacy/types.ts` exporting deletion and audit types
- [ ] `src/privacy/messages.ts` exporting Russian deletion confirmation/result copy
- [ ] `src/privacy/rightToDelete.ts` exporting C11 deletion flow
- [ ] `src/privacy/tenantAudit.ts` exporting K4 audit runner
- [ ] `tests/privacy/rightToDelete.test.ts`
- [ ] `tests/privacy/tenantAudit.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/privacy/rightToDelete.test.ts tests/privacy/tenantAudit.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove cancellation leaves all user rows unchanged.
- [ ] Tests prove confirmed deletion removes `users`, profiles, targets, schedules, onboarding state, transcripts, drafts, confirmed meals, items, summaries, audit events, metric/cost events, lookup cache rows, and K7 labels for that `user_id`.
- [ ] Tests prove repeated deletion after prior deletion returns a Russian fresh-start/already-deleted result without old personalization.
- [ ] Tests prove concurrent delete and meal confirmation serialize on `user_id` lock.
- [ ] Tests prove tenant audit returns counts/findings without user payloads.
- [ ] Tests prove the audit runner refuses to start if `AUDIT_DB_URL` is unset, and that no application skill imports `AUDIT_DB_URL` (CI lint check).
- [ ] Tests prove a repeat `/forget_me` after prior deletion does not insert any new `users` row and returns the Russian fresh-start copy.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT retain user-scoped audit events after right-to-delete completes.
- Do NOT expose another user's data in tenant audit output.
- Use C3 transactions and repository methods only.
- Codex assignment is required because permanent deletion, locks, and tenant audit are security-critical.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-012-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-02 11:12 UTC codex-gpt-5.5: started; runtime observed opencode + Codex GPT-5.5 high (cx/gpt-5.5-high / omniroute/cx/gpt-5.5-high) -->
<!-- 2026-05-02 11:25 UTC codex-gpt-5.5: opened PR #84; local checks passed: npm test -- tests/privacy/rightToDelete.test.ts tests/privacy/tenantAudit.test.ts, npm run lint, npm run typecheck, python3 scripts/validate_docs.py -->
2026-05-02 codex-gpt-5.5: iter-2 pushed (HEAD `24e0c42`) — fixed F-H1 (deletion-order FK violation; reordered `confirmed_meals` before `meal_drafts`, `meal_items` / `kbju_accuracy_labels` before `confirmed_meals`), F-M1 (negated-phrase false positive; added `NEGATED_DELETION_PATTERNS_RU` regex set + tests), F-L1 (weak deletion-order test; now asserts full 17-table order + 3 child-before-parent FK pairs).
2026-05-02 kimi-k2.6: Reviewer iter-3 verdict pass on Executor final HEAD `24e0c42469b3d02217f614e9b15b0242863147aa` (RV-CODE-012); F-H1 + F-M1 + F-L1 all RESOLVED in iter-2; F-L2 (weak AUDIT_DB_URL lint scan) DEFERRED — fix needs repo-wide ESLint or CI script outside TKT-012@0.1.0 §5 outputs; PR-Agent F-PA-1 (Privacy Compliance Risk on mixed-intent ambiguity) classified NOT A FINDING (PRD-001@0.2.0 US-8 establishes explicit `/forget_me` as canonical right-to-delete; ambiguous mixed-intent messages correctly errs toward caution); PR-Agent F-PA-2 (flaky concurrency test) classified REAL/LOW but does not undermine AC proof (production serialization is PostgreSQL `pg_advisory_xact_lock`, unit test only verifies service-level call ordering) — DEFERRED.
2026-05-02 pr-agent (qwen-3.6-plus): persistent review settled to final Executor HEAD `24e0c42` with verdict ⚡ no major issues + 🔒 no security concerns + 🧪 PR contains tests; 2 focus areas (F-PA-1 Privacy Compliance Risk, F-PA-2 Flaky Concurrency Test) promoted into Kimi iter-3 review and classified there; workflow run id 25251565864 cancelled @12m11s (4-of-4 final-HEAD pilot pattern, structural — see BACKLOG-009 §pr-agent-ci-tail-latency-investigation, escalated to Critical).
2026-05-02 ticket-orchestrator (gpt-5.5-thinking): cross-reviewer audit pass-1 — confirmed Reviewer re-engaged for both substantive Executor pushes (iter-1 → Kimi iter-1 fail; iter-2 → Kimi iter-2 verify-fixes → Kimi iter-3 verify-PR-Agent-final-head-findings-and-pass; zero post-pass substantive commits); confirmed RV-CODE-012 numbering AND canonical filename correct per BACKLOG-008 §reviewer-rv-code-numbering + BACKLOG-009 §rv-code-file-naming-canonical (no rename needed in closure-PR); empirical runtime resolution — PO ran opencode + Codex GPT-5.5 high via OmniRoute successfully (`cx/gpt-5.5-high` / `omniroute/cx/gpt-5.5-high`), supporting AGENTS.md `opencode + OmniRoute` row over llm-routing.md stale `Codex CLI` row; closure-ready signal handed back to Devin Orchestrator with infra caveat for stalled PR-Agent workflow.
2026-05-02 devin-orchestrator (glm-5.1): ratification audit pass-2 — independently re-verified Kimi iter-3 verdict + 9/9 AC matrix PASS + scope compliance + 15/15 tests + lint/typecheck/validate_docs clean (60 artifacts); independently re-classified all 4 Kimi findings (F-H1/F-M1/F-L1 RESOLVED; F-L2 DEFERRED) and both PR-Agent focus areas (F-PA-1 NOT A FINDING; F-PA-2 DEFERRED) — 100% match with TO pass-1; verified Reviewer re-engagement constraint MET (zero post-pass substantive Executor commits); classified PR-Agent stall as infra failure under DO authority per BACKLOG-009 §pr-agent-ci-tail-latency-investigation rule; merge-safe sign-off issued.
2026-05-02 devin-orchestrator (glm-5.1): PO merged Executor PR #84 + Reviewer PR #85; Devin Orchestrator opened closure-PR with TKT-012 status flip + RV-CODE-012 frontmatter promotion + BACKLOG-010 (2 low follow-ups F-L2/F-PA-2 + 1 clerical-resolved entry closing BACKLOG-009 §agents-md-vs-llm-routing-md-runtime-mismatch) + `docs/knowledge/llm-routing.md` lines 40+42 reconciliation under explicit PO authorisation recorded verbatim in PR body.

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
