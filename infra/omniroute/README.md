# OmniRoute Router-First Configuration

This directory documents the router-first LLM routing topology for the KBJU Coach stack per ADR-002@0.1.0.

## Topology

```
[skill code]
     │
     ▼
[OmniRoute]  ← primary router (PO operates ~30 Fireworks accounts × $50 quota)
     │  failure / quota exceeded
     ▼
[direct provider key]  ← fallback only (OpenAI, Anthropic, Fireworks direct)
```

## Key expectations

1. **All LLM calls go through OmniRoute first.** Skill code must not hard-code provider URLs or read raw provider keys. See `docs/knowledge/llm-routing.md` hard rules.
2. **OmniRoute config is managed by the operator.** Router manifest, model aliases, and account rotation are outside this repository. The operator sets `OMNIROUTE_BASE_URL` and `OMNIROUTE_API_KEY` as runtime secrets.
3. **Direct provider keys are runtime fallback only.** `FIREWORKS_API_KEY` is declared in `.env.example` but must never be read by skill business logic. Fallback is handled at the OpenClaw runtime / transport layer, not in application code.
4. **Per-call budget guard.** Each skill declares `max_input_tokens` and `max_output_tokens` in its manifest. C10 blocks calls when monthly spend approaches the ceiling.

## Variables

| Variable | Purpose | Notes |
|---|---|---|
| `OMNIROUTE_BASE_URL` | OpenAI-compatible OmniRoute endpoint | e.g. `http://omniroute:8000/v1` on the internal Docker network |
| `OMNIROUTE_API_KEY` | Router authentication key | Injected at runtime; never committed |
| `FIREWORKS_API_KEY` | Direct Fireworks fallback key | Runtime fallback only; not read by skills |

## No secrets in this directory

This file contains configuration expectations only. No real keys, tokens, or passwords are stored here.
