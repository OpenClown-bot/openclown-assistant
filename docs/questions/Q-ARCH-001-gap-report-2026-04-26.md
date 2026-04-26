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
