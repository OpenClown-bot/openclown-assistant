---
id: RV-SPEC-003
type: spec_review
target_ref: ARCH-001@0.3.0 + TKT-015@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-28
---

# Spec Review — ARCH-001@0.3.0 + TKT-015@0.1.0

## Summary

ARCH-001@0.2.0 → 0.3.0 is a focused, well-scoped amendment that hardens two existing components (C1, C10) without introducing new stacks, product scope, or resource footprint. All four deferred post-review findings (D-I5, D-I9, F-L2, IPv6 wildcard) are addressed with contract-level precision in the ArchSpec and machine-checkable acceptance criteria in TKT-015@0.1.0. Validation passes (38 artifacts, 0 failed). One medium finding remains: TKT-015@0.1.0 §6 AC6 makes the `kbju_route_unmatched_count` metric conditional ("if no existing constant fits"), while ARCH-001@0.3.0 §8.2 lists it in the Required metric set unconditionally. This is a contract-level inconsistency that must be resolved before Executor pickup.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: The amendment is structurally sound and fully traceable to its deferred findings, but TKT-015@0.1.0 §6 AC6 must be hardened to match the unconditional Required metric contract in ARCH-001@0.3.0 §8.2 before Executor pickup.

## Findings

### High (blocking)
*None.*

### Medium
- **F-M1 (TKT-015@0.1.0 §6 AC6 vs ARCH-001@0.3.0 §8.2):** TKT-015@0.1.0 §6 AC6 states route-unmatched telemetry constants (`KPI_EVENT_NAMES.route_unmatched`, `PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count`) should be added "if no existing constant fits," making their introduction conditional. ARCH-001@0.3.0 §8.2 lists `kbju_route_unmatched_count` in the **Required metric set** and mandates it "must be present once TKT-015@0.1.0 is done." This is a contract-level inconsistency: the ArchSpec treats the metric as unconditionally required, while the Ticket AC makes it optionally conditional. — *Responsible role:* Architect. *Suggested remediation:* Remove the "if no existing constant fits" hedge from TKT-015@0.1.0 §6 AC6 and replace it with an unconditional assertion that `PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count` is emitted; if a constant already exists, the AC should simply require its emission rather than its conditional addition.

### Low (nit / cosmetic)
*None.*

### Questions for Architect
*None.*

## Independent Assessments (per review brief)

### 1. ArchSpec 0.2.0 → 0.3.0 amendment correctness

| Section | Assessment |
|---|---|
| **§3.1 C1 Failure modes** | Correctly adds the sticker/unsupported-message recovery path: "unsupported Telegram message subtypes such as stickers return the Russian generic recovery prompt and emit C10 route-unmatched telemetry without invoking domain handlers." This is a contract-level change (not merely implementation detail) because it prescribes a deterministic user-facing recovery message and an observability emission. |
| **§8.1 emit-boundary redaction contract** | New paragraph mandates defense-in-depth: C10 MUST re-apply allowlist filtering and forbidden-field redaction immediately before serializing metadata to `ctx.log`, treating producer-side redaction as untrusted. This closes the D-I9 gap. The bounded exception for `message_subtype` is explicitly scoped to TKT-015@0.1.0. |
| **§8.2 metrics endpoint bind** | Contract now enumerates all three unspecified-address wildcard forms (`0.0.0.0`, `::`, `[::]`) as forbidden alongside the existing loopback acceptance criteria. The new metric `kbju_route_unmatched_count` is consistent with the §3.1 telemetry requirement. |
| **§10.7 Observability Hardening Addendum** | New addendum cleanly consolidates all four hardening items (sticker recovery, emit-boundary redaction, 256-char lowercase cap, IPv6 wildcard guard) with traceable rationale pointing back to TKT-004@0.1.0 and TKT-003@0.1.0 closure. It does not leak into other components. |
| **§11 Work Breakdown** | Row added for TKT-015@0.1.0 with correct estimate (M), executor assignment (GLM 5.1), dependencies (TKT-003@0.1.0, TKT-004@0.1.0), and status (`ready`). Execution-order note updated from 10 GLM tickets to 11 GLM tickets without destabilizing the roadmap. |

### 2. TKT-015@0.1.0 ready-state quality (§5 Outputs vs §6 ACs)

- **Goal** is one sentence, contains no "and," and is scoped to observability hardening only.
- **§2 In Scope** lists four bounded items; **§3 NOT In Scope** explicitly forbids scope creep into onboarding, meal estimation, voice/photo, storage, deployment, or new runtime deps.
- **§4 Inputs** are all version-pinned (`ARCH-001@0.3.0`, `TKT-003@0.1.0`, `TKT-004@0.1.0`, `RV-CODE-003@0.1.0`, `RV-CODE-004@0.1.0`) and were verified against the referenced review files. Citation `RV-CODE-004@0.1.0 §Findings F-L2` is unambiguous; citation `RV-CODE-003@0.1.0 §Red-team probes line on createMetricsServer` maps to the `createMetricsServer` probe in that review.
- **§5 Outputs** lists 9 files (4 source + 5 test). Every output is covered by at least one AC in §6. No extraneous files.
- **§6 ACs** are machine-checkable:
  - AC4 (`sendMessage` count), AC5 (no domain-handler invocation), AC6 (telemetry shape) cover D-I5.
  - AC7 (forbidden-key stripping), AC8 (core-field survival) cover D-I9.
  - AC9 (`toLowerCase` receiver-length cap), AC10 (original text preservation), AC11 (existing routing regression) cover F-L2.
  - AC12–AC14 (`::` / `[::]` rejection + existing valid-host preservation) cover IPv6 wildcard.
- **§7 Constraints** include the static-allowlist rule and the "file a Q-TKT" guard for any approach that would require Node socket inspection or a new ADR.
- **§8 DoD / §10 Execution Log** are in standard ready-state form.

**Verdict:** TKT-015@0.1.0 is ready for Executor pickup once F-M1 is resolved.

### 3. Alignment with scope brief

| Scope-brief item | ArchSpec coverage | Ticket coverage | Verdict |
|---|---|---|---|
| **D-I5 sticker fall-through** | §3.1 C1 Failure modes + §10.7 | §2 bullet 1, §5 `src/telegram/entrypoint.ts`, §6 AC4–AC6 | Fully aligned. |
| **D-I9 PII defense-in-depth** | §8.1 emit-boundary redaction + §10.7 | §2 bullet 2, §5 `src/observability/events.ts`, §6 AC7–AC8 | Fully aligned. |
| **F-L2 toLowerCase length-cap** | §10.7 "routing-only case normalization must use at most the first 256 characters" | §2 bullet 3, §5 `src/telegram/types.ts`, §6 AC9–AC11 | Fully aligned; 256-char cap is implementation-specific but safe (well above the longest command). |
| **IPv6 wildcard guard** | §8.2 rejection of `0.0.0.0`, `::`, `[::]` + §10.7 | §2 bullet 4, §5 `src/observability/metricsEndpoint.ts`, §6 AC12–AC14 | Fully aligned; AC14 preserves existing valid-host tests. |

### 4. §0 Recon Report adequacy (no §0 update)

No §0 update was made, and none is required. The amendment hardens existing components (C1, C10) under existing ADR-009@0.1.0 without introducing new major capabilities, runtime stacks, or fork candidates. The PR body explicitly states "No ADR added: this extends ADR-009@0.1.0 local observability policy without introducing a new stack choice." This is consistent with CONTRIBUTING.md amendment rules and with the Phase 0 Recon scope defined in `docs/knowledge/openclaw.md`.

### 5. Version arithmetic

| Artifact | Prior version | New version | Status | Assessment |
|---|---|---|---|---|
| ARCH-001@0.3.0 | 0.2.0 | 0.3.0 | `in_review` | Minor bump is appropriate: contract-level amendments to C1 failure modes, C10 redaction, and metrics bind. Changelog entry dated 2026-04-28 correctly enumerates all three amendment categories. |
| TKT-015@0.1.0 | — | 0.1.0 | `ready` | New ticket, first version. Dependencies (`TKT-003@0.1.0`, `TKT-004@0.1.0`) are both `done`. No blocking cycle. |
| All other tickets | unchanged | unchanged | unchanged | No accidental bumps. |

`python3 scripts/validate_docs.py` was executed on PR branch head `ce89183` and confirmed **38 artifacts, 0 failed**.

## Cross-reference checklist (Reviewer ticks)
- [x] §0 Recon Report present, ≥3 fork-candidates audited per major capability *(not updated for this amendment; no new components introduced — justified)*
- [x] All PRD sections claimed as "implemented" actually have a covering component (Trace matrix walk) *(no new PRD claims; amendment hardens existing coverage)*
- [x] All Non-Goals from PRD are respected (grep against ArchSpec + Tickets) *(TKT-015@0.1.0 §3 NOT In Scope explicitly guards against scope creep)*
- [x] Resource budget fits PRD Technical Envelope (numeric) *(no new resources; amendment is code-only hardening)*
- [x] Every Ticket in Work Breakdown is atomic (one-sentence Goal) *(TKT-015@0.1.0 goal is single-sentence, no "and")*
- [x] Every ADR evaluates ≥3 real options with concrete trade-offs *(no new ADR required; extends ADR-009@0.1.0)*
- [x] All references are version-pinned (`@X.Y.Z`) *(verified in frontmatter, §4 Inputs, and ACs)*
- [x] §8/§9/§10 (Observability/Security/Deployment) non-empty with concrete choices *(§8.1 redaction, §8.2 bind guard, §10.7 addendum are all concrete)*
- [x] Rollback procedure is a real command sequence, not "revert" *(unchanged from 0.2.0; already hardened in RV-SPEC-002@0.1.0)*

## Red-team probes (Reviewer must address each)
- **What happens if openclaw / VPS goes down mid-flow?** — Unchanged from 0.2.0. C1 sticker recovery path is synchronous; no in-flight state is lost.
- **How does the system behave at 10× expected user count?** — Amendment adds bounded telemetry (`message_subtype: sticker`) and a 256-char cap on routing normalization. Both are O(1) overhead.
- **Which prompt-injection vectors apply to LLM-fed components?** — No new LLM-fed components. Sticker recovery is a static Russian message, not passed to an LLM.
- **What is the data-replay / idempotency risk?** — Sticker telemetry uses C10's existing event pipeline; idempotency is handled by C10's existing request-id deduplication.
- **Which single points of failure were introduced?** — None. All changes are within existing C1/C10 contracts.
- **Is the rollback / undo story concrete?** — Unchanged from 0.2.0. No new infra or schema changes.
- **Are secrets handled safely?** — TKT-015@0.1.0 §7 explicitly forbids logging tokens, keys, usernames, and raw prompts. AC7 proves redaction at the emit boundary.
- **Is the metrics bind guard sufficient?** — §8.2 and AC12–AC14 reject `0.0.0.0`, `::`, `[::]`. Defense-in-depth is appropriate for a local-only endpoint.
