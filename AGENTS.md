# AGENTS.md

This repository is managed by a **multi-LLM pipeline** with strict role separation. If you are an AI agent, identify your role from the prompt you received and load the matching file:

| Role | Prompt file | Default model | Runtime |
|---|---|---|---|
| Business Planner | `docs/prompts/business-planner.md` | GPT-5.5 thinking / Claude Opus 4.7 thinking | ChatGPT Plus (web) / Devin |
| Technical Architect | `docs/prompts/architect.md` | GPT-5.5 xhigh / GPT-5.5 thinking / Opus 4.6 thinking | Codex CLI / opencode CLI / Windsurf |
| Code Executor | `docs/prompts/executor.md` | GLM 5.1 (default), Qwen 3.6 Plus (parallel), Codex GPT-5.5 (specialist) | opencode + OmniRoute |
| Reviewer | `docs/prompts/reviewer.md` | Kimi K2.6 | opencode + OmniRoute |

Devin Review (the bot) auto-reviews every PR; it is a **second** reviewer alongside Kimi, not a replacement.

The **Orchestrator** is a separate, PO-delegated coordination role outside the four-LLM pipeline above. Its full role prompt lives in `docs/meta/devin-session-handoff.md`; its formal write-zone is defined in `CONTRIBUTING.md` § Roles; its session-handoff continuity (cold / warm / opencode templates + auto-cold-after-each-closed-TKT-cycle rule) is in `docs/session-log/`. If you are running as the Orchestrator, load `docs/meta/devin-session-handoff.md` first, then check `docs/session-log/` for the latest snapshot.

Follow the role file **exactly**. Do not cross role boundaries. See `CONTRIBUTING.md` for the full process rules.

Before making any change:

1. Read `README.md` and `CONTRIBUTING.md`.
2. Confirm your write-zone in `CONTRIBUTING.md` § Roles. Touching files outside it WILL be rejected by Reviewer.
3. Read the role-specific reference knowledge listed in your prompt file (e.g. Architect MUST read `docs/knowledge/openclaw.md` and `docs/knowledge/awesome-skills.md` before designing — this is Phase 0: Recon).
4. Run `python scripts/validate_docs.py` before pushing. CI runs the same check on every PR.
