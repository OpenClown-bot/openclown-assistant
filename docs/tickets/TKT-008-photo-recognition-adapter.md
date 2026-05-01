---
id: TKT-008
title: "Photo Recognition Adapter"
status: done
arch_ref: ARCH-001@0.2.0
component: "C7 Photo Recognition Provider"
depends_on: ["TKT-001@0.1.0", "TKT-003@0.1.0", "TKT-006@0.1.0"]
blocks: ["TKT-009@0.1.0", "TKT-014@0.1.0"]
estimate: M
assigned_executor: "glm-5.1"
created: 2026-04-26
updated: 2026-05-01
completed_at: 2026-05-01
completed_by: "yourmomsenpai (PO)"
completed_note: "TKT-008 closed following RV-CODE-008 iter-2 verdict pass (Kimi K2.6 commit 52eee7f, all 7 findings RESOLVED). Implementation merged via PR #51 (squash commit de6799e) covering all 8 ACs (npm test 344/344, lint clean, typecheck clean, Fireworks Qwen3 VL 30B A3B Instruct through OmniRoute, downscale-or-passthrough via testable image-preparation interface, candidate items + portion text + per-item confidence + draft confidence return shape, low-confidence flag below 0.70 with Russian label, raw-photo deletion on success or terminal failure). Review trail: iter-1 (commit 4ba7c3b, fail blocked on F-H1 merge-conflict markers + 2M + 3L) → iter-2 (commit bb40216, pass after F-H1 markers removed, F-M1 HTTP-status-gated retry, F-M2 negative `portion_grams` rejection, F-M3 retry-success-path test added per PR-Agent finding, F-L1 per-attempt timeout cap, F-L2 budget_blocked path captures `safeDeletePhoto` deletion result, F-L3 unused interface fields removed). Four PR-Agent supplementary findings (F-PA-8 NaN/Infinity validation in `validateVisionOutput`, F-PA-9/10/11 `photoDeleted: true` hardcoded on three additional outcome paths — suspicious output, JSON parse error, schema validation failure — same pattern as Kimi F-L2 was applied only to budget_blocked) DEFERRED to BACKLOG-004@0.1.0 §TKT-NEW-M/N per PO decision on 2026-05-01. PR-Agent supplementary review on PR #51: 55-line iter-1 `/review` block (independently identified F-H1 merge conflict and F-M3 retry test gap, both promoted into Kimi iter-2 scope) + 1 iter-1 `/improve` inline (line 104 NaN/Infinity, importance 7) + 3 iter-2 `/improve` inlines (lines 403/444/484 photoDeleted hardcoding, importance 8 each); informational only, all 4 distinct findings catalogued in BACKLOG-004."
---

# TKT-008: Photo Recognition Adapter

## 1. Goal (one sentence, no "and")
Implement the OmniRoute vision adapter for meal photo candidates.

## 2. In Scope
- Add C7 adapter for Fireworks Qwen3 VL 30B A3B Instruct through OmniRoute.
- Downscale or pass through a temp image handle using a testable image-preparation interface.
- Return candidate food items, portion text, per-item confidence, and draft confidence.
- Apply low-confidence flag when `confidence_0_1 < 0.70` and expose the Russian label `низкая уверенность`.
- Delete raw photo bytes through the provided temp-file handle on success or terminal failure.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No Telegram photo route selection; that belongs to TKT-004@0.1.0.
- No draft confirmation persistence; that belongs to TKT-009@0.1.0.
- No barcode or packaged-goods scanning.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.2.0 §3.7 C7 Photo Recognition Provider
- ARCH-001@0.2.0 §4.4 Photo meal logging
- ARCH-001@0.2.0 §6 External Interfaces
- ARCH-001@0.2.0 §9.4 LLM Prompt-Injection Mitigations
- ARCH-001@0.2.0 §9.5 PII Handling and Deletion
- ADR-002@0.1.0
- ADR-004@0.1.0
- ADR-009@0.1.0
- docs/knowledge/llm-routing.md
- `src/shared/types.ts`
- `src/llm/omniRouteClient.ts`
- `src/kbju/types.ts`
- `src/kbju/validation.ts`
- `src/observability/costGuard.ts`
- `src/observability/events.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/photo/types.ts` exporting C7 request/result types
- [ ] `src/photo/photoRecognitionAdapter.ts` exporting the vision adapter
- [ ] `src/photo/photoConfidence.ts` exporting threshold and label helpers
- [ ] `tests/photo/photoRecognitionAdapter.test.ts`
- [ ] `tests/photo/photoConfidence.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/photo/photoRecognitionAdapter.test.ts tests/photo/photoConfidence.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Tests prove confidence `0.69` shows `низкая уверенность` and confidence `0.70` does not.
- [ ] Tests prove malformed vision output is discarded and never marked confirmable.
- [ ] Tests prove raw photo deletion is called on success and terminal failure.
- [ ] Tests prove image-visible text is treated as untrusted data in the prompt.
- [ ] Tests prove no photo path returns an auto-save/confirmed result.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies unless a Q-TKT approves an image-processing dependency.
- Do NOT persist raw photo bytes or temp file paths after deletion.
- Do NOT implement barcode scanning.
- Do NOT retry suspicious or malformed vision output.
- GLM assignment is appropriate because ADR-004@0.1.0 gives a narrow adapter contract.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-008-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-01 00:15 glm-5.1: started -->
<!-- 2026-05-01 00:30 glm-5.1: opened PR #51 -->
<!-- 2026-05-01 00:45 glm-5.1: iter-2 fixes pushed -->
---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
