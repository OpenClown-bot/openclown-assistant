---
id: RV-SPEC-008
type: spec_review
target_ref: PRD-003@0.1.1
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-04
---

# Spec Review — Tracking Modalities Expansion (PRD-003@0.1.1)

## Summary

PRD-003@0.1.1 is a well-scoped modality-tracking layer that correctly inherits PRD-002@0.2.1 observability contracts and PRD-001@0.2.0 latency envelopes. The six SMART goals are numerically grounded and trace to seven measurable KPIs; the eleven Non-Goals and crisp §10 successor-PRD boundaries prevent scope creep into proactive coaching, cross-modality recommendations, or calendar UI. Three medium ambiguities remain in acceptance-criteria edge cases: undefined sleep-to-calendar-day attribution for midnight-spanning records, an undefined fallback for workout text lacking quantifiable fields, and a missing timeout for mood free-text inference confirmation. Two low cosmetic items (non-standard transliteration and a nap threshold stranded in a risk mitigation) are also noted. No high-severity blockers.

## Verdict

- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: The PRD is architecturally sound and inherits upstream contracts correctly, but three medium AC ambiguities must be resolved in a patch revision before Architect handoff; no high-severity blockers.

## Findings

### High (blocking)

None.

### Medium

- **F-M1 (§2 G2, §5 US-2 AC2):** Sleep-to-calendar-day attribution rule is undefined. A sleep event spanning midnight (e.g., start 23:00, end 06:00) has no specified inclusion rule for daily summaries, making G6/K6 summary-correctness unverifiable for sleep events because the same record could appear in either of two daily summaries depending on Architect interpretation. — *Responsible role:* Business Planner. *Suggested remediation:* Add a US-2 AC specifying that sleep events are attributed to the calendar day of the end timestamp (the waking day), or an alternative PO-ratified rule, so daily-summary inclusion is deterministic.

- **F-M2 (§5 US-3 AC1):** Fallback behavior is undefined when workout modality is ON and the user sends text describing a workout type but lacking any quantifiable field (duration, distance, repetitions × sets, intensity). The AC precondition "with at least one of {duration, distance, repetitions × sets, intensity descriptor}" excludes this case, leaving the bot's response unspecified; a hostile reader could argue the message silently falls through to KBJU parsing or is dropped. — *Responsible role:* Business Planner. *Suggested remediation:* Add an AC bullet: "Given workout modality is ON, when I send text describing a workout type but lacking duration, distance, repetitions × sets, or intensity, then the bot replies with a friendly clarifying question asking for at least one quantifiable detail, and no workout event is persisted."

- **F-M3 (§5 US-4 AC3):** Mood free-text inference confirmation lacks timeout or cancellation behavior. If the user sends a different message (e.g., a meal log) before confirming the inferred score, or never replies, the pending inference state is undefined; a hostile reader could argue the next message is interpreted as a confirmation or that the state lingers indefinitely. — *Responsible role:* Business Planner. *Suggested remediation:* Add an AC constraint: "If the user does not send an explicit confirmation or correction within 5 minutes, the pending mood inference is discarded and the user's next unrelated message is processed as a new independent input."

### Low (nit / cosmetic)

- **F-L1 (§5 US-2 AC2):** 'iduspat' is a non-standard transliteration of 'иду спать' used alongside Cyrillic 'лёг'. Inconsistent transliteration style may confuse the Architect designing voice-recognition vocabulary. — *Responsible role:* Business Planner. *Suggested remediation:* Replace 'iduspat' with 'иду спать' in Cyrillic, or use a consistent ASCII fallback ('idu spat' or 'spat').

- **F-L2 (§8 R2 mitigation):** The ≤4-hour nap threshold ("naps allowed as separate sleep records ≤4 h with no auto-merge") is stated only in a risk mitigation, not in any User Story AC. This makes the threshold non-normative for implementation and leaves it as an optional Architect design choice rather than a requirement. — *Responsible role:* Business Planner. *Suggested remediation:* Move the ≤4h nap rule into US-2 as an AC, or remove it from R2 and defer entirely to the Architect's design.

### Questions for PO / Business Planner

- **Q1 (§9 OQ-1 + OQ-3):** Confirming the Devin Orchestrator read — OQ-1 already specifies the default modality-priority order (KBJU → water → sleep → workout → mood) and OQ-3 already specifies the per-class golden-set distribution (10 running + 5 walking + 8 cycling + 12 strength training + 5 yoga + 5 swimming + 5 hiking). The DO's Q-candidate (b) claiming "workout golden-set per-class distribution unspecified" was factually incorrect; neither candidate requires escalation to a medium finding.
