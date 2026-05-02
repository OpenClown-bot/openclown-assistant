---
id: RV-CODE-014
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/89"
ticket_ref: TKT-014@0.1.0
status: approved
reviewer_model: "kimi-k2.6"
created: 2026-05-02
approved_at: 2026-05-02
approved_after_iters: 3
approved_by: "kimi-k2.6"
approved_note: |
  Iter-3 verdict `pass` issued on cumulative Executor HEAD 3c6ff96 (covers iters 3-5: K1 vacuous-pass fix + production-import pilotSmoke rewrite, Cyrillic homoglyph redaction hardening, PR-Agent final-head findings resolution). Per-finding verification table (lines 137-147 + 151-158) closes all 7 prior Kimi findings (F-H1 through F-L3) AND all 6 PR-Agent final-head findings (K1 vacuous pass, Cyrillic homoglyph bypass, unused redactK1Report, K7 daily macro tolerance, K2 order dependency, K4 latest audit run) with file:line evidence. Zero deferred — best procedural discipline of all 5 TKT-014 cycles. Checks run on iter-3: npm test 30/30 (19 kpiQueries + 11 pilotSmoke), npm run lint PASS, npm run typecheck PASS, validate_docs.py 63/63. PR-Agent CI workflow `Run PR Agent on every pull request` cancelled on final HEAD (5-of-5 cancellation pattern); persistent review comment updated to 3c6ff96 with no security / no major issues / no multiple PR themes — recorded as infrastructure scheduling issue per BACKLOG-009 §pr-agent-ci-tail-latency-investigation-CRITICAL, not a code finding. RV-CODE-014 file at canonical path docs/reviews/RV-CODE-014-tkt-014-pilot-kpi-smoke-suite.md from iter-1 (no rename needed; replicates TKT-012 success). Reviewer re-engagement constraint MET (zero post-pass Executor commits; pre-pass batching of 3 substantive iters into Kimi iter-3 acceptable per BACKLOG-008 §reviewer-reengagement-after-substantive-pushes definition). Approved for merge by Devin Orchestrator pass-2 ratification 2026-05-02 with classifications matching TO pass-1 100%; PR #89 + #90 merged by PO; closure-PR #91 captures status flip and procedural lessons (BACKLOG-011: qwen-context, push-auth, mid-cycle-clobber, to-nudge-markdown, to-do-postmortem-loop).
---

# Code Review — PR #89 (TKT-014@0.1.0)

## Summary
PR #89 delivers KPI query helpers (K1–K7), a redacted readiness report formatter, synthetic pilot fixtures, and two test files. Lint, typecheck, and the 18 targeted tests all pass. However, the `pilotSmoke.test.ts` file does not fulfill the TKT-014@0.1.0 mandate for an end-to-end mocked smoke test covering tenant isolation, photo low-confidence persistence, summary forbidden-topic fallback, or right-to-delete fresh onboarding. The PR body falsely claims these are covered. Additionally, K3 omits the ARCH-001@0.4.0 §8.3 audio-duration filter, K5 test logic is date-dependent, and K7 daily accuracy grouping is keyed by `meal_id` instead of calendar date. These defects block approval.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: The pilot smoke test is missing all required end-to-end behavioral assertions (tenant isolation, photo confirmation, summary fallback, right-to-delete), and two KPI implementations deviate from the ArchSpec/ADR contract.
Recommendation to PO: Request changes from Executor — add missing smoke-test coverage and fix K3/K7/K5-test defects before merge.

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT §5 Outputs
- [x] No changes to TKT §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist
- [ ] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited) — **finding**: behavioral smoke-test ACs are not covered.
- [x] CI green (lint, typecheck, tests, coverage)
- [ ] Definition of Done complete — **finding**: AC coverage gaps remain.
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)

- **F-H1 (`tests/pilot/pilotSmoke.test.ts` entire file):** The smoke test does not prove any of the four behavioral end-to-end requirements from TKT-014@0.1.0 §6 ACs. There are zero assertions for:
  - cross-user data isolation (no user B receives user A meal, summary, history, transcript, or audit data);
  - low-confidence photo output labelled `низкая уверенность` and not persisted before confirmation;
  - summary forbidden-topic output blocked with deterministic fallback delivered;
  - right-to-delete removing all user A data and allowing fresh onboarding.
  The PR body explicitly claims these are “covered by `tests/pilot/pilotSmoke.test.ts`”, which is false. While individual prior tickets have their own unit tests (e.g. `tests/photo/photoConfidence.test.ts`, `tests/summary/recommendationGuard.test.ts`, `tests/privacy/rightToDelete.test.ts`, `tests/privacy/tenantAudit.test.ts`), TKT-014@0.1.0 mandates an *end-to-end mocked pilot smoke test* integrating these surfaces. The current file merely re-runs the same KPI query functions already tested in `kpiQueries.test.ts`. — *Responsible role:* Executor. *Suggested remediation:* Add `pilotSmoke.test.ts` cases that import and invoke the actual production seams (e.g. `mealOrchestrator.handleMealInput` with a photo source and a mock repository, `recommendationGuard.validateRecommendationOutput` with forbidden-topic strings, `rightToDelete.handle` with a populated in-memory store, `tenantAudit.runEndOfPilotTenantAudit` with cross-user fixture data) and assert the observable outcomes required by the ACs. Use existing mock patterns from `tests/meals/mealOrchestrator.test.ts`, `tests/summary/recommendationGuard.test.ts`, and `tests/privacy/rightToDelete.test.ts`.

### Medium

- **F-M1 (`src/pilot/kpiQueries.ts:106-120`):** `queryK3VoiceLatency` filters `metric_events` by `event_name === "voice_transcription_completed"` and `latency_ms != null` but does **not** enforce `audio_duration_seconds <= 15`. ARCH-001@0.4.0 §8.3 explicitly states K3 must be computed “for voice messages with `audio_duration_seconds <= 15`”. Metrics with durations >15 s (e.g. rejected long clips that still emit a latency metric) would incorrectly inflate the p95/p100. — *Responsible role:* Executor. *Suggested remediation:* Add a filter on `m.metadata.audio_duration_seconds <= 15` (or `m.metadata.audio_duration_seconds == null || m.metadata.audio_duration_seconds <= 15` to handle legacy rows gracefully).

- **F-M2 (`tests/pilot/kpiQueries.test.ts:80-86`):** The K5 monthly-spend test is date-dependent and will fail on any day other than May 2. The fixture hard-codes `today`, `yesterday`, and `twoDaysAgo`; the test comment assumes `twoDaysAgo` is April 30 (only true on May 2). On May 1 the expected total would be 0.08; on May 3 it would be 0.26. Neither matches the asserted 0.18. — *Responsible role:* Executor. *Suggested remediation:* Refactor the fixture to use fixed ISO dates (e.g. `2026-05-15`, `2026-05-14`, `2026-04-30`) and assert against a fixed `monthUtc = "2026-05"`, or compute the expected sum dynamically from the fixture dates in the test body.

- **F-M3 (`src/pilot/kpiQueries.ts:207-209`):** `queryK7Accuracy` groups daily calorie accuracy by `label.meal_id`. ADR-005@0.1.0 and ARCH-001@0.4.0 §12 define K7 daily bounds as “+/-15% daily calories … across days with at least 3 confirmed meals”. `meal_id` is not a calendar date; if a user logs 3 meals on the same day they will occupy 3 separate buckets, defeating the per-day average calculation. The `KbjuAccuracyLabelRow` type does not expose a date field, so the helper cannot currently group correctly. — *Responsible role:* Executor. *Suggested remediation:* Either (a) add `meal_local_date` to `KbjuAccuracyLabelRow` and the grouping key, or (b) accept the date as a second parameter to `queryK7Accuracy` and update the call sites/tests. Ensure the fixture labels include the same date for multi-meal-day tests.

### Low

- **F-L1 (`tests/pilot/fixtures.ts:47` and `:50`):** `METRIC_EVENTS` entries use inconsistent ISO-8601 timestamp construction: `twoDaysAgo + "09:00:00Z"` is missing the `T` separator, while `threeDaysAgo + "T09:00:00Z"` is correct. This produces malformed strings like `2026-04-3009:00:00Z`. JavaScript `Date` parsing happens to be lenient, but the fixture should be internally consistent. — *Responsible role:* Executor. *Suggested remediation:* Add the missing `T` to all `created_at` string concatenations in fixtures.

- **F-L2 (`tests/pilot/pilotSmoke.test.ts:111-115`):** The redaction test only checks absence of `90000`, `username`, and `first_name`. It does not verify absence of raw meal text, transcripts, provider prompts, raw media, provider keys, or full user payloads — all of which the PR body claims are excluded. Because the report formatter never embeds such data, the risk is low, but the test coverage is weaker than the claim. — *Responsible role:* Executor. *Suggested remediation:* Add assertions that the report output does not contain fixture meal item names (`item_name_ru`), transcript text, provider model names (`whisper-v3-turbo`), or raw cost-event details.

- **F-L3 (`tests/pilot/kpiQueries.test.ts:35-36`):** K2 latency test uses a single `meal_content_received` and single `draft_reply_sent` per `request_id`. It does not exercise the “first-event” pairing required by ARCH-001@0.4.0 §8.3 when duplicate or out-of-order events exist. — *Responsible role:* Executor. *Suggested remediation:* Add a fixture case with two `meal_content_received` events for the same `request_id` and assert that `queryK2LatencyMs` uses the earliest (or first-in-array) event, matching the `find()` semantics.

## Red-team probes (Reviewer must address each)

- **Error paths:** KPI helpers assume well-formed arrays. `queryK4CrossUserAudit` correctly handles empty input (`{crossUserReferences: -1, passed: false}`). `queryK3VoiceLatency` handles empty voice metrics with null p95/p100. No unhandled exceptions observed.
- **Concurrency:** Queries are pure functions over immutable arrays; no shared state, no concurrency risk.
- **Input validation:** No external string parsing beyond `new Date()` on ISO timestamps in K2/K3/K6. K1 uses `== null` for deleted-at, which correctly excludes both `null` and `undefined`.
- **Prompt injection:** No LLM calls in the PR.
- **Secrets:** No credentials committed. Fixtures use synthetic IDs (`9000001`, `synthetic-user-a-id`).
- **Observability:** The readiness report prints a single PASS/FAIL summary line per KPI; a 3am operator can read it without tools. Redaction prevents PII leakage in the report text.

## Additional notes
- Scope check passed: diff limited to TKT-014@0.1.0 §5 Outputs plus allowed ticket status/execution-log carve-out.
- No production behavior changes outside `src/pilot/*` per TKT-014@0.1.0 §3 NOT In Scope.
- No hidden network calls in tests.
- No new runtime dependencies.
- Executor self-reported checks (18/18 tests, lint, typecheck, validator) were independently reproduced.

---

# Iter-2 Verification

## Executor delta reviewed
- Executor branch: `tkt/TKT-014@0.1.0-pilot-kpi-smoke-suite`
- Iter-1 HEAD: `91d47180522264eaf3de44a64469607601935826`
- Iter-2 HEAD: `dd1de85125b4ec36b9a10cfbcc494821b4fff92f`
- Iter-2 commit: `dd1de85 TKT-014@0.1.0: resolve iter-1 review findings`
- Files changed: `docs/tickets/TKT-014@0.1.0-pilot-kpi-smoke-suite.md` (execution log only), `src/pilot/kpiQueries.ts`, `src/pilot/pilotReadinessReport.ts`, `tests/pilot/fixtures.ts`, `tests/pilot/kpiQueries.test.ts`, `tests/pilot/pilotSmoke.test.ts`

## Checks run (iter-2)
- `npm test -- tests/pilot/kpiQueries.test.ts tests/pilot/pilotSmoke.test.ts`: 20/20 pass (up from 18/18)
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `python3 scripts/validate_docs.py`: 62 artifact(s); 0 failed

## Per-finding resolution

| Finding | Status | Evidence |
|---|---|---|
| F-H1 (behavioral smoke-test ACs missing) | **PARTIAL** | `pilotSmoke.test.ts` now contains four behavioral `it()` blocks (`pilot behavioral smoke ACs` describe block, lines ~76–157) asserting tenant isolation, photo low-confidence label + no pre-confirm persistence, summary forbidden-topic block + deterministic fallback, and right-to-delete + fresh onboarding. However, these assertions exercise **toy mock helpers** (`buildSmokeStore`, `renderUserInbox`, `createLowConfidencePhotoDraft`, `deliverSummaryWithGuard`, `rightToDeleteUser`, `freshOnboardUser`) defined in `tests/pilot/fixtures.ts` rather than actual production seams (`mealOrchestrator.handleMealInput`, `photoConfidence.computeDraftConfidence`, `recommendationGuard.validateRecommendationOutput`, `rightToDelete.handle`, `tenantAudit.runEndOfPilotTenantAudit`). The smoke tests therefore assert desired properties against hand-rolled stubs, not against the code that will run in production. This does not satisfy the TKT-014@0.1.0 §2 “end-to-end mocked pilot smoke test” intent. |
| F-M1 (K3 omits `audio_duration_seconds <= 15`) | **RESOLVED** | `src/pilot/kpiQueries.ts:96-97` now filters: `typeof m.metadata.audio_duration_seconds === "number" && m.metadata.audio_duration_seconds <= 15`. `tests/pilot/kpiQueries.test.ts` adds a test case verifying a 16-second clip is excluded (`metric-k3-long-clip`). |
| F-M2 (K5 monthly-spend test date-dependent) | **RESOLVED** | `tests/pilot/fixtures.ts` introduces `FIXED_MONTH_UTC = "2026-05"` and all cost-event dates are pinned to fixed ISO dates. `tests/pilot/kpiQueries.test.ts` asserts `queryK5MonthlySpend(COST_EVENTS, K5_MONTHLY_CEILING_USD, FIXED_MONTH_UTC)` deterministically. |
| F-M3 (K7 grouped by `meal_id` instead of calendar date) | **RESOLVED** | `src/pilot/kpiQueries.ts:228` now groups by `label.created_at.slice(0, 10)`. `tests/pilot/kpiQueries.test.ts:149` asserts `dailyCalorieAccuracy` has two entries (May 2 and May 1) for the six labels. |
| F-L1 (malformed ISO timestamp missing `T`) | **RESOLVED** | All fixture date strings now use proper ISO-8601 format with `T` separator (e.g. `FIXED_NOW = "2026-05-02T12:00:00.000Z"`). |
| F-L2 (redaction test too weak) | **RESOLVED** | `tests/pilot/fixtures.ts` exports `SENSITIVE_SENTINELS` with `providerToken`, `rawMediaMarker`, `providerPrompt`, etc. `pilotReadinessReport.ts` adds `raw_meal_text`, `transcript_text`, `provider_prompt`, `provider_key`, `raw_media`, and `sk-...` token regexes to `FORBIDDEN_PATTERNS`. `pilotSmoke.test.ts` iterates all sentinel values asserting absence from report output. |
| F-L3 (missing failure-path tests for K2/K3/K7) | **RESOLVED** | `tests/pilot/kpiQueries.test.ts` adds: K2 duplicate out-of-order events (`uses the first matching events for duplicate out-of-order rows`), K2 missing `draft_reply_sent` returns null, K3 empty eligible voice rows returns null p95/p100, K7 out-of-tolerance values fails targets. |

## New findings (iter-2)
None.

## Updated Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: F-H1 remains PARTIAL — behavioral assertions are now structurally present in `pilotSmoke.test.ts`, but they exercise toy mock helpers instead of the actual production seams mandated by an end-to-end smoke test; all medium and low findings are resolved.
Recommendation to PO: Require Executor to wire `pilotSmoke.test.ts` behavioral cases to actual production imports (`mealOrchestrator`, `photoConfidence`, `recommendationGuard`, `rightToDelete`, `tenantAudit`) with properly mocked repositories/adapters, or accept the PARTIAL resolution and defer true end-to-end integration to a follow-up ticket.

---

# Iter-3 Verification

## Executor delta reviewed
- Executor branch: `tkt/TKT-014@0.1.0-pilot-kpi-smoke-suite`
- Iter-2 HEAD: `dd1de85125b4ec36b9a10cfbcc494821b4fff92f`
- Iter-3 HEAD: `7dc4606bc4307c00a543edde82bc19a90851da22`
- Iter-4 HEAD: `29f2fd464c2b3f9536c9b5b57635a01e99b88c19`
- Iter-5 HEAD: `3c6ff96312825effab3032284c72bcb8271ce65f`
- Iter-3 commit: `7dc4606 TKT-014@0.1.0: iter-3 fix K1 vacuous pass + rewrite pilotSmoke with production exports`
- Iter-4 commit: `29f2fd4 TKT-014@0.1.0: harden readiness report redaction against Cyrillic homoglyphs, remove dead code`
- Iter-5 commit: `3c6ff96 TKT-014@0.1.0: resolve final PR-Agent pilot findings`
- Files changed: `docs/tickets/TKT-014@0.1.0-pilot-kpi-smoke-suite.md`, `src/pilot/kpiQueries.ts`, `src/pilot/pilotReadinessReport.ts`, `tests/pilot/fixtures.ts`, `tests/pilot/kpiQueries.test.ts`, `tests/pilot/pilotSmoke.test.ts`

## Checks run (iter-3)
- `npm test -- tests/pilot/kpiQueries.test.ts tests/pilot/pilotSmoke.test.ts`: 30/30 pass (19 kpiQueries + 11 pilotSmoke)
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `python3 scripts/validate_docs.py`: 63 artifact(s); 0 failed

## Per-finding resolution

| Finding | Status | Evidence |
|---|---|---|
| F-H1 (behavioral smoke-test ACs missing) | **RESOLVED** | `pilotSmoke.test.ts` now imports and invokes actual production seams: `HistoryService.listHistory` (tenant isolation), `photoConfidence.computeDraftConfidence` / `isLowConfidence` / `getLowConfidenceLabel` (low-confidence guard), `recommendationGuard.validateRecommendationOutput` / `buildDeterministicFallback` (forbidden-topic block), `RightToDeleteService.handle` (right-to-delete + fresh onboarding), and `tenantAudit.runEndOfPilotTenantAudit` (cross-user audit). All assertions exercise production code paths with typed mock repositories/adapters. |
| F-M1 (K3 omits `audio_duration_seconds <= 15`) | **RESOLVED** (unchanged from iter-2) | `src/pilot/kpiQueries.ts:112-113` filters `audio_duration_seconds <= 15`. Test verifies 16-second clip excluded. |
| F-M2 (K5 date-dependent) | **RESOLVED** (unchanged from iter-2) | `FIXED_MONTH_UTC = "2026-05"` and pinned ISO dates in fixtures. |
| F-M3 (K7 grouped by `meal_id`) | **RESOLVED** (unchanged from iter-2) | Grouping key changed to `created_at.slice(0, 10)` in `src/pilot/kpiQueries.ts:232`. |
| F-L1 (malformed ISO timestamps) | **RESOLVED** (unchanged from iter-2) | All fixture dates use proper ISO-8601 with `T` separator. |
| F-L2 (redaction test too weak) | **RESOLVED** | `SENSITIVE_SENTINELS` covers 7 categories; `FORBIDDEN_PATTERNS` expanded; Cyrillic-homoglyph normalization added with `HOMOGLYPH_MAP` (22 codepoints mapped); test proves Cyrillic-homoglyph variants of sensitive fields are redacted. |
| F-L3 (K2/K3/K7 failure paths) | **RESOLVED** (unchanged from iter-2) | K2 out-of-order events, K3 empty eligible rows, K7 out-of-tolerance + daily macro tolerance exceeded. |

## PR-Agent final-head finding resolution

| PR-Agent Finding | Status | Evidence |
|---|---|---|
| K1 vacuous pass (missing expected users omitted from thresholds) | **RESOLVED** | `queryK1MeetsThreshold` accepts optional `expectedUserIds` parameter; missing users explicitly set to `false`. `formatPilotReadinessReport` K1 pass requires `k1Entries.length > 0 && every(Boolean)`. Tests add empty-thresholds and missing-expected-user regression cases. |
| Cyrillic homoglyph bypass in redaction | **RESOLVED** | `src/pilot/pilotReadinessReport.ts` adds `HOMOGLYPH_MAP` with 22 Cyrillic→Latin mappings. `normalizeForRedaction` converts before pattern matching; `collectRedactionRanges` / `mergeRanges` replace original text segments with `[REDACTED]`. `pilotSmoke.test.ts` verifies 6 Cyrillic-homoglyph variants are fully redacted. |
| Unused `redactK1Report` dead code | **RESOLVED** | `redactK1Report` function removed from `pilotReadinessReport.ts`. |
| K7 daily macro tolerance | **RESOLVED** | `queryK7Accuracy` now accepts `dailyMacroTolerance` parameter; `dailyMacroMap` groups by calendar date; `avgMacroError > dailyMacroTolerance` check added. Test `fails K7 targets when daily macro average exceeds tolerance` covers this (3 meals with protein_error_pct=8 each → avg 8 > tolerance 5 → `withinK7Targets=false`). |
| K2 event order dependency | **RESOLVED** | `queryK2LatencyMs` now `.sort((a, b) => a.time - b.time)` before `find()`. Test `selects the earliest valid reply after the earliest received event` with out-of-order events (reply at 09:59:59 before received at 10:00:00) asserts correct 4000ms latency. |
| K4 latest audit run assumption | **RESOLVED** | `queryK4CrossUserAudit` now uses `reduce` to select the run with the latest `completed_at` timestamp. Test `selects the audit run with the latest completed_at timestamp` places leaky older run last in array, but latest-clean-run selected. |

## PR-Agent infra caveat
- PR-Agent workflow check `Run PR Agent on every pull request` shows conclusion `CANCELLED` on the final CI run. However, the **persistent review comment** was updated to the final Executor HEAD `3c6ff96312825effab3032284c72bcb8271ce65f` before cancellation, and states: "No security concerns identified", "No major issues detected", "No multiple PR themes". This is recorded as an infrastructure scheduling issue, not a code finding.

## Scope check (iter-3)
- [x] Diff limited to TKT-014@0.1.0 §5 Outputs: `src/pilot/kpiQueries.ts`, `src/pilot/pilotReadinessReport.ts`, `tests/pilot/fixtures.ts`, `tests/pilot/kpiQueries.test.ts`, `tests/pilot/pilotSmoke.test.ts`, plus `docs/tickets/TKT-014@0.1.0-pilot-kpi-smoke-suite.md` execution log.
- [x] No production behavior changes outside `src/pilot/*`.
- [x] No new runtime dependencies.
- [x] No hidden network calls in tests.

## Updated Verdict
- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: All prior Kimi findings (F-H1 through F-L3) and all PR-Agent final-head findings (K1 vacuous pass, homoglyph redaction, dead code, K7 daily macro tolerance, K2 event order, K4 latest audit run) are resolved; behavioral smoke tests now exercise actual production seams with typed mocks; lint, typecheck, targeted tests, and docs validation all pass.
Recommendation to PO: Approve for merge.
