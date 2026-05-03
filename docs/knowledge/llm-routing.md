# LLM routing & cost envelope

> Required reading for: **Architect** (designs the routing / failover policy in an ADR), **Executor** (calls models through the agreed config, never via raw provider keys), **Reviewer** (verifies no skill bypasses the router).
> Helpful for: **Business Planner** (sanity-checks LLM-budget figures in PRD §7).

## Topology

```
[skill code]
     │
     ▼
[OmniRoute]  ← primary router (PO operates ≈30 Fireworks accounts × $50 quota)
     │  failure / quota exceeded
     ▼
[direct provider key]  ← fallback only (OpenAI, Anthropic, Fireworks direct)
```

Sources:
- OmniRoute: <https://github.com/diegosouzapw/OmniRoute>
- Fireworks model catalogue: <https://fireworks.ai/models>
- OpenRouter (free-tier reference): <https://openrouter.ai/models?fmt=cards&order=newest&q=free>

## Hard rules for Architect / Executor

1. **All LLM calls go through OmniRoute first.** A skill that hard-codes a provider URL is a finding (high-severity in CODE review).
2. **OmniRoute config lives in `infra/`** (Architect adds in an ADR; Executor only edits when a Ticket lists it in §5 Outputs).
3. **Direct provider keys are env-vars** declared in `.env.example`, never committed.
4. **Per-call budget guard:** every skill that calls an LLM must declare a `max_input_tokens` and `max_output_tokens` budget in its manifest; exceeding it is a runtime error, not a silent over-spend.
5. **Failover is openclaw's job** at the transport layer — but per-call retry policy belongs in the skill (idempotent retries only; no retries on prompt-injection-suspicious responses).

## Model assignment (project default; ADR may revise per ticket)

> **Updated 2026-05-02** per research-PR #93 (`docs/knowledge/llm-model-evaluation-2026-05.md`) and successor PR #94. Two displacements: Executor parallel slot Qwen 3.6 Plus → DeepSeek V4 Pro (PO Q1); Reviewer auto Qwen 3.6 Plus → GPT-5.3 Codex (PO Q5). All other rows unchanged. **Architect: when designing TKT §7 / ADR routing decisions that mention DeepSeek V4 Pro or GPT-5.3 Codex, consult `docs/knowledge/llm-model-evaluation-2026-05.md` §4.1 Architect Quick Reference Card** — both are recent models that may post-date your training-data cutoff (DeepSeek V4 Pro released 2026-04-24; GPT-5.3 Codex within OpenAI's GPT-5.x family update cycle). The card is authoritative; do not extrapolate from older similarly-named models.

| Role | Model | Where the model is hosted | Why |
|---|---|---|---|
| Business Planner | GPT-5.5 thinking | ChatGPT Plus (web) | #1 on Expert-SWE-style long-context reasoning per OpenAI's GPT-5.5 announcement (Apr 2026); PO uses web UI and copy-pastes |
| Architect (primary) | GPT-5.5 xhigh | Codex CLI | #1 on Terminal-Bench 2.0 per same announcement; Codex CLI is more reliable for long shell sessions than Windsurf |
| Architect (backup) | Opus 4.6 thinking | Windsurf | Strong but Windsurf sessions sometimes break on long shell work — keep sessions short |
| Executor (default) | GLM 5.1 | opencode + OmniRoute → Fireworks | Cheap, fast, good enough for ≈70% of tickets; 3-of-3 successful Executor pilots TKT-010 / TKT-011 / TKT-013 |
| Executor (parallel) | DeepSeek V4 Pro | opencode + OmniRoute → Fireworks | Independent family from GLM — runs alongside without correlated failures; **1M context** (largest of all candidates) fixes Qwen 3.6 Plus 128K-context Executor failure (BACKLOG-011 §qwen-context); BenchLM Coding 73.8 / Knowledge 62.6 (highest non-GPT). Not yet piloted in repo; first executor-parallel-slot ticket assigned here counts as empirical pilot. **New model — released 2026-04-24, see `docs/knowledge/llm-model-evaluation-2026-05.md` §4.1 spec card** |
| Executor (specialist) | Codex GPT-5.5 | opencode + OmniRoute → Fireworks (OpenAI route, empirically verified TKT-012@0.1.0 2026-05-02) | Reserved for security / typing-heavy tickets (Architect justifies in TKT §7). Kept on GPT-5.5 (NOT downgraded to GPT-5.3 Codex) to preserve tier-level uncorrelation with PR-Agent which now also uses Codex family |
| Reviewer (LLM) | Kimi K2.6 | opencode + OmniRoute → Fireworks | Different family from Architect (GPT) and Executor (GLM / DeepSeek / Codex) — uncorrelated judgment; 5-of-5 successful Reviewer pilots, zero deferred findings on TKT-014 |
| Reviewer (auto) | Qodo PR-Agent (GPT-5.3 Codex) | GitHub Actions via OmniRoute (OpenAI Codex route) | Second reviewer; runs on every PR automatically (Devin Review deprecated 2026-04-30 per AGENTS.md — ACU exhaustion). **Swapped from Qwen 3.6 Plus on 2026-05-02** (Qwen exhibited 5-of-5 hard-timeout stalls in pilots, INDEPENDENT of Executor authorship — see `docs/backlog/deployment-followups.md` §pr-agent-ci-tail-latency Update pt3). GPT-5.3 Codex BenchLM 88 / Coding 63.1 closes the quality gap with primary Reviewer Kimi K2.6 (BenchLM 84). **New tier — see `docs/knowledge/llm-model-evaluation-2026-05.md` §4.1 spec card** |

## Cost envelope (sanity reference; PRD §7 must restate concrete numbers)

- **Whisper (v0.1):** OpenAI Whisper API ≈ $0.006 / min. For 2 users × ≈4 voice messages / day × ≈10 s each ≈ $1.50 / month.
- **Per-meal LLM call:** GPT-5.5 thinking via OmniRoute → Fireworks ≈ $0.005–0.02 / call (depends on prompt size). ≈4 meals / user / day × 2 users × 30 days ≈ 240 calls / mo ≈ $1–5 / mo.
- **Daily / weekly summary:** ≈9 calls / week × $0.02 ≈ $0.20 / mo.

Total v0.1 LLM spend for 2 users: order-of-magnitude **$5–10 / month**. PRD §7 should set a hard ceiling at e.g. $20/mo as a buffer; Architect must add an ADR if their design pushes past it.

## What the Reviewer looks for in CODE mode

- No `process.env.OPENAI_API_KEY` (or similar) inside skill code — must go through `ctx.secrets` and OmniRoute.
- No hard-coded model name inside skill business logic — model is config-driven via the OmniRoute manifest.
- No `console.log(prompt)` or similar (would leak prompts including PII).
- Idempotent retries only — tax of retrying on a transient failure is fine, retrying on "the model said something weird" is not.

## Future work (backlog)

- Local LLM (e.g. self-hosted GLM via vLLM on the VPS) once user count > 5. Out of v0.1 scope.
- Per-user spend caps with explicit user-facing quota messaging. Out of v0.1 scope; track in `docs/backlog/`.
