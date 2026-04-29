# Session Log

In-repo, version-controlled record of orchestrator session handoffs. Lets the PO move the orchestrator role between Devin accounts (or to opencode + GPT-5.5) **without losing state** even when token credits run out unexpectedly.

This directory complements (does not replace) `docs/meta/devin-session-handoff.md`:

| File | What it contains | When written | Survives box restart |
|---|---|---|---|
| `docs/meta/devin-session-handoff.md` | Stable role prompt (identity, pipeline, hard rules) | Edited rarely; only when the role itself changes | Yes (in repo) |
| `docs/session-log/<date>-session-N.md` | Volatile state snapshot (open PRs, last action, next step, observations) | After every closed TKT cycle (auto) OR on-demand "переезжаем" | Yes (in repo) |
| `docs/session-log/TEMPLATES/*.md` | Skeletons the orchestrator copies when generating a snapshot | Stable; edited when handoff format changes | Yes (in repo) |

## Files in this directory

- `README.md` — this file
- `TEMPLATES/handoff-cold-devin.md` — for **routine** handoff to a fresh Devin account when credits run out unexpectedly. Auto-generated after every closed TKT cycle (see §"Auto-cold rule" below). Short (~600 lines target). Formal state only.
- `TEMPLATES/handoff-warm-devin.md` — for **planned** handoff when the PO says "переезжаем в новую Devin сессию" ahead of time. Includes texture (observations about the PO's working style, sticky moments, open conversational threads). Longer (~1200 lines target).
- `TEMPLATES/handoff-opencode-gpt55.md` — **fallback** handoff to opencode + GPT-5.5 (500k context window) on the PO's VPS when no Devin account is available. Inlines extra material because opencode lacks Devin's Knowledge / Playbook system. Longest (~2500 lines target).
- `<YYYY-MM-DD>-session-N.md` — actual snapshot files. Filled-in copies of one of the templates, named by date + session counter for that date.

## How to use (PO playbook)

### Scenario 1 — Routine cold handoff (credits ran out)

1. Open `https://raw.githubusercontent.com/OpenClown-bot/openclown-assistant/main/docs/session-log/<latest-cold-file>` in your browser. The latest file is the one with the highest date / session counter under this directory.
2. `Ctrl+A`, `Ctrl+C` — copy the entire file.
3. Open a new Devin session in any account. Paste the content as the **first message** in chat.
4. New Devin will run the self-checks listed at the top of the file (env var, repo clone, gh auth, validate-docs). It will request `GITHUB_TOKEN_OPENCLOWN` via Devin's `secrets` tool if missing. Provide it as a **fine-grained PAT** scoped to `OpenClown-bot/openclown-assistant` with `Contents: R/W` + `Pull requests: R/W` + `Workflows: R/W`.
5. New Devin reads `docs/meta/devin-session-handoff.md` and the listed required files, then replies with: 5-line state summary + role-confirmation + proposed next concrete action.
6. You answer "go" (or redirect priorities) and continue.

**Time cost: 5–10 minutes of your active time.**

### Scenario 2 — Planned warm handoff ("переезжаем")

1. Tell the current orchestrator: **"переезжаем в новую Devin сессию"**. Optionally specify scope (e.g. "warm — keep texture" vs "cold — formal state only").
2. Current orchestrator runs the warm template, which captures texture sections in addition to formal state. ~7–10 minutes for the orchestrator to produce.
3. The orchestrator commits the warm snapshot to this directory and pushes via the standard PR flow (or — if the PO authorises — direct commit, since `session-log` is FREEFORM and skips frontmatter validation).
4. PO copies the file (same as Scenario 1, step 2 onward).
5. **Sanity check on arrival:** new Devin will quote 1–2 specific observations from the texture section in its first reply, proving it actually read the file.

### Scenario 3 — Fallback to opencode + GPT-5.5

When no Devin account is reachable:

1. Ask the current orchestrator: **"переезжаем в opencode"**. The orchestrator generates the opencode template (longer, inlines role prompts because opencode lacks Devin Knowledge).
2. On your VPS:
   ```bash
   ssh <vps>
   export GITHUB_TOKEN_OPENCLOWN=<your_pat>
   if [[ ! -d ~/repos/openclown-assistant/.git ]]; then
     git clone https://x-access-token:${GITHUB_TOKEN_OPENCLOWN}@github.com/OpenClown-bot/openclown-assistant.git ~/repos/openclown-assistant
   fi
   cd ~/repos/openclown-assistant && git pull origin main
   ```
3. Launch opencode with GPT-5.5 (or Kimi K2.6 — also a large-context option).
4. Paste the opencode handoff file as the first message.
5. opencode will run its own self-checks, ask for missing pieces via CLI prompts, then summarise state and propose next action.

**opencode constraints to keep in mind:**
- No Devin Review (the bot that posts inline PR findings) — review responsibility is fully on the human + Kimi LLM Reviewer.
- No native `git_view_pr` / `git_create_pr` tools — use `gh` CLI with `GITHUB_TOKEN_OPENCLOWN`.
- No browser / desktop tools — purely git + shell + curl.
- Upside: 500k context (Devin is smaller), CLI speed, full shell autonomy.

## Auto-cold rule

After every **closed TKT cycle** — i.e. both the Code PR and the corresponding RV-CODE Review file are merged into `main` — the orchestrator MUST automatically generate a `cold-devin` handoff file under this directory, named `<YYYY-MM-DD>-session-N.md`, without waiting for the PO to ask.

Rationale: if credits run out unexpectedly between cycles, the PO must always have an up-to-date snapshot to paste into a fresh session. The cost (~3–5 minutes of orchestrator time per closed cycle) is small relative to the loss of recreating context from chat memory.

The auto-cold file is generated from `TEMPLATES/handoff-cold-devin.md` and committed via the PR flow (or direct push if the PO has authorised that for `docs/session-log/` specifically — see CONTRIBUTING.md Orchestrator write-zone).

Warm handoffs remain **on-demand only** ("переезжаем" trigger). Texture is expensive to capture and only worth it when planned.

## How often will I need to switch sessions?

Two pressures push you toward switching: **token credits** (your axis) and **context window saturation** (the orchestrator's axis).

| Work mode | Recommended frequency |
|---|---|
| Active TKT cycles (Executor + Reviewer + fixes + merge) | Every **3–4 hours** or **2 closed cycles**, whichever comes first |
| Architecture / planning / discussion | Every **5–6 hours** or when you notice the orchestrator slipping |
| Pure read / analysis sessions | Up to 8+ hours in one session is fine |
| Crisis mode (something broken in prod) | Write a cold handoff after every incident in case credits run out mid-debug |

Signals the orchestrator is "drifting" and you should switch:
- Asks you to repeat instructions you gave 30+ minutes ago
- Confuses the order of pipeline steps
- Two or more "summary of previous conversation" notices appeared (background context compression has run twice)
- Drops references to artifacts it cited correctly an hour ago

When you see any of these — say "переезжаем" early. A planned warm handoff loses far less than a forced cold handoff after the orchestrator has already partially lost context.

## Validation

Files in `docs/session-log/` are FREEFORM (no frontmatter required). The validator (`scripts/validate_docs.py`) skips this directory because the snapshot files are not versioned artifacts — they are operational state.
