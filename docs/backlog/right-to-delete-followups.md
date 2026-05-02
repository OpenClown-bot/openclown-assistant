---
id: BACKLOG-010
title: "Right-to-Delete + Tenant Audit follow-ups (post TKT-012) + fourth TO pilot structural lessons"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-02
---

# Right-to-Delete + Tenant Audit follow-ups + fourth TO pilot lessons

This file collects the deferred follow-ups from the TKT-012 closure (PR #84 + PR #85 + closure-PR) and one structural-resolution entry from the fourth end-to-end Ticket Orchestrator pilot. The first pilot (TKT-010) generated `BACKLOG-007` and `PR #71`; the second (TKT-011) generated `BACKLOG-008`; the third (TKT-013) generated `BACKLOG-009`; this fourth pilot generates `BACKLOG-010`.

The 3 entries below split into:
- **2× deferred-low carry-over** from the TKT-012 review on PR #84 final HEAD `24e0c42469b3d02217f614e9b15b0242863147aa` (one Kimi `F-L2`, one PR-Agent `F-PA-2`; both classified low-severity, deferred per Reviewer rationale because the real fix lies outside TKT-012@0.1.0 §5 outputs).
- **1× structural resolution** closing `BACKLOG-009 §agents-md-vs-llm-routing-md-runtime-mismatch` empirically through the TKT-012 dispatch (PO ran `opencode + Codex GPT-5.5 high` via OmniRoute successfully; AGENTS.md is canonical and `docs/knowledge/llm-routing.md` rows 40 + 42 are reconciled in this closure-PR with explicit PO authorisation recorded verbatim in the PR body).

## TKT-NEW-audit-db-url-repo-wide-lint

**Source:** Kimi RV-CODE-012 finding `F-L2` on PR #84 final HEAD `24e0c42` (`tests/privacy/tenantAudit.test.ts:78–92`, deferred); independent Devin Orchestrator ratification audit pass-2 confirmed the deferral rationale.

**The issue:** TKT-012@0.1.0 §6 AC 8 mandates that the audit runner refuses to start if `AUDIT_DB_URL` is unset AND that no application skill imports `AUDIT_DB_URL`. The shipped test `keeps AUDIT_DB_URL out of application skill source imports` enforces the second half by reading a hard-coded sample of six well-known application source files (`src/index.ts`, `src/telegram/router.ts`, etc.) and grepping each for the literal string `AUDIT_DB_URL`. This is correct as a smoke test but provides only sampled coverage — a future application skill author could introduce an `AUDIT_DB_URL` import in a not-yet-listed file and the test would not catch it. The current test does not violate the AC because the AC does not specify enforcement breadth, but the practical isolation guarantee weakens as `src/` grows.

**Proposed fix:** Replace the sampled-file scan with a repo-wide enforcement, in either of two equivalent forms:
1. **Repo-wide ESLint rule:** Add a `no-restricted-syntax` rule in `.eslintrc.js` (or whichever config is canonical) that flags any `process.env.AUDIT_DB_URL` reference in `src/**` outside the explicit `src/privacy/tenantAudit.ts` allow-list. Run as part of `npm run lint`.
2. **CI grep script:** Add `scripts/check-audit-db-url-isolation.sh` (or a Python/Node equivalent) to the `validate-docs` GitHub Actions workflow (or a new check) that does `git grep -l 'AUDIT_DB_URL' src/` and asserts the only match is `src/privacy/tenantAudit.ts`. Faster to implement than the ESLint rule.

Either form must be paired with: (a) updating the existing unit test to assert "the lint rule / script exists and would fail on a synthetic `src/index.ts` import of `AUDIT_DB_URL`", and (b) cross-link in `tests/privacy/tenantAudit.test.ts` so future maintainers find the breadth-enforcement pointer.

**Severity:** Low (test-quality / coverage; no AC violation in current state). Defer to a future hygiene-pass ticket; can be batched with other repo-wide lint hardening tickets if a lint-rule omnibus emerges.

**ArchSpec dependency:** `ARCH-001@0.4.0 §3.11 C11 Right-to-Delete and Tenant Audit Service` is unchanged; this ticket only hardens the AC enforcement breadth.

## TKT-NEW-right-to-delete-concurrency-test-barrier

**Source:** PR-Agent persistent review item (`F-PA-2 Flaky Concurrency Test`) on PR #84 final HEAD `24e0c42`; promoted into Kimi RV-CODE-012 iter-3 verification (Section "Iter-3 PR-Agent Finding Verification → F-PA-2"), classified `REAL, LOW, accepted for pilot scope`.

**The issue:** The TKT-012 unit test `serializes concurrent delete and meal confirmation on user_id lock` (`tests/privacy/rightToDelete.test.ts:200–207`) uses a `waitForCall` helper that polls a mock-call counter via a 10-iteration `await Promise.resolve()` microtask loop. Under extreme CPU pressure (e.g. a heavily contended CI runner), 10 microtask turns may not suffice for the mock `confirmMeal` promise to resolve before the polling loop exhausts, producing a non-deterministic test failure. The concern is technically valid but does not undermine the AC proof because: (a) Vitest runs tests sequentially by default so cross-test contention is minimal; (b) `MemoryDeletionRepository` is fully in-memory with no I/O; (c) the real concurrency guarantee is provided by PostgreSQL `pg_advisory_xact_lock`, not this unit test, which only verifies service-level call ordering.

**Proposed fix:** Replace the microtask polling loop with a deterministic synchronization mechanism — either:
1. **Fake-timer barrier:** `vi.useFakeTimers()` + explicit `vi.runAllTimersAsync()` to flush mock-call resolution.
2. **Promise-based barrier:** Add an explicit `releaseConfirmMeal: () => void` hook on the mock `MemoryDeletionRepository` so the test code can deterministically release the held promise after asserting the lock-holder ordering (the holder is on `lockUserForDeletion`).

Either form makes the test deterministic without changing the production locking mechanism. Pair the change with a CI-rerun assertion (3 back-to-back runs all pass) to verify the flake is gone.

**Severity:** Low (test-quality / determinism; production correctness unaffected because real serialization is database-native). Defer to a future hygiene-pass ticket; can be batched with `TKT-NEW-audit-db-url-repo-wide-lint` since both touch privacy-area test files.

**ArchSpec dependency:** `ARCH-001@0.4.0 §9.2 Access Control and Tenant Isolation` is unchanged; this ticket only hardens the unit-test determinism without changing the production lock contract.

## TKT-NEW-runtime-mismatch-empirically-resolved-codex-via-omniroute

**Source:** Empirical resolution of `BACKLOG-009 §TKT-NEW-agents-md-vs-llm-routing-md-runtime-mismatch` (Low/clerical, opened 2026-05-02 in PR #83 during 4th-pilot preparation) through TKT-012 dispatch. PO ran `opencode + Codex GPT-5.5 high` via OmniRoute successfully on the PO's Windows PC; Executor PR #84 body records observed runtime as `cx/gpt-5.5-high / omniroute/cx/gpt-5.5-high`.

**The issue (resolved):** `AGENTS.md` row "Code Executor" listed runtime as `opencode + OmniRoute` for ALL three Executor model variants (GLM 5.1 / Qwen 3.6 Plus / Codex GPT-5.5). `docs/knowledge/llm-routing.md` row "Executor (specialist) Codex GPT-5.5 / Codex CLI" disagreed, listing Codex CLI as the runtime. The contradiction was triaged before TKT-012 dispatch and the resolution path was: PO empirically tries `opencode + Codex GPT-5.5 high`; if reachable through OmniRoute, AGENTS.md wins and llm-routing.md is updated; if not reachable, AGENTS.md is updated to split runtime per-model. The TKT-012 dispatch confirmed `opencode + Codex GPT-5.5 high → OmniRoute → OpenAI` is reachable and works end-to-end (full TKT cycle: Executor iter-1 → Kimi iter-1 → Executor iter-2 → Kimi iter-2 → Kimi iter-3 → pass — 2 Executor + 3 Reviewer iterations completed without runtime issues).

**Resolution applied in this closure-PR (with explicit PO authorisation recorded verbatim in PR body):**
- `docs/knowledge/llm-routing.md` row 40 (Executor specialist): `Codex GPT-5.5 | Codex CLI` → `Codex GPT-5.5 | opencode + OmniRoute → Fireworks (OpenAI route, empirically verified TKT-012@0.1.0 2026-05-02)`. The runtime cell is brought into alignment with AGENTS.md.
- `docs/knowledge/llm-routing.md` row 42 (Reviewer auto, also stale): `Devin Review | GitHub bot` → `Qodo PR-Agent (Qwen 3.6 Plus) | GitHub Actions via OmniRoute` to reflect AGENTS.md 2026-04-30 deprecation note ("Devin Review was the prior supplementary reviewer; deprecated 2026-04-30 due to ACU exhaustion") and the actual `.pr_agent.toml` configuration.

Both edits land in this closure-PR (BACKLOG-010) under the explicit PO authorisation `"Yes, include in #86 with explicit auth recorded verbatim in PR body"` (PO chat 2026-05-02). `docs/knowledge/` is outside the standard Devin Orchestrator write-zone per CONTRIBUTING.md row 17 + 23; this clerical edit is therefore explicitly authorised in the closure-PR body per the row-23 protocol.

**Severity:** Low (clerical reconciliation; resolves an open BACKLOG-009 entry).

**ArchSpec dependency:** None directly. `ADR-002@0.1.0 OmniRoute-First LLM Routing` governs the routing layer; the TKT-012 empirical run confirms OmniRoute reaches OpenAI Codex GPT-5.5 via opencode, supporting the existing ADR without amendment.

**Status:** RESOLVED in this closure-PR — entry retained in BACKLOG-010 for audit-trail completeness only; no further action required.
