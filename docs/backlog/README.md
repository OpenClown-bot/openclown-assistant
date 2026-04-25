# Backlog

Where deferred work lives. Anything explicitly out of MVP scope but worth remembering.

## Rules

- Backlog items are **not** Tickets. They are unscoped, unestimated, sometimes vague.
- Format: free-form Markdown grouped by theme (e.g. `voice.md`, `multi-tenancy.md`).
- A Backlog item is promoted to a Ticket only after:
  1. A new PRD revision lifts the relevant Non-Goal, OR
  2. The Architect produces an ArchSpec section that covers it.
- Reviewer does not gate Backlog files — they are reference material.

## Examples of v0.1 → backlog

- Local `faster-whisper` (replaces OpenAI Whisper API in v0.2).
- Calendar / task planner / study tracker (each its own future PRD).
- Multi-tenant deployment (container-per-customer, see `multi-tenancy.md` once written).
- Web scraping ("buy train ticket" / "watch this site").
