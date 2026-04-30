---
id: RV-SPEC-005
type: spec_review
target_ref: ADR-010@0.1.0 (PR #40, SHA e225b30)
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-30
updated: 2026-04-30
---

# Spec Review — ADR-010@0.1.0 + ARCH-001@0.4.0 cascade

## Summary

ADR-010@0.1.0 is a focused, medically defensible safety guard that correctly identifies the gap in ADR-005@0.2.0 and PRD-001@0.2.0 US-1: aggressive pace selections can produce negative or very-low-energy calorie targets for low-maintenance users. The four options are genuinely distinct, the empirical basis (1200/1500 kcal/day) is consistent with cited clinical sources, the application order is achievable without structural refactor of `src/onboarding/targetCalculator.ts`, and the formula-version bump (`v1 → v2`) is semantically justified. Two medium findings prevent a clean pass: the ARCH-001@0.4.0 cascade omits the new telemetry event from §8.2 required metric names, and ADR-010@0.1.0 §3 mischaracterizes BACKLOG-001@0.1.0 §TKT-NEW-D as having explicitly rejected Option C when it did not.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: ADR-010@0.1.0 is sound and implementable, but the ARCH-001@0.4.0 telemetry cascade and the Option C attribution must be corrected before the Architect cycle closes.

## Findings

### High (blocking)
*(none)*

### Medium
- **F-M1 (ADR-010@0.1.0 §3, line 91):** ADR-010@0.1.0 claims Option C "was explicitly not the selected route in BACKLOG-001@0.1.0 §TKT-NEW-D", but BACKLOG-001 records only the gap (negative/dangerously low `calculateCalories` output) and proposes an ADR-NEW for a calorie floor — it does not evaluate, name, or reject a pace-tightening alternative. This misattribution makes Option C appear pre-rejected by a source-of-record that contains no such decision, weakening the decision record. — *Responsible role:* Architect. *Suggested remediation:* Revise the "why losers lost" for Option C to rely solely on the substantive rationale already present ("it changes the input variable rather than guarding the final emitted risk value, making the safety boundary indirect and harder to explain to users"), removing the unsupported BACKLOG-001 citation.

- **F-M2 (ARCH-001@0.4.0 §8.2, line 716):** The durable metric event `kbju_onboarding_target_floor_clamped` defined in ADR-010@0.1.0 §Q4 is not listed in ARCH-001@0.4.0 §8.2 required metric names. The cascade is incomplete: a C10 event that ADR-010@0.1.0 mandates as MUST-emit lacks ArchSpec contract enumeration, creating a gap between the ADR and the Executor ticket that will implement it. — *Responsible role:* Architect. *Suggested remediation:* Append `kbju_onboarding_target_floor_clamped` to the §8.2 required metric names list and add a one-line cross-reference to ADR-010@0.1.0 §Q4 field whitelist.

### Low (nit / cosmetic)
- **F-L1 (ARCH-001@0.4.0 §5 schema, lines 450 / 466):** The `formula_version: string` pseudo-schema does not document that two canonical values (`mifflin_st_jeor_v1_2026_04` and `mifflin_st_jeor_v2_2026_04`) now exist, which future K7 analysts and tenant auditors will need to distinguish. — *Responsible role:* Architect. *Suggested remediation:* Add a schema comment or example list: `formula_version: string # e.g. mifflin_st_jeor_v1_2026_04 (pre-ADR-010@0.1.0) or v2_2026_04 (floor-capable)`.

### Questions for Architect
- **Q1:** ADR-010@0.1.0 §Q3 applies the floor to the *rounded* `raw_calories`. For a female user with `raw_calories = 1199.4` (rounds to 1199, then clamps to 1200) vs `raw_calories = 1199.6` (rounds to 1200, no clamp), the difference of 0.2 kcal changes clamp status. Was this rounding-before-floor ordering intentional, and should the downstream Executor ticket add a unit test for this boundary? (Not a finding — the order is clearly specified; asking for confirmation of intent.)

## Cross-reference checklist (Reviewer ticks)
- [x] §0 Recon Report present, ≥3 fork-candidates audited per major capability — *N/A for ADR-only cycle; recon audits 5 artifacts + 3 external sources, which is adequate for a narrow safety-guard ADR.*
- [x] All PRD sections claimed as "implemented" actually have a covering component (Trace matrix walk) — *ADR-010@0.1.0 is additive safety guard on existing US-1 trace; no new PRD coverage claimed.*
- [x] All Non-Goals from PRD are respected (grep against ArchSpec + Tickets) — *NG7 (no medical advice) is explicitly reinforced by ADR-010@0.1.0 disclosure copy and repeated non-medical disclaimers.*
- [x] Resource budget fits PRD Technical Envelope (numeric) — *ADR-010@0.1.0 adds no runtime cost, no LLM calls, no new infra.*
- [x] Every Ticket in Work Breakdown is atomic (one-sentence Goal) — *No new Ticket in this PR; follow-up TKT-NEW-D promotion deferred per ADR-010@0.1.0 §5.*
- [x] Every ADR evaluates ≥3 real options with concrete trade-offs — *4 options (A/B/C/D), all distinct, all with concrete pros/cons.*
- [x] All references are version-pinned (`@X.Y.Z`) — *ADR-010@0.1.0 refs: BACKLOG-001@0.1.0, PRD-001@0.2.0, ARCH-001@0.3.1, ADR-005@0.2.0. ARCH-001@0.4.0 refs: ADR-010@0.1.0, ADR-005@0.2.0.*
- [x] §8/§9/§10 (Observability/Security/Deployment) non-empty with concrete choices — *ARCH-001@0.4.0 §8.2, §9, §10 are present; F-M2 notes a missing metric name in §8.2.*
- [x] Rollback procedure is a real command sequence, not "revert" — *Handled in prior ARCH-001@0.4.0 reviews (RV-SPEC-002); unchanged in this cascade.*

## Red-team probes (Reviewer must address each)
- **What happens if openclaw / VPS goes down mid-flow?** — Onboarding state is persisted in C3; resume behaviour is unchanged by ADR-010@0.1.0. If clamp occurs, the user sees the disclosure before confirmation; a mid-flow crash leaves the state at the same step with no partial target persistence (C2 writes targets only after explicit confirmation per PRD-001@0.2.0 US-1).
- **How does the system behave at 10× expected user count?** — Floor calculation is O(1) deterministic math; no change to asymptotic behaviour or resource envelope.
- **Which prompt-injection vectors apply to LLM-fed components?** — None. ADR-010@0.1.0 is entirely deterministic; no LLM call is involved in the floor logic.
- **What is the data-retention / GDPR boundary?** — The `kbju_onboarding_target_floor_clamped` durable event contains `user_id`, `sex`, and `raw_calories_kcal`; all are user-scoped C3 rows and fall under the existing right-to-delete hard-delete transaction (ARCH-001@0.4.0 §9.5).
- **What happens if the floor constant is misconfigured at runtime?** — The floor is a compile-time / deterministic constant (`MIN_DAILY_CALORIES_BY_SEX`), not a runtime config. A misconfiguration would require a code change and redeploy, which would be caught by the Executor ticket tests.
- **Can a user bypass the floor by editing their profile post-onboarding?** — Profile editing is not a PRD-001@0.2.0 US. If introduced later, the same ADR-010@0.1.0 floor must apply to any target recalculation path.
