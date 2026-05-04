---
id: TKT-020
title: "Config-Driven Telegram Allowlist"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C1 Access-Controlled Telegram Entrypoint; C15 Config-Driven Telegram Allowlist"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "codex-gpt-5.5"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-020: Config-Driven Telegram Allowlist

## 1. Goal (one sentence, no "and")
Make Telegram access control config-driven at scale.

## 2. In Scope
- Add C15 allowlist loader/cache preserving existing `TELEGRAM_PILOT_USER_IDS` semantics.
- Add hot reload with propagation to enforcement within 30 seconds.
- Add documented end-to-end allowlist code-path audit.
- Add load tests at N = 2, 10, 100, 1,000, and 10,000 entries.
- Add revocation behavior proving access stops without deleting user data.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No public signup, referral, billing, or subscription behavior.
- No replacement of C1 access-control envelope.
- No right-to-delete behavior change beyond proving revocation is not deletion.
- No new tracking modalities or user-facing UX changes.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.1
- ARCH-001@0.5.0 §3.15
- ARCH-001@0.5.0 §4.10
- ARCH-001@0.5.0 §5 `allowlist_audit_events`
- ARCH-001@0.5.0 §9.1
- ARCH-001@0.5.0 §9.2
- PRD-002@0.2.1 §2 G4
- PRD-002@0.2.1 §5 US-4
- PRD-002@0.2.1 §6 K4
- `src/shared/config.ts`
- `src/telegram/entrypoint.ts`
- `src/telegram/types.ts`
- `src/store/schema.sql`
- `.env.example`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/telegram/allowlist.ts` exporting the C15 loader/cache/checker.
- [ ] `src/shared/config.ts` adding only allowlist config required for C15.
- [ ] `src/telegram/entrypoint.ts` using C15 without weakening existing access checks.
- [ ] `src/store/schema.sql` adding only allowlist audit rows required by ARCH-001@0.5.0 §5.
- [ ] `.env.example` documenting any new allowlist variable with blank/example-safe values only.
- [ ] `docs/architecture/allowlist-code-path-audit.md` documenting every access-check layer, cache, store round-trip, linear scan candidate, and fallback path.
- [ ] `tests/telegram/allowlist.test.ts` covering hot reload, revocation, fallback, malformed config, and O(1)-style lookup behavior.
- [ ] `tests/telegram/allowlistLoad.test.ts` covering N = 2, 10, 100, 1,000, and 10,000 load gates.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/telegram/allowlist.test.ts tests/telegram/allowlistLoad.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] The code-path audit document exists and enumerates Telegram update arrival, access-check layer, cache layer, store round-trips, linear-scan candidates, and fallback paths.
- [ ] Updating allowlist config changes enforcement within 30 seconds without code deploy.
- [ ] Removing a user revokes access to new user-scoped storage operations without deleting existing data.
- [ ] Load tests pass at N = 2, N = 10, N = 100, N = 1,000, and N = 10,000 entries.
- [ ] Per-update allowlist overhead is <=2% of PRD-001@0.2.0 §7 latency budgets at every load-test point.
- [ ] Malformed config keeps the last-known-good allowlist and emits a redacted PO alert.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT replace `TELEGRAM_PILOT_USER_IDS`; extend its semantics as bootstrap/default config.
- Do NOT implement public signup, billing, referrals, or invite links.
- Do NOT hard-delete user data on allowlist removal.
- Do NOT use linear scans on the per-update hot path for the effective allowlist.
- Do NOT modify files outside §5 Outputs.
- Codex is required because this ticket is access-control and scale-performance critical.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-020-NN.md -->

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
