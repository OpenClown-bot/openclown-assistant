# Warm Handoff — `openclown-assistant` Orchestrator → New Devin Account

**Generated:** `<YYYY-MM-DD HH:MM UTC>` on PO trigger "переезжаем в новую Devin сессию".
**Type:** WARM (on-demand, includes texture / observations / open conversational threads).
**Handoff target:** Fresh Devin session in any account that can authenticate to `OpenClown-bot/openclown-assistant`.

This template is a strict superset of `handoff-cold-devin.md`. The first 6 sections are identical to the cold template (state-only) — copy them verbatim and fill them in. The added sections (§7–§10) capture the texture that makes a warm handoff distinct.

---

## 0. What you (new Devin) are looking at

(same as cold §0 — copy verbatim)

You are taking over the orchestrator role for `openclown-assistant`. Read every section here before acting. Your obligations: **teach**, **push back with evidence**, **protect docs-as-code**.

---

## 1. Self-check (run BEFORE asking the PO anything)

(same as cold §1 — copy verbatim. Items 1a–1d: secrets list, repo clone with PAT, validate-docs check, gh CLI install if needed.)

---

## 2. Required reading

(same as cold §2 — copy verbatim, including read order: README → CONTRIBUTING → AGENTS → docs/meta/devin-session-handoff.md → 4 prompt files → latest PRD → latest ArchSpec → open Tickets → recent reviews → this snapshot)

---

## 3. Project context (stable)

(same as cold §3 — copy the table verbatim)

---

## 4. Pipeline (stable)

(same as cold §4 — copy verbatim)

---

## 5. Roles and write-zones

(same as cold §5 — copy the table verbatim, including the Devin Orchestrator + Ticket Orchestrator rows)

---

## 6. Current state — `<YYYY-MM-DD>`

(same template as cold §6 — fill in artifact phase, open PRs, last action, next step, outstanding decisions, tooling assumptions)

---

## 7. Texture from this session ⚠ WARM-ONLY

This section captures what `cold-devin` deliberately omits: **how things felt** in the outgoing session, what the PO was emotionally invested in, what felt sticky, what the orchestrator had been quietly noticing but not yet surfacing. The new Devin should read this carefully — it is the most context-dense section per token.

### Sticky moments

`<bulleted: 3–7 moments where a decision felt heavier than its surface weight, or where the PO and orchestrator had to align before proceeding. Each bullet: 2–3 sentences.>`

### In-flight Ticket Orchestrator sessions

For each TKT currently delegated to a Ticket Orchestrator (TO opencode session on PO's Windows PC), capture the TO state at handoff time so the new Devin Orchestrator can resume the ratification audit when hand-back lands. Include: TKT id and pinned version, TO opencode session id (or workspace path), TKT-branch / RV-branch HEAD SHAs, latest iter number and most recent Reviewer verdict, whether the TO has hand-back-completed-and-Devin-bounced, and any open NUDGEs the previous Devin had drafted but not yet sent to the PO.

- `<TKT-NNN: TO state, latest hand-back status, open Devin actions>`

### Open conversational threads

`<bulleted: discussions started but not resolved — e.g. "PO mentioned wanting to revisit ADR-NNN's data-locality choice once the pilot has 2 weeks of data, but no Q-PO file yet" — these are NOT yet in the artifact graph but matter for continuity.>`

### Active priorities (PO's order, not ours)

1. `<priority 1, with the PO's stated motivation>`
2. `<priority 2>`
3. `<priority 3, often deferred>`

### Things the PO has said clearly

`<bulleted: direct PO quotes that capture preferences. Use original language (Russian / English / mixed) when it matters.>`

---

## 8. Observations about the PO ⚠ WARM-ONLY

These are the orchestrator's read on how the PO works best. They are **observations, not rules** — the new Devin should treat them as priors to update, not constants.

### Working style

- `<observation: e.g. "PO prefers Russian for high-trust direct discussion, English for formal artifacts and PR bodies. Switching language signals tone shift.">`
- `<observation>`

### Decision style

- `<observation: e.g. "PO accepts pushback when it cites artifacts; rejects pushback that cites only 'best practice'. Always quote the ADR / PRD / ticket line.">`

### Trust calibration

- `<observation: e.g. "PO trusts our analysis on process / git mechanics implicitly; explicitly verifies any LLM-routing or budget-related claim.">`

### Known frustrations

- `<observation: e.g. "PO is frustrated when Devin Review surfaces stale findings on resolved threads. Pre-empt by quoting commit SHAs in PR bodies that close findings.">`

---

## 9. What is intentionally not in the docs ⚠ WARM-ONLY

Things the outgoing orchestrator had decided to keep OUT of formal artifacts (and the reasoning). The new Devin should respect these decisions unless the PO says otherwise — they are usually deliberate, not oversights.

- `<item + reason: e.g. "Architect's recommendation to consolidate ADR-002 and ADR-003 was deferred per PO; rationale: minimise churn during MVP, revisit post-pilot.">`
- `<item + reason>`

---

## 10. Sanity-check protocol on arrival

The new Devin's **first reply** to the PO must include, in addition to the cold-template requirements (5-line summary + role-confirmation + proposed next action):

> A direct quote of one observation from §8 (Observations about the PO) AND one item from §9 (intentionally not in docs).

This proves the new Devin actually read the warm-only sections. If the new Devin gives only the cold-template reply, it has not earned the trust transfer; the PO should ask it to reread §7–§9 and try again.

---

## 11. After self-checks + required reading + texture absorbed

Reply to the PO with:

1. 5-line state summary (cold-template requirement)
2. Role-confirmation (cold-template requirement)
3. One concrete proposed next action with reasoning (cold-template requirement)
4. **One quoted observation from §8 + one item from §9** (warm-only requirement)
5. Wait for the PO to say "go" before executing.

---

## 12. If something contradicts

Same rule as cold: repo files win over snapshots. Snapshots are volatile; the repo is the bridge. Tell the PO what you found.
