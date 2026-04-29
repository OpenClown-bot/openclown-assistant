---
id: RV-SPEC-004
type: spec_review
target_ref: ADR-005@0.2.0 (PR #29, branch arch/ADR-005-formula-parameters @ 3045637)
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-29
updated: 2026-04-29
---

# Spec Review — ADR-005@0.2.0: pin KBJU formula parameters (Q-TKT-005-01)

## Summary

ADR-005@0.2.0 is a focused, additive amendment that correctly pins Mifflin-St Jeor coefficients (PMID 2305711), standard Harris-Benedict-derived activity multipliers, the 7700 kcal/kg pace heuristic, goal-specific macro splits, and a `formula_version` persistence contract. Numerical values are correct against cited sources, URLs resolve, and the `formula_version` constant aligns with the existing `user_targets` schema in ARCH-001@0.3.1 §5.

**Post-fix assessment (commit 3045637):**
- F-M1 **RESOLVED** — Q3 now explicitly derives the calorie-delta sign from the `goal` enum (`lose`/`gain`/`maintain`) and stores `pace_kg_per_week` as strictly positive per PRD-001@0.2.0 §5 US-1.
- F-M2 **RESOLVED** — `ARCH-001@0.3.0` was bumped to `ARCH-001@0.3.1` and all `ADR-005@0.1.0` body pins (frontmatter + §4.1 + §4.2) were updated to `ADR-005@0.2.0`; `TKT-005@0.1.0` was re-pinned to `ARCH-001@0.3.1`.
- F-L1, F-L2, F-L3 **REMAIN OPEN** — three low nits on JS `Math.round` wording, `user_profiles.formula_version` schema clarification, and ADR frontmatter `version:` convention drift remain unaddressed.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: Medium findings F-M1 and F-M2 are resolved in commit 3045637; three low nits (F-L1–F-L3) remain but do not block merge.

## Findings

### High (blocking)
*None.*

### Medium
- **F-M1 — RESOLVED (commit 3045637, ADR-005@0.2.0 §Decision Detail Q3):** Architect replaced the ambiguous sign-convention sentence with explicit per-goal formulas: `lose` negates pace, `gain` passes pace positive, `maintain` sets delta to 0. This closes the Executor misinterpretation surface.

- **F-M2 — RESOLVED (commit 3045637, ARCH-001@0.3.1):** Architect bumped `ARCH-001@0.3.0` to `ARCH-001@0.3.1` and updated all `ADR-005@0.1.0` pins (frontmatter `adrs:` list and §4.1 C2 target creation body text) to `ADR-005@0.2.0`. `TKT-005@0.1.0` was re-pinned to `ARCH-001@0.3.1`. The cascade is now complete and version-consistent.

### Low (nit / cosmetic)
- **F-L1 (ADR-005@0.2.0 §Decision Detail Q5, line ~105):** The ADR describes `Math.round` as "round-half-up," but the JavaScript `Math.round` implementation is actually "round half away from zero" (e.g. `-1.5` rounds to `-1`, not `-2`). For positive calorie and macro targets the two rules are equivalent, but the description is technically imprecise for the locked Node 24 runtime. — *Responsible role:* Architect. *Suggested remediation:* Change the wording to "`Math.round` (round half away from zero; for positive calorie and macro targets this is equivalent to round-half-up)."

- **F-L2 (ARCH-001@0.3.1 §5 schema `user_profiles` vs. ADR-005@0.2.0 §Consequences):** The `user_profiles` table already defines `formula_version: string` (ARCH-001@0.3.1 line 439), but the ADR audit-impact clause only mandates persisting the field on `user_targets` rows. This leaves the `user_profiles.formula_version` column undocumented — should it be populated, left null, or reserved for a future schema amendment? — *Responsible role:* Architect. *Suggested remediation:* Add a one-sentence note to ADR-005@0.2.0 §Consequences clarifying whether `user_profiles.formula_version` should also be populated with the same constant at profile creation time, or explicitly deferred.

- **F-L3 (ADR-005@0.2.0 frontmatter, line 4):** The PR adds `version: 0.2.0` to the ADR frontmatter, but the ADR template (`docs/architecture/adr/TEMPLATE.md`) does not include a `version:` field, and none of the other 8 ADRs in `docs/architecture/adr/` declare one. This creates a convention drift where only one artifact in the directory carries an inline version. — *Responsible role:* Architect. *Suggested remediation:* Either (a) remove `version:` from ADR-005@0.2.0 and rely on git history + caller artifact version pins for versioning, keeping all ADR frontmatters consistent, or (b) add `version:` to the ADR template and all existing ADR frontmatters in a separate clerical PR so the convention is uniform.

### Questions for Architect
*None.*

## Independent Assessments (per review brief)

### 1. Numerical correctness of Q1–Q5 vs. published standards

| Parameter | ADR-005@0.2.0 value | Published standard | Verdict |
|---|---|---|---|
| **Q1 Mifflin-St Jeor male** | 10W + 6.25H − 5A + 5 | PMID 2305711 (Mifflin et al., 1990) | **Correct.** Matches original publication exactly. |
| **Q1 Mifflin-St Jeor female** | 10W + 6.25H − 5A − 161 | PMID 2305711 | **Correct.** Matches original publication exactly. |
| **Q2 Activity multipliers** | 1.2 / 1.375 / 1.55 / 1.725 / 1.9 | Harris-Benedict-derived industrial standard (cited via NIDDK BWP) | **Standard values.** Widely used in fitness/nutrition software; NIDDK BWP methodology brief endorses comparable factors. |
| **Q3 7700 kcal/kg** | `pace × 7700 / 7` | Common dietetics heuristic | **Acceptable as approximation.** Scientific adipose-tissue value is closer to 7000–7200 kcal/kg, but 7700 is the de-facto standard in consumer apps. ADR correctly labels it "standard approximation." |
| **Q4 Macro splits** | lose 30/25/45; maintain 25/30/45; gain 25/25/50 | Product decision (no single universal standard) | **Within reasonable ranges.** Sums to 100% for each goal. |
| **Q4 Atwater coefficients** | protein 4, fat 9, carbs 4 | USDA Atwater general factors | **Canonical.** Correct general factors. |
| **Q5 Math.round** | JS `Math.round` | ECMA-262 `Math.round` semantics | **Correct for positive numbers.** `-0.5` edge case does not apply to positive nutritional targets. |

**Source-citation integrity:**
- `https://pubmed.ncbi.nlm.nih.gov/2305711/` — HTTP 200, valid.
- `https://www.niddk.nih.gov/bwp` — HTTP 200, valid.

### 2. Formula version constant traceability (`mifflin_st_jeor_v1_2026_04`)

The constant uses `snake_case` with a dated suffix (`_v1_2026_04`). It is self-documenting and unambiguous. The ARCH-001@0.3.1 §5 schema defines `formula_version: string` on both `user_profiles` (line 439) and `user_targets` (line 455), so the ADR amendment does not introduce a schema mismatch. The ADR correctly mandates persistence on `user_targets` for audit traceability.

### 3. Internal consistency: ADR-005@0.2.0 §Decision Detail vs. Q-001 answer

Q-TKT-005-01 (answerer_model: gpt-5.5-xhigh) states: "Use ADR-005@0.2.0 §Decision Detail: KBJU Formula Parameters Q1–Q5 as the source of truth for TKT-005@0.1.0 target calculation; it pins the Mifflin-St Jeor coefficients, activity multipliers, 7700 kcal/kg pace conversion, goal-specific macro split, rounding rule, and required `formula_version` persistence contract without duplicating values in this question artifact."

This is a single-source-of-truth pattern: Q-001 delegates to the ADR and does not duplicate the numeric values. **Consistent.**

### 4. Frontmatter version arithmetic (0.1.0 → 0.2.0)

Semantically, a minor bump for an additive amendment (new §Decision Detail section, no breaking change to existing Options/Decision/Consequences) is correct per semver conventions. However, the ADR file in `main` currently lacks a `version:` frontmatter field entirely; the `@0.1.0` reference in caller artifacts was a logical convention. Adding `version: 0.2.0` is technically a frontmatter expansion rather than a bump of an existing field. See F-L3.

### 5. Cascade discipline (caller pins)

The PR updates TKT-005@0.1.0 → ADR-005@0.2.0 in two places (§2 In Scope, §4 Inputs). `validate_docs.py` passes on the PR branch (39 artifacts, 0 failed). Other tickets referencing ADR-005@0.1.0 (TKT-003@0.1.0, TKT-006@0.1.0, TKT-014@0.1.0) consume cost bounds, K7 accuracy proposals, and food-lookup paths — none of which changed in the amendment. **Caller cascade is minimal and safe for those tickets.**

ARCH-001@0.3.1 (commit 3045637) now carries `ADR-005@0.2.0` pins in both frontmatter and §4.1 body text. The cascade is complete. **F-M2 resolved.**

### 6. §0 Recon (ADR has no §0; amendment vs. ARCH-001@0.3.0 §0)

ADR-005@0.2.0 is a Phase 5 design decision record, not an ArchSpec, so it has no §0 Recon Report by convention. The amendment does not introduce any new major capability, fork candidate, or external stack. The Phase 0 KBJU skill audit in ARCH-001@0.3.1 §0.2 Capability A is unchanged and remains valid. **No contradiction introduced.**

### 7. Audit impact: `formula_version` vs. `user_targets` schema

ARCH-001@0.3.1 §5 `user_targets` contains `formula_version: string` (line 455). The ADR amendment’s instruction — "C2 must persist the formula-version field on each `user_targets` calculation" — aligns with the existing schema and does not introduce a schema drift. The `user_profiles` table also contains the same field (line 439), but the ADR does not mention it. See F-L2.

## Cross-reference checklist (Reviewer ticks)
- [x] §0 Recon Report present, ≥3 fork-candidates audited per major capability *(N/A for ADR; ArchSpec §0 unchanged and uncontradicted)*
- [x] All PRD sections claimed as "implemented" actually have a covering component *(no new PRD claims; amendment hardens existing C2 coverage)*
- [x] All Non-Goals from PRD are respected *(formula math is deterministic and contains no LLM call, no medical advice, no scope creep)*
- [x] Resource budget fits PRD Technical Envelope *(local arithmetic; zero runtime cost change)*
- [x] Every Ticket in Work Breakdown is atomic *(TKT-005@0.1.0 is unchanged by this PR; ADR amendment only)*
- [x] Every ADR evaluates ≥3 real options with concrete trade-offs *(Option A–E remain from 0.1.0; 5 real options, no strawmen)*
- [x] All references are version-pinned (`@X.Y.Z`) *(TKT-005@0.1.0 updated to @0.2.0; ARCH-001@0.3.1 updated to @0.2.0 — F-M2 resolved)*
- [x] §8/§9/§10 (Observability/Security/Deployment) non-empty with concrete choices *(N/A for ADR; unchanged)*
- [x] Rollback procedure is a real command sequence, not "revert" *(N/A for ADR; unchanged)*

## Red-team probes (Reviewer must address each)
- **What happens if openclaw / VPS goes down mid-flow?** — N/A; onboarding target calculation is deterministic local arithmetic with no external call.
- **How does the system behave at 10× expected user count?** — O(1) arithmetic per onboarding; no scaling risk.
- **Which prompt-injection vectors apply to LLM-fed components?** — None; this ADR governs deterministic math, no LLM usage.
- **What is the data-retention story?** — `formula_version` is a static string persisted alongside targets; no PII added. Right-to-delete already covers `user_targets` hard-delete in ARCH-001@0.3.1 §4.1.
- **Concurrency: can two updates race for the same DB row?** — C2 writes `user_profiles`, `user_targets`, and `summary_schedules` in one transaction per ARCH-001@0.3.1 §4.1; no new race surface introduced by the amendment.
