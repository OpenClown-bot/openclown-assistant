---
id: Q-ARCH-001-GAP-2026-04-26
status: open
ticket_ref: ARCH-001@0.1.0
asker_model: "gpt-5.5-thinking"
answerer_model: "product-owner"
created: 2026-04-26
answered: null
---

# Gap Report for ARCH-001@0.1.0

## Context

This is the Phase 2 PRD-gap report before component design. It records ambiguities and technical constraints found after Phase 0 Recon and Phase 1 Bootstrap for PRD-001@0.2.0.

## Findings

- PRD-001@0.2.0 §5 US-1 requires the bot to offer a default daily-report time with a timezone inferred from the Telegram client. Telegram Bot API `User` exposes `id`, names, username, and `language_code`, but no timezone field in the official object definition (<https://core.telegram.org/bots/api#user>). Without another OpenClaw-provided signal, timezone inference is not technically reliable.
- PRD-001@0.2.0 §7 says concrete VPS specs must be verified by Architect, but this checkout does not expose the live host CPU/RAM/disk/OS shape. This blocks a numeric resource budget and any local-vs-hosted ADR trade-off that depends on available RAM/CPU.
- PRD-001@0.2.0 §6 K7 and §9 OQ-1 leave KBJU estimation accuracy target as TBD until Architect feasibility analysis. The workflow requires Phase 2 questions before design, but the PRD itself asks for Architect feasibility before PO ratification.
- PRD-001@0.2.0 §7 and §9 OQ-3 leave stored-record data hosting jurisdiction to PO selection from an Architect shortlist. Jurisdiction affects database location, backup location, legal-exposure risk, and latency assumptions.
- PRD-001@0.2.0 §3 NG3 says pilot users are added out-of-band, but the technical source of truth for allowed Telegram users is unspecified. The architecture differs if the allowlist is static env/config, DB-admin seeded, or first-two-users bootstrap.
- PRD-001@0.2.0 §8 / §3 NG10 says v0.1 ships a single curated assistant personality written by the PO, but there is no referenced artifact or text source for Executor to read. The architecture can expose a config slot, but Executor needs a concrete source before implementation.

## Questions

Q_TO_BUSINESS_1: For timezone handling in PRD-001@0.2.0 §5 US-1, which behavior should the architecture specify?

- Option A: Ask the user to choose/confirm timezone explicitly during onboarding; do not claim Telegram-client inference.
- Option B: Infer from VPS/default locale first, label it as a guess, and require user confirmation.
- Option C: Use a Telegram Mini App or another explicit client-side mechanism to collect timezone, accepting extra implementation scope.

Q_TO_BUSINESS_2: Provide the live VPS baseline for PRD-001@0.2.0 §7 resource budgeting: CPU model/vCPU count, total RAM, free steady RAM, disk type/free space, OS, Docker availability, and whether GPU is present. If you prefer, authorize Architect to record these as `Q_TO_BUSINESS` unresolved until you paste host specs.

Q_TO_BUSINESS_3: How should K7 accuracy be handled before Phase 3 design?

- Option A: Proceed with K7 as an explicit open design variable; Architect will propose a feasibility bound in ADRs and ask PO to ratify before ArchSpec moves to `in_review`.
- Option B: PO sets an initial numeric target now for per-meal and per-day KBJU accuracy.
- Option C: Remove K7 as a gating metric for v0.1 and track only confirmation/edit rate; this would require a PRD revision, not an Architect assumption.

Q_TO_BUSINESS_4: For data hosting jurisdiction in PRD-001@0.2.0 §7 / §9 OQ-3, should Architect shortlist all technically sane options, or are any jurisdictions already forbidden or preferred before design?

Q_TO_BUSINESS_5: What is the source of truth for the two pilot Telegram users?

- Option A: Static allowlist of Telegram numeric user IDs in secret/config, supplied by PO before deploy.
- Option B: DB-seeded allowlist migration with user IDs supplied by PO.
- Option C: First two users who complete `/start` become the pilot users; every later user is blocked.

Q_TO_BUSINESS_6: Where will the PO-authored curated assistant personality live?

- Option A: A future config/env value outside git, supplied at deploy.
- Option B: A tracked docs artifact that Architect references and Executor copies into config.
- Option C: Architect should specify a neutral placeholder and leave final wording as a deployment-time PO edit.

## What I assumed / would do if no answer

No Phase 3 design assumptions will be made until PO answers or explicitly defers each question. If a question is deferred, it will stay listed as `Q_TO_BUSINESS` in ARCH-001@0.1.0 §12 with a concrete design default and risk.

## Architect's answer

Pending PO response.

## OBC injected — 2026-04-26

OBC-1 (multi-tenancy): day-1 user_id-scoped storage isolation is HARD. Do NOT propose any single-tenant or "scope-down" ADR. Your ADR work on multi-tenancy is on the *implementation choice* of isolation (column-scoped queries vs row-level security vs schema-per-tenant) with concrete trade-offs.

OBC-2 (F-M2 enforcement): the PRD US-5 AC2 prohibition list (no medical / clinical / supplement / drug recommendations) must be system-prompt-enforced inside the recommendation generator. Propose the enforcement mechanism in an ADR (system-prompt vs guardrail layer vs LLM-call validator vs combination).

OBC-3 (LLM transport): the PO uses ≈30 Fireworks accounts × $50 quota fronted by OmniRoute as the LLM transport. All skill LLM calls go through OmniRoute first; direct provider keys are fallback only. Your routing ADR must respect this topology — no design where skill code holds raw provider keys.

OBC-4 (Reviewer §A.3): a second Reviewer LLM session (Kimi K2.6, SPEC mode) will audit your ArchSpec after the PR is open. Mandatory check: §A.3 Recon Report present and non-shallow with ≥3 fork-candidates per major capability with concrete fork/reference/reject verdicts.

OBC-5 (executor self-containment): the PO does not write production code. Tickets must be self-contained enough that an Executor LLM (GLM 5.1 / Qwen 3.6 Plus / GPT-5.5) can execute without PO clarification. If a ticket §3 AC says "implementer figures out X" — split or specify.

## PO answers — 2026-04-26

Q1 (timezone): A — explicit timezone prompt during /start onboarding. Store in users.timezone column. No Mini App for v0.1.

Q2 (VPS baseline):
- CPU: 6 vCPU (shared VPS, x86_64)
- RAM: 7.6 GiB total; ~5.7 GiB available at idle; 2 GiB swap
- Disk: 75 GB ext4 root, 12 GB used / 61 GB free
- OS: Ubuntu 24.04.4 LTS (noble)
- Docker: 29.4.0
- GPU: none

IMPORTANT — pilot VPS is TEMPORARY. PO may migrate to a stronger box if v0.1 telemetry shows resource pressure. Therefore:
- Treat current spec as the FLOOR for resource budget (Phase 7), not the ceiling.
- Design must be portable: no host-kernel assumptions, no host-file paths outside Docker volumes, no systemd-service dependencies, no host-network-namespace tricks.
- Resource-heavy components (local Whisper inference, vector DB, large embedding models) should be swap-overflow-aware on 7.6 GiB RAM. If your design needs >5 GB sustained RAM for any single service, default to remote/managed equivalents (e.g. Whisper via Fireworks/OpenAI API, not local) and document the trade-off in an ADR.
- No GPU on host — any model that needs GPU MUST be remote.
- Plan a documented "VPS migration" runbook in §10 (operational risks): what data needs to move, what services need to restart, how secrets transfer.

Q3 (K7 accuracy target): A — leave open until your Phase 5–6 feasibility analysis. CORRECTION: this is NOT a PO pre-design choice. Per OBC and PRD §9 OQ-1, your job is to compute the achievable accuracy bound from your chosen voice / vision / food-lookup / LLM stack and propose a recommended numeric target (e.g. "±X% per-meal, ±Y% daily-aggregate on a fixed Russian-food test set") at Phase 11 PR. PO ratifies the number you propose.

Q4 (data hosting jurisdiction): no PO-imposed forbidden or preferred jurisdictions upfront. Produce an ADR with a ranked shortlist (RU domestic, EU, US, hybrid) including concrete cost / latency-from-RU-users / legal-exposure trade-offs (numbers, citations). PO selects from your ranked options.

Q5 (pilot users source of truth): A — static allowlist of numeric Telegram user IDs as env-var TELEGRAM_PILOT_USER_IDS, not in git. Two known users; static config is simpler, more secure, no migration overhead. Note: allowlist is the *access-control* layer, NOT the multi-tenant isolation layer — your multi-tenant ADR (per OBC-1) must still mandate user_id-scoped storage from day 1 (both layers required).

Q6 (assistant personality location): B — tracked docs artifact at docs/personality/PERSONA-001-kbju-coach.md, loaded at runtime via config (PERSONA_PATH env var). Versioned, reviewable by Reviewer LLM for F-M2 compliance, multi-tenant ready (per-tenant persona files in future). Cite this artifact from ArchSpec §6. PO edits via PR (clerical-edit exception per CONTRIBUTING.md).
