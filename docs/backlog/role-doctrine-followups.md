---
id: BACKLOG-012
title: "Role doctrine follow-ups (model-assignment / write-zone / role-prompt rationale)"
status: open
spec_ref: AGENTS.md, CONTRIBUTING.md, docs/meta/devin-session-handoff.md, docs/prompts/*.md
created: 2026-05-05
---

# Role doctrine follow-ups

Deferred refresh work surfaced when a PO-set model assignment, runtime change, or write-zone change collides with the rationale or doctrine documented in the role-prompt files (`docs/prompts/*.md`) or in `docs/meta/devin-session-handoff.md`. These are NOT clerical updates to the role prompt — those go through Devin Orchestrator clerical PRs with explicit PO authorisation. These ARE the substantive Architect-level rewrites of WHY a role uses a particular model / runtime / write-zone, when the previous WHY no longer fits the current WHAT.

Source-of-record for finding text:
- Devin Orchestrator clerical PRs that introduced a model / runtime change without rewriting the supporting rationale (each entry below cites the specific PR + commit).
- Session-log warm or cold snapshots that document the PO-set change (each entry below cites the specific snapshot section).

PO decisions on whether to defer to BACKLOG vs roll into the same clerical PR are recorded per-entry. Default is to defer to BACKLOG when the rationale rewrite is substantively Architect-scope (multiple paragraphs of reasoning, citations to research notes, trade-off framing) rather than a one-line model-name swap.

## TKT-NEW-architect-refresh-to-rationale-after-deepseek-fallback

**Source:** PR `devin/<timestamp>-openclown-warm-handoff-and-to-model-update` introduced 2026-05-05 to apply the PO-set Ticket Orchestrator (TO) model assignment change `GPT-5.5 thinking → GPT-5.5 high (main)` + `Codex CLI + ChatGPT Plus → DeepSeek V4 Pro (fallback)`.

The clerical PR updated the model line everywhere (AGENTS.md Roles table row 11, CONTRIBUTING.md Roles table row 18 + the supporting paragraph at line 25, `docs/meta/devin-session-handoff.md` §11 first sentence + §11.4 step-summary at line 300, `docs/prompts/ticket-orchestrator.md` §ROLE line 11 + §ENVIRONMENT NOTE line 47). The clerical PR did NOT rewrite the §"Why GPT-5.5 thinking (uncorrelated reasoning + accepted Codex-family overlap)" rationale block in `docs/prompts/ticket-orchestrator.md` (lines 73+). Instead it added a `<!-- DOCTRINE-COLLISION -->` HTML comment marker above the section explaining that the rationale is now stale relative to the new fallback choice.

**The doctrine collision.** The §"Why GPT-5.5 thinking" rationale block argues:

> The Reviewer (Kimi K2.6), default Executor (GLM 5.1), and Executor parallel (DeepSeek V4 Pro) are three different non-OpenAI families. ... Kimi / GLM / DeepSeek are explicitly *not* candidates for the TO role because each would correlate with one pipeline output and silently rubber-stamp it.

The PO's 2026-05-05 fallback choice (DeepSeek V4 Pro) directly contradicts this argument: when the TO falls back to DeepSeek V4 Pro, the TO's audit pass is correlated with the Executor parallel slot (which is also DeepSeek V4 Pro per `docs/knowledge/llm-model-evaluation-2026-05.md` §4). If a DeepSeek V4 Pro Executor produces code in iter-N, and the TO then audits that code on a DeepSeek V4 Pro fallback, the TO is reviewing same-family output — exactly the rubber-stamp risk the rationale was written to avoid.

**Why this is not a TKT yet.** The fallback is by definition rare. As of 2026-05-05 the TO has run on GPT-5.5 thinking for 5 of 5 TO pilots (TKT-010/011/012/013/014). The fallback case has not yet been exercised in a closed cycle. The collision is a real doctrine inconsistency but its operational impact has not yet manifested. Architect should refresh the rationale before the first time the TO actually invokes the DeepSeek V4 Pro fallback, OR the PO can choose a different fallback (e.g. Opus 4.7 / Claude 3.7 / Qwen 3.6 Plus) to keep the uncorrelation property.

**What Architect must produce.** A revised §"Why GPT-5.5 thinking (uncorrelated reasoning + accepted Codex-family overlap)" rationale block in `docs/prompts/ticket-orchestrator.md` that either:
- (a) Defends the new DeepSeek V4 Pro fallback, e.g. by arguing fallback frequency is low enough that correlation cost is bounded and that TO + Kimi K2.6 (load-bearing Reviewer) still gives one independent reasoner per audit; OR
- (b) Proposes a different uncorrelated fallback (Opus 4.7 thinking, Claude 3.7, Qwen 3.6 Plus on opencode + OmniRoute) and the PO ratifies the change in a follow-up clerical PR; OR
- (c) Argues that the fallback should NOT exist at all — i.e., if GPT-5.5 high on opencode is unavailable, TO is paused and the work is held for direct PO + Devin Orchestrator handling rather than dropping into a correlated fallback.

The Architect refresh must also update the parallel mention in `docs/meta/devin-session-handoff.md` §11 / §11.4 if the rationale conclusion changes.

**Acceptance criteria for the eventual TKT.**
- §"Why GPT-5.5 thinking" rationale block in `docs/prompts/ticket-orchestrator.md` is internally consistent with the chosen fallback model.
- The `<!-- DOCTRINE-COLLISION -->` HTML comment marker is removed once the rationale is internally consistent.
- `docs/meta/devin-session-handoff.md` §11 reads coherently with the rewritten rationale.
- A new ADR is filed if the conclusion is (b) or (c) above (the model / fallback policy itself is being changed in light of the doctrine review).

**Reviewer load-bearing for verdict on the eventual TKT.** Kimi K2.6 RV-SPEC review on the rewritten rationale, with explicit pushback if the rewrite is not internally consistent.

**Deferred-to-BACKLOG decision recorded by Devin Orchestrator on 2026-05-05.** Rationale: the PO instruction was to apply a model-assignment change clerically; expanding the same PR into an Architect-level rationale rewrite would have exceeded the Devin Orchestrator write-zone and forced PO authorisation for substantive `docs/prompts/` edits. The cleaner path is: clerical PR ships the model name + warning marker, Architect later refreshes the rationale via the standard pipeline (PRD-not-needed → Architect → RV-SPEC → Devin Orchestrator clerical merge).
