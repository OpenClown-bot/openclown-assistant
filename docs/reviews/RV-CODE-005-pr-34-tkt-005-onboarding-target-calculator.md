---
id: RV-CODE-005
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/34"
ticket_ref: TKT-005@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-04-29
---

# Code Review — PR #34 (TKT-005@0.1.0)

## Summary
PR #34 implements the C2 onboarding state machine and Mifflin-St Jeor target calculator with Russian prompts. All 7 ACs from TKT-005@0.1.0 are covered by tests (218 green), lint/typecheck pass, and scope is compliant. Two medium contract gaps (ArchSpec resume behavior and English sex input rejection) and one high-severity atomicity bug in the completion transaction are present.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: The implementation correctly satisfies all explicit ACs and ADR-005@0.2.0 formula contracts, but a nested transaction breaks atomicity of onboarding completion (high), and two medium defects (resume behavior and English sex rejection) violate ArchSpec contracts.
Recommendation to PO: approve & merge after Executor fixes F-H1; F-M1 and F-M2 may be patched in this PR or deferred to the follow-up TKT the Executor already identified.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
- [x] No changes to TKT §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited)
- [x] CI green (lint, typecheck, tests, coverage)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)
- **F-H1 (src/onboarding/onboardingFlow.ts:382):** `persistOnboardingCompletion` calls `store.upsertOnboardingState` **inside** a `store.withTransaction` callback. `TenantStore.upsertOnboardingState` acquires a new DB client and starts a second, nested transaction, breaking atomicity of profile/target/schedule/onboarding-state creation. If the second transaction fails, the user has orphaned profile/target rows with no matching onboarding state. — *Responsible role:* Executor. *Suggested remediation:* Replace `store.upsertOnboardingState` with `repo.upsertOnboardingState` (the `TenantScopedRepository` already exposes this method) inside the same callback so all writes share one transaction.

### Medium
- **F-M1 (src/onboarding/onboardingFlow.ts:179):** `getOrCreateOnboardingState` always calls `store.upsertOnboardingState` without `id`, generating a new `onboarding_states` row with `currentStep: "sex"` and empty answers on every `/start`. This violates ARCH-001@0.3.1 §3.2: "duplicate /start during onboarding resumes the current step instead of creating a second profile". The real PostgreSQL store will orphan previous rows; the test mock hides this by updating a single in-memory object. — *Responsible role:* Executor / Architect. *Suggested remediation:* Use `repo.getLatestOnboardingState(userId)` (requires a new store method, as the Executor correctly noted in the PR body follow-up) and only create a fresh state when no row exists; or at minimum preserve `currentStep` and `partialAnswers` for pending users.
- **F-M2 (src/onboarding/onboardingFlow.ts:71):** `validateSex` accepts only Russian synonyms via `parseSex` and lacks a fallback to `VALID_SEX_VALUES`. Unlike `validateActivityLevel` and `validateWeightGoal`, which accept exact English enum strings, `validateSex` rejects "male" and "female" even though the data model stores English enums. — *Responsible role:* Executor. *Suggested remediation:* Add the same lowered-exact-match fallback used in the other validators: `if (VALID_SEX_VALUES.includes(lowered as Sex)) return { valid: true, value: lowered as Sex };`.
- **F-M3 (src/onboarding/types.ts:46):** `VALID_TIMEZONE_RE` requires exactly one slash (`/`), rejecting valid IANA zones without a slash (e.g., `UTC`, `GMT`) and three-segment zones (e.g., `America/Argentina/Buenos_Aires`). — *Responsible role:* Executor. *Suggested remediation:* Replace the hand-rolled regex with `Intl.supportedValuesOf('timeZone')` (available on Node 24 per runtime spec) and test membership with `.includes(trimmed)`.
- **F-M4 (src/onboarding/onboardingFlow.ts:267):** `handleOnboardingStep` updates onboarding state via `store.upsertOnboardingState` without optimistic version checking. Concurrent messages from the same user can race, causing a lost update because the method does not verify `state.version` against the DB row. The store already provides `updateOnboardingStateWithVersion` for this purpose. — *Responsible role:* Executor. *Suggested remediation:* Switch to `repo.updateOnboardingStateWithVersion` passing `expectedVersion: state.version`; on version-mismatch, re-read the latest state and replay the current step prompt.

### Low
- **F-L1 (src/onboarding/types.ts:48):** `REPORT_TIME_RE` rejects single-digit hours such as `9:00`. Users commonly omit the leading zero. — *Responsible role:* Executor. *Suggested remediation:* Relax the regex to `^([01]?\d|2[0-3]):([0-5]\d)$`.
- **F-L2 (tests/onboarding/targetCalculator.test.ts:192):** End-to-end test description says `160 cm` but the actual `heightCm` argument and assertion use `165`. The test is internally consistent but the description is misleading. — *Responsible role:* Executor. *Suggested remediation:* Change the `it` description to `165 cm` to match the code.
- **F-L3 (src/onboarding/messages.ts:100):** `STEP_PROMPTS` and `STEP_REASKS` are typed as `Record<string, string>` instead of `Record<OnboardingStep, string>`, weakening compile-time safety for step keys. — *Responsible role:* Executor. *Suggested remediation:* Change the type annotations to `Record<OnboardingStep, string>`.
- **F-L4 (src/onboarding/onboardingFlow.ts:198):** When `currentStep` is corrupted (not in `ONBOARDING_STEPS`), `handleOnboardingStep` silently resets state to `sex` without emitting an audit event, metric, or log entry. This makes data-corruption incidents invisible to C10 observability. — *Responsible role:* Executor. *Suggested remediation:* Add a `console.error` or C10 event emission (if available in C2 deps) before resetting.

## Red-team probes (Reviewer must address each)
- **Error paths:** Telegram API failure is not in this ticket scope (C1). DB failures inside `withTransaction` are handled by the store (rollback). Target calculation is deterministic and cannot fail on valid inputs; no failure path is tested for mathematically impossible configs, though the ArchSpec says C10 should raise a blocking error. Not a finding for this PR because C10 integration is out of scope.
- **Concurrency:** Two text messages from the same user during onboarding can race because `upsertOnboardingState` does not use optimistic locking (see F-M4). The store provides `updateOnboardingStateWithVersion`, but C2 does not consume it.
- **Input validation:** No voice/photo handling in this ticket. Text inputs are validated by per-step validators. No length cap on raw input, but regexes are linear and not backtrack-prone. Unicode `toLowerCase()` correctly handles Cyrillic.
- **Prompt injection:** No LLM calls in onboarding; N/A.
- **Secrets:** No credentials, tokens, or DB URLs in diff. Good.
- **Rollback:** PR body lists `git revert HEAD~1..HEAD --no-edit`. This only reverts the status-flip commit (`e1f76f2`) on the PR branch, not the implementation commit (`1340fdd`). Correct rollback on `main` after merge would be `git revert e1f76f2^..e1f76f2` or two discrete reverts. This is a minor documentation gap, not a code defect.

## Verdict
**pass_with_changes** — F-H1 must be fixed before merge (atomicity violation). F-M1–F-M4 should be fixed or explicitly deferred to follow-up TKTs with PO sign-off. F-L1–F-L4 are non-blocking.
