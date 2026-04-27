---
id: RV-CODE-003
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/17"
ticket_ref: TKT-003@0.1.0
status: changes_requested
reviewer_model: "kimi-k2.6"
created: 2026-04-27
---

# Code Review — PR #17 (TKT-003@0.1.0)

## Summary
PR #17 adds C10 observability scaffolding with correct file scope, zero new runtime dependencies, and valid Prometheus metric name registry. However, the SpendTracker class has three critical data-integrity bugs (fresh-instance state loss, month-rollover spend leak, lost-update race) and is completely uncovered by tests. Additionally, the histogram renderer emits invalid Prometheus exposition format. These defects block merge.

## Verdict
- [ ] pass
- [ ] pass_with_changes
- [x] fail

One-sentence justification: Three high-severity SpendTracker data-integrity bugs, completely untested stateful class, and invalid histogram exposition format mean the PR does not satisfy TKT-003@0.1.0 acceptance criteria for safe cost guarding or correct metrics rendering.

Recommendation to PO: **PO: request changes from Executor.**

## Contract compliance (each must be ticked or marked finding)
- [x] PR modifies ONLY files listed in TKT-003@0.1.0 §5 Outputs
- [x] No changes to TKT-003@0.1.0 §3 NOT-In-Scope items
- [x] No new runtime dependencies beyond TKT-003@0.1.0 §7 Constraints allowlist
- [ ] All Acceptance Criteria from TKT-003@0.1.0 §6 are verifiably satisfied (file:line or test name cited) — see F-H5 below
- [x] CI green (lint, typecheck, tests, coverage) — `npm test`, `npm run lint`, `npm run typecheck` all exit 0; note lint is still an alias for typecheck (pre-existing F-M1 from RV-CODE-001, deferred)
- [x] Definition of Done complete
- [x] Ticket frontmatter `status: in_review` in a separate commit

## Findings

### High (blocking)

- **F-H1 (src/observability/costGuard.ts:120–134):** `SpendTracker.getState()` performs a **destructive upsert** on every call when the in-memory cache is null or stale. When a fresh instance is constructed after a restart, `this.cache` is `null`, so the upsert request carries `estimatedSpendUsd: 0`. The underlying `TenantStore.upsertMonthlySpendCounter` SQL uses `ON CONFLICT DO UPDATE SET estimated_spend_usd = EXCLUDED.estimated_spend_usd`, which **overwrites any existing DB row for the current month with $0**, permanently erasing prior spend. This is a classic fresh-instance state-loss bug and directly violates AC5.
  - *Suggested remediation:* Replace the read-as-write `getState()` with a true `SELECT`-based read (`SELECT * FROM monthly_spend_counters WHERE user_id = $1 AND month_utc = $2`) that preserves existing DB state. Only write on `recordCostAndCheckBudget` / `markPoAlertSent`. If the TenantStore interface lacks a getter, the Executor must extend it or use a raw query inside `getState()`.

- **F-H2 (src/observability/costGuard.ts:158–177):** `recordCostAndCheckBudget` is a **read-modify-write without any concurrency guard**. Two concurrent webhook handlers for the same `user_id` each call `getState()`, read the same DB value (e.g. $5.00), each add their local call cost locally (handler A +$3, handler B +$4), then each write back their own computed total. The last write wins ($8.00 or $9.00), and **$7.00 of combined spend is silently lost**. This lost-update race means the cost ceiling can be exceeded without triggering degrade mode.
  - *Suggested remediation:* Use an atomic increment in SQL (`UPDATE monthly_spend_counters SET estimated_spend_usd = estimated_spend_usd + $3 ... RETURNING *`) or wrap the read-modify-write in a Postgres advisory lock / `SELECT FOR UPDATE` transaction. The `upsert` must not replace the column with a stale client-computed total.

- **F-H3 (src/observability/costGuard.ts:120–134):** Month-rollover at UTC midnight **leaks the previous month's cached spend into the new month**. If the cache holds April data ($9.50) and the first May request arrives, `getState()` detects the month change, then upserts a May row with `estimatedSpendUsd: 9.50` (the stale April value). The new month therefore starts with $9.50 instead of $0, prematurely triggering degrade mode and blocking legitimate calls.
  - *Suggested remediation:* On month change, discard the stale cache entirely and seed the new row at $0 (or whatever the DB already contains for the new month). Do not carry `estimatedSpendUsd` across month boundaries.

- **F-H4 (src/observability/metricsEndpoint.ts:97–109):** Histogram rendering emits **invalid Prometheus exposition format**. `getSamples()` pushes two samples with the *same* base metric name (`kbju_meal_draft_latency_ms`) — one with `type: "histogram"` / `value: sum`, and one with `type: "counter"` / `value: count`. `render()` then emits the same metric name twice with a single `# TYPE ... histogram` line. Valid Prometheus histograms require **suffixed names**: `name_sum`, `name_count`, and `name_bucket{le="..."}`. Scrapers will reject the output.
  - *Suggested remediation:* Change `getSamples()` to emit samples with names suffixed `_sum` and `_count` (as `PrometheusMetricName` strings, or extend the type), and add `_bucket` lines with `le` labels. Alternatively, replace histograms with simple counters/summaries until proper bucket support is designed.

- **F-H5 (tests/observability/costGuard.test.ts):** The `SpendTracker` class (`getState`, `preflightCheck`, `recordCostAndCheckBudget`, `markPoAlertSent`) is **completely untested**. The test suite only exercises pure functions (`worstCaseCostForCall`, `shouldDegrade`, `shouldSuppressPoAlert`). TKT-003@0.1.0 §2 In Scope explicitly demands: *"tests for ... concurrency-safe increments via the C3 mock"*. Because the class has zero test coverage, F-H1–H3 were not caught, and the AC gap is itself a finding.
  - *Suggested remediation:* Add a `TenantStore` mock that returns realistic `MonthlySpendCounterRow` objects, simulates concurrent upserts, and asserts that: (a) fresh reads preserve existing DB spend, (b) concurrent calls do not lose updates, (c) month rollover resets spend to $0.

### Medium

- **F-M1 (src/observability/events.ts:72–96):** `redactPii` uses a **blocklist (forbidden-key substrings)** rather than an allowlist. Unknown fields that do not match any forbidden substring pass through unchanged. A future developer could accidentally log `{telegram_chat_id: "123456789"}` or `{meal_description: "я съел борщ"}` and the values would leak into log events because neither key is in `FORBIDDEN_KEY_SUBSTRINGS`.
  - *Suggested remediation:* Switch to an allowlist model for the `extra` bag, or at minimum add `telegram_chat_id`, `chat_id`, and `telegram_user_id` to the forbidden list and document the blocklist as an operational risk.

- **F-M2 (src/observability/costGuard.ts:196–198):** `shouldDegrade` returns `true` only when `estimatedSpendUsd > MONTHLY_SPEND_CEILING_USD`. This is stricter than ARCH-001@0.2.0 §4.8, which states *"When the projected total reaches the ceiling"* (implying `>=`). The AC5 test codifies the `>` behavior, so the literal AC is met, but the divergence from the architectural contract means a spend of exactly $10.00 will not trigger degrade mode despite having *reached* the ceiling.
  - *Suggested remediation:* Align the condition with ARCH-001@0.2.0 by using `>=`, or raise a Ticket question to update the Arch if the PO intended `>`.

- **F-M3 (src/observability/metricsEndpoint.test.ts):** No test exercises `registry.observe()` or validates the rendered output of a histogram metric. Consequently F-H4 went undetected.
  - *Suggested remediation:* Add a test that calls `observe()` twice and asserts the rendered text contains `_sum`, `_count`, and `_bucket` suffixes with valid Prometheus syntax.

- **F-M4 (src/observability/events.ts:32–41):** PII string-pattern redaction does not redact raw meal text, transcripts, or photo captions when they appear in **generic string values** under non-forbidden keys (e.g., `detail: "user said: Я съел борщ"`). The `PII_PATTERNS` only match Telegram tokens, provider keys, and audio/photo markers; they do not match free-form user text.
  - *Suggested remediation:* Add a broad regex for Cyrillic/Unicode meal text (high risk of false positives), or constrain the `extra` allowlist so that no generic free-text field can be logged.

### Low

- **F-L1 (src/observability/metricsEndpoint.ts:102):** `countKey` is computed but never used — dead assignment.
  - *Suggested remediation:* Remove the unused variable.

- **F-L2 (PR body):** Rollback command `git revert 535d961 b87a161` intentionally omits `b827ea0`. Reverting only the impl + ready→in_progress leaves the TKT-003@0.1.0 ticket file with `status: in_review` but no corresponding code, which is not the same state as `main`. A safer rollback sequence would revert all three commits, leaving the ticket at `ready`, or document explicitly that the post-rollback state is intentionally `in_review` without code.
  - *Suggested remediation:* Append a note to the PR body clarifying the expected post-revert ticket state.

## Red-team probes

- **Error paths:** `createMetricsServer` rejects `0.0.0.0` with a thrown Error; callers must catch. `emitLog` delegates to the injected logger and does not catch — acceptable because the logger contract is synchronous. No external HTTP calls are made inside the diff scope.
- **Concurrency:** See F-H1, F-H2, F-H3. The SpendTracker is the primary concurrency hazard.
- **Input validation:** `buildLogEvent` does not validate `userId` or `requestId` format, but these are internal UUIDs injected by upstream components, not raw user input.
- **Prompt injection:** No external string reaches an LLM inside this diff scope.
- **Secrets:** No credential committed. `PII_PATTERNS` cover `sk-...`, `Bearer ...`, and `API_KEY=...`. Telegram token pattern is present. No raw error.stack or error.message is emitted in the new code (the logger receives the structured event object, not a raw Error).

## AC traceability matrix

| AC | Location in diff / test | Verdict |
|---|---|---|
| AC1 — no new runtime deps | `git diff main..HEAD -- package.json` empty | PASS |
| AC2 — tests pass | `npm test -- tests/observability/` 53/53 pass | PASS |
| AC3 — lint/typecheck | `npm run lint` and `npm run typecheck` exit 0 | PASS |
| AC4 — PII redaction | `tests/observability/events.test.ts` lines 30–189 cover raw_prompt, raw_transcript, raw_audio, raw_photo, telegram_bot_token, provider_key, username, first_name, last_name, provider_response_raw, callback_payload_meal_text, nested objects, arrays | **PASS for known fields**; **MEDIUM** for unknown-field leak (F-M1) and generic-string meal-text leak (F-M4) |
| AC5 — spend ceiling + PO alert suppression | `tests/observability/costGuard.test.ts` lines 37–104 test `shouldDegrade` and `shouldSuppressPoAlert` | **PARTIAL** — pure functions pass, but `SpendTracker` class is untested and has F-H1/H2/H3 |
| AC6 — metrics no-PII labels | `tests/observability/metricsEndpoint.test.ts` lines 22–137 test label stripping | **PASS for labels**; **HIGH** for histogram format (F-H4) |

## Severities and verdict mapping
- High (blocks merge): F-H1, F-H2, F-H3, F-H4, F-H5
- Medium (fix before next stage): F-M1, F-M2, F-M3, F-M4
- Low (cosmetic): F-L1, F-L2

**Verdict:** `fail` — five high findings across data integrity, concurrency safety, metrics format, and test coverage.
