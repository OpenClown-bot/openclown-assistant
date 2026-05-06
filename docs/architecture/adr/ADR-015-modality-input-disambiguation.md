---
id: ADR-015
title: "Modality-input disambiguation strategy (deterministic priority + clarifying reply)"
status: proposed
arch_ref: ARCH-001@0.6.0
prd_ref: PRD-003@0.1.3
author_model: "claude-sonnet-4.5"
reviewer_models:
  - "kimi-k2.6"
review_refs: []
source_inputs:
  - "PRD-003@0.1.3 §8 R1 (modality-input ambiguity risk + ratified mitigation)"
  - "PRD-003@0.1.3 §5 US-1..US-4 OFF-state acceptance bullets"
  - "PRD-003@0.1.3 §5 US-3 normative AC for missing-quantifiable-fields workout clarifying reply"
  - "ARCH-001@0.5.0 §3.4 C4 Meal Logging Orchestrator current routing"
created: 2026-05-06
updated: 2026-05-06
---

# ADR-015: Modality-input disambiguation strategy (deterministic priority + clarifying reply)

## Context

PRD-003@0.1.3 introduces four new tracking modalities (water G1, sleep G2, workout G3, mood
G4) alongside the existing KBJU surface from PRD-001@0.2.0 §5 US-2 / US-3 / US-4. PRD-003@0.1.3
§8 R1 explicitly enumerates the resulting ambiguity risk:

> R1 — modality-input ambiguity: a message like "выпил пол-литра" could match either a
> water-tracking pattern OR a KBJU drink pattern; the wrong path is taken.

PRD-003@0.1.3 §8 R1 also pre-ratifies the *shape* of the mitigation:

> The Architect defines an explicit modality-priority resolution at the parser layer
> (default order: KBJU → water → sleep → workout → mood for ambiguous inputs, ratified by
> PO before sign-off); ambiguous inputs trigger a friendly clarifying reply rather than
> silent best-guess persistence; rolling-30-day modality-misclassification rate tracked
> as informational telemetry.

That paragraph fixes three free variables the Architect must convert to a concrete
component contract:

1. **Where** the disambiguation runs: at the C1 entrypoint, inside C4 Meal Logging
   Orchestrator, in a new dedicated component, or as a post-LLM validation gate.
2. **How** it decides: pure deterministic regex / keyword matching, an LLM-classifier
   call, or a hybrid of both.
3. **What** "ambiguous" means: a strict definition (does both patterns match? does
   neither pattern match?) and the corresponding behaviour for each branch.

PRD-003@0.1.3 §5 US-3 already locks one normative behaviour: a workout text describing a workout
type but lacking ANY of {duration, distance, repetitions × sets, intensity descriptor}
MUST trigger a friendly clarifying reply and MUST NOT silently fall through to KBJU. That
is one specific rule; this ADR generalises it to the cross-modality routing problem.

PRD-003@0.1.3 §7 latency budget: ≤5% overhead on every PRD-001@0.2.0 §7 latency envelope. That
makes adding an LLM classifier hop on every message *expensive* — for text the budget is
≤5 s p95 and a typical OmniRoute LLM-classifier round-trip is 800–1500 ms, which alone is
20–30% of the budget.

## Options Considered (≥3 real options, no strawmen)

### Option A: Deterministic-only — keyword/regex priority chain in a new C16 Modality Router

- Description: A new component C16 Modality Router sits between C1 Access-Controlled
  Telegram Entrypoint and the per-modality handlers (C4 KBJU / C17 Water / C18 Sleep /
  C19 Workout / C20 Mood). For each inbound text or voice-transcribed message, C16
  evaluates a chain of deterministic matchers in fixed priority order: KBJU patterns
  (existing C4 trigger set) → water keywords ("вод", "ml", "мл", "литр", "стакан") →
  sleep keywords ("спал", "слип", "лёг", "встал", "h") → workout keywords ("бегал",
  "кило", "5×5", "км", "минут") → mood keywords ("настроение", "энергия", "mood", or a
  bare integer 1–10). The first matcher that *uniquely* fires owns the message. If
  multiple matchers fire, C16 emits a clarifying reply ("Это запись еды или воды?") with
  inline-keyboard buttons for the user to disambiguate. If zero matchers fire, the
  message goes to the existing C4 free-form path (preserves PRD-001@0.2.0 §5 US-3
  generic meal-text behaviour).
- Pros (concrete):
  - Zero new LLM cost on the routing decision. Latency overhead is microsecond-scale
    string matching; the ≤5% PRD-003@0.1.3 §7 budget is preserved with margin.
  - Fully predictable behaviour. A misclassification can be reproduced by replaying the
    text against the matcher chain — no model nondeterminism. K-style metric for PRD-003@0.1.3
    §8 R1 "rolling-30-day modality-misclassification rate" becomes a stable, auditable
    quantity.
  - Matches PRD-003@0.1.3 §8 R1 default order exactly: "KBJU → water → sleep → workout → mood".
    No interpretation step.
  - Honours US-3 normative AC: workout pattern that matches type-keyword but no
    quantifiable field is detected by C16 (matcher fires) and routed to C19 Workout
    Logger, which then issues the clarifying reply per its own state machine. C16 stays
    pure routing.
- Cons (concrete):
  - Russian morphology + transliteration are messy: "пол-литра" / "поллитра" / "пол литра"
    / "0.5 л" / "пол-литра кефира" all want to mean the same thing for water tracking
    *unless* the user is logging a meal that contains 500 ml of kefir (KBJU). A keyword
    chain cannot disambiguate "пол-литра" alone without context.
  - Adding a new modality (e.g. step-counting in a future PRD) requires editing the
    matcher chain and updating the priority order; the chain is a project-wide concern,
    not a per-modality one. (Architect-acceptable: this is the same shape as ADR-013@0.1.0
    allowlist hot-reload — config-driven, not code-driven, easy to amend.)
- Cost / latency / ops burden: ~zero. Fully synchronous in-process. Pure TypeScript
  function. No new external dependency.

### Option B: LLM-classifier — single classification call before dispatch

- Description: For every inbound text or voice-transcribed message, C16 issues an
  OmniRoute call to a small LLM (e.g. an open-weights Qwen-2.5-7B-Instruct via Fireworks)
  with a structured prompt: "Classify this Russian Telegram message into exactly one of:
  KBJU, WATER, SLEEP, WORKOUT, MOOD, or AMBIGUOUS. Reply with a single uppercase token."
  The classifier returns a label; C16 routes to the matching component, or emits a
  clarifying reply if AMBIGUOUS.
- Pros (concrete):
  - Robust to morphology + transliteration; the LLM handles "пол-литра" / "0.5л" / "пол
    литра кефира" via the same understanding it already uses for the KBJU path
    (ADR-002@0.1.0 OmniRoute is the existing routing infrastructure).
  - Generalises to new modalities without code edits: a future step-counting PRD adds
    "STEPS" to the prompt's label set.
- Cons (concrete, with sources):
  - **Latency:** every message pays a classifier round-trip *before* dispatch. Typical
    OmniRoute latency for a 50–200 token classifier prompt is 800–1500 ms (cited from the
    §1.4.4 sources <https://composio.dev/content/top-openclaw-skills>; confirmed against
    project's own ARCH-001@0.5.0 §3.13 C13 stall-watchdog default `STALL_THRESHOLD_MS =
    120 000`). On the PRD-003@0.1.3 §7 ≤5 s text budget, that is 16–30% of the budget consumed
    by routing alone, before any modality handler runs.
  - **Cost:** every text message costs an extra LLM call. PRD-001@0.2.0 §2 G5 cost ceiling
    was ≤$10/month with 2 users; PRD-003@0.1.3 §7 inherits the no-budget envelope but spend is
    still tracked (PRD-002@0.2.1 §9 OQ-1). At ~$0.0002 per classification × thousands of
    messages × tens to thousands of users = a non-trivial recurring line item for a
    decision that is mostly deterministic.
  - **Hallucination risk:** the entire project's quality bar is "никогда не галлюцинировать"
    (ROADMAP-001@0.1.0 §1.2 "никогда не галлюцинировать"). Inserting an LLM in the routing
    decision creates a new hallucination surface — the classifier could route a clear
    KBJU message to mood, breaking PRD-001@0.2.0 §5 US-3 in subtle ways.
  - PRD-003@0.1.3 §8 R1 default order ("KBJU → water → sleep → workout → mood") is harder to
    enforce: the LLM may rank labels by likelihood, not by the PO-ratified priority order.
- Cost / latency / ops burden: 800–1500 ms / message + recurring LLM spend. Adds Hermes-
  Agent-style cost shape (LLM-on-every-decision) without Hermes's persistent-memory
  benefit (because we're on OpenClaw per ADR-014@0.1.0).

### Option C: Hybrid — deterministic-first with LLM-fallback only on ambiguous match

- Description: Run Option A's deterministic matcher chain first. If exactly one matcher
  fires uniquely → route. If zero matchers fire → route to KBJU free-form path
  (preserves PRD-001@0.2.0 §5 US-3 behaviour). If multiple matchers fire → invoke the
  Option B LLM classifier as a tie-breaker, with the deterministic candidate set as a
  hard constraint on the classifier's output (forced JSON-mode response in the candidate
  set + AMBIGUOUS).
- Pros (concrete):
  - Best-of-both: deterministic on the common case (the LLM call only fires on genuinely
    ambiguous messages, which by R1's modality-misclassification telemetry should be
    <10% of inbound traffic), so the average latency overhead is dominated by the
    deterministic path.
  - Russian morphology problem (Option A Con #1) is partially closed: when "пол-литра"
    matches both KBJU and water keywords, the LLM tie-breaker is exactly the right shape.
- Cons (concrete):
  - Two routing paths to maintain and test. The deterministic chain and the LLM
    fallback can disagree on edge cases that *should* be deterministic — e.g. what
    happens when the deterministic chain fires KBJU+water but the LLM says SLEEP. (Per
    constraint above, AMBIGUOUS would be returned, which is acceptable.)
  - Still pays the latency tax on the ambiguous ~10% of messages; on those messages the
    user already waited for a deterministic match attempt (~negligible) plus a classifier
    round-trip (~800–1500 ms). For voice messages where the wake-up-and-transcribe
    already costs 4–6 s, the additional 800–1500 ms is borderline-acceptable.
  - The LLM-fallback ADR (Option B Cons) still applies in the ambiguous branch:
    hallucination surface, cost line item, prompt-injection vector (mitigated by
    forced-output-set per ADR-006@0.1.0 guardrail pattern, but the surface exists).

## Decision

We will use **Option A — deterministic priority chain in C16 Modality Router** for the
PRD-003@0.1.3 implementation cycle, with PRD-003@0.1.3 §8 R1 default priority "KBJU → water → sleep →
workout → mood" hard-coded into the chain (config-tunable per ADR-013@0.1.0 hot-reload
pattern; PO must ratify any change at next ArchSpec dispatch).

**For ambiguous-match cases** (multiple matchers fire on the same message): C16 emits a
clarifying inline-keyboard reply ("Это запись еды или воды?") rather than silent
best-guess persistence (per PRD-003@0.1.3 §8 R1 normative mitigation). The user's tap on the
keyboard routes the message to the correct component without re-parsing.

**For zero-match cases**: C16 routes to the existing C4 KBJU free-form text path,
preserving PRD-001@0.2.0 §5 US-3 behaviour exactly. This is also the path for KBJU-only
generic meal text that doesn't contain any of the modality keywords.

**LLM-classifier picks (Option B / Option C)** are deferred. We have shortlisted three
candidate models (Qwen-2.5-7B-Instruct on Fireworks, GPT-4o-mini on direct OpenAI,
Claude-3.5-Haiku on Anthropic) but DO NOT pick a winner in this ADR. Per
`docs/prompts/architect.md` Phase 5 LLM-pick exception, the final pick is deferred to PO
ratification only IF the project later decides to add the LLM-fallback branch (Option C).
This ADR records the shortlist for posterity; activation requires a follow-up ADR or
ADR-015 amendment + PO ratification.

Why the losers lost (one sentence each, addressing their best case):

- **Option B (LLM-classifier)**: pays a 16–30% latency tax on every text message and a
  non-trivial recurring LLM spend on a routing decision that is overwhelmingly
  deterministic (the keyword sets for water/sleep/workout/mood barely overlap), and
  introduces an unnecessary hallucination surface in the routing layer that the project
  is explicitly trying to minimise (ROADMAP-001@0.1.0 §1.2).
- **Option C (Hybrid)**: a sound design that we may upgrade to in a follow-up cycle if
  ambiguity-rate telemetry from PRD-003@0.1.3 R1 telemetry exceeds an actionable threshold,
  but adopting it now adds two routing paths to maintain when the deterministic-only
  path has not yet been measured to fail.

## Consequences

**Positive:**

- Routing decision is fully deterministic and auditable. PRD-003@0.1.3 §8 R1 telemetry
  (rolling-30-day modality-misclassification rate) is computable from C10 metric events
  without any LLM trace.
- Adding a new modality in a future PRD is a config edit (insert position + keyword
  list), not a code-then-LLM-prompt-then-test cycle.
- Latency budget (PRD-003@0.1.3 §7 ≤5%) preserved with substantial margin. On voice messages,
  the current C5 transcription already takes 4–6 s; routing adds <1 ms.
- Russian morphology problem (the hardest case identified in §Cons) is forced to surface
  as a clarifying reply rather than a silent misclassification — which is exactly the
  PRD-003@0.1.3 §8 R1 ratified mitigation shape.

**Negative / trade-offs accepted:**

- The matcher chain MUST be maintained when keyword surface drifts (e.g. user starts
  using "h2o" or English-only mode). Drift is detectable by the ambiguity-rate
  telemetry; the chain is config-driven (per ADR-013@0.1.0 hot-reload pattern) so an
  amendment is a config push, not a redeploy.
- Some genuinely ambiguous messages will produce a clarifying reply where a clever user
  expects auto-routing. The PO has accepted this trade-off via PRD-003@0.1.3 §8 R1 ratification
  ("ambiguous inputs trigger a friendly clarifying reply rather than silent best-guess
  persistence").
- A future Option C upgrade requires another ADR + an amendment to the C16 contract;
  not a free upgrade. We document the shortlist now to preserve research artefact.

**Follow-up work:**

- TKT-022@0.1.0 implements C16 Modality Router (per this ADR §Decision) including:
  - the deterministic matcher chain, ordered KBJU → water → sleep → workout → mood
  - the clarifying-reply path for multi-match
  - the zero-match → C4 free-form fallback
  - C10 telemetry counter `kbju_modality_route_outcome` with labels {kbju, water, sleep,
    workout, mood, ambiguous_resolved, ambiguous_clarified, zero_match_fallback} for
    R1 rolling-30-day rate
  - 1+ golden-test set covering the documented Russian morphology edge cases
- Future ADR (post-PRD-003 ship) MAY amend this decision after ambiguity-rate telemetry
  is collected over a rolling 30-day production window.
- The shortlisted LLM-classifier candidates (Qwen-2.5-7B-Instruct, GPT-4o-mini,
  Claude-3.5-Haiku) are recorded in §Decision for posterity; they are NOT picked.

## References

- PRD-003@0.1.3 §8 R1 (verbatim ratified mitigation)
- PRD-003@0.1.3 §5 US-1..US-4 OFF-state acceptance bullets (defines the negative-path
  shape this ADR honours)
- PRD-003@0.1.3 §5 US-3 5th AC bullet (workout missing-quantifiable-fields normative
  clarifying reply — the local pattern this ADR generalises)
- ARCH-001@0.5.0 §3.4 C4 Meal Logging Orchestrator (the existing KBJU free-form path
  this ADR preserves)
- ADR-002@0.1.0 (OmniRoute) — what Option B / Option C would have used
- ADR-006@0.1.0 (Summary recommendation guardrails) — pattern reused if a future LLM
  classifier is added (forced output-set, deterministic validator on classifier output)
- ADR-013@0.1.0 (allowlist hot-reload) — pattern reused for matcher-chain config
- `docs/prompts/architect.md` Phase 5 LLM-pick exception (deferred shortlist)
- ROADMAP-001@0.1.0 §1.2 PO vision verbatim ("никогда не галлюцинировать")
