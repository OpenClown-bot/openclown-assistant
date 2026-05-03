# LLM model re-evaluation — May 2026 (research note)

> **Status:** RESEARCH NOTE / proposal. Captures evidence + proposed role→model assignments for PO review. **Does not** rewrite `docs/knowledge/llm-routing.md` or `AGENTS.md` directly — those changes are deferred to a follow-up PR pending PO acceptance of the specific assignments below.
>
> **Authority:** PO Meta-feedback #4 from 2026-05-02 chat after TKT-014 closure (Devin Orchestrator coordination). Authorisation quoted verbatim in PR #93 body per `CONTRIBUTING.md` § Roles row 23.
>
> **Context:** Five-pilot KBJU Coach v0.1 multi-LLM pipeline closed end-to-end (TKT-010..TKT-014). Two structural model failures emerged that motivate this re-evaluation:
> 1. **Qwen 3.6 Plus 128K context insufficient for Executor** (TKT-014 mid-cycle context exhaustion forced Codex GPT-5.5 takeover); see `docs/backlog/pilot-kpi-smoke-followups.md` §`TKT-NEW-qwen-3.6-plus-128k-context-insufficient-for-executor` (HIGH/strategic).
> 2. **Qwen 3.6 Plus PR-Agent stall on long code-diff prompts** (5-of-5 final-HEAD code-PR runs stalled/cancelled across all 5 pilots, INDEPENDENT of Executor authorship: TKT-014 final HEAD `3c6ff96` was Codex-authored and still stalled Qwen PR-Agent CI); see `docs/backlog/deployment-followups.md` §`TKT-NEW-pr-agent-ci-tail-latency-investigation-CRITICAL` (Update 2026-05-02).
>
> **Recommended audience:** PO (decides which proposals to apply), Architect (consumes finalised matrix when designing role assignments in ADRs), Devin Orchestrator (applies merged proposals to `llm-routing.md` + `AGENTS.md` in successor PR).

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

### 1.2 Operational specs (Fireworks model catalogue)

[Fireworks model pages](https://fireworks.ai/models) crawled 2026-05-02 for the five candidate Fireworks-hosted models. Each entry captures: hosting state, parameter count, context window, pricing (input / cached input / output per 1M tokens), function-calling support, multimodal support.

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

All five Fireworks-hosted models are unlimited / free per tokens for the PO's account topology (PO quote, 2026-05-02). GPT-5.5 family via Codex CLI is finite-budget; allocate carefully.

### 2.1 GPT-5.5 (OpenAI; via Codex CLI; finite budget)

- **BenchLM provisional:** 91/100 (verified #3 of 23). Agentic 98.2 (#2 in category — tied with Claude Opus 4.7 thinking), Reasoning 95.8, Knowledge 98.1, Coding 84.0.
- **Operational:** $5/$30 per 1M tokens (input/output), 1M context, explicit chain-of-thought reasoning, multimodal.
- **GPT-5.3 Codex** (cheaper sibling): $1.75/$14, 400K context, BenchLM 88; Coding 63.1 (beats GPT-5.5's 58.6 on 5-of-5 coding sub-benchmarks per BenchLM head-to-head).
- **Empirical (this repo):** Codex GPT-5.5 high validated on TKT-012 (full pilot) and TKT-014 iter-2..iter-5 substantive (took over Qwen).
- **Strengths:** Best overall agentic + reasoning + knowledge. Best for high-stakes one-shot output (PRD, ArchSpec).
- **Weaknesses:** Output token cost ~10× DeepSeek-V4-Pro / Kimi K2.6. Finite budget. Reserve for roles where Fireworks alternatives demonstrate measurable quality gap.

### 2.2 GLM 5.1 (Z.ai; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 83/100 (verified #21). Coding 60.9, Agentic 65.3, Knowledge 52.3.
- **Operational:** $1.40 / $0.26 / $4.40 per 1M tokens, **202.8K context**, 743.9B MoE params, function-calling supported.
- **Marketing:** "Built for agentic engineering, with stronger coding capabilities and sustained performance over long-horizon tasks with hundreds of iteration rounds." (Z.ai)
- **Empirical (this repo):** 3-of-3 successful Executor pilots (TKT-010, TKT-011, TKT-013). No context-exhaustion failures observed across iter counts up to ≈10.
- **Strengths:** Validated as default Executor; agentic-engineering optimisation matches the multi-iter Executor loop profile; 203K context handled all 5-pilot ticket scopes.
- **Weaknesses:** Output cost is highest of the five Fireworks options ($4.40 per 1M tokens). For PR-Agent (which produces long persistent reviews), cost matters more than for Executor.

### 2.3 DeepSeek V4 Pro (DeepSeek; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 84/100 (verified #7). Coding 73.8, Agentic 70, Knowledge 62.6 (highest of all Fireworks-hosted candidates).
- **Operational:** $1.74 / $0.14 / $3.48 per 1M tokens, **1,048.6K context (1M — largest of all candidates)**, 1.6T MoE params, hybrid attention architecture, function-calling supported.
- **Marketing:** "Frontier reasoning, advanced coding, and long-context intelligence at scale (up to 1M tokens)... top-tier open-source system for complex agentic workflows, high-precision reasoning, and demanding production workloads." (DeepSeek)
- **Empirical (this repo):** **Not yet tested in pipeline** (released 2026-04-24, post-dating most TKT closures). Strong-on-paper Qwen replacement for Executor parallel slot.
- **Strengths:** 1M context is the natural fix for Qwen 3.6 Plus 128K-context Executor failure mode (BACKLOG-011 §qwen-context). Best non-GPT knowledge score (62.6). Cheapest output among 60+ score models ($3.48). Coding (73.8) beats GLM 5.1 (60.9) by 12.9 points.
- **Weaknesses:** Untested in this repo's specific agent-loop runtime. Recommended pilot in a low-stakes ticket before committing as Executor parallel default.

### 2.4 Qwen 3.6 Plus (Alibaba; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 77/100 (verified #6 in coding sub-leaderboard). Coding 64.8, Agentic 61.6.
- **Operational:** $0.50 / $0.10 / $3.00 per 1M tokens, **context window listed as N/A on Fireworks page** (PO empirical: 128K), 0 params listed (closed model), multimodal (image input), function-calling supported.
- **Empirical (this repo):** **INVALIDATED on two operational fronts:**
  1. **Executor:** TKT-014 iter-1 completed (5m58s, c1c97f2) but iter-2 stalled on context exhaustion when responding to cumulative Kimi findings + repo state. TKT-011 was Qwen-assigned but silently ran on GLM (`docs/backlog/deployment-followups.md` §runtime-mismatch). End-to-end Qwen Executor pipeline never validated.
  2. **PR-Agent:** 5-of-5 final-HEAD code-PR runs stalled or cancelled at ~12m hard-timeout, INDEPENDENT of Executor authorship (TKT-014 final HEAD `3c6ff96` was Codex-authored and still stalled Qwen PR-Agent). This is the strongest empirical signal in the dataset for any model failure mode.
- **Strengths on paper:** Cheapest input ($0.50 per 1M), competitive BenchLM coding (64.8 beats GLM 5.1's 60.9).
- **Weaknesses:** Operationally unfit for both Executor (context too small for repo agent loops) and PR-Agent (throughput collapse on long code-diff prompts). The benchmark scores don't predict this — empirical signal dominates.

### 2.5 Kimi K2.6 (Moonshot AI; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 84/100 (verified #6). Coding 72, Agentic 73.1, Knowledge 53.8.
- **Operational:** $0.95 / $0.16 / $4.00 per 1M tokens, **262.1K context**, 1T MoE params, multimodal, **fine-tuning supported**, function-calling supported.
- **Marketing:** "Open-source, native multimodal agentic model that advances practical capabilities in long-horizon coding, coding-driven design, proactive autonomous execution, and **swarm-based task orchestration**." (Moonshot)
- **Empirical (this repo):** 5-of-5 successful Reviewer pilots. TKT-014 reviewer iter-3 issued `pass` verdict on cumulative final HEAD covering iter-3+iter-4+iter-5 with zero deferred findings — best procedural discipline of all 5 pilots. No reliability issues observed.
- **Strengths:** Validated as Reviewer; strong agentic + coding scores; multimodal (useful for future image-input tickets); fine-tunable (future custom-Reviewer LoRA option).
- **Weaknesses:** Already saturated as Reviewer. Adding Kimi to additional roles introduces correlation risk (Reviewer reviewing its own siblings) and contradicts CONTRIBUTING.md §7 uncorrelation principle. Reuse only in roles distant from primary review chain (e.g. Executor specialist for swarm tasks, TO Fireworks fallback).

### 2.6 MiniMax M2.7 (MiniMax; via OmniRoute → Fireworks; unlimited)

- **BenchLM provisional:** 64/100 (unranked). Coding 56.2, Agentic 57.
- **Operational:** $0.30 / $0.06 / $1.20 per 1M tokens (cheapest output of all candidates by 2.5×), **196.6K context**, 228.7B MoE params, function-calling supported.
- **Marketing:** "Mixture-of-Experts language model... capable of building complex agent harnesses and completing highly elaborate productivity tasks, leveraging Agent Teams, complex Skills, and dynamic tool search." (MiniMax)
- **Empirical (this repo):** Not yet tested in pipeline.
- **Strengths:** Cheapest output by a wide margin ($1.20 vs $3.00–$4.40). Marketing literally describes the PR-Agent operational profile (structured agent harnesses + complex skills + per-PR tool calls). Uncorrelated from all five pilot-validated families (GLM / Codex / Kimi / DeepSeek-not-yet-used / Qwen-deprecated).
- **Weaknesses:** Lowest BenchLM aggregate (64) and Coding (56.2) of all Fireworks candidates. Unranked on lmarena verified leaderboard. Pilot in low-stakes role (PR-Agent supplementary review) before committing to higher-stakes assignment.

## 3. Empirical-vs-benchmark divergences worth flagging

These cases show where the public benchmarks misled and only empirical pipeline evidence revealed the true operational fit:

1. **Qwen 3.6 Plus BenchLM coding 64.8 → 5-of-5 PR-Agent stall.** Coding-sub-benchmark performance does not predict throughput on multi-thousand-line code-diff prompts in CI workflows. Recommendation: treat BenchLM Coding as a *necessary but not sufficient* condition for PR-Agent assignment; require operational tail-latency validation on a representative diff before committing.
2. **Qwen 3.6 Plus 128K advertised context → repo agent-loop context exhaustion at iter-2.** Advertised context windows do not predict cumulative-prompt-context behaviour after several rounds of Reviewer-finding response. Recommendation: for Executor parallel slot, require ≥256K advertised context (rules out Qwen 3.6 Plus, leaves Kimi 262K / DeepSeek 1M / GLM 203K-tight as candidates).
3. **MiniMax M2.7 BenchLM 64 (unranked) → operationally untested.** Lower benchmark scores correctly counter-recommend M2.7 for primary Reviewer or primary Executor roles, but its agent-harness specialisation may make it the best PR-Agent fit despite the score gap. Recommendation: pilot M2.7 in PR-Agent slot with explicit rollback-to-GLM-5.1 trigger if 2-of-3 stall pattern emerges.

## 4. Proposed role → model matrix

This is the **proposed** matrix. PO decides which rows to apply; selected rows then propagate to `docs/knowledge/llm-routing.md` + `AGENTS.md` in a successor PR (out-of-DO-write-zone, requires PO authorisation per row 23).

| Role | Current model | Proposed model | Change | Primary rationale |
|---|---|---|---|---|
| Business Planner | GPT-5.5 thinking | GPT-5.5 thinking | unchanged | Top reasoning (95.8) + knowledge (98.1); BP runs are infrequent (one-shot PRD output); GPT budget is well-allocated here |
| Architect (primary) | GPT-5.5 xhigh | GPT-5.5 xhigh | unchanged | Top agentic (98.2 #2 category) + 1M context for ArchSpec compilation; xhigh tier reserved for highest-stakes architectural decisions |
| Architect (Fireworks fallback) | (none) | **DeepSeek V4 Pro** | **NEW slot** | 1M context for ArchSpec scope; Knowledge 62.6 (highest non-GPT); Agentic 70; preserves GPT budget on routine architectural follow-ups |
| Architect (Anthropic backup) | Opus 4.6 thinking | Opus 4.6 thinking | unchanged | Existing Windsurf path; keep as cross-vendor uncorrelation backup |
| Ticket Orchestrator | GPT-5.5 thinking | GPT-5.5 thinking | unchanged | TO empirically worked across all 5 pilots; agentic + role-discipline strength matters |
| TO (Fireworks fallback) | (none) | **Kimi K2.6** | **NEW slot** | BenchLM 84, Agentic 73.1; Fireworks-routed alternative when GPT budget tight; Kimi in this role is acceptable because TO does not directly review Reviewer output (no correlation cycle) |
| Executor (default) | GLM 5.1 | GLM 5.1 | unchanged | 3-of-3 successful pilots; agentic-engineering optimisation; 203K context handled all 5-pilot scopes |
| Executor (parallel) | Qwen 3.6 Plus | **DeepSeek V4 Pro** | **SWAP** | Qwen 128K context **invalidated** (TKT-014); DeepSeek 1M context, Coding 73.8, Knowledge 62.6, $3.48 output (cheapest 60+ score); restores 3-family executor-uncorrelation matrix (GLM + DeepSeek + Codex) per CONTRIBUTING.md §7 |
| Executor (specialist — security/typing) | Codex GPT-5.5 | Codex GPT-5.5 | unchanged | Validated TKT-012 + TKT-014; security-heavy / typing-heavy work; GPT-5.3 Codex tier ($1.75/$14) preferred over GPT-5.5 base ($5/$30) for routine specialist runs since BenchLM Coding 63.1 > 58.6 |
| Executor (specialist 2 — swarm/multi-agent) | (none) | **Kimi K2.6** | **NEW slot (optional)** | Marketing: "swarm-based task orchestration"; 262K context; useful for future multi-skill orchestration tickets; ONLY assign when Architect explicitly justifies in TKT §7 (do not default-route here, to preserve Reviewer uncorrelation) |
| Reviewer (primary) | Kimi K2.6 | Kimi K2.6 | unchanged | 5-of-5 successful pilots; best procedural discipline (TKT-014 zero deferred findings); strong coding (72) + agentic (73.1) |
| Reviewer (auto / PR-Agent) | Qwen 3.6 Plus | **MiniMax M2.7** | **SWAP** | Qwen 5-of-5 stall **invalidated**; M2.7 marketing matches PR-Agent profile ("agent harnesses... Agent Teams... dynamic tool search"); cheapest output ($1.20 — relevant for long persistent-review generation); uncorrelated from Reviewer-Kimi + Executor-GLM/DeepSeek/Codex; **pilot with rollback trigger** (see §5 implementation plan) |

### 4.1 Alternative for PR-Agent (if MiniMax M2.7 piloting fails)

If MiniMax M2.7 stalls 2-of-3 in PR-Agent piloting, fall back to **GLM 5.1** for PR-Agent. Trade-offs:

- **Pro:** Same family already validated as Executor default; 203K context; agentic-engineering focus.
- **Con:** Violates Executor-vs-PR-Agent uncorrelation (CONTRIBUTING.md §7) when PR-Agent reviews GLM-authored Executor diffs. Acceptable only as temporary rollback target until DeepSeek V4 Pro can be piloted as PR-Agent (1M context + 73.8 coding score is overkill for PR-Agent but eliminates uncorrelation concern with GLM Executor).

### 4.2 What this matrix does NOT change (defer to follow-up research)

- **Devin Orchestrator runtime model:** Not in scope of this evaluation. DO runs on Devin's webapp default model (Anthropic Claude family per Devin product configuration); no direct role↔model assignment in this repo.
- **GPT-5.5 specific tier (high vs xhigh vs thinking):** Treated as one logical "GPT-5.5 family" assignment. Empirical observation TKT-012/TKT-014: GPT-5.5 high suffices for Executor specialist; xhigh reserved for ArchSpec; thinking reserved for BP/TO. Tier-level optimisation deferred to per-TKT Architect ADR.
- **Embeddings / rerankers / vision models:** Out of v0.1 scope; KBJU Coach v0.1 is text-only.

## 5. Implementation plan (if PO accepts the matrix)

### 5.1 Sequence (post-PR #93 merge)

Apply changes in dependency order to minimise risk of mid-pipeline failures:

1. **Architect (Fireworks fallback) = DeepSeek V4 Pro** — additive, no displacement; safe to add immediately to `llm-routing.md`.
2. **TO (Fireworks fallback) = Kimi K2.6** — additive, no displacement.
3. **Executor (parallel) Qwen 3.6 Plus → DeepSeek V4 Pro** — displacement; pilot on next available executor-parallel-slot ticket; if DeepSeek V4 Pro fails, fall back to Qwen 3.6 Plus only for tickets ≤128K-context-fitable (i.e. document the constraint explicitly per BACKLOG-011 §qwen-context).
4. **Executor (specialist 2) Kimi K2.6** — additive, optional, only used when Architect explicitly justifies.
5. **PR-Agent Qwen 3.6 Plus → MiniMax M2.7** — displacement; pilot on next 2 PRs with monitoring; rollback trigger = 2-of-3 stalls (see §5.2).

### 5.2 PR-Agent rollback trigger (if MiniMax M2.7 piloting fails)

- **Trigger:** 2-of-3 final-HEAD PR-Agent runs stalled / cancelled at hard-timeout in the first 3 piloted PRs.
- **Action:** Rollback PR-Agent to **GLM 5.1** as the temporary fallback; open new BACKLOG entry to pilot **DeepSeek V4 Pro** as PR-Agent in subsequent cycle (1M context overkill for PR-Agent but eliminates Executor-default uncorrelation concern).
- **Telemetry to capture:** Per-PR-Agent run, log the actual diff line count + final-HEAD time-to-completion. This data feeds into `docs/backlog/deployment-followups.md` §pr-agent-ci-tail-latency-investigation-CRITICAL track #3 (currently empirically narrowed to "PR-Agent Qwen-side, INDEPENDENT of Executor authorship" per Update 2026-05-02 — MiniMax M2.7 telemetry will further narrow the root-cause).

### 5.3 Cost-aware allocation (PO budget envelope per `llm-routing.md` § Cost envelope)

GPT-5.5 finite budget conservation actions if PO accepts the matrix:

- **BP / Architect primary / TO primary** stay on GPT-5.5 family. These roles are run-frequency-bounded (≤1 BP per pipeline minor-version; ≤1 Architect ADR per TKT batch; 1 TO instance per active TKT cycle).
- **Architect Fireworks fallback (DeepSeek V4 Pro) + TO Fireworks fallback (Kimi K2.6)** absorb the routine architectural follow-ups + per-TKT TO bootstrap dispatch where GPT budget is tight. Estimated GPT-budget savings: 30–50% of current Architect + TO consumption pulled into Fireworks.
- **Executor specialist (Codex GPT-5.5)** kept finite-budget; specialist invocations are explicitly ADR-justified (already gated). Recommend default to **GPT-5.3 Codex tier** ($1.75/$14) over GPT-5.5 base ($5/$30) for routine specialist runs unless ADR justifies higher tier — BenchLM Coding 63.1 > 58.6 supports this.

### 5.4 Out-of-DO-write-zone changes required for follow-up PR

- `docs/knowledge/llm-routing.md` § Model assignment (project default; ADR may revise per ticket) — replace 8-row table with revised matrix per §4 above.
- `AGENTS.md` § role table — update Code Executor row (default + parallel + specialist + specialist-2), Reviewer auto row.
- `.pr_agent.toml` — change PR-Agent model identifier from Qwen 3.6 Plus to MiniMax M2.7 (or follow-up rollback target if pilot fails).

All three are out-of-DO-write-zone per `CONTRIBUTING.md` row 17. The follow-up PR will quote PO's explicit per-assignment authorisation verbatim in PR body.

## 6. Open questions for PO (block on PO acceptance)

These need PO judgement before the follow-up PR can apply changes:

1. **Accept Qwen 3.6 Plus → DeepSeek V4 Pro Executor-parallel swap?** Or prefer to drop parallel slot entirely and ship 2-family uncorrelation (GLM + Codex) explicitly, deprecating Qwen as Executor without replacement?
2. **Accept Qwen 3.6 Plus → MiniMax M2.7 PR-Agent swap with §5.2 pilot+rollback protocol?** Or prefer DeepSeek V4 Pro directly (no pilot, higher confidence, but overkill spec)?
3. **Accept new Architect Fireworks fallback (DeepSeek V4 Pro) + TO Fireworks fallback (Kimi K2.6)?** Or keep these GPT-only to maximise per-role uncorrelation (current state)?
4. **Accept Executor specialist-2 (Kimi K2.6 swarm slot)?** Or defer until a TKT explicitly demands swarm orchestration (avoid premature optimisation)?
5. **Accept GPT-5.3 Codex tier as default for routine Executor specialist runs?** Or keep GPT-5.5 base default and make GPT-5.3 Codex an ADR-justified down-tier?
6. **Re-pilot Qwen 3.6 Plus once Alibaba ships Qwen3.7 with 256K+ context?** Or treat Qwen as deprecated for openclown-assistant pipeline going forward?

## 7. References

- Public benchmarks crawled 2026-05-02:
  - BenchLM head-to-heads: <https://benchlm.ai/compare/glm-5-1-vs-kimi-k2-6>, <https://benchlm.ai/compare/deepseek-v4-pro-high-vs-glm-5-1>, <https://benchlm.ai/compare/minimax-m2-7-vs-qwen3-6-plus>
  - GPT-5.5 profile: <https://benchlm.ai/models/gpt-5-5>
  - lmarena leaderboard: <https://lmarena.ai/leaderboard/text>, <https://lmarena.ai/leaderboard/code>
- Fireworks model pages crawled 2026-05-02:
  - <https://fireworks.ai/models/fireworks/glm-5p1>
  - <https://fireworks.ai/models/deepseek-ai/deepseek-v4-pro>
  - <https://fireworks.ai/models/fireworks/qwen3p6-plus>
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
