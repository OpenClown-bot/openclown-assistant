# AGENTS.md

This repository is managed by a **multi-LLM pipeline** with strict role separation. If you are an AI agent, identify your role from the prompt you received and load the matching file:

| Role | Prompt file | Default model | Runtime |
|---|---|---|---|
| Business Planner | `docs/prompts/business-planner.md` | GPT-5.5 thinking | ChatGPT Plus (web) |
| Technical Architect | `docs/prompts/architect.md` | GPT-5.5 xhigh / Opus 4.6 thinking | Codex CLI / Windsurf |
| Code Executor | `docs/prompts/executor.md` | GLM 5.1 (default), Qwen 3.6 Plus (parallel), Codex GPT-5.5 (specialist) | opencode + OmniRoute |
| Reviewer | `docs/prompts/reviewer.md` | Kimi K2.6 | opencode + OmniRoute |

Devin Review (the bot) auto-reviews every PR; it is a **second** reviewer alongside Kimi, not a replacement.

Follow the role file **exactly**. Do not cross role boundaries. See `CONTRIBUTING.md` for the full process rules.

Before making any change:

1. Read `README.md` and `CONTRIBUTING.md`.
2. Confirm your write-zone in `CONTRIBUTING.md` § Roles. Touching files outside it WILL be rejected by Reviewer.
3. Read the role-specific reference knowledge listed in your prompt file (e.g. Architect MUST read `docs/knowledge/openclaw.md` and `docs/knowledge/awesome-skills.md` before designing — this is Phase 0: Recon).
4. Run `python scripts/validate_docs.py` before pushing. CI runs the same check on every PR.
