---
id: TKT-007
title: "Voice Transcription Adapter"
status: in_progress
arch_ref: ARCH-001@0.2.0
component: "C5 Voice Transcription Provider"
depends_on: ["TKT-001@0.1.0", "TKT-003@0.1.0", "TKT-004@0.1.0"]
blocks: ["TKT-009@0.1.0", "TKT-014@0.1.0"]
estimate: M
assigned_executor: "glm-5.1"
created: 2026-04-26
updated: 2026-04-26
---

# TKT-007: Voice Transcription Adapter

## 1. Goal (one sentence, no "and")
Implement the Fireworks Whisper transcription adapter for short Russian voice clips.

## 2. In Scope
- Add C5 adapter for Fireworks Whisper V3 Turbo through OmniRoute audio path or configured runtime fallback.
- Enforce voice duration `<=15` seconds before provider upload.
- Store transcript text through C3 only after successful transcription.
- Delete raw audio through the provided temp-file handle on success or terminal failure.
- Add first-failure text fallback and second-consecutive-failure manual-entry signal for C1/C4.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No Telegram route selection; that belongs to TKT-004@0.1.0.
- No KBJU parsing of transcript text; that belongs to TKT-006@0.1.0 and TKT-009@0.1.0.
- No local Whisper or GPU inference path.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.2.0 §3.5 C5 Voice Transcription Provider
- ARCH-001@0.2.0 §4.3 Voice meal logging
- ARCH-001@0.2.0 §6 External Interfaces
- ARCH-001@0.2.0 §8 Observability
- ARCH-001@0.2.0 §9.5 PII Handling and Deletion
- ADR-002@0.1.0
- ADR-003@0.1.0
- ADR-009@0.1.0
- docs/knowledge/llm-routing.md
- `src/shared/types.ts`
- `src/store/tenantStore.ts`
- `src/observability/costGuard.ts`
- `src/observability/events.ts`
- `src/telegram/messages.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/voice/types.ts` exporting C5 request/result types
- [ ] `src/voice/transcriptionAdapter.ts` exporting the Fireworks Whisper adapter
- [ ] `src/voice/voiceFailurePolicy.ts` exporting consecutive-failure behavior
- [ ] `tests/voice/transcriptionAdapter.test.ts`
- [ ] `tests/voice/voiceFailurePolicy.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/voice/transcriptionAdapter.test.ts tests/voice/voiceFailurePolicy.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove audio longer than 15 seconds is rejected before provider client invocation.
- [ ] Tests prove one transient transport retry occurs only when still within the latency budget.
- [ ] Tests prove raw audio deletion is called on success and terminal failure.
- [ ] Tests prove first consecutive failure returns `Не расслышал, напиши текстом` behavior and second returns manual-entry behavior.
- [ ] Tests prove transcript text is stored in C3 but never written to C10 logs.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT persist raw audio bytes or temp file paths after deletion.
- Do NOT implement local transcription.
- Do NOT call Fireworks directly unless the shared OmniRoute transport reports router failure and config explicitly enables fallback.
- GLM assignment is appropriate because provider behavior is constrained by ADR-003@0.1.0.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-007-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-01 00:00 glm-5.1: started -->
<!-- YYYY-MM-DD HH:MM model-id: opened PR #NN -->

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
