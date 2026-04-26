---
id: RV-SPEC-002
type: spec_review
target_ref: ARCH-001@0.1.0@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-26
---

# Spec Review — ARCH-001@0.1.0@0.1.0

## Summary

ARCH-001@0.1.0@0.1.0 is a coherent, multi-tenant-first design that correctly honors all six PO gap-report answers (Q1–Q6), respects the ten PRD Non-Goals (NG1–NG10), and wires the F-M1/F-M2 patches from RV-SPEC-001 into onboarding validation and summary guardrails. All nine ADRs evaluate >=3 real options with concrete trade-offs, and every Ticket is atomic with machine-checkable acceptance criteria. Three issues prevent an unqualified pass: the rollback procedure is hand-wavy, the Recon Report offloads fork-analysis to ADRs instead of presenting it upfront, and the K4 cross-user audit runner lacks an explicit RLS-bypass mechanism.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: The architecture is sound and honors all ratified PO decisions, but the rollback procedure, recon depth, and K4 audit RLS bypass must be hardened before merge.

## Findings

### High (blocking)
- **F-H1 (section 9.3, ARCH-001@0.1.0-kbju-coach-v0-1.md:9.3):** Rollback procedure states "revert to previous Docker image tag" without a concrete command sequence, pre-flight check, or database-state compatibility test. This is a safety-critical gap for a live pilot handling PII. — Responsible role: Architect. Suggested remediation: Replace the one-liner with a numbered command sequence including docker compose pull, docker compose up with health-check curl, docker compose logs until Ready appears, automated Telegram test message to PO, and on failure docker compose up with previous tag and alert. Include a DB migration down-script reference if the rollback crosses a schema change.

### Medium
- **F-M1 (section 0.1, ARCH-001@0.1.0-kbju-coach-v0-1.md:0.1):** The Recon Report table only maps OpenClaw "built-in" vs "remaining gap" and does not itself audit >=3 fork-candidates per major capability with concrete fork/reference/reject verdicts. Per reviewer prompt section A.3 and PO OBC-4, the purpose of section 0 is to prevent discovered-after-design failures; offloading the option analysis entirely to downstream ADRs defeats this purpose because by the time an ADR is written the Architect has already implicitly chosen a component shape. — Responsible role: Architect. Suggested remediation: Expand section 0.1 table to include at least three explicit fork-candidate rows per major capability (e.g., for Telegram entrypoint: OpenClaw native reject due to no Telegram gateway, custom Telegram Bot API poller reference as chosen, third-party library like telegraf reject as extra dependency) with a one-sentence verdict and citation.

- **F-M2 (section 3.11 / section 9.2, ARCH-001@0.1.0-kbju-coach-v0-1.md:3.11):** C11 Right-to-Delete and Tenant Audit Service claims to run a K4 "cross-user reference audit" at end-of-pilot, but the security model (section 9.2) hardens RLS for all application roles and never defines a privileged audit role that can bypass RLS to verify cross-user leakage without returning user payloads. PostgreSQL RLS blocks row reads by non-owner roles by design; without BYPASSRLS or a separate read-replica role, the audit runner cannot physically execute its stated mission. — Responsible role: Architect. Suggested remediation: Add to section 9.2 a dedicated kbju_audit PostgreSQL role with BYPASSRLS (or pg_read_all_data restricted to audit queries) that is used only by the C11 audit runner, locked behind a separate runtime secret, and forbidden from being used by any application service path.

- **F-M3 (section 6 / TKT-011@0.1.0, ARCH-001@0.1.0-kbju-coach-v0-1.md:6):** The persona artifact docs/personality/PERSONA-001-kbju-coach.md is referenced by TKT-011@0.1.0 and the External Interfaces table but does not exist in the repository. While the architecture correctly loads it via PERSONA_PATH, the missing file means TKT-011@0.1.0 cannot be executed by an Executor without PO clarification mid-session, violating OBC-5 (Executor self-containment). — Responsible role: Architect. Suggested remediation: Create the persona file with at least a Russian-language system-prompt skeleton, role description, tone guidelines, and the F-M2 prohibition list (no medical / clinical / supplement / drug / hydration / micronutrient advice) so that TKT-011@0.1.0 has a concrete artifact to load.

### Low (nit / cosmetic)
- **F-L1 (section 10.6, ARCH-001@0.1.0-kbju-coach-v0-1.md:10.6):** VPS migration runbook says "snapshot volume, docker compose down, restore on new host, docker compose up -d" but omits the snapshot tooling, webhook re-registration steps after an IP change, and a checklist for validating Telegram webhook delivery on the new host. — Suggested remediation: Add a 5-step command sequence including webhook re-registration via Telegram API setWebhook and a scripts/migrate-vps.sh helper.

- **F-L2 (section 3.1, ARCH-001@0.1.0-kbju-coach-v0-1.md:3.1):** C1 claims "typing status renewal during provider work" but does not specify the renewal interval. Telegram typing indicators expire after approximately 5 seconds; without an explicit renewal cadence, long transcription or vision calls may leave the user staring at a stale indicator. — Suggested remediation: Add a concrete renewal interval (e.g., every 4 seconds) to the C1 interface contract.

### Questions for Architect
- **Q1:** If the pilot grows to 5+ users before subscription features are built, does the current $10/month cost guard degrade gracefully to deterministic/manual paths for all users, or does it fail closed for new users once the cap is hit? Clarify the expected user-visible behavior in section 4.8.

## Cross-reference checklist (Reviewer ticks)
- [x] section 0 Recon Report present, >=3 fork-candidates audited per major capability — present but shallow; offloaded to ADRs (F-M1)
- [x] All PRD sections claimed as "implemented" actually have a covering component (Trace matrix walk)
- [x] All Non-Goals from PRD are respected (grep against ArchSpec + Tickets)
- [x] Resource budget fits PRD Technical Envelope (numeric)
- [x] Every Ticket in Work Breakdown is atomic (one-sentence Goal)
- [x] Every ADR evaluates >=3 real options with concrete trade-offs
- [x] All references are version-pinned (at X.Y.Z)
- [x] section 8/section 9/section 10 (Observability/Security/Deployment) non-empty with concrete choices
- [ ] Rollback procedure is a real command sequence, not "revert" — F-H1: section 9.3 uses "revert" without commands

## Red-team probes (Reviewer must address each)

- **What happens if OpenClaw / VPS goes down mid-flow?**
  The bot uses Telegram webhooks (not long-polling), so inbound messages queue at Telegram servers for up to 24 hours. On VPS restart, OpenClaw re-initializes and processes the backlog. In-flight meal drafts that have not reached C3 persistence are lost; the user must resend the meal. Confirmed meals and audit logs are durable in the PostgreSQL named volume, which survives container restarts.

- **How does the system behave at 10x expected user count?**
  At 20 users: PostgreSQL on 6 vCPU / 7.6 GiB handles the load easily. The $10/month cost guard is the first bottleneck; voice and vision costs scale linearly, so the guard would degrade to deterministic/manual paths after roughly 3-4x usage. Telegram Bot API rate limits (30 msg/sec) are not approached. Voice transcription serializes per-user (one in-flight clip per user), so latency remains flat. No architecture change is needed, but the PO should be alerted that the $10 cap becomes a hard ceiling on quality of service.

- **Which prompt-injection vectors apply to LLM-fed components?**
  C6 (meal text): User text is sent as a user message within a structured JSON schema request; the system prompt restricts the model to food parsing only. No user text is concatenated into the system prompt.
  C7 (photo): The image is sent as user content; the system prompt explicitly forbids executing instructions found in the image. OWASP multimodal prompt-injection risk is mitigated by structured output schema and deterministic validator.
  C9 (summary): System prompt enumerates allowed topics (calories, macros, balance vs targets) and forbidden topics (medical, supplements, drugs, hydration, micronutrients). A deterministic post-generation validator rejects any output containing forbidden Russian/English stems, and a deterministic fallback message is sent if validation fails. This is layered defense, not single-point-of-failure.

- **What is the data-recovery story if the VPS volume is lost without backup?**
  All durable user data lives in a single PostgreSQL Docker named volume on the VPS. If the volume is lost without a snapshot/backup, every confirmed meal, profile, target, summary, and audit record is permanently gone. Raw voice/photo media is already deleted immediately after processing, so there is no secondary copy. The only recovery path is prevention: ADR-008@0.1.0 mandates named volumes and TKT-013@0.1.0 is expected to produce backup/restore scripts. The architecture does not currently specify automated backup frequency or off-site replication. For a 30-day pilot this is acceptable risk, but it should be documented as an explicit assumption in section 12 Risks.
