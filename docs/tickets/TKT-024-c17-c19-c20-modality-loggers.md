---
id: TKT-024
title: "C17 Water Logger + C19 Workout Logger + C20 Mood Logger atomic event handlers"
version: 0.1.0
status: ready
arch_ref: ARCH-001@0.6.0
prd_ref: PRD-003@0.1.3
component: "C17+C19+C20"
depends_on: ["TKT-021@0.1.0", "TKT-022@0.1.0"]
blocks: ["TKT-027@0.1.0"]
estimate: L
assigned_executor: "deepseek-v4-pro"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-06
updated: 2026-05-06
---

# TKT-024: C17 Water Logger + C19 Workout Logger + C20 Mood Logger atomic event handlers

## 1. Goal
Land the three remaining modality event handlers — water (C17), workout (C19), mood (C20) — each persisting one event row per inbound message with PRD-003@0.1.3 §5 US-1 / US-3 / US-4 acceptance.

## 2. In Scope
- `src/modality/water/logger.ts`: voice / text / inline-keyboard quick-volume preset → `water_events` row insert (G1).
- `src/modality/workout/logger.ts`: text / voice / photo → `workout_events` row insert with the ADR-016@0.1.0 closed-enum forced-output prompt (G3).
- `src/modality/mood/logger.ts`: 1–10 numeric / numeric+comment / free-form-text-with-inference + 5-minute pending-confirmation TTL → `mood_events` row insert (G4).
- Russian-language reply copy for each handler in `src/modality/{water,workout,mood}/copy.ru.ts`.
- Quick-volume preset inline keyboard for water (PO ratifies the three presets — small / medium / large millilitre values).
- 1–10 inline keyboard for mood.
- The `kbju_modality_event_persisted` telemetry counter with labels `{modality, source}` where `modality ∈ {water, workout, mood}` and `source ∈ {text, voice, keyboard, photo, inferred}`.
- Per-handler unit tests at ≥80% coverage.

## 3. NOT In Scope
- C18 Sleep Logger (TKT-023@0.1.0).
- C16 Modality Router (TKT-022@0.1.0).
- C21 Modality Settings Service (TKT-026@0.1.0).
- C22 Adaptive Summary Composer (TKT-027@0.1.0).
- The `water_events` / `workout_events` / `mood_events` tables themselves (TKT-021@0.1.0).
- The OmniRoute extraction LLM contract (reused without modification per ADR-002@0.1.0 + ADR-016@0.1.0 §Decision; this ticket only authors the prompt strings, not the LLM provider abstraction).
- Photo-extraction adapter changes (C7 reused as-is).

## 4. Inputs
- ARCH-001@0.6.0 §3.17, §3.19, §3.20 (C17 / C19 / C20 component specs)
- PRD-003@0.1.3 §5 US-1, §5 US-3, §5 US-4 (verbatim AC bullets)
- PRD-003@0.1.3 §2 G1, G3, G4 (goal definitions + recognition success rate ≥80% for workout)
- PRD-003@0.1.3 §6 K1, K2, K4 (per-modality KPIs)
- ADR-016@0.1.0 §Decision (workout closed-enum + forced-output prompt — verbatim)
- ADR-002@0.1.0 OmniRoute extraction LLM (reused for water-volume, workout-extraction, mood-inference prompts)
- ADR-006@0.1.0 forced-output-set guardrail pattern (reused for the workout JSON validator)
- TKT-021@0.1.0 schemas
- Existing C5 voice + C7 photo adapters

## 5. Outputs
- [ ] `src/modality/water/logger.ts` exporting the water handler.
- [ ] `src/modality/workout/logger.ts` exporting the workout handler.
- [ ] `src/modality/mood/logger.ts` exporting the mood handler (including the 5-minute pending-inference TTL).
- [ ] `src/modality/water/copy.ru.ts`, `src/modality/workout/copy.ru.ts`, `src/modality/mood/copy.ru.ts` Russian copy files.
- [ ] `src/modality/water/keyboard.ts` quick-volume preset inline keyboard (small / medium / large; PO ratifies values).
- [ ] `src/modality/mood/keyboard.ts` 1–10 inline keyboard.
- [ ] `src/observability/kpiEvents.ts` extended with `kbju_modality_event_persisted` counter.
- [ ] `tests/modality/water/logger.test.ts`, `tests/modality/workout/logger.test.ts`, `tests/modality/mood/logger.test.ts` (≥80% coverage each).
- [ ] `tests/modality/workout/golden.test.ts` covering ≥10 of the PO-ratified 50-event golden set (initial seed; PO will extend to 50 before sign-off — see ADR-016@0.1.0 §Decision).
- [ ] `tests/modality/mood/pending-ttl.test.ts` covering the 5-minute pending-inference flow (per PRD-003@0.1.3 §5 US-4 4th AC bullet).

## 6. Acceptance Criteria
- [ ] `npm test -- tests/modality/water/ tests/modality/workout/ tests/modality/mood/` passes.
- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean (strict).
- [ ] Manual smoke (water): "выпил 200мл" → `water_events` row inserted with `volume_ml=200`. Quick-volume keyboard tap on "small" preset → row inserted with PO-ratified ml.
- [ ] Manual smoke (workout): "бегал 30 мин 5 км" → `workout_events` row with `type='running'`, `duration_min=30`, `distance_km=5.0`. "сегодня жал" with no quantifiable field → bot replies with the §5 US-3 2nd-AC clarifying question; NO row persisted until user replies.
- [ ] Manual smoke (mood): "настроение 7" → `mood_events` row with `score=7`, `comment=null`. "настроение 7 — устал" → row with `score=7`, `comment="устал"`. "чувствую себя дерьмово" → bot replies with inferred score for confirmation; on user "да" → row persists.
- [ ] Mood 5-minute TTL: pending inference is discarded silently after 5 minutes; the next user message is treated as new input (not auto-confirmation).
- [ ] Workout golden-set unit test passes ≥80% on its initial 10-event seed (full 50-event PO-ratified set is added in a follow-up commit before sign-off; this AC gates the initial seed only).
- [ ] All three handlers reject inserts when the corresponding modality is OFF (per PRD-003@0.1.3 §5 US-1 / US-3 / US-4 OFF-state AC bullets) — verified via the C21 settings query in unit tests with mocked settings.

## 7. Constraints
- Do NOT add new runtime dependencies. Reuse OmniRoute, existing C5 / C7, existing Telegram inline-keyboard utility.
- The workout extraction LLM prompt MUST use the ADR-016@0.1.0 §Decision JSON-schema verbatim (closed enum + forced-output set).
- The mood inference LLM prompt MUST honor PRD-003@0.1.3 §5 US-4 3rd AC bullet: reply with the inferred score for user confirmation BEFORE persisting.
- Mood comment field MUST be truncated to 280 characters at persistence with a friendly notice (PRD-003@0.1.3 §5 US-4 2nd AC bullet).
- Mood comment is subject to ARCH-001@0.5.0 §10.7 emit-boundary redaction (extended in TKT-026@0.1.0). DO NOT add the comment to any structured-log emit in this ticket.
- All event tables persist `user_id` from the C1 Telegram entrypoint; do NOT trust client-supplied user IDs.
- All SQL parameterised.
- `assigned_executor: "deepseek-v4-pro"` justified: three parallel-but-cohesive handlers at ~150 LoC each plus three test files plus three Russian copy files = ~1500 LoC PR with cross-handler-consistent patterns; per `docs/prompts/architect.md` §Phase 8 "deepseek-v4-pro: parallel/wide-context (>200K effective context)".

## 8. Definition of Done
- [ ] All Acceptance Criteria pass.
- [ ] PR opened with link to this TKT in description (version-pinned).
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body.
- [ ] Executor filled §10 Execution Log.
- [ ] Ticket frontmatter `status: in_review` in a separate commit.

## 9. Questions
<!-- (empty) -->

## 10. Execution Log
<!-- (empty) -->

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions (the "+" is a list, not a conjunction; one sentence: "Land the three remaining modality event handlers").
- [x] NOT-In-Scope has ≥1 explicit item (7 explicit items).
- [x] Acceptance Criteria are machine-checkable.
- [x] Constraints explicitly list forbidden actions (no new deps, no comment in structured logs, no client-supplied user IDs, etc.).
- [x] All references version-pinned.
- [x] `depends_on: ["TKT-021@0.1.0", "TKT-022@0.1.0"]` (tables + router).
- [x] `assigned_executor: "deepseek-v4-pro"` justified (parallel-cohesive multi-handler PR).
