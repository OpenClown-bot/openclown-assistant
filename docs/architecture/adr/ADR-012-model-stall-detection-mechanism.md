---
id: ADR-012
title: "Automated model-stall detection mechanism"
version: 0.1.0
status: proposed
arch_ref: ARCH-001@0.5.0
author_model: "deepseek-v4-pro"
reviewer_models: []
review_refs: []
created: 2026-05-04
updated: 2026-05-04
approved_at: null
approved_by: null
approved_note: null
superseded_by: null
---

# ADR-012: Automated model-stall detection mechanism

## 0. Recon Report

Resolves mechanism for PRD-002@0.2.1 G2. Closes manual-recovery gap from BACKLOG-011 (Qwen 3.6 Plus context exhaustion — found manually by PO).

| Artifact | Finding |
|---|---|
| PRD-002@0.2.1 G2 | 120 s default threshold, ≤15 s emission after threshold. Streaming token-watchdog. Synthetic stalls at 120/300/600 s. |
| BACKLOG-011 | Qwen 3.6 Plus 128K context silently produced zero token output. |
| `docs/knowledge/llm-routing.md` | `llmRouter.call()` governs all LLM invocations. |

## 1. Options

### Option A: Promise-race timeout — rejected
Conflates "slow" with "stalled." Doesn't detect zero-token-output specifically.

### Option B: Streaming token-watchdog — chosen
Timer resets on each stream chunk. Fires at zero-token threshold. Exact semantic match to G2.

### Option C: External poll process — rejected
Poll latency violates ≤15 s emission target.

## 2. Decision

**Option B: Streaming token-watchdog + Promise-race fallback for batch calls.**

## 3. Decision Detail

### Q1: Placement
Wraps every `llmRouter.call()`. Intercepts streaming body chunks.

### Q2: Thresholds
| Role | Env var | Default |
|---|---|---|
| Text LLM | `STALL_THRESHOLD_MS_TEXT_LLM` | 120000 |
| Vision LLM | `STALL_THRESHOLD_MS_VISION_LLM` | 120000 |
| Transcription | `STALL_THRESHOLD_MS_TRANSCRIPTION` | 120000 |

Range [60000, 600000]. Clamped at bounds.

### Q3: Event emission
`stall_events` row: `request_id, call_role, elapsed_ms, prompt_token_count, provider_alias, model_alias`. Forbidden: raw prompts, transcripts, media, provider keys.

### Q4: PO alert
Format: `[STALL] model qwen-3.6-plus stalled after 132s (threshold 120s). role=text_llm, request=req_a1b2, tokens=14250`. Dedup by `request_id` in 5-min in-memory window.

### Q5: Stale response
LLM recovers after stall → `Date.now() - startTime > threshold` → discard, log `stale_response_discarded`.

### Q6: Batch call fallback
Non-streaming: fixed timeout at `requestSentAt + threshold`.

### Q7: Synthetic tests
Zero-output: Promise never resolves. Delayed recovery: streaming gap then tokens. Test at 120/300/600 s.

### Q8: Overhead
~0.1–0.5 ms per call. Within ≤5 % target.

## 4. Consequences
- Follow-up: TKT-018@0.1.0 (implementation + synthetic stall tests).

## 5. References
- PRD-002@0.2.1 G2
- BACKLOG-011
- ARCH-001@0.5.0 §3.10c, §4.9
- `docs/knowledge/llm-routing.md`