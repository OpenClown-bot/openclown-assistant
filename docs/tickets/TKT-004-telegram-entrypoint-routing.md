---
id: TKT-004
title: "Telegram Entrypoint Routing"
status: in_review
arch_ref: ARCH-001@0.2.0
component: "C1 Access-Controlled Telegram Entrypoint"
depends_on: ["TKT-001@0.1.0", "TKT-002@0.1.0", "TKT-003@0.1.0"]
blocks: ["TKT-005@0.1.0", "TKT-007@0.1.0", "TKT-008@0.1.0", "TKT-009@0.1.0", "TKT-010@0.1.0", "TKT-012@0.1.0"]
estimate: M
assigned_executor: "glm-5.1"
created: 2026-04-26
updated: 2026-04-26
---

# TKT-004: Telegram Entrypoint Routing

## 1. Goal (one sentence, no "and")
Implement the allowlisted Telegram entrypoint router for Russian bot flows.

## 2. In Scope
- Add C1 event normalization for Telegram text, voice, photo, callback, and command updates.
- Enforce `TELEGRAM_PILOT_USER_IDS` before creating any user-owned state.
- Route `/start`, meal inputs, history requests, callbacks, scheduled summary deliveries, and `/forget_me` to typed handler interfaces.
- Maintain Telegram typing status during long provider work through a cancellable renewal helper.
- Add Russian generic recovery messages and one-retry send behavior for transient Telegram send errors.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No onboarding step implementation; that belongs to TKT-005@0.1.0.
- No voice transcription provider implementation; that belongs to TKT-007@0.1.0.
- No meal draft persistence orchestration; that belongs to TKT-009@0.1.0.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.2.0 §3.1 C1 Access-Controlled Telegram Entrypoint
- ARCH-001@0.2.0 §4.1 Onboarding and target creation
- ARCH-001@0.2.0 §4.2 Text meal logging
- ARCH-001@0.2.0 §4.3 Voice meal logging
- ARCH-001@0.2.0 §4.4 Photo meal logging
- ARCH-001@0.2.0 §6 External Interfaces
- ARCH-001@0.2.0 §9.2 Access Control and Tenant Isolation
- docs/knowledge/openclaw.md
- `src/shared/types.ts`
- `src/shared/config.ts`
- `src/store/tenantStore.ts`
- `src/observability/events.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/telegram/types.ts` exporting normalized Telegram update and handler interfaces
- [ ] `src/telegram/messages.ts` exporting Russian C1 generic/recovery copy
- [ ] `src/telegram/typing.ts` exporting the typing renewal helper
- [ ] `src/telegram/entrypoint.ts` exporting the C1 router
- [ ] `tests/telegram/entrypoint.test.ts`
- [ ] `tests/telegram/typing.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/telegram/entrypoint.test.ts tests/telegram/typing.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove non-allowlisted Telegram IDs produce no C3 write calls.
- [ ] Tests prove voice messages longer than 15 seconds are rejected before media download handler invocation.
- [ ] Tests prove route selection for `/start`, `/forget_me`, text meal, voice meal, photo meal, history command, and callback payloads.
- [ ] Tests prove typing renewal stops after success, user fallback, or thrown error.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT log full Telegram usernames, bot tokens, raw meal text, or callback payloads containing meal text.
- Use C10 event helpers for all route outcomes.
- Handler interfaces must be dependency-injected so later tickets can implement flows without editing C1 tests.
- GLM assignment is appropriate because routing behavior is deterministic and testable.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-004-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-04-27 18:14 glm-5.1: started -->
<!-- 2026-04-27 18:14 glm-5.1: all 6 §5 Outputs implemented, 125 tests green, typecheck/lint/validate_docs pass -->

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
