---
id: RV-CODE-011
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/75"
ticket_ref: TKT-011@0.1.0
status: approved
reviewer_model: "kimi-k2.6"
created: 2026-05-02
updated: 2026-05-02
approved_at: 2026-05-02
approved_after_iters: 2
approved_by: "yourmomsenpai (PO)"
approved_note: "RV-CODE-011 reached verdict pass on iter-2 (Executor commit f195017, Reviewer Kimi K2.6 on the same opencode session). Second Ticket Orchestrator (TO) pilot review cycle, end-to-end. Iter-1 verdict was pass_with_changes blocked on F-M1 (computePeriodBounds accepted timezone but ignored it, computing weekly/monthly boundaries with UTC Date methods on a local-time string \u2014 violates ARCH-001@0.4.0 \u00a74.6 / TKT-011 \u00a72 user-timezone-aware local period boundaries) + F-L1 (DETERMINISTIC_FALLBACK_RU exported but never imported) + F-L2 (blocked-recommendation test asserted logger.warn called but did not assert the specific KPI event name summary_recommendation_blocked, weakening test integrity). Iter-2 (Executor commit f195017) RESOLVED F-M1 by rewriting computePeriodBounds with pure calendar math (parseLocalDate, dayOfWeekUtc, normalizeDate, daysInMonth, isLeapYear) instead of host-timezone-dependent new Date(referenceDate + 'T00:00:00') construction; timezone parameter now validated via validateTimezone at entry; weekly/monthly boundaries computed deterministically from parsed calendar date; new tests cover validateTimezone acceptance/rejection and leap-year February. RESOLVED F-L1 by removing dead DETERMINISTIC_FALLBACK_RU export from src/summary/messages.ts. RESOLVED F-L2 by asserting the specific KPI event name via expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining('summary_recommendation_blocked'), expect.anything()). Reviewer iter-2 verdict pass on the same opencode session per the iter-N continuation rule (PR #71). Iter-3..iter-8 (Executor commits 31062e4, ee5ef88, 55b56e8c, 9f456e41, 11ee175d, 4e3e818) were Executor responses to PR-Agent inline findings (NFKC normalization, zero-width stripping, persona <persona> delimiters, homoglyph normalization, persona cache path, persona-text escape against </persona> breakout) plus one Devin Review correctness fix on iter-7 (actual month-length targets + delta JSON aligned to KBJUValues keys). Reviewer (Kimi K2.6) was not formally re-engaged on iter-3..iter-8; this is a procedural gap covered substantively by PR-Agent persistent review + Devin Review (both verdict no-major-issues / no-security-concerns) and captured as a structural lesson in BACKLOG-008 \u00a7TKT-NEW-reviewer-reengagement-after-substantive-pushes. PR-Agent supplementary review on PR #75 final HEAD 4e3e818: \u26a1no major issues detected, \ud83d\udd12no security concerns, \ud83d\udd00no PR themes; 2 informational findings (F-PA-1 Misleading Error Context @ summaryScheduler.ts:286 + F-PA-2 Synchronous File Read in Async Flow @ personaLoader.ts:12) deferred to BACKLOG-008 as TKT-NEW entries. PR-Agent workflow run 25240991302 was formally stuck IN_PROGRESS on the final HEAD (after a prior CANCELLED run after 9 min); Devin Orchestrator treated as CI infrastructure tail-latency per session-4 \u00a76.6 OmniRoute outlier precedent (2 of 2 final-HEAD runs across 2 TO pilots show pattern, captured as BACKLOG-008 \u00a7TKT-NEW-pr-agent-tail-latency). Cross-reviewer audit pass-1 (Ticket Orchestrator, GPT-5.5 thinking on opencode): Reviewer iter-2 verdict pass valid; PR-Agent persistent review on final HEAD non-blocking; closure-ready hand-back to Devin Orchestrator with PR-Agent CI status flagged as strategic blocker per docs/prompts/ticket-orchestrator.md \u00a7 PR-Agent settle-on-final-HEAD requirement. Cross-reviewer audit pass-2 (Devin Orchestrator ratification per docs/meta/devin-session-handoff.md \u00a711.4): independent re-classification confirmed all RESOLVED + iter-3..8 changes covered by PR-Agent + Devin Review (procedural anomaly captured as BACKLOG-008 lesson, not substance blocker); PR-Agent stuck CI ruled infra failure under DO authority; merge-safe sign-off issued. PR #75 + PR #76 squash-merged to main 2026-05-02 by PO. Frontmatter assigned_executor on TKT-011 was qwen-3.6-plus per original ticket; actual run was glm-5.1 (PO-confirmed: deviation between TKT-011 frontmatter and PO-launched opencode session); frontmatter bumped post-hoc to glm-5.1 in this closure-PR; structural lesson captured as BACKLOG-008 \u00a7TKT-NEW-launcher-asserts-frontmatter-executor. RV file was incorrectly created as RV-CODE-016 by Reviewer at iter-1 (next-sequential instead of TKT-aligned RV-CODE-011); renamed in this closure-PR per TKT-N\u2194RV-CODE-N convention. This cycle was the second end-to-end TO pilot (after TKT-010 closed merge-safe 2026-05-01) and produced 4 structural lessons (BACKLOG-008): launcher must fail-closed on assigned_executor mismatch, Reviewer must be re-engaged when Executor pushes substantive code post-pass, PR-Agent CI tail-latency is a recurring pattern needing investigation, and Reviewer must follow TKT-N\u2194RV-CODE-N file numbering convention."
---

# Code Review — PR #75 (TKT-011@0.1.0)

## Summary
PR #75 delivers the C9 Summary Recommendation Scheduler with guarded recommendations, deterministic fallbacks, and idempotency. All 70 targeted tests pass, lint/typecheck/validator are green, and all core acceptance criteria are satisfied. Iter-1 findings F-M1 (timezone-aware period boundaries), F-L1 (dead code), and F-L2 (test assertion specificity) were all resolved in iter-2 (Executor commit `f195017`).

## Verdict
- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: All acceptance criteria are met, iter-1 findings are resolved, tests/lint/typecheck/validator are green, and no new regressions were introduced.
Recommendation to PO: `approve & merge`.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT-011@0.1.0 §5 Outputs
  - In-scope: `src/summary/*.ts`, `tests/summary/*.test.ts`
  - Ticket change: `status: ready → in_review` + append-only §10 Execution Log. No body/frontmatter edits.
- [x] No changes to TKT-011@0.1.0 §3 NOT-In-Scope items
  - No onboarding schedules, no meal edit/delete, no right-to-delete hard deletion.
- [x] No new runtime dependencies beyond TKT-011@0.1.0 §7 Constraints allowlist
  - `package.json` unchanged; no new `dependencies` entries.
- [x] All Acceptance Criteria from TKT-011@0.1.0 §6 are verifiably satisfied (file:line or test name cited)
  - AC #1 (`npm test ... passes`): 70 tests, 0 failures.
  - AC #2 (`npm run lint` passes): `tsc --noEmit` clean.
  - AC #3 (`npm run typecheck` passes): `tsc --noEmit` clean.
  - AC #4 (duplicate cron idempotency): `summaryScheduler.test.ts:255` — `"duplicate cron events produce one summary_records row per idempotency key"` asserts `mockLlm` once + second call `skipped: true`.
  - AC #5 (zero-meal nudge without LLM): `summaryScheduler.test.ts:293` — `"zero-meal periods send deterministic Russian nudge without LLM call"` asserts `mockLlm` not called + mode `"no_meal_nudge"` + text contains `"нет подтверждённых приёмов пищи"`.
  - AC #6 (forbidden-term coverage): `recommendationGuard.test.ts:100` — 16 Russian cases + `recommendationGuard.test.ts:127` — 16 English cases covering all required categories.
  - AC #7 (blocked fallback + event): `summaryScheduler.test.ts:371` — `"blocked recommendation sends deterministic numeric KBJU fallback and emits summary_recommendation_blocked"` asserts mode `"deterministic_fallback"`, `blockedReason` contains `"forbidden_topic_ru"`, text contains `"ккал"`, and `logger.warn` is called with a string containing `"summary_recommendation_blocked"`.
  - AC #8 (missing `PERSONA_PATH` fail-closed): `personaLoader.test.ts:45` — `"throws and logs critical when PERSONA_PATH is missing"`.
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
*None.*

### Medium
*None.*

### Low
*None.*

## Iter-1 findings resolved in iter-2

- **F-M1 (resolved)**: `computePeriodBounds` was rewritten to use pure calendar math (`parseLocalDate`, `dayOfWeekUtc`, `normalizeDate`, `daysInMonth`, `isLeapYear`) instead of `new Date(referenceDate + "T00:00:00")` host-timezone-dependent construction. The `timezone` parameter is now validated via `validateTimezone` at entry. Weekly/monthly boundaries are computed deterministically from the parsed calendar date, eliminating runtime-timezone drift. New tests cover `validateTimezone` acceptance/rejection and leap-year February.
  - *Verified*: `src/summary/summaryScheduler.ts` lines 37–120; `tests/summary/summaryScheduler.test.ts` lines 99–177.

- **F-L1 (resolved)**: Dead export `DETERMINISTIC_FALLBACK_RU` removed from `src/summary/messages.ts`.
  - *Verified*: file now contains only the used `NO_MEAL_NUDGE_RU` export.

- **F-L2 (resolved)**: Blocked-recommendation test now asserts the specific KPI event name via `expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringContaining("summary_recommendation_blocked"), expect.anything())`.
  - *Verified*: `tests/summary/summaryScheduler.test.ts` lines 396–399.

## Red-team probes (Reviewer must address each)
- **Error paths — DB lock / LLM timeout / transport failure?**
  - LLM timeout/transport failure: `summaryScheduler.ts` catches any exception from `doLlmCall` and returns deterministic fallback with `blockedReason: "llm_call_failed"`.
  - LLM non-success outcome: `summaryScheduler.ts` checks `llmResult.outcome !== "success"` and returns deterministic fallback.
  - DB-level conflict: `tenantStore.ts:682` uses `ON CONFLICT (user_id, idempotency_key) DO UPDATE`, ensuring exactly one durable row per idempotency key even under concurrent writes.
  - No Telegram / OpenFoodFacts / Whisper calls in this PR.

- **Concurrency — can two cron workers process the same schedule simultaneously?**
  - Yes. Both workers could see `lastDuePeriodStart === null` and proceed to call the LLM. The DB upsert guarantees single-row persistence, but there is no distributed lock preventing a double LLM spend. This is an acceptable cost/ops trade-off for the current ticket scope.

- **Input validation — malformed JSON / huge text / unicode edge cases?**
  - `validateRecommendationOutput` (`recommendationGuard.ts:79`) defensively parses JSON, validates the result is an object, checks `recommendation_ru` is a non-empty string, then scans for forbidden stems. Malformed or huge output is rejected safely.
  - No external user strings reach the LLM prompt unsanitised.

- **Prompt injection — does any external string reach an LLM unsanitised?**
  - No. `buildRecommendationPrompt` (`recommendationGuard.ts:46`) injects only numeric aggregates, targets, deltas, period label, and the static persona. No raw meal text or user-generated content enters the prompt. This satisfies ARCH-001@0.4.0 §9.4 and ADR-006@0.1.0.

- **Secrets — any credential committed, logged, or leaked through error paths?**
  - No new credentials introduced. `personaPath` is a filesystem path string logged at info/critical level; it is not a secret. `omniRouteConfig` is injected and not logged by C9 code.

## AC traceability matrix

| AC # | Test file | Test name | Result |
|---|---|---|---|
| 4 | `summaryScheduler.test.ts` | `"duplicate cron events produce one summary_records row per idempotency key"` | `mockLlm` ×1, second run `skipped: true` |
| 5 | `summaryScheduler.test.ts` | `"zero-meal periods send deterministic Russian nudge without LLM call"` | `mockLlm` ×0, mode `"no_meal_nudge"` |
| 6 | `recommendationGuard.test.ts` | `it.each(forbiddenRuCases)` + `it.each(forbiddenEnCases)` | 16 RU + 16 EN stems blocked |
| 7 | `summaryScheduler.test.ts` | `"blocked recommendation sends deterministic numeric KBJU fallback and emits summary_recommendation_blocked"` | Fallback contains `"ккал"`, mode `"deterministic_fallback"`, `logger.warn` called with `"summary_recommendation_blocked"` |
| 8 | `personaLoader.test.ts` | `"throws and logs critical when PERSONA_PATH is missing"` | Throws `"C9 startup failed..."` |
