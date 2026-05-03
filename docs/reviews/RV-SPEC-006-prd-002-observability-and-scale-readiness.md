---
id: RV-SPEC-006
type: spec_review
target_ref: PRD-002@0.2.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-03
---

# Spec Review — Observability and Scale Readiness (PRD-002@0.2.0)

## Summary

PRD-002@0.2.0 is a tightly scoped follow-on PRD that correctly limits itself to observability hardening (G1–G3) and scale-readiness foundation (G4). The four SMART goals are numerically grounded and trace to five measurable KPIs; the nine Non-Goals and crisp §10 successor-PRD boundaries prevent scope creep into modalities, coaching, or billing. Three medium ambiguities remain: undefined PR-Agent telemetry taxonomy, unclear transactional-deletion scope for log-based telemetry, and a missing risk for PR-Agent CI infrastructure failure. One clerical citation typo and one PO-escalation question on scope-split sequencing are also noted.

## Verdict

- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: The PRD is architecturally sound and the goals are defensible, but three medium ambiguities must be resolved in a patch revision before Architect handoff; no high-severity blockers.

## Findings

### High (blocking)

None.

### Medium

- **F-M1 (§5 US-3 AC1):** The metric tuple "pre-token / first-token / last-token / total-duration" is undefined. A hostile Architect can map these four labels to four unrelated wall-clock timers, making G3 unverifiable. Standard LLM-inference telemetry uses distinct phase names (queue/setup latency, TTFT, generation duration, end-to-end wall clock); the PRD borrows none of them and provides no glossary. — *Responsible role:* Business Planner. *Suggested remediation:* Replace the four terms with explicitly defined phases, e.g., `(CI-step-setup latency, time-to-first-token from PR-Agent LLM call start, time-to-last-token, total CI stage wall-clock duration)`, or add a §7 glossary pinning each definition.

- **F-M2 (§5 US-5 AC4, §7 Technical Envelope):** US-5 AC4 states telemetry traces are hard-deleted "in the same transaction boundary as the existing user-scoped data," but ARCH-001@0.4.0 §8.1 splits C10 output between durable PostgreSQL tables (C3) and ephemeral Docker stdout logs captured by the JSON logging driver. The PRD does not clarify whether log-based telemetry is in scope for `/forget_me` deletion, creating hostile-reader wiggle-room where DB rows are deleted but rotated log entries bearing `user_id` tags may persist for up to the Docker rotation window. — *Responsible role:* Business Planner. *Suggested remediation:* Add an AC or §7 constraint stating "PRD-002@0.2.0 telemetry covered by right-to-delete MUST be stored exclusively in the durable tenant-scoped store (C3 tables); any stdout-log emission MUST redact `user_id` and PII-bearing fields at the emit boundary so log retention does not become a deletion-gap."

- **F-M3 (§8 Risks):** The risk table omits the possibility that PR-Agent CI infrastructure fails to invoke the configured model at all (e.g., LiteLLM routing misconfiguration, provider credential mismatch), which makes G3/K3 unmeasurable regardless of GPT-5.3 Codex intrinsic latency. The Devin Orchestrator ratification audit observed exactly this failure mode on PR #96 (`litellm.BadRequestError: OpenAIException - No credentials for provider: openrouter`). Because G3 is the empirical-validation gate for the swap, a broken invocation path is a higher-likelihood threat than the model itself stalling. — *Responsible role:* Business Planner. *Suggested remediation:* Add R9 — "PR-Agent CI fails to invoke the configured model due to workflow or LiteLLM routing misconfiguration" — with impact=high, likelihood=medium, mitigation="Verify PR-Agent end-to-end on a dummy PR before telemetry-deploy; if two consecutive PRs fail CI invocation, escalate to Devin Orchestrator and extend the G3 measurement window until 10 successful PR-Agent runs are observed."

### Low (nit / cosmetic)

- **F-L1 (§7 Technical Envelope, line 101 + line 122):** Citation reads `PRD-001@0.2.0 §6 G5`; PRD-001@0.2.0 §6 contains only K-rows (K1–K7). The intended reference is §2 G5 (the cost-ceiling Goal) and/or §6 K5 (the matching KPI). — *Responsible role:* Business Planner. *Suggested remediation:* Replace both occurrences with `PRD-001@0.2.0 §2 G5 / §6 K5`.

### Questions for PO / Business Planner

- **Q1 (Scope-split sequencing, from DO audit):** PO direction in chat 2026-05-02 was "точно a+c+e" (observability + modalities + coaching). The Business Planner decomposed this into PRD-002@0.2.0 (observability + scale readiness) → modalities-expansion PRD → proactive-coaching PRD. The split is technically justified (the modalities and coaching epics need the observability foundation underneath), but it deviates from the literal instruction. Please confirm that this 3-PRD sequential decomposition is ratified before PRD-002@0.2.0 is promoted to `approved`. — *Responsible role:* Product Owner.

## Cross-reference checklist (Reviewer ticks)

- [x] §A.4 Contract compliance — all sections §1 through §10 present and in order; frontmatter complete; status is `draft`; Handoff Checklist present with truthful annotations.
- [x] §A.5 Goal → KPI traceability — G1→K1, G2→K2, G3→K3, G4→K4, cross-cutting US-5→K5; all Goals covered.
- [x] §A.6 Non-Goal respect — no Non-Goal feature re-introduced in User Stories; NG terms appear only in §3, §10, and justified references (NG7 preserves PRD-001@0.2.0 USes, NG8 reaffirms medical advice exclusion).
- [x] §A.7 Envelope compliance — concrete numbers (≤5 % telemetry overhead, ≤2 % allowlist overhead, ≤30 s propagation, N = 2/10/100/1 000/10 000); latency budgets inherited from PRD-001@0.2.0 §7 are correctly referenced.
- [x] §A.10 Risks — 8 risks listed (R1–R8), each with concrete impact / likelihood / mitigation; ≥3 satisfied. (Note: F-M3 argues for a ninth risk.)
- [x] §A.12 Security & data handling — §7 and §5 US-5 address redaction, retention, right-to-delete scope extension, and Telegram ToS compliance.
- [x] P1 SMART goals — all four Goals (G1–G4) are Specific, Measurable, Achievable, Relevant, Time-bound.
- [x] P2 Testable ACs — every User Story AC is Given/When/Then or an equivalent verifiable step; no "user is happy" or "works smoothly" ACs found.
- [x] P3 Measurable KPIs — K1–K5 have numeric targets, measurement windows, and methods.
- [x] P4 Non-Goals minimum — nine NGs (NG1–NG9) present; all are genuine deferrals or explicit exclusions.
- [x] P5 Open Questions discipline — OQ-1..OQ-4 are all escalated with working defaults and explicit closure conditions; none are unresolved bullet points.
- [x] P6 Tech stack leaks — no forbidden library, framework, schema, model name, API endpoint, or transport protocol found in §1–§8 outside the PO-locked "openclaw" and "Telegram" context and version-pinned references to existing approved artifacts (ARCH-001@0.4.0, PRD-001@0.2.0).
- [x] P7 Frontmatter accuracy — id, title, version, status, owner, author_model, created, updated all correct.
- [x] P8 Handoff Checklist truthfulness — checked items are true; unchecked items carry honest one-line rationale; no outstanding TBD outside §9.
- [ ] §0 Recon Report present, ≥3 fork-candidates audited per major capability — N/A — PRD-only review
- [ ] All PRD sections claimed as "implemented" actually have a covering component (Trace matrix walk) — N/A — PRD-only review
- [ ] Resource budget fits PRD Technical Envelope (numeric) — N/A — PRD-only review
- [ ] Every Ticket in Work Breakdown is atomic (one-sentence Goal) — N/A — PRD-only review
- [ ] Every ADR evaluates ≥3 real options with concrete trade-offs — N/A — PRD-only review
- [ ] All references are version-pinned (`@X.Y.Z`) — N/A — PRD-only review (external refs are names of PO-locked services; internal refs are version-pinned)
- [ ] §8/§9/§10 (Observability/Security/Deployment) non-empty with concrete choices — N/A — PRD-only review
- [ ] Rollback procedure is a real command sequence, not "revert" — N/A — PRD-only review

## Red-team probes (Reviewer must address each)

- What happens if telemetry collection overhead breaches the §7 ≤5 % budget mid-pilot? — §8 R1 covers this: sampled metrics fallback, explicit load-test gate blocks merge. Acceptable at PRD stage.
- How does the breach detector behave at 10× expected event volume (e.g., 10 000 users each producing hundreds of DB operations per day)? — G1 does not set an events-per-second ceiling; the sampling-fallback mitigation in R7 allows asynchronous queueing if synchronous checking breaches the 5 % overhead. The Architect must size the queue in the feasibility study. PRD stage acceptable.
- Which prompt-injection vectors apply to LLM-fed components introduced by PRD-002@0.2.0? — PRD-002@0.2.0 introduces no new LLM-fed user-facing components; the only LLM interactions are in G2 stall detection (instrumentation of existing calls) and G3 PR-Agent validation (external tool). No new injection surface.
- What is the data-retention story for PRD-002@0.2.0 telemetry? Where is it stored, for how long, deletable how? — §9 OQ-2 sets the retention question with a 90-day live / 365-day auto-purge default. US-5 AC4 extends `/forget_me` to hard-delete user-scoped telemetry in the DB transaction. F-M2 flags the open gap on log-based emission.
- Concurrency: can two simultaneous allowlist updates race? — Not explicitly addressed. §5 US-4 AC2 says "access-control enforcement reflects the new list within ≤30 seconds," which implies atomic config propagation but does not state serializability of overlapping edits. The Architect should address this in the code-path audit. PRD stage acceptable.
