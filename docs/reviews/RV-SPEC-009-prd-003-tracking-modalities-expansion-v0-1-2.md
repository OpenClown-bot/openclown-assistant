---
id: RV-SPEC-009
type: spec_review
target_ref: PRD-003@0.1.2
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-04
---

# Spec Review (closure-audit) — Tracking Modalities Expansion (PRD-003@0.1.2)

## Summary

Second-pass closure-audit of PRD-003@0.1.2, verifying that all six RV-SPEC-008 findings (F-M1, F-M2, F-M3, F-L1, F-L2, Q1) are substantively closed by the v0.1.2 patch. The Business Planner added four normative Given/When/Then AC bullets (US-2 AC3 for midnight-spanning sleep attribution, US-2 AC4 for nap-class records, US-3 AC2 for workout fallback, US-4 AC4 for mood inference timeout), replaced the non-standard ASCII transliteration `iduspat` with Cyrillic `иду спать`, and refactored R2 mitigation to point at the new normative ACs. No new substantive ambiguities, contradictions, or regressions were introduced by the patch. PRD-003@0.1.2 is ready for Architect handoff.

## Verdict

- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: PRD-003@0.1.2 closes all RV-SPEC-008 findings (F-M1 / F-M2 / F-M3 / F-L1 / F-L2 / Q1) with explicit Given/When/Then AC additions and a normative R2-mitigation refactor; no new hostile-reader ambiguities or closure-induced regressions were discovered.

## Findings

### High (blocking)

None.

### Medium

None.

### Low (nit / cosmetic)

None.

### Questions for PO / BP

None.

## Closure verification table

| RV-SPEC-008 finding | Status on v0.1.2 | Evidence (file:line or section) |
|---|---|---|
| **F-M1** — Sleep midnight-spanning attribution undefined | closed | PRD-003@0.1.2 §5 US-2 AC3: "Given a sleep record with start timestamp on calendar day D and end timestamp on calendar day D+1... then the record is attributed to and included in the calendar day of the END (waking) timestamp only... and is NOT also included in the D daily summary." |
| **F-M2** — Workout text lacking quantifiable fields: fallback undefined | closed | PRD-003@0.1.2 §5 US-3 AC2: "Given workout modality is ON, when I send a free-form text message describing a workout type but lacking ANY of {duration, distance, repetitions × sets, intensity descriptor}... then the bot replies with a friendly clarifying question... AND NO workout event is persisted until I reply with the missing field; the message MUST NOT silently fall through to KBJU parsing and MUST NOT be dropped without a reply." |
| **F-M3** — Mood free-text inference confirmation: timeout / cancellation undefined | closed | PRD-003@0.1.2 §5 US-4 AC4: "Given a pending mood free-text inference is awaiting my confirmation or correction, when 5 minutes elapse without my explicit confirmation or correction, then the pending inference is discarded silently AND my next message is processed as a new independent input (NOT auto-treated as confirmation of the discarded inference); a fresh free-text mood input restarts the inference + confirmation flow with a new 5-minute window." |
| **F-L1** — `iduspat` non-standard transliteration | closed | PRD-003@0.1.2 §5 US-2 AC2: evening trigger now reads `"лёг" / "иду спать"` (Cyrillic, consistent with adjacent `лёг`). |
| **F-L2** — ≤4 h nap threshold stranded in R2 mitigation | closed | PRD-003@0.1.2 §5 US-2 AC4: "Given a sleep record has a derived duration ≤ 4 hours, the record is persisted as a separate nap-class sleep record and is NOT auto-merged with any other sleep record of the same calendar day..." AND §8 R2 mitigation refactored to point at normative AC: "nap handling is normative per §5 US-2 AC — ≤4 h derived duration = separate nap-class record with no auto-merge; midnight-spanning attribution is normative per §5 US-2 AC." |
| **Q1** — OQ-1 / OQ-3 confirmation | closed (no PRD action) | RV-SPEC-008 confirmed the DO's read that OQ-1 default (KBJU→water→sleep→workout→mood) and OQ-3 default (10 running + 5 walking + 8 cycling + 12 strength training + 5 yoga + 5 swimming + 5 hiking) are sufficient; no escalation to BP action required. |

## Cross-reference checklist (Reviewer ticks)

- [x] **P1 — PRD sections present.** §1–§10 all non-empty; §5 has ≥1 User Story per Goal; §6 has ≥1 KPI per Goal.
- [x] **P2 — Non-Goals respect PRD-001@0.2.0 §3.** NG1–NG11 explicitly listed; NG6 preserves PRD-001@0.2.0 US-1..US-9; no replacement or contradiction of approved v0.1 scope.
- [x] **P3 — Goals are SMART and numerically defensible.** G1 ≤ PRD-001@0.2.0 §7 latency envelopes; G2 30 min / 24 h sanity floor/ceiling; G3 ≥80 % golden-set accuracy; G4 1–10 scale + optional ≤280-char comment; G5 ≤30 s toggle propagation; G6 100 % summary-correctness on rolling-7-day audit.
- [x] **P4 — Risks ranked by impact × likelihood, highest first.** R4 (critical×medium), R1/R3/R9 (medium–high×medium), R2/R6/R7 (medium×medium), R5/R8 (low×medium), correctly ordered.
- [x] **P5 — OQs have working defaults + escalation condition.** OQ-1 default = 200 ml / 500 ml / 1 000 ml; OQ-2 default = 7-class taxonomy; OQ-3 default = 50-event per-class composition; OQ-4 default = confirmation-reply + accept/correct flow; OQ-5 default = `/settings`; OQ-6 default = weekly Telegram digest to PO.
- [x] **P6 — LLM cost claim cross-checks to envelope.** No numeric LLM-budget envelope; inherited from PRD-002@0.2.1 §7 + §9 OQ-1 with PO-authorised unconstrained v0.2 spend.
- [x] **P7 — No hallucinated architecture terms.** Anti-hallucination grep clean (no SQLite / Postgres / Whisper / OpenFoodFacts / OmniRoute / Fireworks / Docker / cron / API endpoint / framework / library as concrete mandates).
- [x] **P8 — write-zone respected.** The only file changed in the v0.1.1 → v0.1.2 patch is the PRD-003@0.1.2 markdown document itself; no code, config, or template modifications.
- [N/A] **A1 — ArchSpec ADR coverage.** (Architect stage-gate check; not applicable at PRD review.)
- [N/A] **A2 — Ticket atomicity and resource budgets.** (Architect stage-gate check; not applicable at PRD review.)
- [N/A] **A3 — Deployment pipeline rollback procedure.** (Architect stage-gate check; not applicable at PRD review.)

## Red-team probes (Reviewer must address each)

1. **What happens if a user sends a "лёг" event but never sends the matching "встал" event within 24 h?** US-2 AC2 states: "if a 'лёг' event is followed by another 'лёг' event without an intervening 'встал', the older one is invalidated and a friendly reply asks the user to clarify." However, the PRD does not explicitly define the behaviour if no second event of any kind arrives within 24 h. A hostile reader could argue the first "лёг" lingers indefinitely. This is a gap, but it is not introduced by the v0.1.2 patch — it existed in v0.1.1 and was not flagged in RV-SPEC-008. Per closure-audit discipline (re-verify only RV-SPEC-008 findings, do not re-discover), this is noted as a pre-existing edge case for Architect design, not a new finding.

2. **Does the ≤5 % telemetry-overhead budget (§7 Latency budget) still hold when all four new modalities fire simultaneously on the same user message?** The PRD-003@0.1.2 §7 latency envelope requires modality-event handling to add ≤5 % overhead to every user-facing latency budget already locked in PRD-001@0.2.0 §7. This is a per-event overhead, not a per-modality additive stack. A single user message triggers at most one modality path (R1 priority order: KBJU → water → sleep → workout → mood). Therefore simultaneous four-modality firing on one message is architecturally impossible by design; the ≤5 % budget applies to the single matched modality pipeline. No new finding.

3. **Could the new US-4 AC4 5-minute mood-inference timeout be exploited as a state-DoS vector (user sends free-text mood, waits 4:59, sends another free-text mood, ad infinitum, never confirming, never persisting)?** Yes, a hostile user could loop this. However, the PRD does not promise infinite-state robustness at the requirements layer; state-gardening (max-pending-inference limit, rate-limiting, or TTL sweep) is an Architect/Executor implementation concern. The AC is clear: "discarded silently" after 5 min. No hostile-reader ambiguity in the requirement itself. No new finding.

4. **Does the v0.1.2 patch introduce any contradiction between the new US-2 AC4 (nap ≤4 h, no auto-merge) and existing G2 sanity floor (< 30 min)?** No. US-2 AC5 (G2 sanity floor/ceiling) fires before nap classification: "when a parsed duration is < 30 minutes or > 24 hours, then the record is NOT persisted; instead a friendly Telegram reply asks the user to confirm." A 25-minute nap would hit the < 30 min floor first and never reach the ≤4 h nap-class path. The two rules are sequentially consistent. No new finding.

5. **Does the v0.1.2 patch preserve the BP's HARD-SCOPE write-zone — i.e. is the only file changed the PRD-003@0.1.2 markdown document?** Yes. The diff `main..ed5ea39` touches only the PRD-003@0.1.2 markdown document itself; the BP hand-back comment and PR #97 both confirm the single-file patch. No code, config, workflow, or template files were modified.
