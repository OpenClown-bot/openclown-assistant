# Onboarding follow-ups (post TKT-005)

Deferred work surfaced during the TKT-005 (Onboarding Target Calculator) review cycle (`docs/reviews/RV-CODE-005-pr-34-tkt-005-onboarding-target-calculator.md`) and Devin Review panel triage. Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations: `docs/reviews/RV-CODE-005-pr-34-tkt-005-onboarding-target-calculator.md` (especially `approved_note` frontmatter and the §Findings body).

## TKT-NEW-A — `getOrCreateOnboardingState` resume bug (correctness, user-visible)

**Source:** RV-CODE-005 iter-1 finding F-M1 (medium). Devin Review panel reaffirmed post-iter-3.

**The bug.** `src/onboarding/onboardingFlow.ts:R210-227` calls `store.upsertOnboardingState(userId, { currentStep: "sex", partialAnswers: {} })` without an `id`. The SQL at `src/store/tenantStore.ts:444-455` uses `COALESCE($1::uuid, gen_random_uuid())` for the id; the only unique constraint is `UNIQUE (user_id, id)` (`src/store/schema.sql:155`), so a fresh UUID always wins. Returning users whose status ≠ `pending` see "Продолжаем настройку" followed immediately by the sex question — losing all in-flight progress. Orphan rows accumulate.

**Proposed fix (Architect to ratify).** Add `getLatestOnboardingState(userId): Promise<OnboardingState | null>` to `TenantScopedRepository` interface, returning `updated_at DESC LIMIT 1` row. Modify `getOrCreateOnboardingState` to call it first; only fall through to `upsertOnboardingState` when the result is `null` OR `status === "completed"` (resume not applicable to completed flows; new flow allowed).

**NOT in scope of the eventual TKT.** ON CONFLICT migration (current schema's `UNIQUE (user_id, id)` is fine for resume semantics); cleanup of historical orphan rows (separate housekeeping); voice/photo flows.

**Estimated size:** S. Tests: returning user mid-flow at step `weight_goal` resumes there; user with completed onboarding can re-start with fresh row; brand-new user gets initial `sex` step.

**Dependencies:** none. TKT-005, TKT-002 already done.

---

## TKT-NEW-B — Onboarding nits (split into "trim" + "rest")

Eight findings batched. Recommended split: promote the two non-cosmetic ones (Intl memo, race UX) ahead of the six cosmetic ones.

### TKT-NEW-B-trim (perf + UX, non-cosmetic)

1. **Intl memoization** (Devin Review panel post-iter-4). `Intl.supportedValuesOf("timeZone")` at `src/onboarding/onboardingFlow.ts:144` runs ~400-element array allocation on every `validateTimezone` call. Module-level `const SUPPORTED_TIMEZONES: ReadonlySet<string> = new Set(Intl.supportedValuesOf("timeZone"))` lazy-initialized once.
2. **`persistOnboardingCompletion` race UX** (Devin Review panel post-iter-4). `repo.updateOnboardingStateWithVersion` inside `withTransaction` at `src/onboarding/onboardingFlow.ts:286` does not catch `OptimisticVersionError`; it propagates to C1 generic recovery. Atomicity is preserved (rollback works), but UX is degraded in concurrent-confirmation scenarios. Wrap call site in try/catch to mirror the other three call sites (lines 241, 290, 308) — return graceful re-ask message.

**Estimated size:** S. Tests: timezone validator called N times allocates set once; concurrent confirmation returns graceful re-ask, not generic error.

### TKT-NEW-B-rest (six cosmetic nits)

1. **F-L1** — `REPORT_TIME_RE` (`src/onboarding/onboardingFlow.ts`): currently rejects `9:00`; widen to accept single-digit hours (`/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/`) per ARCH-001 §C5 user-friendly intent.
2. **F-L2** — `tests/onboarding/targetCalculator.test.ts:192`: test description says "160 cm" but body uses `heightCm: 165`. Description-only fix.
3. **F-L3** — Type weakness: `Record<string, string>` for activity-level → multiplier; tighten to `Record<ActivityLevel, number>`.
4. **FLAG_4** — `String.replace(',', '.')` at `onboardingFlow.ts:84`: single-replace is intentional per Devin's own note ("any malformed input correctly fails validation"). Add inline comment so future maintainers don't "fix" it back to `.replaceAll`.
5. **FLAG_5** — Dead else branch in `target_confirmation` (`onboardingFlow.ts:285-294`): `validateConfirmation` returns `valid: false` for non-confirmation inputs, so the else is unreachable. Delete or convert to defensive `InvariantError`.
6. **FLAG_7** — Rounding inconsistency: `goalDeltaKcalPerDay = Math.round(goalDelta)` but `caloriesKcal = Math.round(maintenanceKcal + goalDelta)` uses unrounded `goalDelta` (`targetCalculator.ts:94-96`). Devin's own note: "using unrounded intermediates for the final calorie value is arguably more accurate" — keep current math but add a one-line comment explaining the deliberate rounding-order choice.

**Estimated size:** S. Mostly cosmetic; +/-30 lines.

---

## TKT-NEW-C — Audit emission for state-corruption resets (F-L4, blocked on TKT-015)

**Source:** RV-CODE-005 iter-1 finding F-L4 (low).

**The gap.** If the C2 state machine encounters a row with malformed `partialAnswers` JSON, an unrecognised `currentStep` enum value, or schema-version mismatch, the code resets to `sex` without emitting a signal. We lose the ability to detect data-corruption bugs in production.

**Proposed.** Emit `c10_onboarding_state_reset` event with fields: `userId`, `previousStep`, `previousStatus`, `resetReason: "malformed_partial_answers" | "unknown_step" | "schema_mismatch"`, `timestamp`.

**Hard dependency:** TKT-015@0.1.0 (Observability Hardening) must be `done` first to provide the C10 audit channel and event-name registry. Mark this as `blocked: TKT-015@0.1.0` when promoted to TKT.

**Estimated size:** S.

---

## TKT-NEW-D — Calorie floor on final target (medical-safety; ADR-track)

**Source:** Devin Review panel finding FLAG_2 (informational).

**The gap.** `calculateCalories` (`src/onboarding/targetCalculator.ts:52-54`) returns `maintenanceKcal + goalDelta` with no lower bound. With aggressive pace (`2.0 kg/week` = `-2200 kcal/day`) and a sedentary low-maintenance profile (~1500 kcal), the result can be negative or dangerously low (<800 kcal). Pace validation (`src/onboarding/types.ts:31`, range 0.1–2.0 kg/week) does not prevent this combination.

**Track:** ADR-NEW «Calorie floor on final target» (sibling to ADR-005). Architect drafts; Reviewer ratifies; PO accepts. Floor candidates from public guidelines: Female adult **1200 kcal/day** floor; Male adult **1500 kcal/day** floor. ADR §4 Decision Detail must cite a primary source (NIH Office of Dietary Supplements, NICE clinical guidelines, or equivalent).

ADR ratifies → ARCH-001 cascades the floor constant → new TKT formalizes Executor work to clamp the output and add tests.

**Why ADR (not direct TKT clamp).** Sets precedent (ADR-005 already pinned medical constants for the same module via Q-TKT-005-01); medical-safety constants are durable and defensible; pilot audience is the PO + partner — defensible to them; constants survive future refactors when canonical in ADR.

**Estimated size:** L (full ADR cycle + downstream TKT cycle).

**Dependencies:** none for the ADR cycle. Decision drives a TKT after acceptance.

---

## Routing summary (orchestrator's recommendation per «выбираем лучшие варианты» on 2026-04-30)

| Item | Recommendation |
|---|---|
| TKT-NEW-A | Promote to TKT (Architect drafts, then Executor) when next product cycle window opens. |
| TKT-NEW-B-trim | Promote alongside TKT-NEW-A (similar Executor scope; same opencode-session can batch). |
| TKT-NEW-B-rest | Stays in backlog until PO has spare cycle bandwidth. Cosmetic, non-blocking. |
| TKT-NEW-C | Backlog only. Promote when TKT-015@0.1.0 reaches `done`. |
| TKT-NEW-D | Promote ADR-NEW cycle ASAP (medical-safety; pilot users are PO + partner). |

## Other carried debt (separate from TKT-005 follow-ups)

- **RV-SPEC-004 F-L1 + F-L3 wording cleanup** — debt from session-2 §6.5. Reviewer-side wording polish; PO previously deferred.
- **CONTRIBUTING.md MAY-write column enumeration** — Devin Review on PR #36 noted that the closure-frontmatter fields (`closed_at`, `closed_by`, `closure_pr`, `closure_commit`, `review_ref`) are canonical pattern across TKT-001..005 closures but not in the literal CONTRIBUTING.md list. Out-of-write-zone for the orchestrator; needs explicit PO authorisation in PR body.
- **`docs/prompts/architect.md` cleanup side-quest** — carried from session-2 §6.4 step 7. PO verbally authorised: drop framework-specific references (Fireworks, OmniRoute, OpenRouter, GPT-5.5 announcement page); keep arena.ai; **add OpenClaw Plugins URLs** (composio-community/awesome-openclaw-plugins, vincentkoc/awesome-openclaw, composio.dev/content/top-openclaw-plugins — PO emphasised this is the most important addition); add LLM-model-selection rule (Architect must NOT choose independently — surface shortlist via Q_TO_BUSINESS for PO ratification). Out-of-write-zone for the orchestrator; PR body MUST cite the verbatim PO authorisation.
