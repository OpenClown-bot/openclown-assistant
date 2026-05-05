# AGENTS.md

This repository is managed by a **multi-LLM pipeline** with strict role separation. If you are an AI agent, identify your role from the prompt you received and load the matching file:

| Role | Prompt file | Default model | Runtime |
|---|---|---|---|
| Business Planner | `docs/prompts/business-planner.md` | GPT-5.5 thinking / Claude Opus 4.7 thinking | ChatGPT Plus (web) / Devin |
| Technical Architect | `docs/prompts/architect.md` | GPT-5.5 xhigh / GPT-5.5 thinking / Opus 4.6 thinking | Codex CLI / opencode CLI / Windsurf |
| Code Executor | `docs/prompts/executor.md` | GLM 5.1 (default), DeepSeek V4 Pro (parallel), Codex GPT-5.5 (specialist) | opencode + OmniRoute |
| Reviewer | `docs/prompts/reviewer.md` | Kimi K2.6 | opencode + OmniRoute |
| Ticket Orchestrator | `docs/prompts/ticket-orchestrator.md` | GPT-5.5 high (main) / DeepSeek V4 Pro (fallback) | opencode (PO's Windows PC) |

**Qodo PR-Agent** (GPT-5.3 Codex through OmniRoute) auto-reviews every PR; it is a **second** reviewer alongside Kimi, not a replacement. See `.pr_agent.toml` for its configuration. (Swapped from Qwen 3.6 Plus on 2026-05-02 per research-PR #93 + #94; rationale in `docs/knowledge/llm-model-evaluation-2026-05.md` §4 + §4.1 + §6 Q5; root cause for the swap is BACKLOG-009 §pr-agent-ci-tail-latency. Devin Review was the prior supplementary reviewer; deprecated 2026-04-30 due to ACU exhaustion.)

The **Devin Orchestrator** is a separate, PO-delegated coordination role outside the pipeline above. Its full role prompt lives in `docs/meta/devin-session-handoff.md`; its formal write-zone is defined in `CONTRIBUTING.md` § Roles; its session-handoff continuity (cold / warm / opencode templates + auto-cold-after-each-closed-TKT-cycle rule) is in `docs/session-log/`. If you are running as the Devin Orchestrator, load `docs/meta/devin-session-handoff.md` first, then check `docs/session-log/` for the latest snapshot.

The **Ticket Orchestrator** is a per-ticket execution-orchestration role delegated from the Devin Orchestrator (added 2026-05-01 to preserve Devin's strategic token budget). It owns one TKT cycle from dispatch to closure-ready hand-back, runs the **first cross-reviewer audit pass** before hand-back, and then yields to the Devin Orchestrator for the **second ratification audit** before merge-safe sign-off. The two-phase audit was codified after the F-PA-17 miss (`docs/session-log/2026-05-01-session-3.md` §6.7); see `docs/meta/devin-session-handoff.md` § Delegating to Ticket Orchestrator for the bootstrap and hand-back protocol, and `docs/prompts/ticket-orchestrator.md` for the full role prompt.

Follow the role file **exactly**. Do not cross role boundaries. See `CONTRIBUTING.md` for the full process rules.

Before making any change:

1. Read `README.md` and `CONTRIBUTING.md`.
2. Confirm your write-zone in `CONTRIBUTING.md` § Roles. Touching files outside it WILL be rejected by Reviewer.
3. Read the role-specific reference knowledge listed in your prompt file (e.g. Architect MUST read `docs/knowledge/openclaw.md` and `docs/knowledge/awesome-skills.md` before designing — this is Phase 0: Recon).
4. Run `python scripts/validate_docs.py` before pushing. CI runs the same check on every PR.
