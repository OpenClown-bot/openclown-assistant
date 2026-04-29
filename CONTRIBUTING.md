# Contributing — Process Rules

This file defines **how humans and LLMs collaborate** in this repo. These are not suggestions. CI enforces the machine-checkable parts; Reviewers (Kimi + Devin Review) enforce the rest. The Product Owner is the final authority.

## Roles and write zones

| Role | Model(s) | Runtime | MAY write | MUST NOT write |
|---|---|---|---|---|
| Product Owner (human) | — | — | Anything (final authority) | — |
| Business Planner (primary) | GPT-5.5 thinking | ChatGPT Plus (web) | `docs/prd/` | `docs/architecture/`, `docs/tickets/`, `src/`, anything else |
| Business Planner (alternative) | Claude Opus 4.7 thinking | Devin | Same as primary | Same as primary |
| Technical Architect (primary) | GPT-5.5 xhigh | Codex CLI (on VPS or laptop) | `docs/architecture/`, `docs/tickets/` | `docs/prd/`, `src/`, `tests/`, `infra/`, repo root |
| Technical Architect (alternative) | GPT-5.5 thinking | opencode CLI (verify thinking-mode is supported by the runtime) | Same as primary | Same as primary |
| Technical Architect (backup) | Opus 4.6 thinking | Windsurf | Same as primary | Same as primary |
| Reviewer (LLM) | Kimi K2.6 | opencode + OmniRoute | `docs/reviews/` | Everything else, **NEVER `status: approved`** (PO sets that based on Reviewer verdict) |
| Reviewer (auto bot) | Devin Review | GitHub bot | inline PR comments only | Files in repo |
| Orchestrator (PO assistant) | Devin (webapp) | Devin session | `docs/session-log/`, `docs/backlog/` (light edits / new entries), ticket frontmatter promotions (`status`, `arch_ref`, `version`, `updated`) + light reference-pinning in ticket body during promotion | `src/`, `tests/`, formal artifact bodies (PRD/ARCH/ADR/RV), substantive ticket body edits beyond reference-pinning, `docs/prompts/` |
| Code Executor (default) | GLM 5.1 | opencode + OmniRoute | `src/`, `tests/`, append-only to `docs/tickets/<id>.md#10 Execution Log`, the assigned Ticket file's `status` frontmatter field only (transitions `ready → in_progress`, `in_progress → in_review`, `in_progress → blocked`, `blocked → in_progress`), create files in `docs/questions/` | `docs/prd/`, `docs/architecture/`, any other field on the Ticket file (Goal, ACs, Outputs, etc.), anything outside the assigned ticket's §5 Outputs |
| Code Executor (parallel) | Qwen 3.6 Plus | opencode + OmniRoute | Same as default | Same as default |
| Code Executor (specialist) | Codex GPT-5.5 | Codex CLI | Same as default | Same as default |

The **Orchestrator** row formalises the Devin-on-PO's-account session that coordinates the four pipeline roles. It is a PO-delegated coordination role, not a pipeline role; it does not appear in the PRD → ArchSpec → Code → Review chain. See `docs/meta/devin-session-handoff.md` for the full role prompt and `docs/session-log/README.md` for handoff continuity rules. Orchestrator edits to files outside its declared write-zone (e.g. `CONTRIBUTING.md` itself, `docs/prompts/`, formal artifact bodies) require **explicit PO authorisation recorded verbatim in the PR body**.

## Hard rules

1. **Never skip upstream.** No Ticket without an approved ArchSpec. No ArchSpec without an approved PRD.
2. **Version-pinned references only.** Inside any artifact, reference upstream docs as `ID@X.Y.Z` (e.g. `PRD-001@1.0.0`). Bare `PRD-001` outside code fences is rejected by CI.
3. **Status gates.**
   - `draft` — anyone in role may edit.
   - `in_review` — only Reviewer adds comments via a separate `docs/reviews/RV-*.md`.
   - `approved` — immutable. Any change ⇒ bump version and create a new revision file (or `superseded_by` link).
   - `superseded` — read-only; `superseded_by` must point to the replacement.
4. **Non-Goals / NOT In Scope are mandatory.** PRDs list ≥1 Non-Goal. Tickets list ≥1 NOT-In-Scope item. Reviewers reject any artifact without them.
5. **Architect Phase 0: Recon is mandatory.** Before any design, the Architect MUST read `docs/knowledge/openclaw.md` and `docs/knowledge/awesome-skills.md`, audit fork-candidates, and write a Recon Report into ArchSpec §0. ArchSpec without a Recon Report fails Reviewer SPEC mode automatically.
6. **Executor guardrails.**
   - Executor may modify ONLY files explicitly listed in the Ticket's §5 Outputs, with one carve-out: the assigned Ticket file's `status` frontmatter field (transitions `ready → in_progress`, `in_progress → in_review`, `in_progress → blocked`, `blocked → in_progress` — these four only) and append-only edits to that file's §10 Execution Log. All other fields on the Ticket file (Goal, ACs, Outputs, etc.) remain read-only to the Executor.
   - If a Ticket is ambiguous or contradicts the ArchSpec, Executor MUST stop and create `docs/questions/Q-TKT-XXX-NN.md` before writing code.
   - Executor may NOT add new runtime dependencies unless the Ticket §7 Constraints explicitly allows them.
7. **Reviewer independence.** Reviewer must be a different model family from the artifact's author (Business Planner for PRD reviews, Architect for ArchSpec reviews, Executor for code reviews). A GPT-written PRD or ArchSpec must not be reviewed by GPT (use Kimi K2.6).
8. **No secrets in git.** Ever. Use `.env.example` and document in ArchSpec §9 Security. CI does NOT scan secrets — review responsibility falls on Reviewer.
9. **No direct push to `main`.** All changes via PR. PRs require: docs CI green, Reviewer LLM verdict `pass` or `pass_with_changes`, Devin Review verdict, PO approval.

## Handoff contracts

Each artifact ends with a "Handoff Checklist". CI validates the frontmatter; the Reviewer validates the checklist by reading the artifact.

| From → To | What goes across | Gate |
|---|---|---|
| PO → Business Planner | This-epic ask, in chat | — |
| Business Planner → Reviewer (SPEC for PRD) | One PRD, status `in_review` | Business Planner runs `validate_docs.py` |
| Reviewer (SPEC for PRD) → PO | One review file, verdict | — |
| PO → Architect | One PRD, status `approved` | PO sets status after Reviewer verdict |
| Architect → Reviewer (SPEC for ArchSpec) | ArchSpec + ADRs + Tickets, status `in_review` | Architect runs `validate_docs.py` |
| Reviewer (SPEC for ArchSpec) → PO | One review file, verdict | — |
| PO → Executor | One Ticket, status `ready`, `assigned_executor` set | PO promotes status |
| Executor → Reviewer (CODE) | One PR, Ticket status `in_review` | CI green + Executor self-review |
| Reviewer (CODE) → PO | One review file, verdict | — |
| PO | Merge | — |

## Change requests

If PO wants to change an already-`approved` PRD:

1. Bump PRD version (e.g. `1.0.0 → 1.1.0`).
2. Open a PR that modifies the PRD (or supersedes it with a new file).
3. Architect annotates which ArchSpec sections are impacted (in a comment or via `Q_TO_BUSINESS`).
4. Affected ArchSpec is bumped, re-reviewed, affected Tickets are re-opened or split.

**No "small tweak" propagates silently to code.** Every change walks the pipeline.

## Parallelism

- Tickets may be executed in parallel **only if** `depends_on` is empty or all listed dependencies are `done`.
- The default Executor (GLM) and the parallel Executor (Qwen) must never work on the same Ticket.
- The specialist Executor (Codex) is assigned by the Architect per-Ticket, not opportunistically.

## LLM hygiene

- Every LLM session starts with a **fresh context**. Paste the role's prompt (from `docs/prompts/`) first, then the artifact to work on, then the question.
- Never dump the entire repo into context — only what the artifact's §4 Inputs (or equivalent) explicitly references.
- If an LLM produces output outside its role (Architect writing code, Executor redesigning the queue) → reject without merge. Model drift is real.
- Per-role context budget: see `docs/knowledge/llm-routing.md` for token windows of each model.
