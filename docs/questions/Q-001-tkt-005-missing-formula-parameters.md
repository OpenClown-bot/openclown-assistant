---
id: Q-TKT-005-01
status: answered
ticket_ref: TKT-005@0.1.0
asker_model: "glm-5.1"
answerer_model: "gpt-5.5-xhigh"
created: 2026-04-29
answered: 2026-04-29
---

# Q-TKT-005-01: Missing KBJU Formula Parameters

## Context
ADR-005@0.1.0 states "Target calculation for onboarding uses Mifflin-St Jeor BMR, activity multiplier, and a disclosed calorie delta from selected pace" and cites PMID 2305711, but does NOT specify: (1) the Mifflin-St Jeor coefficients, (2) the activity multiplier table, (3) the macro split ratios per goal, (4) the pace-to-calorie-delta conversion constant, or (5) the rounding rule for final integer targets. These are product decisions the Executor cannot invent.

## Questions (multiple-choice preferred)

**Q1: Mifflin-St Jeor coefficients** — The published formula (PMID 2305711) is:
- Male: BMR = 10W + 6.25H − 5A + 5
- Female: BMR = 10W + 6.25H − 5A − 161
(where W=weight_kg, H=height_cm, A=age_years)
Confirm? Or use different coefficients?

**Q2: Activity multiplier table** — Standard Harris-Benedict-derived multipliers:
- sedentary: 1.2
- light: 1.375
- moderate: 1.55
- active: 1.725
- very_active: 1.9
Confirm? Or provide custom table?

**Q3: Pace-to-calorie-delta conversion** — Option A: 7700 kcal per 1 kg body weight change (standard approximation). Option B: different constant. Pace delta = pace_kg_per_week × 7700 / 7 (kcal/day).

**Q4: Macro split per goal** — Option A:
- lose: protein 30%, fat 25%, carbs 45%
- maintain: protein 25%, fat 30%, carbs 45%
- gain: protein 25%, fat 25%, carbs 50%
Option B: fixed split regardless of goal (e.g., 30/25/45). Option C: other.

**Q5: Rounding rule for integer targets** — Option A: Math.round (round-half-up). Option B: Math.floor (always round down for safety). Option C: round-half-to-even (banker's rounding). ADR-005@0.1.0 does not specify.

## What I assumed / would do if no answer
I would use Q1 standard Mifflin, Q2 standard multipliers, Q3 7700 kcal/kg, Q4 Option A macro split, Q5 Math.round. These are the most common defaults in nutrition-tracking software. However, since the PRD emphasizes this is a personal health tool for 2 pilot users, I want explicit PO/Architect ratification before committing these constants to the formula_version-tagged code.

## Architect's answer
Use ADR-005@0.2.0 §Decision Detail: KBJU Formula Parameters Q1–Q5 as the source of truth for TKT-005@0.1.0 target calculation; it pins the Mifflin-St Jeor coefficients, activity multipliers, 7700 kcal/kg pace conversion, goal-specific macro split, rounding rule, and required `formula_version` persistence contract without duplicating values in this question artifact.
