---
id: RV-SPEC-001
type: spec_review
target_ref: PRD-001@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-26
---

# Spec Review — KBJU Coach v0.1

## Summary
The reviewed PRD is a well-structured, tight-scope pilot document. All five SMART Goals trace to measurable KPIs, nine concrete User Stories have testable Acceptance Criteria, the Technical Envelope sets defensible numeric bounds against the project's LLM-routing cost model, and all three Open Questions are disciplined escalations with working defaults and closure conditions. Three medium findings stem from hostile-reader wiggle-room (undefined validation ranges, unguarded recommendation scope) and two low findings cover minor UX omissions. No high-severity blockers.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: The PRD is ready for `in_review` once two medium ambiguities are tightened in a patch revision; no architectural or product-level defects block the stage gate.

## Findings

### High (blocking)
None.

### Medium
- **F-M1 (§5 US-1 AC2 / AC3, line 50–51):** The terms "sane default" (pace default) and "sane ranges" (biometric validation) give the Architect undefined latitude that a hostile reader could stretch to useless extremes (e.g., age range 0–999). The PRD should either pin the ranges/default explicitly, or add an AC stating "PO ratifies concrete ranges and the default pace before pilot start." — *Responsible role:* Business Planner. *Suggested remediation:* Replace "sane default" with "default pace = 0.5 kg/week (moderate deficit) unless the user overrides" and list the concrete validation ranges (e.g., age 10–120, height 100–250 cm, weight 20–300 kg, pace 0.1–2.0 kg/week) in a parenthetical, or escalate to PO as a mini OQ with a working default.

- **F-M2 (§5 US-5 AC2, line 88):** "A short personalized recommendation derived from the data" lacks guardrails on topical scope. A hostile Architect (or an over-eager LLM prompt) could emit vitamin, supplement, hydration, or glycemic-index advice — all explicitly deferred in §3 NG6. The PRD should constrain recommendations to KBJU-relevant coaching (e.g., calorie-surplus/deficit, macro balance, meal-timing around targets) and explicitly prohibit non-KBJU health advice in the same AC. — *Responsible role:* Business Planner. *Suggested remediation:* Append to the AC: "Recommendations MUST be limited to calorie and macronutrient balance relative to the user's target; they MUST NOT mention vitamins, supplements, hydration, glycemic index, or any clinical/medical advice."

### Low (nit / cosmetic)
- **F-L1 (§5 US-6 AC1, line 96):** "Paginated list" omits page size, giving the Architect wiggle room that could produce an unusable 3-item-per-page or overwhelming 100-item-per-page list. — *Responsible role:* Business Planner. *Suggested remediation:* Add "with a page size of 5–10 meals per page (PO selects exact number before pilot start)" or similar.

- **F-L2 (§5 US-7 AC2 / AC3, line 104–105):** "Guided manual-entry form" is undefined in the Telegram UX context (free-text sequence? Inline keyboard? One-shot structured message?). — *Responsible role:* Business Planner. *Suggested remediation:* Add a clarifying parenthetical, e.g., "(sequential Telegram messages or inline-keyboard flow, Architect specifies in UX notes)."

- **F-L3 (§6 K4, line 132):** "End-of-pilot manual audit of stored events" leaves the audit scope ambiguous — application logs, observability traces, and router billing records may contain user-mentioning data but are not explicitly in or out of scope. — *Responsible role:* Business Planner. *Suggested remediation:* Clarify whether the audit covers only the primary user-data store or also includes logs/transcripts/router events; if the latter, add a requirement to the Technical Envelope or K4 measurement method.

### Questions for PO / Business Planner
- **Q1:** F-M1 asks for concrete biometric validation ranges. Can the PO supply these in a follow-up commit, or should they be escalated as a fourth OQ with working defaults?
- **Q2:** F-M2 asks for a topical guardrail on "personalized recommendations." Is the proposed KBJU-only constraint acceptable, or does the PO want a broader but still non-medical scope?

## Cross-reference checklist (Reviewer ticks)
- [x] §A.4 Contract compliance — all sections §1–§10 present and in order; frontmatter complete; status is `draft`; Handoff Checklist present with truthful annotations.
- [x] §A.5 Goal → KPI traceability — G1→K1, G2→K2, G3→K3, G4→K4, G5→K5; all Goals covered.
- [x] §A.6 Non-Goal respect — no Non-Goal feature re-introduced in User Stories; NG terms appear only in §3, §10, and justified references (disclaimer for NG7, risk mitigation for NG10).
- [x] §A.7 Envelope compliance — concrete numbers (CPU ≤25 % p95, RAM ≤2 GB, $10/mo hard ceiling, p95/p100 latency triplets); cost ceiling is defensible against `docs/knowledge/llm-routing.md` ≈ $5–10/mo envelope; all external dependencies map to §7 constraints.
- [x] §A.10 Risks — 9 risks listed, each with concrete impact / likelihood / mitigation; ≥3 satisfied.
- [x] §A.12 Security & data handling — §7 and §8 address raw-media deletion, indefinite text retention until right-to-delete, hosting-jurisdiction exposure, and Telegram ToS obligations.
- [x] P1 SMART goals — all five Goals are Specific, Measurable, Achievable, Relevant, Time-bound.
- [x] P2 Testable ACs — every User Story AC is Given/When/Then or an equivalent verifiable step; no "user is happy" or "works smoothly" ACs found.
- [x] P3 Measurable KPIs — K1–K6 have numeric targets, measurement windows, and methods; K7 is explicitly TBD with a closure condition (OQ-1) and does not orphan any downstream requirement.
- [x] P4 Non-Goals minimum — 10 Non-Goals present; all are genuine deferrals or explicit exclusions.
- [x] P5 Open Questions discipline — OQ-1, OQ-2, OQ-3 are all escalated with working defaults and explicit closure conditions; none are unresolved bullet points.
- [x] P6 Tech stack leaks — no forbidden library, framework, schema, model name, API endpoint, or transport protocol found in §1–§8 outside the PO-locked "openclaw" and "Telegram" context.
- [x] P7 Frontmatter accuracy — id, title, version, status, owner, author_model (`claude-opus-4.7-thinking`), created, updated all correct.
- [x] P8 Handoff Checklist truthfulness — checked items are true; unchecked items carry honest one-line rationale; the K7 TBD is the only outstanding TBD outside §9.
- [ ] §0 Recon Report present, ≥3 fork-candidates audited per major capability — N/A — PRD-only review
- [ ] All PRD sections claimed as "implemented" actually have a covering component (Trace matrix walk) — N/A — PRD-only review
- [ ] Resource budget fits PRD Technical Envelope (numeric) — N/A — PRD-only review
- [ ] Every Ticket in Work Breakdown is atomic (one-sentence Goal) — N/A — PRD-only review
- [ ] Every ADR evaluates ≥3 real options with concrete trade-offs — N/A — PRD-only review
- [ ] All references are version-pinned (`@X.Y.Z`) — N/A — PRD-only review (no internal version-pinned refs in PRD body; external refs are names of PO-locked services)
- [ ] §8/§9/§10 (Observability/Security/Deployment) non-empty with concrete choices — N/A — PRD-only review
- [ ] Rollback procedure is a real command sequence, not "revert" — N/A — PRD-only review

## Red-team probes (Reviewer must address each)
- What happens if openclaw / VPS goes down mid-flow? — PRD does not specify infra redundancy; deferred to Architect per §8 Risk "VPS or runtime outage interrupts logging" and mitigation US-7 manual-entry fallback. PRD stage acceptable.
- How does the system behave at 10× expected user count? — PRD states multi-tenant day-1 design goal (US-9, §7) but does not set a 10× load target; cost envelope would breach at 10 users. This is acknowledged as a future scaling epic, not a v0.1 pilot requirement.
- Which prompt-injection vectors apply to LLM-fed components? — Not specified at PRD stage (implementation detail). The PRD does require retry policy excluding "model returned a suspicious response" (US-7 AC3), which seeds an anti-injection posture without naming the mechanism.
- What is the data-retention story? Where is PII stored, for how long, deletable how? — §7 covers this: raw voice/photo deleted immediately post-extraction; transcripts and confirmed records retained indefinitely until right-to-delete (US-8); hosting jurisdiction TBD (OQ-3).
- Concurrency: can two updates race for the same DB row? — Not specified at PRD stage; data-isolation requirement (US-9 AC1) is storage-layer scoping, not transactional semantics. Architect must close this in the data-model ADR.
