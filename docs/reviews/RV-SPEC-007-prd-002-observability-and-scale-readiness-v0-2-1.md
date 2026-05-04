---
id: RV-SPEC-007
type: spec_review
target_ref: PRD-002@0.2.1
status: in_review
reviewer_model: "kimi-k2.6"
related: ["RV-SPEC-006"]
created: 2026-05-03
---

# Spec Review — Observability and Scale Readiness (PRD-002@0.2.1, second-pass)

## Summary

Second-pass audit of PRD-002@0.2.1, the patch revision applied in response to RV-SPEC-006 findings F-M1 / F-M2 / F-M3 / F-L1 + Q1. All five RV-SPEC-006 findings are substantively closed: F-M1 by normative four-phase metric definitions with a non-remapping clause; F-M2 by the durable-store-only + emit-boundary-redaction dual requirement; F-M3 by the evidenced R9 risk with concrete mitigation; F-L1 by corrected citations; and Q1 by verifiable PO-ratification in PR #96 description + PR #97 existence. No new hostile-reader ambiguities, scope drift, or forbidden architecture terms were introduced by the patch. PRD-002@0.2.1 is ready for Architect handoff.

## Verdict

- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: All RV-SPEC-006 findings are closed and no new issues were discovered on the second pass; the PRD is safe for the next ArchSpec Phase-0 recon.

## Findings

### High (blocking)

None.

### Medium

None.

### Low (nit / cosmetic)

None.

### Questions for PO / Business Planner

None.

## Closure record

| RV-SPEC-006 finding | Status on v0.2.1 | Evidence (file:line or PR-body section) |
|---|---|---|
| F-M1 | closed | PRD-002@0.2.1 §2 G3 (lines 24–28): four phase metrics explicitly defined with start-event / end-event / units; §5 US-3 AC1 (line 65): "Architect MUST NOT remap them to other wall-clock timers." |
| F-M2 | closed | PRD-002@0.2.1 §5 US-5 AC5 (line 87): dual requirement — durable tenant-scoped store only (ARCH-001@0.4.0 §3.11) + stdout-log emit-boundary redaction (ARCH-001@0.4.0 §10.7); scope restricted to telemetry introduced by PRD-002@0.2.1. |
| F-M3 | closed | PRD-002@0.2.1 §8 R9 (line 121): impact=high, likelihood=medium, evidenced by `litellm.BadRequestError` on PR #96; mitigation = dummy-PR pre-deploy verification + two-consecutive-failure escalation + extended G3 window until 10 successes. |
| F-L1 | closed | PRD-002@0.2.1 §7 LLM budget (line 102) + §9 OQ-1 (line 124): both now cite `PRD-001@0.2.0 §2 G5 / §6 K5`; zero remaining `§6 G5` occurrences in file. |
| Q1 | closed | PR #96 body (BP hand-back comment): "PO explicitly authorised parallel modalities-expansion PRD draft on 2026-05-03"; PR #97 (`Tracking Modalities Expansion`) is open and confirms the 3-PRD split. |

## Cross-reference checklist (Reviewer ticks)

- [x] **P1 — PRD sections present.** §1–§10 all non-empty; §5 has ≥1 User Story per Goal; §6 has ≥1 KPI per Goal.
- [x] **P2 — Non-Goals respect PRD-001@0.2.0 §3.** NG1–NG10 explicitly listed; NG7 preserves PRD-001@0.2.0 US-1..US-9; no replacement or contradiction of approved v0.1 scope.
- [x] **P3 — Goals are SMART and numerically defensible.** G1 ≤5 min p95 + ≤5 min alert; G2 ≥120 s threshold, ≤15 s detection, ≥95 % coverage; G3 p100 ≤8 min / p50 ≤4 min on rolling-10-PR; G4 N=10 000, ≤2 % overhead, ≤30 s propagation.
- [x] **P4 — Risks ranked by impact × likelihood, highest first.** R3 (critical×low), R5 (critical×low–medium), R1/R2/R4/R9 (high×medium or high×low–medium), R6/R7/R8 (medium×low/medium/medium–high). Order defensible.
- [x] **P5 — OQs have working defaults + escalation condition.** OQ-1 default = continue PRD-001@0.2.0 telemetry without ceiling; OQ-2 default = 90-day live / 365-day purge; OQ-3 default = K1 ≤5 min (sync) / ≤15 min (fallback), K2 120 s (60–600 s configurable); OQ-4 default = NG10 preserved until PO reopens.
- [x] **P6 — LLM cost claim cross-checks to envelope.** v0.2 dev cycle explicitly de-scoped from PRD-001@0.2.0 §2 G5 / §6 K5 $10/month ceiling per PO authorisation; OQ-1 is the ratification gate, not a hidden loophole.
- [x] **P7 — No hallucinated architecture terms.** Anti-hallucination grep clean (no SQLite / Postgres / Whisper / OpenFoodFacts / OmniRoute / Fireworks / Docker / cron / API endpoint / framework / library as concrete mandates).
- [x] **P8 — write-zone respected.** The only file changed in the v0.2.0 → v0.2.1 patch is the PRD-002@0.2.1 markdown document itself; no code, config, or template modifications.
- [N/A] **A1 — ArchSpec ADR coverage.** (Architect stage-gate check; not applicable at PRD review.)
- [N/A] **A2 — Ticket atomicity and resource budgets.** (Architect stage-gate check; not applicable at PRD review.)
- [N/A] **A3 — Deployment pipeline rollback procedure.** (Architect stage-gate check; not applicable at PRD review.)

## Red-team probes (Reviewer must address each)

1. **What happens if the breach-detector itself is compromised or misconfigured to silently drop breach events?** The PRD mitigates via synthetic-breach injection (G1 acceptance) and Reviewer audit of the detector implementation (R3). A second-layer safeguard (e.g., a Reviewer-run synthetic audit independent of the production detector) is implied but not normatively required; acceptable because R3 likelihood is `low` and impact is `critical`, justifying the existing mitigation stack.

2. **At 10 000 concurrent users, does the ≤2 % overhead telemetry budget still hold if every user simultaneously triggers breach-detection, model-stall, and PR-Agent CI metrics?** PRD-002@0.2.1 addresses this via G4 load-test gates at N = 10 / 100 / 1 000 / 10 000, each with ≤2 % overhead ceiling and ≤30 s propagation. R4 and R8 explicitly flag the bottleneck risk and make the Reviewer-signed code-path audit a blocking gate before each load-test. The PRD does not guarantee the budget at 10 000; it guarantees the budget will be measured and gated before growth is enabled past the last-passed gate.

3. **Does v0.2.1's normative phase-metric definition force the Architect into a specific instrumentation choice that violates the openclaw runtime constraint (PRD-001@0.2.0 §7) or the C10 ≤5 % telemetry-overhead budget (PRD-002@0.2.1 §7)?** No. The four phase metrics are defined as wall-clock observables with start/end events, not as implementation mandates. The Architect may instrument them via the existing C10 emit path, via CI-native timing hooks, or via any other means that respects the ≤5 % overhead budget. The "MUST NOT remap" clause constrains label semantics, not implementation technology.

4. **Does R9's "extended G3 measurement window until 10 successful PR-Agent invocations observed" mitigation indefinitely defer K3 measurement if PR-Agent invocation failures persist?** No. The mitigation is bounded by the two-consecutive-failure escalation trigger: after two failures, the Devin Orchestrator escalates to the Product Owner, who then decides whether to (a) fix the infrastructure and resume measurement, or (b) declare a fallback model (per R2's existing escalation path). The 10-success target is a measurement-completeness gate, not an unbounded deferral; the two-failure escalation is the bounded-time exit.

5. **Does the v0.2.1 patch correctly preserve the BP's HARD-SCOPE write-zone — i.e. is the only file changed the PRD-002@0.2.1 markdown document?** Yes. The diff `c8dc73c..e66149b` touches only that file; the BP hand-back comment and PR #96 both confirm the single-file patch. No code, config, workflow, or template files were modified.
