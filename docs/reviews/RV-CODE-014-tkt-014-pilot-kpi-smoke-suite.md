---
id: RV-CODE-014
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/89"
ticket_ref: TKT-014@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-02
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
