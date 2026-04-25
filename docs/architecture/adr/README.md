# Architecture Decision Records (ADRs)

Owner: **Technical Architect**.

## Rules

- One ADR per non-obvious tech choice (language, storage, queue, framework, third-party API).
- Filename: `ADR-NNN-<kebab-slug>.md`.
- Scaffold: `python scripts/new_artifact.py adr "Title"`.
- ADR MUST evaluate **≥3 real options** with concrete trade-offs (latency, cost, ops burden, learning curve).
- Cite empirical claims (rate limits, benchmark numbers, library behaviour).
- "Strawman + 1 option" is rejected by Reviewer.

## Lifecycle

`proposed` → `accepted` (after Reviewer SPEC pass + PO ack) → `superseded` (link to the new ADR).
Never delete an `accepted` ADR. New trade-off ⇒ write a new ADR that supersedes the old one.
