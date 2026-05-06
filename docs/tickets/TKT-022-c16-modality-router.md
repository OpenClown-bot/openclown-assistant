---
id: TKT-022
title: "C16 Modality Router with deterministic priority chain + clarifying-reply path"
version: 0.1.0
status: ready
arch_ref: ARCH-001@0.6.0
prd_ref: PRD-003@0.1.3
component: "C16"
depends_on: ["TKT-021@0.1.0"]
blocks: ["TKT-023@0.1.0", "TKT-024@0.1.0", "TKT-025@0.1.0", "TKT-026@0.1.0"]
estimate: M
assigned_executor: "glm-5.1"
author_model: "claude-sonnet-4.5"
created: 2026-05-06
updated: 2026-05-06
---

# TKT-022: C16 Modality Router with deterministic priority chain + clarifying-reply path

## 1. Goal
Land the C16 Modality Router that classifies inbound Telegram messages into KBJU / water / sleep / workout / mood / ambiguous via the ADR-015@0.1.0 deterministic priority chain.

## 2. In Scope
- New module `src/modality/router.ts` exporting `routeModality(input: ModalityRouterInput): ModalityRouterDecision` per ADR-015@0.1.0 §Decision.
- Configuration file `config/modality-router.json` listing the five matcher chains (KBJU keywords already in C4; water / sleep / workout / mood keyword sets per ADR-015@0.1.0 §Decision) — hot-reload following the ADR-013@0.1.0 pattern.
- Integration into the existing `src/sidecar/factory.ts` so C1 entrypoint routes every claimed text or voice-transcribed message through C16 before dispatching to the matching component.
- Clarifying-reply inline-keyboard for ambiguous matches (Russian-only copy ratified by PO before sign-off).
- New telemetry counter `kbju_modality_route_outcome` with labels `{kbju, water, sleep, workout, mood, ambiguous_resolved, ambiguous_clarified, zero_match_fallback}`.
- Golden-test set `tests/modality/router.golden.test.ts` covering ≥30 hand-curated Russian morphology cases (PO ratifies the golden set).

## 3. NOT In Scope
- LLM-classifier fallback (Option C in ADR-015@0.1.0 — explicitly deferred; this ticket implements Option A only).
- Per-modality storage logic (TKT-023@0.1.0..TKT-025@0.1.0).
- Per-modality settings (TKT-026@0.1.0).
- Adaptive summary logic (TKT-027@0.1.0).
- Modification of C4 KBJU pattern set; the C4 free-form fallback path is preserved exactly.
- Photo dispatch routing — photos go directly to C7 photo recognition then to C19 Workout Logger if workout modality is active; C16 only routes text + voice-transcribed text.

## 4. Inputs
- ARCH-001@0.6.0 §3.16 (C16 component spec)
- ADR-015@0.1.0 §Decision (verbatim contract for matcher chain + clarifying-reply + zero-match fallback)
- ADR-013@0.1.0 (hot-reload config pattern reused for `config/modality-router.json`)
- Existing `src/security/allowlist.ts` (precedent for hot-reload + atomic-rename safety)
- Existing `src/observability/kpiEvents.ts` (precedent for adding a new metric counter)
- `src/sidecar/factory.ts`, `src/telegram/entrypoint.ts` (integration points)

## 5. Outputs
- [ ] `src/modality/router.ts` exporting `routeModality` + types (`ModalityRouterInput`, `ModalityRouterDecision`).
- [ ] `config/modality-router.json` with the five matcher chains seeded from ADR-015@0.1.0 §Decision.
- [ ] `config/modality-router.example.json` (non-secret example file).
- [ ] `src/observability/kpiEvents.ts` extended with `kbju_modality_route_outcome` counter and label set.
- [ ] `src/sidecar/factory.ts` wires the router into the C1 dispatch path (additive; no breakage of existing KBJU path).
- [ ] `tests/modality/router.unit.test.ts` (matcher-chain unit tests, ≥80% coverage of `src/modality/router.ts`).
- [ ] `tests/modality/router.golden.test.ts` (≥30 PO-ratified Russian morphology cases — initial 30 inline; PO may extend).
- [ ] `tests/modality/router.hot-reload.test.ts` (mirrors `tests/security/allowlist.test.ts` pattern; verifies a config change takes effect ≤30 s).

## 6. Acceptance Criteria
- [ ] `npm test -- tests/modality/router.unit.test.ts` passes.
- [ ] `npm test -- tests/modality/router.golden.test.ts` passes (every golden case classified correctly per the priority chain).
- [ ] `npm test -- tests/modality/router.hot-reload.test.ts` passes (hot-reload propagation ≤30 s).
- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean (strict).
- [ ] Existing `tests/telegram/entrypoint.test.ts` still passes (no regression on the C1 path).
- [ ] Manual smoke: send a "выпил 200мл" text → C17 Water Logger handler invoked. Send a "съел 200г творога" text → C4 KBJU handler invoked. Send "выпил пол-литра" with no further context → bot replies with the inline-keyboard ambiguity-resolution prompt.
- [ ] `kbju_modality_route_outcome` metric emits per route decision with the documented label set.

## 7. Constraints
- Do NOT add new runtime dependencies. Use the existing TypeScript regex engine.
- Do NOT call any LLM from C16. The LLM-classifier branch is explicitly Option C of ADR-015@0.1.0 and deferred; an LLM call in this PR fails review.
- The matcher chain MUST be evaluated in fixed order KBJU → water → sleep → workout → mood (PRD-003@0.1.3 §8 R1 ratified order).
- Multi-match → emit clarifying inline-keyboard reply, do NOT silently best-guess.
- Zero-match → fall through to existing C4 KBJU free-form path; do NOT discard the message.
- `assigned_executor: "glm-5.1"` justified: TypeScript module-creation with regex matching, configuration loading, and observability wiring — a representative GLM workload per the §Phase 8 default rule.

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
- [x] Goal is one sentence, no conjunctions.
- [x] NOT-In-Scope has ≥1 explicit item (6 explicit items).
- [x] Acceptance Criteria are machine-checkable.
- [x] Constraints explicitly list forbidden actions (no LLM hop, no new deps, fixed priority order).
- [x] All references version-pinned.
- [x] `depends_on: ["TKT-021@0.1.0"]` (no DB tables to read; but C16 reads modality settings table to gate OFF-state — that table lives in TKT-021@0.1.0 schema). `blocks` lists modality-handler tickets.
- [x] `assigned_executor: "glm-5.1"` justified.
