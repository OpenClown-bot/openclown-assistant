# LLM model re-evaluation — May 2026 (research note + PO-finalised proposal)

> **Status:** RESEARCH NOTE / proposal **with PO-finalised decisions** (chat 2026-05-02 after initial PR #93 round-trip). Captures evidence + role→model assignments PO explicitly approved. **Does not** rewrite `docs/knowledge/llm-routing.md` or `AGENTS.md` directly — those changes are deferred to a successor PR (#94 planned) which will cite each PO authorisation verbatim per `CONTRIBUTING.md` row 23.
>
> **Authority:** PO Meta-feedback #4 from 2026-05-02 chat after TKT-014 closure (Devin Orchestrator coordination). Authorisation quoted verbatim in PR #93 body. Subsequent PO clarifications (Q1–Q6 round-trip) recorded in §6 below.
>
> **Context:** Five-pilot KBJU Coach v0.1 multi-LLM pipeline closed end-to-end (TKT-010..TKT-014). Two structural model failures emerged that motivate this re-evaluation:
> 1. **Qwen 3.6 Plus 128K context insufficient for Executor** (TKT-014 mid-cycle context exhaustion forced Codex GPT-5.5 takeover); see `docs/backlog/pilot-kpi-smoke-followups.md` §`TKT-NEW-qwen-3.6-plus-128k-context-insufficient-for-executor` (HIGH/strategic).
> 2. **Qwen 3.6 Plus PR-Agent stall on long code-diff prompts** (5-of-5 final-HEAD code-PR runs stalled/cancelled across all 5 pilots, INDEPENDENT of Executor authorship: TKT-014 final HEAD `3c6ff96` was Codex-authored and still stalled Qwen PR-Agent CI); see `docs/backlog/deployment-followups.md` §`TKT-NEW-pr-agent-ci-tail-latency-investigation-CRITICAL` (Update 2026-05-02).
>
> **Recommended audience:** PO (already decided per §6), **Architect** (consumes finalised matrix + Quick Reference Card §4.1 when designing role assignments in TKT §7 / ADRs — especially important for new models the Architect's training-data may not cover), Devin Orchestrator (applies merged proposals to `llm-routing.md` + `AGENTS.md` in successor PR).

## 1. Methodology

This evaluation triangulates three evidence sources to ground each proposed role→model assignment:

### 1.1 Public benchmark aggregation (BenchLM provisional + lmarena verified)

[BenchLM.ai](https://benchlm.ai/) provisional aggregate is a single-number weighted score (0–100) that combines:

- **Agentic** (22% weight): Terminal-Bench 2.0, BrowseComp, OSWorld-Verified, GAIA, TAU-bench, WebArena.
- **Coding** (20%): SWE-bench Verified, LiveCodeBench, SWE-bench Pro, SWE-Rebench, SciCode.
- **Reasoning** (17%): MuSR, LongBench v2, MRCRv2, ARC-AGI-2.
- **Knowledge** (12%): GPQA, SuperGPQA, MMLU-Pro, HLE.
- Plus Math / Multimodal / Instruction-following.

[lmarena.ai](https://lmarena.ai/leaderboard) "verified rank" is human-vote Elo on the public chat-vs-chat arena (text + code arenas). Verified rank is more conservative than BenchLM provisional because it requires sufficient pairwise vote volume.

Both sources crawled 2026-05-02. Scores below are point-in-time snapshots; PO should re-verify before committing model choices to production.

### 1.2 Operational specs (Fireworks model catalogue + direct API)

[Fireworks model pages](https://fireworks.ai/models) crawled 2026-05-02 for the five candidate Fireworks-hosted models. Each entry captures: hosting state, parameter count, context window, pricing (input / cached input / output per 1M tokens), function-calling support, multimodal support.

**Important:** Some Fireworks public catalogue pages display "Context Length: N/A" (notably for Qwen 3.6 Plus). When the catalogue value disagrees with third-party listings (Puter Developer, OpenRouter), the **direct Fireworks API response is authoritative** for the openclown-assistant pipeline because we route exclusively through Fireworks. PO verified Qwen 3.6 Plus context = 128K via direct API on 2026-05-02 (see §3 finding #2).

Pricing matters because the PO operates ≈30 Fireworks accounts × $50 quota (per `docs/knowledge/llm-routing.md` § Topology). At Fireworks scale "unlimited and free per tokens" (PO quote, 2026-05-02) holds for routine pilot work, but the cost ratios still inform which model fits which call-frequency profile.

### 1.3 Empirical pipeline data (this repo, 5 pilots × 2 closure session-logs)

This is the highest-signal source: **what actually worked in production-grade multi-iteration agent loops on the openclown-assistant repo** across TKT-010..TKT-014. See `docs/session-log/2026-05-02-session-2.md` §6.6 for the full 5-pilot cumulative table. Key empirical facts:

- **GLM 5.1 ran 3-of-5 Executor pilots successfully** (TKT-010, TKT-011, TKT-013).
- **Codex GPT-5.5 ran 2-of-5 Executor pilots successfully** (TKT-012; TKT-014 iter-2..iter-5 substantive after Qwen takeover).
- **Qwen 3.6 Plus failed entirely as Executor** (TKT-011 silently routed to GLM; TKT-014 iter-1 only at 5m58s then context-exhaustion at iter-2 forced Codex takeover; never validated end-to-end).
- **Kimi K2.6 ran 5-of-5 Reviewer pilots reliably** (zero deferred findings on TKT-014; best procedural discipline of all 5 pilots).
- **Qodo PR-Agent (Qwen 3.6 Plus) stalled 5-of-5 final-HEAD code-PR runs** (TKT-010 22-min outlier; TKT-011/013/012/014 all ~12m hard-timeout cancellations). This is the strongest empirical signal in the dataset because n=5 with zero counter-examples.

Empirical signal **dominates** benchmark signal where they conflict. Qwen 3.6 Plus's BenchLM coding score (64.8) is respectable on paper but is operationally invalidated by the n=5 PR-Agent stall and the n=1 Executor context-exhaustion — both consistent with throughput / context-handling weaknesses on long agent-loop prompts that benchmarks under-weight.

## 2. Per-model evidence summary

All five Fireworks-hosted models are unlimited / free per tokens for the PO's account topology (PO quote, 2026-05-02). GPT family via Codex CLI is finite-budget; allocate carefully.

### 2.1 GPT-5.5 (OpenAI; via Codex CLI; finite budget)

- **BenchLM provisional:** 91/100 (verified #3 of 23). Agentic 98.2 (#2 in category — tied with Claude Opus 4.7 thinking), Reasoning 95.8, Knowledge 98.1, Coding 84.0.
- **Operational:** $5/$30 per 1M tokens (input/output), 1M context, explicit chain-of-thought reasoning, multimodal.
- **Empirical (this repo):** Codex GPT-5.5 high validated on TKT-012 (full pilot) and TKT-014 iter-2..iter-5 substantive (took over Qwen).
- **Strengths:** Best overall agentic + reasoning + knowledge. Best for high-stakes one-shot output (PRD, ArchSpec).
- **Weaknesses:** Output token cost ~10× DeepSeek V4 Pro / Kimi K2.6. Finite budget. Reserve for roles where Fireworks alternatives demonstrate measurable quality gap.

### 2.2 GPT-5.3 Codex (OpenAI; via Codex CLI; finite budget)

- **BenchLM provisional:** 88/100 (cheaper sibling of GPT-5.5). **Coding 63.1 (beats GPT-5.5's 58.6 on 5-of-5 coding sub-benchmarks per BenchLM head-to-head)** — coding-specialised tier within OpenAI Codex family.
- **Operational:** **$1.75 / $14 per 1M tokens (input/output)**, 400K context.
- **Empirical (this repo):** Not yet directly piloted as a stand-alone tier (Codex CLI has dispatched Codex GPT-5.5 in TKT-012 + TKT-014). Sibling-tier compatibility validated by Codex CLI architecture.
- **Strengths:** Best coding-tier-per-dollar in the GPT family; strong on code-review-shaped prompts (the operational profile of PR-Agent); proven Codex CLI route from existing pipeline use; uncorrelated from all Fireworks-hosted families (Moonshot / Z.ai / DeepSeek / Alibaba / MiniMax).
- **Weaknesses:** Counts against GPT budget (though materially cheaper than GPT-5.5). Same-family root as Codex GPT-5.5 specialist tier — when both are used in the same pipeline cycle, they introduce mild correlation (different sub-tiers but shared training distribution); acceptable because Executor specialist is rarely used (ADR-justified gate).

### 2.3 GLM 5.1 (Z.ai; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 83/100 (verified #21). Coding 60.9, Agentic 65.3, Knowledge 52.3.
- **Operational:** $1.40 / $0.26 / $4.40 per 1M tokens, **202.8K context**, 743.9B MoE params, function-calling supported.
- **Marketing:** "Built for agentic engineering, with stronger coding capabilities and sustained performance over long-horizon tasks with hundreds of iteration rounds." (Z.ai)
- **Empirical (this repo):** 3-of-3 successful Executor pilots (TKT-010, TKT-011, TKT-013). No context-exhaustion failures observed across iter counts up to ≈10.
- **Strengths:** Validated as default Executor; agentic-engineering optimisation matches the multi-iter Executor loop profile; 203K context handled all 5-pilot ticket scopes.
- **Weaknesses:** Output cost is highest of the five Fireworks options ($4.40 per 1M tokens). For PR-Agent (which produces long persistent reviews), cost matters more than for Executor.

### 2.4 DeepSeek V4 Pro (DeepSeek; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 84/100 (verified #7). Coding 73.8, Agentic 70, Knowledge 62.6 (highest of all Fireworks-hosted candidates).
- **Operational:** $1.74 / $0.14 / $3.48 per 1M tokens, **1,048.6K context (1M — largest of all candidates)**, 1.6T MoE params, hybrid attention architecture, function-calling supported.
- **Marketing:** "Frontier reasoning, advanced coding, and long-context intelligence at scale (up to 1M tokens)... top-tier open-source system for complex agentic workflows, high-precision reasoning, and demanding production workloads." (DeepSeek)
- **Empirical (this repo):** **Not yet tested in pipeline** (released 2026-04-24, post-dating most TKT closures — 7 days old at this note's authoring). Strong-on-paper Qwen replacement for Executor parallel slot.
- **Strengths:** 1M context is the natural fix for Qwen 3.6 Plus 128K-context Executor failure mode (BACKLOG-011 §qwen-context). Best non-GPT knowledge score (62.6). Cheapest output among 60+ score Fireworks models ($3.48). Coding (73.8) beats GLM 5.1 (60.9) by 12.9 points.
- **Weaknesses:** Untested in this repo's specific agent-loop runtime. Recommended pilot in a low-stakes ticket before committing as Executor parallel default.

### 2.5 Qwen 3.6 Plus (Alibaba; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 77/100 (verified #6 in coding sub-leaderboard). Coding 64.8, Agentic 61.6.
- **Operational:** $0.50 / $0.10 / $3.00 per 1M tokens, **128K context (PO-verified via direct Fireworks API 2026-05-02; Fireworks public catalogue lists "N/A")**, 0 params listed (closed model), multimodal (image input), function-calling supported. **Note:** Third-party listings (Puter Developer, OpenRouter) cite "1M context" for the underlying Alibaba model — these refer to Alibaba's own infrastructure deployment or the "Qwen3.6 Plus Preview" variant; the **Fireworks Serverless deployment we use through OmniRoute is capped at 128K**, which is what the openclown-assistant pipeline operationally experiences.
- **Empirical (this repo):** **INVALIDATED on two operational fronts:**
  1. **Executor:** TKT-014 iter-1 completed (5m58s, c1c97f2) but iter-2 stalled on context exhaustion when responding to cumulative Kimi findings + repo state. TKT-011 was Qwen-assigned but silently ran on GLM (`docs/backlog/deployment-followups.md` §runtime-mismatch). End-to-end Qwen Executor pipeline never validated.
  2. **PR-Agent:** 5-of-5 final-HEAD code-PR runs stalled or cancelled at ~12m hard-timeout, INDEPENDENT of Executor authorship (TKT-014 final HEAD `3c6ff96` was Codex-authored and still stalled Qwen PR-Agent). This is the strongest empirical signal in the dataset for any model failure mode.
- **Strengths on paper:** Cheapest input ($0.50 per 1M), competitive BenchLM coding (64.8 beats GLM 5.1's 60.9).
- **Weaknesses:** Operationally unfit for both Executor (Fireworks-routed 128K context too small for repo agent loops) and PR-Agent (throughput collapse on long code-diff prompts). The benchmark scores don't predict this — empirical signal dominates.

### 2.6 Kimi K2.6 (Moonshot AI; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 84/100 (verified #6). Coding 72, Agentic 73.1, Knowledge 53.8.
- **Operational:** $0.95 / $0.16 / $4.00 per 1M tokens, **262.1K context**, 1T MoE params, multimodal, **fine-tuning supported**, function-calling supported.
- **Marketing:** "Open-source, native multimodal agentic model that advances practical capabilities in long-horizon coding, coding-driven design, proactive autonomous execution, and **swarm-based task orchestration**." (Moonshot)
- **Empirical (this repo):** 5-of-5 successful Reviewer pilots. TKT-014 reviewer iter-3 issued `pass` verdict on cumulative final HEAD covering iter-3+iter-4+iter-5 with zero deferred findings — best procedural discipline of all 5 pilots. No reliability issues observed.
- **Strengths:** Validated as Reviewer; strong agentic + coding scores; multimodal (useful for future image-input tickets); fine-tunable (future custom-Reviewer LoRA option).
- **Weaknesses:** Already saturated as Reviewer. Adding Kimi to additional roles introduces correlation risk (Reviewer reviewing its own siblings) and contradicts CONTRIBUTING.md §7 uncorrelation principle.

### 2.7 MiniMax M2.7 (MiniMax; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 64/100 (unranked). Coding 56.2, Agentic 57.
- **Operational:** $0.30 / $0.06 / $1.20 per 1M tokens (cheapest output of all candidates by 2.5×), **196.6K context**, 228.7B MoE params, function-calling supported.
- **Marketing:** "Mixture-of-Experts language model... capable of building complex agent harnesses and completing highly elaborate productivity tasks, leveraging Agent Teams, complex Skills, and dynamic tool search." (MiniMax)
- **Empirical (this repo):** Not yet tested in pipeline.
- **Strengths:** Cheapest output by a wide margin ($1.20 vs $3.00–$4.40). Marketing-fit for PR-Agent agent-harness profile. Uncorrelated from all five pilot-validated families.
- **Weaknesses:** Lowest BenchLM aggregate (64) and Coding (56.2) of all Fireworks candidates. Unranked on lmarena verified leaderboard. Quality gap vs GPT-5.3 Codex (BenchLM 88) and Kimi K2.6 primary Reviewer (BenchLM 84) too large to make MiniMax M2.7 a primary review-role candidate; PO Q5 (chat 2026-05-02) elected GPT-5.3 Codex over MiniMax M2.7 for PR-Agent on quality-gap grounds. **MiniMax M2.7 retained in this evaluation as a documented option for future v0.3+ roles where its cost+marketing-fit would be relevant** (e.g. high-frequency low-stakes agent-harness workloads not yet present in v0.1 / v0.2).

## 3. Empirical-vs-benchmark divergences worth flagging

These cases show where the public benchmarks (or model-card listings) misled and only empirical pipeline evidence or direct-API verification revealed the true operational fit:

1. **Qwen 3.6 Plus BenchLM coding 64.8 → 5-of-5 PR-Agent stall.** Coding-sub-benchmark performance does not predict throughput on multi-thousand-line code-diff prompts in CI workflows. Recommendation: treat BenchLM Coding as a *necessary but not sufficient* condition for PR-Agent assignment; require operational tail-latency validation on a representative diff before committing.
2. **Qwen 3.6 Plus 128K Fireworks-effective context vs 1M third-party citation → repo agent-loop context exhaustion at iter-2.** Third-party model-card listings (Puter Developer; OpenRouter) cite Qwen 3.6 Plus context as 1M, matching Alibaba's own deployment. **Fireworks Serverless deployment caps the same model at 128K**, verified via direct API call by PO 2026-05-02 (the Fireworks public catalogue page additionally displays "N/A" for context length, which is a documentation gap rather than a value). Lesson: when models are deployed across multiple providers, the **provider-specific effective context** can differ from the underlying model's published spec; verify directly against the provider you actually use.
3. **MiniMax M2.7 BenchLM 64 (unranked) → operationally untested + outweighed by GPT-5.3 Codex BenchLM 88.** Lower benchmark scores correctly counter-recommend M2.7 for primary Reviewer / PR-Agent / Executor roles. PR-Agent specifically: a model with BenchLM 64 generating findings that primary Reviewer Kimi K2.6 (BenchLM 84) already produces would add little signal; the cross-reviewer value comes from PR-Agent catching what Kimi missed, which requires comparable-or-higher quality. PO Q5 (chat 2026-05-02) chose GPT-5.3 Codex (BenchLM 88) over MiniMax M2.7 (BenchLM 64) for PR-Agent on this quality-gap ground.

## 4. PO-finalised role → model matrix (after Q1–Q6 round-trip)

PO accepted decisions captured in §6 (chat 2026-05-02 round-trip). Final matrix:

| Role | Current model | Final proposed model | Change | Primary rationale |
|---|---|---|---|---|
| Business Planner | GPT-5.5 thinking | GPT-5.5 thinking | unchanged | Top reasoning (95.8) + knowledge (98.1); BP runs are infrequent (one-shot PRD output); GPT budget is well-allocated here |
| Architect (primary) | GPT-5.5 xhigh | GPT-5.5 xhigh | unchanged | Top agentic (98.2 #2 category) + 1M context for ArchSpec compilation; xhigh tier reserved for highest-stakes architectural decisions; **PO Q3 explicit: «вообще будем ориентироваться пока только на гпт как архитектора»** |
| Architect (Anthropic backup) | Opus 4.6 thinking | Opus 4.6 thinking | unchanged | Existing Windsurf path; cross-vendor uncorrelation backup |
| Ticket Orchestrator | GPT-5.5 thinking | GPT-5.5 thinking | unchanged | TO empirically worked across all 5 pilots; agentic + role-discipline strength matters; GPT-only orientation per PO Q3 |
| Executor (default) | GLM 5.1 | GLM 5.1 | unchanged | 3-of-3 successful pilots; agentic-engineering optimisation; 203K context handled all 5-pilot scopes |
| Executor (parallel) | Qwen 3.6 Plus | **DeepSeek V4 Pro** | **SWAP — PO Q1 approved** | Qwen 128K Fireworks-effective context **invalidated** (TKT-014 + PO direct-API verification); DeepSeek 1M context, Coding 73.8, Knowledge 62.6, $3.48 output (cheapest 60+ score Fireworks model); restores 3-family executor-uncorrelation matrix (GLM + DeepSeek + Codex) per CONTRIBUTING.md §7. **NEW MODEL caveat: see §4.1 Architect Quick Reference Card** |
| Executor (specialist — security/typing) | Codex GPT-5.5 | Codex GPT-5.5 | unchanged | Validated TKT-012 + TKT-014; security-heavy / typing-heavy work; tier kept on GPT-5.5 (NOT downgraded to GPT-5.3 Codex) to preserve uncorrelation with PR-Agent (now GPT-5.3 Codex) |
| Reviewer (primary) | Kimi K2.6 | Kimi K2.6 | unchanged | 5-of-5 successful pilots; best procedural discipline (TKT-014 zero deferred findings); strong coding (72) + agentic (73.1) |
| Reviewer (auto / PR-Agent) | Qwen 3.6 Plus | **GPT-5.3 Codex** | **SWAP — PO Q5 approved** | Qwen 5-of-5 stall **invalidated**; GPT-5.3 Codex BenchLM 88 / Coding 63.1 vs MiniMax M2.7 64 / 56.2 — far stronger findings quality (matters because PR-Agent value comes from catching what Kimi K2.6 missed); ~$2–5/month GPT-budget impact (manageable); **no pilot+rollback needed** (Codex CLI route already validated in pipeline); **NEW TIER caveat: see §4.1 Architect Quick Reference Card** |

Slots considered and **DROPPED** during PO round-trip:
- ~~Architect (Fireworks fallback) = DeepSeek V4 Pro~~ — DROPPED per **PO Q3** directive (GPT-only Architect orientation).
- ~~TO (Fireworks fallback) = Kimi K2.6~~ — DROPPED per **PO Q3** logic (GPT-only orientation extends to TO primary).
- ~~Executor (specialist 2 — swarm) = Kimi K2.6~~ — DROPPED per **PO Q4** («у нас сейчас вариации для экзекутора - гпт 5.5, глм 5.1, дипсик 4 про. нужна ли нам 4ая модель в этот пул?» — answer: no, three families is sufficient; revisit when v0.3+ swarm-orchestration tickets emerge).
- ~~PR-Agent = MiniMax M2.7~~ — REPLACED by GPT-5.3 Codex per **PO Q5** + analysis (BenchLM quality-gap: M2.7 at 64 too low to add cross-reviewer value vs Kimi K2.6 at 84; pilot+rollback risk avoided).
- ~~Routine Executor specialist = GPT-5.3 Codex tier~~ — REVERSED. Original §5.3 proposal (downgrade routine specialist runs from GPT-5.5 to GPT-5.3 Codex) is **withdrawn** because PR-Agent now uses GPT-5.3 Codex; keeping Executor specialist on Codex GPT-5.5 maintains tier-level uncorrelation with PR-Agent.

### 4.1 Architect Quick Reference Card (read this when designing role assignments in TKT §7 / ADRs)

**Why this section exists (PO request 2026-05-02):** the Architect role runs on GPT-5.5 xhigh / GPT-5.5 thinking / Opus 4.6 thinking — frontier models whose training data may pre-date some of the new models in this matrix. PO explicitly asked: «нам нужно, чтобы архитектор четко понимал, что такое дипсик 4 про. это новая модель, ей 1 неделя от выхода. архитектор может не знать. нужно учесть этот момент». **If your training-data knowledge cutoff predates a model in this matrix, treat the spec card here as authoritative — do not extrapolate intuitions from similar-named older models** (e.g. DeepSeek V3 differs materially from V4 Pro; GPT-5.3 Codex is a different tier from GPT-5.5 base or GPT-5.3 base).

#### DeepSeek V4 Pro — Executor (parallel)

- **Released:** 2026-04-24 by DeepSeek (≈1 week old at this note's authoring 2026-05-02).
- **Vendor / hosting:** DeepSeek (model author); deployed on Fireworks Serverless; reachable from this repo via OmniRoute → Fireworks routing layer per `docs/knowledge/llm-routing.md` § Topology.
- **Architecture:** 1.6T parameter mixture-of-experts (MoE), hybrid attention (linear + sparse). Function-calling and tool-use supported.
- **Context window:** **1,048,576 tokens (1M)** — largest of all Executor candidates; ≈5× GLM 5.1's 203K and ≈8× Qwen 3.6 Plus's Fireworks-effective 128K.
- **Pricing (Fireworks):** $1.74 input / $0.14 cached input / $3.48 output per 1M tokens.
- **Benchmarks (BenchLM provisional 2026-05-02):** aggregate 84/100; Coding 73.8 (vs GLM 60.9, Qwen 64.8, MiniMax M2.7 56.2); Agentic 70; **Knowledge 62.6 (highest of all Fireworks-hosted candidates including Kimi K2.6's 53.8 and GLM's 52.3)**; verified-rank #7 on lmarena.
- **Marketing positioning:** "Frontier reasoning, advanced coding, and long-context intelligence at scale (up to 1M tokens). Top-tier open-source system for complex agentic workflows, high-precision reasoning, and demanding production workloads."
- **Primary use case in this repo:** Executor parallel slot. Architect routes long-context / multi-file repository-context tickets here when GLM 5.1's 203K context is tight, OR when uncorrelation calibration (cross-family Executor evidence) is desired. Does NOT replace GLM 5.1 default — GLM remains validated default; DeepSeek V4 Pro is parallel-slot complement.
- **Replaces:** Qwen 3.6 Plus in Executor parallel slot (Qwen 128K Fireworks-effective context insufficient — see §2.5 + BACKLOG-011).
- **Empirical status in this repo:** **Not yet piloted** as of 2026-05-02. First Executor TKT assigned to DeepSeek V4 Pro in a successor pipeline cycle should be treated as an empirical pilot; capture observations in `docs/session-log/`.
- **Operational note for Architect:** when assigning a TKT to DeepSeek V4 Pro Executor parallel slot, the TKT §7 rationale should mention the 1M context as a justification when relevant (otherwise default to GLM 5.1).

#### GPT-5.3 Codex — Reviewer auto / PR-Agent

- **Released:** within the GPT-5.x family update cycle (2026 H1). Cheaper coding-specialised sibling to GPT-5.5 base / high / xhigh.
- **Vendor / hosting:** OpenAI (model author); deployed via OpenAI Codex CLI route (NOT Fireworks). PR-Agent integration is via Qodo PR-Agent's GitHub Actions workflow, which calls OpenAI Codex CLI through OmniRoute when the model identifier is set to `gpt-5-3-codex` (or equivalent — successor PR will set the exact identifier in `.pr_agent.toml`).
- **Architecture:** OpenAI Codex tier; coding-specialised training distribution; function-calling and tool-use supported.
- **Context window:** 400K tokens (sufficient for any pilot-era PR diff; pilot PRs in TKT-010..TKT-014 had cumulative review-context well under 100K).
- **Pricing:** $1.75 input / $14 output per 1M tokens — materially cheaper than GPT-5.5 ($5/$30); estimated PR-Agent run cost ~$0.063 (≈12K input + 3K output per typical TKT review); ~$2/month at 30 PRs/month, ~$5/month with iterations.
- **Benchmarks (BenchLM provisional 2026-05-02):** aggregate 88/100. **Coding 63.1 (beats GPT-5.5 base's 58.6 on 5-of-5 coding sub-benchmarks per direct head-to-head)** — coding-tier specialisation pays off on code-review-shaped prompts; Agentic 71.5.
- **Primary use case in this repo:** PR-Agent / Reviewer auto. Generates structured persistent review on every PR, complementing primary Reviewer Kimi K2.6.
- **Replaces:** Qwen 3.6 Plus in PR-Agent slot (Qwen 5-of-5 stall — see §2.5 + BACKLOG-009 §pr-agent-ci-tail-latency).
- **Uncorrelation note:** GPT-5.3 Codex (PR-Agent) and Codex GPT-5.5 (Executor specialist) share OpenAI Codex root family but are different tiers. When Executor specialist is used (rare; ADR-justified gate per `docs/knowledge/llm-routing.md`), PR-Agent reviewing that specialist's output has mild correlation. Acceptable per §4 reasoning. If a TKT specifically needs strong uncorrelation guarantees (security-critical specialist tickets), Architect should assign Reviewer (primary, Kimi K2.6) as the load-bearing review channel and treat PR-Agent as advisory.
- **Empirical status in this repo:** Codex CLI route validated (TKT-012 + TKT-014 Executor specialist runs); GPT-5.3 Codex tier specifically not yet directly invoked but tier-compatibility with Codex CLI is architectural.

#### Models in matrix that are NOT new (Architect already familiar — no card needed)

- GPT-5.5 family (BP / Architect primary / TO) — frontier OpenAI; documented in OpenAI's GPT-5.5 announcement.
- GLM 5.1 (Executor default) — Z.ai; in operation since pilot 1 (TKT-010, 2026-04-30).
- Codex GPT-5.5 (Executor specialist) — OpenAI; validated TKT-012 + TKT-014.
- Kimi K2.6 (Reviewer primary) — Moonshot; validated 5-of-5 Reviewer pilots.
- Opus 4.6 thinking (Architect Anthropic backup) — Anthropic; existing Windsurf path.

### 4.2 What this matrix does NOT change (defer to follow-up research)

- **Devin Orchestrator runtime model:** Not in scope of this evaluation. DO runs on Devin's webapp default model (Anthropic Claude family per Devin product configuration); no direct role↔model assignment in this repo.
- **GPT-5.5 specific tier (high vs xhigh vs thinking):** Treated as one logical "GPT-5.5 family" assignment for BP / Architect-primary / TO. Empirical observation TKT-012/TKT-014: GPT-5.5 high suffices for Executor specialist; xhigh reserved for ArchSpec; thinking reserved for BP/TO. Tier-level optimisation deferred to per-TKT Architect ADR.
- **Embeddings / rerankers / vision models:** Out of v0.1 scope; KBJU Coach v0.1 is text-only.
- **MiniMax M2.7 future v0.3+ role:** Documented in §2.7 but not assigned. If a v0.3+ workload emerges where its $1.20/1M output cost + agent-harness specialisation is relevant (e.g. high-frequency low-stakes harness automation), revisit then.
- **Qwen 3.7+ re-pilot:** If Alibaba ships a Qwen 3.7 with a Fireworks-effective context >256K, revisit Qwen as a candidate for Executor parallel slot or PR-Agent. **PO Q6 noted Fireworks 128K cap is the operational reality today; if the cap is removed at the Fireworks-routing layer in future, Qwen 3.6 Plus itself may become viable retroactively** — verify via the same direct-API method PO used 2026-05-02.

## 5. Implementation plan (post-PR #93 merge)

### 5.1 Sequence — successor PR #94 (planned)

Apply changes in dependency order to minimise risk of mid-pipeline failures:

1. **Executor (parallel) Qwen 3.6 Plus → DeepSeek V4 Pro** — displacement; Architect routes next available executor-parallel-slot ticket to DeepSeek V4 Pro and captures empirical observations in `docs/session-log/`. Document as the first DeepSeek V4 Pro pilot in BACKLOG forward-pointer.
2. **PR-Agent Qwen 3.6 Plus → GPT-5.3 Codex** — displacement; update `.pr_agent.toml` model identifier; update PR-Agent OmniRoute / Codex-CLI dispatch config; verify on next 1–2 PRs that PR-Agent persistent review settles to final HEAD with structured findings (sanity check on dispatch wiring; no rollback trigger needed because Codex CLI route is already empirically validated).

### 5.2 Telemetry to capture

For each DeepSeek V4 Pro Executor pilot run (next ticket assigned to parallel slot):
- Cumulative iter count to reach Reviewer pass.
- Per-iter time-to-first-token + total wall-clock.
- Context-utilisation (peak prompt size in tokens, per-iter).
- Any context-exhaustion warnings.

For each GPT-5.3 Codex PR-Agent run:
- Final-HEAD time-to-completion.
- Diff line count.
- Whether persistent review settled to final HEAD or stalled.
- Quality of findings (subjectively: did it surface anything Kimi K2.6 missed?).

This data feeds into `docs/backlog/deployment-followups.md` §pr-agent-ci-tail-latency-investigation-CRITICAL track #3 (now in resolution phase) and a new BACKLOG entry for DeepSeek V4 Pro empirical-validation status.

### 5.3 Cost-aware allocation

GPT family budget envelope after PO-finalised matrix:

- **BP / Architect primary / TO primary** stay on GPT-5.5 family (run-frequency-bounded: ≤1 BP per minor-version; ≤1 Architect ADR per TKT batch; 1 TO instance per active TKT cycle). PO Q3 «будем ориентироваться пока только на гпт как архитектора» preserves quality at the cost of some budget consumption — acceptable trade-off.
- **Executor specialist (Codex GPT-5.5)** kept finite-budget; specialist invocations are explicitly ADR-justified (already gated by `docs/knowledge/llm-routing.md`).
- **PR-Agent (GPT-5.3 Codex)** introduces a **new run-frequency-high-but-per-run-cheap GPT consumer** (~$2-5/month at 30 PRs/month). This consumes budget but at a manageable level and replaces the Qwen 3.6 Plus 5-of-5 stall pattern with a reliable channel.
- **DeepSeek V4 Pro (Executor parallel) + GLM 5.1 (Executor default) + Kimi K2.6 (Reviewer)** all on Fireworks unlimited — zero GPT budget impact.

Estimated total GPT-budget impact change: PR-Agent additional ~$2-5/month; no other increases. Estimated saving from Qwen 3.6 Plus deprecation: zero direct $ saving (Qwen was on Fireworks unlimited too) but recovered ~12 minutes per failed PR-Agent run × frequency = significant operator-time saving.

### 5.4 Out-of-DO-write-zone changes required for successor PR #94

The successor PR will edit (each requires PO authorisation cited verbatim per CONTRIBUTING.md row 23):

- `docs/knowledge/llm-routing.md` § Model assignment (project default; ADR may revise per ticket) — replace 8-row table with revised matrix per §4 above.
- `AGENTS.md` § role table — update Code Executor row (`GLM 5.1 (default), Qwen 3.6 Plus (parallel)` → `GLM 5.1 (default), DeepSeek V4 Pro (parallel)`) + Reviewer auto note (`Qwen 3.6 Plus through OmniRoute` → `GPT-5.3 Codex through OmniRoute`).
- `.pr_agent.toml` — change PR-Agent model identifier from Qwen 3.6 Plus to GPT-5.3 Codex (exact identifier TBD by routing layer).
- Cross-link from `docs/knowledge/llm-routing.md` to this evaluation note (§4.1 Architect Quick Reference Card) so the Architect can find new-model spec cards from their primary reference.

All four are out-of-DO-write-zone per `CONTRIBUTING.md` row 17. The successor PR will quote PO's per-decision authorisations from §6 below verbatim in PR body.

## 6. PO decisions captured (chat 2026-05-02 round-trip)

PO authorisations after research-PR #93 round-trip discussion. Each decision is the PO's verbatim direction or my paraphrase confirmed by PO acceptance:

### Q1 — Executor parallel slot

> «не понимаю, что такое параллельный свап?» (PO clarification ask)
>
> *(After explanation of the "parallel" slot semantics:)* «да, делаем дипсик 4 про параллельным.»

**Decision:** Executor parallel = DeepSeek V4 Pro. Approved.

### Q2 — PR-Agent candidate trade-off

> «я уверен, что дипсик круто отработает. или может вообще поставим туда гпт какой-то? можно 5.3 или 5.4 гпт туда поставить, например. что думаешь? вообще дипсик очень круто туда поставить, но имхо его и в написании кода как экзекутора было бы круто использовать, что будет нарушать нашу доку. надо думать. в принципе пр это много работы, а для параллельного экзекутора будто работы немного, поэтому непонятно, где дипсик использоваться эффективнее. если поставим минимакс на пр-агента, то мб бдуем дипсик чаще использовать для экзекутора? или это только архитектор решает?»

**Decision:** Architect decides per-TKT which Executor variant to use; with DeepSeek V4 Pro = Executor parallel and GPT-5.3 Codex = PR-Agent, no cross-role correlation, so Architect is free to route DeepSeek V4 Pro frequently (especially for long-context / repository-context-heavy tickets where GLM 5.1's 203K is tight). DeepSeek V4 Pro NOT placed in PR-Agent slot — see Q5.

### Q3 — Architect orientation

> «дипсик лучше на архитекторе, чем глм? про фолбек речь. вообще будем ориентироваться пока только на гпт как архитектора.»

**Decision:** Architect remains GPT-only (primary GPT-5.5 xhigh + Anthropic backup Opus 4.6 thinking). Fireworks fallback proposal DROPPED. TO Fireworks fallback proposal also DROPPED by extension (same GPT-only orientation logic).

### Q4 — Executor specialist-2 swarm slot

> «можно, но у нас сейчас вариации для экзекутора - гпт 5.5, глм 5.1, дипсик 4 про. нужна ли нам 4ая модель в этот пул?»

**Decision:** No 4th Executor variant. Three families (GLM 5.1 default + DeepSeek V4 Pro parallel + Codex GPT-5.5 specialist) is sufficient. Kimi K2.6 swarm slot proposal DROPPED. Revisit if v0.3+ swarm-orchestration tickets emerge that GLM/DeepSeek/Codex cannot handle.

### Q5 — PR-Agent model

> «вот об этом я говорил, мб будем 5.3 использовать как пр-агент?»

**Decision:** PR-Agent = GPT-5.3 Codex. Approved (PO instinct + analysis aligned: BenchLM 88 vs MiniMax M2.7 64 — quality gap matters because PR-Agent's value is catching what Kimi K2.6 missed; ~$2-5/month GPT-budget impact manageable; no pilot+rollback needed because Codex CLI route already validated). MiniMax M2.7 PR-Agent proposal REPLACED. Original §5.3 proposal to downgrade routine Executor specialist to GPT-5.3 Codex tier WITHDRAWN to preserve uncorrelation between PR-Agent (GPT-5.3 Codex) and Executor specialist (GPT-5.5).

### Q6 — Qwen 3.6 Plus context verification

> *(After my recommendation to verify the 128K via direct API:)* «128к показывает прямое апи фаерворкс у квен.»

**Decision:** Qwen 3.6 Plus Fireworks-routed context = 128K confirmed by direct API call. BACKLOG-011 §qwen-context HIGH/strategic conclusion stands as written. Third-party listings (Puter Developer / OpenRouter) citing 1M context refer to non-Fireworks deployments and are not operationally relevant to the openclown-assistant pipeline. Architect Quick Reference Card (§4.1) added at PO request («нам нужно, чтобы архитектор четко понимал, что такое дипсик 4 про. это новая модель, ей 1 неделя от выхода. архитектор может не знать. нужно учесть этот момент») to ensure Architect understands new models without relying on potentially-stale training data.

## 7. References

- Public benchmarks crawled 2026-05-02:
  - BenchLM head-to-heads: <https://benchlm.ai/compare/glm-5-1-vs-kimi-k2-6>, <https://benchlm.ai/compare/deepseek-v4-pro-high-vs-glm-5-1>, <https://benchlm.ai/compare/minimax-m2-7-vs-qwen3-6-plus>, <https://benchlm.ai/compare/gpt-5-3-codex-vs-gpt-5-5>
  - GPT-5.5 profile: <https://benchlm.ai/models/gpt-5-5>
  - lmarena leaderboard: <https://lmarena.ai/leaderboard/text>, <https://lmarena.ai/leaderboard/code>
- Fireworks model pages crawled 2026-05-02:
  - <https://fireworks.ai/models/fireworks/glm-5p1>
  - <https://fireworks.ai/models/deepseek-ai/deepseek-v4-pro>
  - <https://fireworks.ai/models/fireworks/qwen3p6-plus> (catalogue lists Context Length: N/A; PO direct-API call verified 128K)
  - <https://fireworks.ai/models/fireworks/kimi-k2p6>
  - <https://fireworks.ai/models/fireworks/minimax-m2p7>
- Empirical pipeline data:
  - `docs/session-log/2026-05-02-session-2.md` §6.1 (15-TKT actual-Executor-model table), §6.4 (TKT-014 retrospective), §6.6 (5-pilot cumulative).
  - `docs/backlog/pilot-kpi-smoke-followups.md` (BACKLOG-011, especially §qwen-context).
  - `docs/backlog/deployment-followups.md` §pr-agent-ci-tail-latency-investigation-CRITICAL Update 2026-05-02 (PR-Agent 5-of-5 narrowed to Qwen-side independent of Executor authorship).
- Authority:
  - `CONTRIBUTING.md` row 23 (DO out-of-write-zone PO-authorisation-verbatim protocol).
  - `CONTRIBUTING.md` §7 / `docs/knowledge/llm-routing.md` § Model assignment (uncorrelation principle).
- PO Meta-feedback #4 verbatim authorisation: see PR #93 body.
- PO Q1–Q6 round-trip authorisations: see §6 above + PR #93 conversation thread.
