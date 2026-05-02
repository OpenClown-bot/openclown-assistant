---
id: RV-CODE-016
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/75"
ticket_ref: TKT-011@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-02
---

# Code Review — PR #75 (TKT-011)

## Summary
PR #75 delivers the C9 Summary Recommendation Scheduler with guarded recommendations, deterministic fallbacks, and idempotency. All 61 targeted tests pass, lint/typecheck/validator are green, and the core acceptance criteria are satisfied. Two minor issues remain: `computePeriodBounds` accepts a `timezone` parameter but ignores it, and one unused message export adds dead code.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: Core functionality and safety guardrails are correct and tested, but `computePeriodBounds` ignores its `timezone` argument (violating ArchSpec §4.6 / TKT-011 §2 timezone-aware boundaries) and one unused export adds dead code.
Recommendation to PO: `approve & merge with noted changes` — the medium finding should be patched in a follow-up commit (use `timezone` in `computePeriodBounds` or document the UTC-runtime invariant) and the dead code removed.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
  - In-scope: `src/summary/*.ts`, `tests/summary/*.test.ts`
  - Ticket change: `status: ready → in_review` + append-only §10 Execution Log. No body/frontmatter edits.
- [x] No changes to TKT §3 NOT-In-Scope items
  - No onboarding schedules, no meal edit/delete, no right-to-delete hard deletion.
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
  - `package.json` unchanged; no new `dependencies` entries.
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
  - AC #1 (`npm test ... passes`): 61 tests, 0 failures.
  - AC #2 (`npm run lint` passes): `tsc --noEmit` clean.
  - AC #3 (`npm run typecheck` passes): `tsc --noEmit` clean.
  - AC #4 (duplicate cron idempotency): `summaryScheduler.test.ts:255` — `"duplicate cron events produce one summary_records row per idempotency key"` asserts `mockLlm` once + second call `skipped: true`.
  - AC #5 (zero-meal nudge without LLM): `summaryScheduler.test.ts:293` — `"zero-meal periods send deterministic Russian nudge without LLM call"` asserts `mockLlm` not called + mode `"no_meal_nudge"` + text contains `"нет подтверждённых приёмов пищи"`.
  - AC #6 (forbidden-term coverage): `recommendationGuard.test.ts:100` — 16 Russian cases + `recommendationGuard.test.ts:127` — 16 English cases covering all required categories.
  - AC #7 (blocked fallback + event): `summaryScheduler.test.ts:310` — `"blocked recommendation sends deterministic numeric KBJU fallback and emits summary_recommendation_blocked"` asserts mode `"deterministic_fallback"`, `blockedReason` contains `"forbidden_topic_ru"`, text contains `"ккал"`, `logger.warn` called. Note: test does not assert the specific KPI event name (see F-L2).
  - AC #8 (missing `PERSONA_PATH` fail-closed): `personaLoader.test.ts:45` — `"throws and logs critical when PERSONA_PATH is missing"`.
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
*None.*

### Medium
- **F-M1 (`src/summary/summaryScheduler.ts:35-68`)**: `computePeriodBounds` accepts a `timezone: string` parameter but never uses it. Weekly boundaries are computed with `getUTCDay()` / `setUTCDate()` and monthly boundaries with `getUTCFullYear()` / `getUTCMonth()` on a `Date` constructed from `referenceDate + "T00:00:00"` (local-time interpretation). This yields correct Monday/Sunday and month boundaries only when the runtime timezone is UTC. If the container timezone drifts, or if `referenceDate` crosses a date boundary in the user’s timezone, the computed boundaries will be off by one day. ArchSpec §4.6 and TKT-011 §2 explicitly require user-timezone-aware local period boundaries.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Either (a) use `timezone` to construct an unambiguous UTC Date (e.g. `new Date(referenceDate + "T00:00:00" + timezoneOffset)`) and document the invariant, or (b) remove the unused parameter and add a runtime assert that `process.env.TZ === "UTC"`.

### Low
- **F-L1 (`src/summary/messages.ts:3`)**: `export const DETERMINISTIC_FALLBACK_RU` is never imported or used. `summaryScheduler.ts` calls `buildDeterministicFallback` from `recommendationGuard.ts` instead, which generates a different numeric fallback message. Remove the dead export.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Delete the unused export.

- **F-L2 (`tests/summary/summaryScheduler.test.ts:337`)**: The blocked-recommendation test asserts `deps.logger.warn` was called but does not assert the specific KPI event name `summary_recommendation_blocked`. A future refactor could move the emission to a different log level or helper without breaking this test, silently losing the AC coverage for the named event.
  - *Responsible role:* Executor.
  - *Suggested remediation:* Add an assertion such as `expect(deps.logger.warn).toHaveBeenCalledWith("summary_recommendation_blocked", expect.anything())` or verify the emitted event object contains `event_name: "summary_recommendation_blocked"`.

## Red-team probes (Reviewer must address each)
- **Error paths — DB lock / LLM timeout / transport failure?**
  - LLM timeout/transport failure: `summaryScheduler.ts:244` catches any exception from `doLlmCall` and returns deterministic fallback with `blockedReason: "llm_call_failed"`.
  - LLM non-success outcome: `summaryScheduler.ts:262` checks `llmResult.outcome !== "success"` and returns deterministic fallback.
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
| 7 | `summaryScheduler.test.ts` | `"blocked recommendation sends deterministic numeric KBJU fallback and emits summary_recommendation_blocked"` | Fallback contains `"ккал"`, mode `"deterministic_fallback"`, `logger.warn` called |
| 8 | `personaLoader.test.ts` | `"throws and logs critical when PERSONA_PATH is missing"` | Throws `"C9 startup failed..."` |
