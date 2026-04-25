# Tickets (TKT)

Owner: **Technical Architect** (creates) + **Code Executor** (executes).

## Rules

- A Ticket is **atomic**: one concern, one-sentence Goal, no "and".
- Filename: `TKT-NNN-<kebab-slug>.md`.
- Scaffold: `python scripts/new_artifact.py ticket "Title"`.
- A Ticket without ≥1 NOT-In-Scope item is rejected.
- A Ticket without machine-checkable Acceptance Criteria is rejected.
- The Architect sets `assigned_executor` deliberately:
  - `glm-5.1` — default (≈70% of tickets).
  - `qwen-3.6-plus` — independent + parallelisable tickets.
  - `codex-gpt-5.5` — security-critical, algorithmically dense, or typing-heavy tickets only. Justify in §7 Constraints.
- Executor MUST NOT touch files outside §5 Outputs. Reviewer rejects scope violations as high-severity.

## Lifecycle

`draft` → `ready` (Architect promotes after self-review) → `in_progress` (Executor claims) → `in_review` (Executor opens PR) → `done` (PO merges) | `blocked` (Executor stuck, see `docs/questions/`).
