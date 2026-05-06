---
id: TKT-025
title: "Modality-input disambiguation golden tests + R1 misclassification telemetry"
version: 0.1.0
status: ready
arch_ref: ARCH-001@0.6.0
prd_ref: PRD-003@0.1.3
component: "C16+observability"
depends_on: ["TKT-022@0.1.0"]
blocks: []
estimate: S
assigned_executor: "glm-5.1"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-06
updated: 2026-05-06
---

# TKT-025: Modality-input disambiguation golden tests + R1 misclassification telemetry

## 1. Goal
Land the PRD-003@0.1.3 §8 R1 rolling-30-day modality-misclassification rate telemetry plus the PO-ratified ambiguity-clarifying-reply golden test set.

## 2. In Scope
- New telemetry view / aggregation that exposes a 30-day rolling rate from the `kbju_modality_route_outcome` counter (TKT-022@0.1.0) — specifically: `(ambiguous_resolved + ambiguous_clarified) / total_routes` over a rolling 30-day window.
- The view is exposed in the existing local-only observability surface (Prometheus / scrapeable endpoint) per ADR-009@0.1.0; no new dashboards in this ticket.
- Expanded ambiguity golden test set covering ≥20 PO-ratified Russian morphology cases that produce the inline-keyboard clarifying reply (each case has a known-correct disambiguation outcome — the test asserts the routing decision is `ambiguous_clarified`, not a specific destination, since the user's tap on the keyboard is what dispatches).
- Documentation note: ARCH-001@0.6.0 §8 (Observability) already lists the rolling-30-day misclassification rate metric in the new §12.2 R13 entry; this ticket does NOT modify the ArchSpec, only the emitter + aggregator + golden test set.

## 3. NOT In Scope
- The C16 Modality Router itself (TKT-022@0.1.0 owns the deterministic priority chain).
- LLM-classifier fallback (Option C of ADR-015@0.1.0; explicitly deferred).
- Action-able alerting on the 30-day rate (informational metric only per PRD-003@0.1.3 §8 R1 — "rolling-30-day modality-misclassification rate tracked as informational telemetry").
- The PO-ratified golden set composition (composition is PO sign-off responsibility; this ticket implements the harness against an initial 20-case seed and includes an extension hook for the PO to add more without code edits).

## 4. Inputs
- ARCH-001@0.6.0 §3.16 + §0.6 (C16 + observability deltas)
- ADR-015@0.1.0 §Decision (verbatim contract; forced-output-set NOT used at this ticket)
- ADR-009@0.1.0 (observability + redaction patterns)
- TKT-022@0.1.0 module `src/modality/router.ts`
- PRD-003@0.1.3 §8 R1 (verbatim mitigation paragraph for the metric definition)
- Existing `src/observability/kpiEvents.ts`

## 5. Outputs
- [ ] `src/observability/modalityMisclassificationRate.ts` exporting the 30-day rolling rate aggregation.
- [ ] `tests/modality/router.ambiguity.test.ts` covering ≥20 PO-ratified ambiguous-input cases (initial 20 inline; extension via JSON file under `tests/fixtures/modality/ambiguous.json`).

- [ ] No production-code changes outside `src/observability/`.

## 6. Acceptance Criteria
- [ ] `npm test -- tests/modality/router.ambiguity.test.ts` passes.
- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean (strict).
- [ ] The metric is queryable via the existing local Prometheus surface; a manual scrape returns a non-empty value after a smoke run that produces ≥1 ambiguous_resolved + ≥1 ambiguous_clarified event.
- [ ] `python3 scripts/validate_docs.py` clean.

## 7. Constraints
- Do NOT change the ADR-015@0.1.0 contract — observability is on top of, not inside, the router.
- Do NOT emit raw user text into the metric labels (per ARCH-001@0.5.0 §8.1 redaction allowlist).
- Do NOT add new dashboards or alert rules — informational only per PRD-003@0.1.3 §8 R1.
- The 30-day rolling window MUST be computed over the existing metric retention; if the existing retention is shorter than 30 days, the metric returns `null` until enough data accrues (do not fabricate values).
- `assigned_executor: "glm-5.1"` justified: ~50 LoC of metric-aggregation + a fixture-driven test set + a one-line doc edit; representative GLM workload.

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
- [x] NOT-In-Scope has ≥1 explicit item (4 explicit items).
- [x] Acceptance Criteria are machine-checkable.
- [x] Constraints explicitly list forbidden actions.
- [x] All references version-pinned.
- [x] `depends_on: ["TKT-022@0.1.0"]` (the C16 router emits the counter this ticket aggregates).
- [x] `assigned_executor: "glm-5.1"` justified.
