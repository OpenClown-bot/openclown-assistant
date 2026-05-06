---
id: RV-SPEC-013
type: spec_review
target_ref: ARCH-001@0.6.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-06
version: 0.1.0
owner: "@OpenClown-bot"
---

# RV-SPEC-013: Spec Review — ARCH-001@0.6.0 + ADR-014@0.1.0..ADR-018@0.1.0 + TKT-021@0.1.0..TKT-028@0.1.0

## §0 Review Preamble
Target secondary refs: ADR-014@0.1.0, ADR-015@0.1.0, ADR-016@0.1.0, ADR-017@0.1.0, ADR-018@0.1.0, TKT-021@0.1.0, TKT-022@0.1.0, TKT-023@0.1.0, TKT-024@0.1.0, TKT-025@0.1.0, TKT-026@0.1.0, TKT-027@0.1.0, TKT-028@0.1.0.

Reviewed against: PRD-003@0.1.3, ROADMAP-001@0.1.0, docs/prompts/architect.md, docs/prompts/reviewer.md §A SPEC workflow, docs/knowledge/openclaw.md, docs/knowledge/awesome-skills.md.

## §1 Summary
The v0.6.0 PRD-003@0.1.3 architecture bundle (ARCH-001@0.6.0, 5 ADRs, 8 Tickets) is substantially complete and implements the PRD requirements with concrete component specs, version-pinned cross-references, and detailed failure modes. However, ADR-015@0.1.0 lacks a mandatory "Why the losers lost" section, §1.4 is structurally misplaced inside §0.10, the Ticket DAG has `blocks`/`depends_on` asymmetries, TKT-024@0.1.0 bundles three components in one ticket, §9.4 omits new LLM prompt-injection surfaces, and §10.3 lacks a cost delta for the new modalities. No high-severity blockers. Verdict: **pass_with_changes**.

## §2 Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: Six medium-severity findings (ADR rigour, structural drift, DAG asymmetry, ticket atomicity, security coverage gap, resource budget omission) and two low-severity format nits prevent a clean pass, but none block merge; all are patchable in a v0.6.1 amendment PR.

## §3 Findings

### High (blocking)
*None.*

### Medium
- **F-M1 (ADR-015@0.1.0 §Decision):** Amended Option C Hybrid Decision (2026-05-06) lacks a "Why the losers lost" section explaining why original Option A (deterministic-only) and Option B (LLM-only) lose against Option C in the post-PO-push-back regime. The old Option A Decision is preserved as rejected history, but there is no substantive one-sentence-per-loser analysis for the current Decision. ADR rigour failure per reviewer.md §A.8. — *Responsible role:* Architect. *Suggested remediation:* Add `## Why the losers lost` immediately after the amended `## Decision` (Option C) with ≥1 sentence per losing option addressing its best-case scenario.
- **F-M2 (ARCH-001@0.6.0 §0.10 / §1.4 structural placement):** `### 1.4 PRD-NEXT research findings` is nested inside `### 0.10 v0.6.0 PRD-003@0.1.3 Recon Delta` at line 580 and appears before `## 1. Context` at line 598. A hostile reader searching for §1.4 under `## 1. Context` will not find it; the content is Q-RM-2 evidence and belongs as a sibling of §1.1, not a child of §0.10. — *Responsible role:* Architect. *Suggested remediation:* Move `### 1.4` out of `### 0.10` and place it as `### 1.4` under `## 1. Context`, or rename it to `#### 0.10.6` if it is intentionally Recon-delta content.
- **F-M3 (TKT-021@0.1.0..TKT-028@0.1.0 DAG asymmetry):** `blocks`/`depends_on` fields are not symmetric. TKT-021@0.1.0.blocks lists TKT-025@0.1.0, but TKT-025@0.1.0.depends_on is `["TKT-022@0.1.0"]` and omits TKT-021@0.1.0 (transitive dependency only). TKT-028@0.1.0.blocks lists TKT-022@0.1.0 / TKT-023@0.1.0 / TKT-024@0.1.0 / TKT-027@0.1.0, but none of those tickets list TKT-028@0.1.0 in `depends_on`. This contradicts the intended DAG semantics and makes manual verification error-prone. — *Responsible role:* Architect. *Suggested remediation:* Align `depends_on` arrays with upstream `blocks` claims, or document explicit exceptions in each Ticket's §3 Constraints.
- **F-M4 (TKT-024@0.1.0 atomicity):** TKT-024@0.1.0 bundles three components (C17 Water Logger + C19 Workout Logger + C20 Mood Logger) under a single Goal. While they share infrastructure (event-row insert pattern, telemetry counter, OmniRoute reuse), this violates architect.md "one atomic Goal per Ticket" discipline. C19 (workout photo extraction) and C20 (mood free-form inference) have significantly different LLM surfaces, test surfaces, and failure modes from C17 (simple water counter). A bug in C19 photo recognition would block C17 and C20 from shipping. — *Responsible role:* Architect. *Suggested remediation:* Either (a) split into sub-ticket 024-A (C17), sub-ticket 024-B (C19), sub-ticket 024-C (C20) with cross-references to shared infra, or (b) add an explicit frontmatter `atomicity_exception_rationale` field documenting the bundling justification and a decomposition plan for v0.6.1.
- **F-M5 (ARCH-001@0.6.0 §9.4):** LLM Prompt-Injection Mitigations covers C6, C7, C9 but omits the NEW v0.6.0 LLM components that ingest external user text: C16 Modality Router (LLM tie-breaker / full-classifier on arbitrary Telegram text), C19 Workout Logger (LLM extraction from voice/text/photo), and C20 Mood Logger (LLM inference on free-form mood text). While C16 cites ADR-006@0.1.0 forced-output guardrail and C19 cites ADR-016@0.1.0 forced-output schema in their own sections, §9.4 is the authoritative security cross-section and should enumerate every LLM-fed component. — *Responsible role:* Architect. *Suggested remediation:* Extend §9.4 bullet list with explicit mitigations for C16 (hard-constrained label set + ADR-006@0.1.0), C19 (forced-output JSON schema + deterministic post-validator), and C20 (score-range guardrail + optional comment truncation).
- **F-M6 (ARCH-001@0.6.0 §10.3):** Resource Budget describes only the v0.1.0 KBJU stack (RAM, CPU, disk). It lacks a back-of-envelope cost delta for the NEW v0.6.0 LLM calls (C16 fallback classifier, C19 workout extraction, C20 mood inference, C22 summary composer) against the PRD-003@0.1.3 §7 mandate that aggregate spend stays within PRD-001@0.2.0 §7 $10/month ceiling. ADR-018@0.1.0 provides per-call pricing (~$0.0002–$0.0004 per call), but the ArchSpec does not sum these into a monthly pilot-user estimate. — *Responsible role:* Architect. *Suggested remediation:* Add a bullet to §10.3 quantifying estimated additional LLM calls/day for the 2-user pilot, per-call cost from ADR-018@0.1.0, and a summed monthly delta proving the $10 ceiling is not breached.

### Low (nit / cosmetic)
- **F-L1 (ADR-014@0.1.0, ADR-016@0.1.0, ADR-017@0.1.0 formatting):** "Why the losers lost" content is substantive and meets the one-sentence-per-loser quality bar, but it is rendered as plain text (no Markdown heading prefix `#`), not as a formal `##` or `###` section. This is inconsistent with ADR-018@0.1.0 which uses `## Why the losers lost`. — *Responsible role:* Architect. *Suggested remediation:* Convert the plain-text labels into `### Why the losers lost` headings in ADR-014@0.1.0, ADR-016@0.1.0, ADR-017@0.1.0 for template consistency.
- **F-L2 (ADR-018@0.1.0 format deviation):** ADR-018@0.1.0 uses five site-specific pick tables (C16 router, C17-C20 logger, C22 composer, emergency-free, failover trigger) instead of the standard single-axis A/B/C Option structure. Substantively this provides ≥3 real options per table and satisfies the architect.md spirit, but it deviates from the TEMPLATE.md format. — *Responsible role:* Architect. *Suggested remediation:* Add a one-sentence note at the top of ADR-018@0.1.0 explaining the table format is an intentional multi-site deviation from the standard A/B/C template, or refactor into Options A/B/C if a future patch prefers uniformity.

### Questions for Architect
- **Q1:** TKT-024@0.1.0 bundles three loggers. If a decomposition is rejected, what is the intended Executor split — will one Executor build all three, or will they be assigned to different Executors with a shared branch? The current `assigned_executor: "deepseek-v4-pro"` suggests a single Executor; is this realistic given C19's vision-surface complexity?
- **Q2:** F-M2 (§1.4 placement) — was the placement inside §0.10 intentional to keep Q-RM-2 evidence adjacent to the Recon Delta, or an editing artifact from the mid-PR amendment (ADR-015@0.1.0 flip + ADR-018@0.1.0 addition)?

## §4 Cross-reference checklist (Reviewer ticks)
- [x] §0 Recon Report present, ≥3 fork-candidates audited per major capability — YES. §0.10.3 audits 6 Hermes/OpenClaw fork candidates with file:line citations; §0.10.5 audits 5 runtime comparison designs (PR-A..PR-E).
- [x] All PRD sections claimed as "implemented" actually have a covering component (Trace matrix walk) — YES. §1.1 Trace Matrix maps PRD-001@0.2.0 G1..G5, US-1..US-9, K1..K7; PRD-002@0.2.1 G1..G4; PRD-003@0.1.3 G1..G6, US-1..US-7, K1..K8, NG1..NG11, R1..R2. No orphan components (C1..C22 all traced).
- [x] All Non-Goals from PRD are respected (grep against ArchSpec + Tickets) — YES. NG1 (no new DB), NG6 (KBJU not toggleable), NG8 (no external APIs beyond existing providers), NG9 (no Redis), NG10 (no K8s), NG11 (no retroactive backfill) all honoured. R14 self-reports a near-violation (C18 orphaned events + NG11) with mitigation.
- [ ] Resource budget fits PRD Technical Envelope (numeric) — PARTIAL. §10.3 gives concrete RAM/CPU/disk for v0.1.0 stack but omits a numeric cost delta for v0.6.0 LLM additions (F-M6). Bias toward pass_with_changes because ADR-018@0.1.0 per-call pricing makes the envelope likely safe, but the ArchSpec must prove it.
- [ ] Every Ticket in Work Breakdown is atomic (one-sentence Goal) — PARTIAL. TKT-024@0.1.0 violates this (F-M4). All other Tickets (TKT-021@0.1.0, TKT-022@0.1.0, TKT-023@0.1.0, TKT-025@0.1.0, TKT-026@0.1.0, TKT-027@0.1.0, TKT-028@0.1.0) are atomic with single-sentence Goals.
- [x] Every ADR evaluates ≥3 real options with concrete trade-offs — YES. ADR-014@0.1.0 (A/B/C), ADR-015@0.1.0 (A/B/C), ADR-016@0.1.0 (A/B/C), ADR-017@0.1.0 (A/B/C) each have ≥3 options. ADR-018@0.1.0 uses 5 pick tables with ≥3 model aliases each, satisfying the spirit.
- [x] All references are version-pinned (`@X.Y.Z`) — YES. Every ArchSpec, ADR, and Ticket reference uses `@0.1.0` or `@0.2.0` or `@0.6.0` consistently.
- [x] §8/§9/§10 (Observability/Security/Deployment) non-empty with concrete choices — YES. §8.1-8.4 have log/metric/KPI/tracing schemas. §9.1-9.6 have secrets, RLS, network boundaries, prompt-injection mitigations (partial — F-M5), PII handling, allowlist config. §10.1-10.6 have deploy/backup/rollback command sequences.
- [x] Rollback procedure is a real command sequence, not "revert" — YES. §10.6 gives pre-flight checks, DB snapshot, migration audit, advisory-lock sequence, and explicit `docker compose` commands.

## §5 Red-team probes (Reviewer must address each)
- **What happens if openclaw / VPS goes down mid-flow?** — C1 returns Russian generic recovery prompt on malformed/unexpected transport failures; voice/photo raw bytes are deleted on terminal failure; PostgreSQL is co-located in Docker Compose and survives a sidecar restart; OpenClaw Gateway health-gates sidecar startup (§10.1). No data loss for confirmed meals; in-flight unconfirmed drafts are lost (expected).
- **How does the system behave at 10× expected user count?** — PRD-001@0.2.0 §7 targets ≤25% CPU p95 / ≤2 GiB RAM for the v0.1.0 stack. C15 allowlist is config-driven and hot-reloadable for growth. C10 spend-guard auto-degrades to cheaper models and ultimately manual entry. However, the v0.6.0 modalities add new LLM surfaces (C16, C19, C20) whose per-user cost scales linearly; the missing cost delta (F-M6) means 10× cost behaviour is unproven in the spec. PostgreSQL RLS scales with connection pool sizing; no explicit 10× connection-pool analysis is present.
- **Which prompt-injection vectors apply to LLM-fed components?** — C6 (meal text as data field), C7 (photo text as untrusted image content), C9 (numeric aggregates only, no arbitrary prose), C16 (arbitrary Telegram text → LLM classifier — hard-constrained label set mitigates but §9.4 omits it), C19 (workout description/photo → LLM extraction — forced-output JSON schema + deterministic post-validator), C20 (mood free-form text → LLM inference — score-range guardrail + comment truncation). No general input-sanitization layer is described; mitigation is per-component schema/validator.
- **What is the data-retention story?** — Raw voice/photo bytes deleted immediately after extraction. PostgreSQL stores transcripts, meal items, summaries, audit events, metrics. Right-to-delete is hard-delete per C11 (advisory lock + child-row cascade). Backups ≤30 days, operator-only file permissions. No `deleted_at` except `confirmed_meals` (soft-delete for US-6 audit). KBJU-only recommendation guardrails prevent medical PII generation.
- **Concurrency: can two updates race for the same DB row?** — C3 uses `user_id`-scoped RLS and optimistic version checks on callbacks (C1 → C3). C8 history mutations use the same pattern. C18 sleep-pairing uses explicit invalidation of older unpaired events. No distributed lock is described; the 2-user pilot makes races unlikely but the pattern (optimistic version) is documented.

## §6 Verdict recommendation
Recommended next action: Architect opens a v0.6.1 amendment PR addressing F-M1..F-M6. All six are patchable without component redesign. Once amended, this bundle is ready for Executor dispatch per Ticket Orchestrator sequencing.
