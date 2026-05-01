---
id: BACKLOG-003
title: "Voice Transcription Adapter follow-ups (post TKT-007)"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-01
---

# Voice Transcription Adapter follow-ups (post TKT-007)

Deferred low-severity work surfaced during the TKT-007 (Voice Transcription Adapter) review cycle. Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations:
- Reviewer (Kimi K2.6): `docs/reviews/RV-CODE-007-pr-50-tkt-007.md` (Findings §Low).
- Supplementary reviewer (PR-Agent / Qwen 3.6 Plus on OmniRoute): inline `/review` and `/improve` comments on PR #50 (commits 4ba7c3b iter-1 and dd780d2 iter-2).

PO decision on 2026-05-01 was to fix F-M1, F-M2, F-L2 in iter-2 and defer F-L1 (Architect-responsibility) plus four PR-Agent findings to this backlog.

## TKT-NEW-H — Add `transcriptText` to `LOG_FORBIDDEN_FIELDS` allowlist

**Source:** RV-CODE-007 iter-1 finding F-L1 (low, Architect-responsibility).

**The issue.** `src/observability/logging.ts:LOG_FORBIDDEN_FIELDS` does not include `transcriptText`, so any future log emit-call that accidentally includes the transcribed audio text in its payload would not be redacted by the centralised filter. Defense-in-depth gap: present implementations of C5 do not log `transcriptText`, but the allowlist exists precisely to make redaction not depend on every call-site author remembering. The Reviewer (Kimi) flagged this as an Architect-responsibility item because it touches the global PII-redaction contract spanning multiple components.

**Proposed fix (Architect to ratify).** Either: (a) extend `LOG_FORBIDDEN_FIELDS` to include `transcriptText` and add a regression test confirming the field is filtered on every emit-event regardless of payload shape, OR (b) introduce a more general PII-classification scheme (annotation-driven) that auto-derives the forbidden list from per-field metadata. Option (a) is the lower-risk default; option (b) would require an ADR.

**NOT in scope of the eventual TKT.** Migrating to OpenTelemetry semantic conventions; redesigning the observability event schema; introducing typed log emit DSL.

**Estimated size:** XS. Tests: existing observability tests stay green; one negative test confirming `transcriptText` never appears in any emitted log event regardless of input.

**Dependencies:** none. TKT-007 already done. Architect to produce ArchSpec section before promotion.

---

## TKT-NEW-I — Handle `readAudio` throw — orphaned audio file cleanup

**Source:** PR #50 PR-Agent `/review` block iter-1 finding (Missing Error Path).

**The issue.** In `src/voice/transcriptionAdapter.ts`, the `readAudio` callback can throw (e.g. file deleted between validation and read, disk I/O error). The current implementation does not wrap this in a try-catch with `safeDeleteAudio`, so an exception leaves the audio file on disk indefinitely. C5's deletion contract states audio MUST be deleted on success or terminal failure; an exception during read is a terminal failure and should trigger cleanup.

**Proposed fix (Architect to ratify).** Wrap `readAudio(...)` in a try-catch; on catch, call `safeDeleteAudio(request, providerAlias)`, log a `voice_read_failed` event with `error_class`, and return `provider_failure` outcome. Add a test using a mock `readAudio` that throws to assert: outcome is `provider_failure`, `audioDeleted === true` (or `false` if `safeDeleteAudio` itself fails), and the log event is emitted.

**NOT in scope of the eventual TKT.** Adding retry logic for read failures (transient I/O errors are out of TKT-007 scope); rewriting the adapter to a streaming model.

**Estimated size:** XS. Tests: 1 new test for the throw-catch path; existing tests stay green.

**Dependencies:** none. TKT-007 already done.

---

## TKT-NEW-J — Validate JSON Response shape — reject `{error: "..."}` masquerading as success

**Source:** PR #50 PR-Agent `/review` block iter-1 finding (Unvalidated JSON Response).

**The issue.** In `src/voice/transcriptionAdapter.ts`, the HTTP response body is parsed as `{text?: string; confidence?: number}` via `await httpResponse.json()` and accessed without runtime shape validation. If OmniRoute or Whisper returns a degraded payload like `{error: "rate limited"}` with HTTP 200 (which can happen on backend overload), the cast accepts it, `text` is undefined, the function returns success with empty transcript text, and the user sees a silently empty result. This is a correctness bug masked as a happy-path.

**Proposed fix (Architect to ratify).** Add a runtime shape check after `httpResponse.json()`: confirm `typeof body.text === "string"` AND `body.text.length > 0` AND (if present) `typeof body.confidence === "number"`. On shape failure, classify as `provider_failure` (not `success`), log `voice_response_shape_invalid` with the response body's keys (NOT values, to respect PII), and follow the standard terminal-failure path (delete audio, return `provider_failure`).

**NOT in scope of the eventual TKT.** Migrating to a typed schema-validation library (e.g. zod); JSON-schema generation from TypeScript types; full provider-response contract testing across all OmniRoute endpoints.

**Estimated size:** XS. Tests: 1 new test with mock fetch returning `{error: "..."}` payload, asserting `provider_failure` outcome.

**Dependencies:** none. TKT-007 already done.

---

## TKT-NEW-K — Cap retry per-attempt timeout at remaining latency budget

**Source:** PR #50 PR-Agent `/review` block iter-1 finding (Latency Budget Drift) + PR-Agent `/improve` inline suggestion on iter-2 commit dd780d2 (line 162, importance 7) with concrete code snippet.

**The issue.** The retry attempt in `src/voice/transcriptionAdapter.ts:162` calls `attemptTranscription` with the full `TRANSCRIPTION_TIMEOUT_MS` (7000 ms) regardless of how much of `config.maxLatencyMs` has already been consumed by the first attempt + retry-delay sleep. If the first attempt takes close to `maxLatencyMs`, the retry can start, run for the full 7000 ms, and exceed the overall latency budget. PR-Agent's iter-2 suggestion (line 162) provided the concrete fix: compute `remainingBudgetMs = config.maxLatencyMs - (Date.now() - startTime)` and pass `Math.min(TRANSCRIPTION_TIMEOUT_MS, remainingBudgetMs)` as the retry-attempt timeout cap.

**Proposed fix (Architect to ratify).** Add an optional `timeoutMs` parameter to `attemptTranscription` (defaulting to `TRANSCRIPTION_TIMEOUT_MS` for the first attempt). At the retry call site (`transcriptionAdapter.ts:162`), compute the remaining budget and pass `Math.min(TRANSCRIPTION_TIMEOUT_MS, max(0, remainingBudgetMs))` as the cap. Apply both to `body.timeout_ms` (server-side hint) and the `AbortController` setTimeout (client-side enforcement). Add a test using `vi.useFakeTimers()` asserting that when first attempt consumes >50% of `maxLatencyMs`, the retry's effective timeout is the remaining budget, not the full 7000 ms.

**NOT in scope of the eventual TKT.** General latency-budget refactor across all C5/C6/C7 adapters; switching from fixed timeouts to deadline propagation.

**Estimated size:** S. Tests: 1 new test for the budget-capped retry timeout; existing retry tests stay green.

**Dependencies:** none. TKT-007 already done.

---

## TKT-NEW-L — Order spendTracker before audio deletion (or wrap in try-catch)

**Source:** PR #50 PR-Agent `/improve` inline suggestion on iter-2 commit dd780d2 (line 277, importance 7).

**The issue.** In `src/voice/transcriptionAdapter.ts:277`, the call sequence on the success path is `safeDeleteAudio(...)` THEN `recordCostAndCheckBudget(...)`. If `recordCostAndCheckBudget` throws (e.g. spend-tracker store unreachable, transient DB error), the audio file is already deleted but the cost is not recorded — leaving budget-tracking in an inconsistent state where the user has a successful transcription, an empty audit trail, and no spend deduction. Subsequent budget calculations for the user are now off by `preflight.estimatedCallCostUsd`.

**Proposed fix (Architect to ratify).** Either: (a) reorder operations to record cost BEFORE deletion, ensuring budget tracking is consistent even if deletion fails subsequently, OR (b) wrap `recordCostAndCheckBudget` in a try-catch that logs the failure and continues to the deletion step (preserving cost-tracking integrity at the expense of complicating the audit trail). Option (a) is the safer default and matches the principle "log first, side-effect second".

**NOT in scope of the eventual TKT.** Migrating to a transactional write across spend-tracker + audio-store; introducing an outbox/queue pattern for cost recording.

**Estimated size:** XS. Tests: 1 new test using a mock `spendTracker` that throws on `recordCostAndCheckBudget`, asserting cost is recorded before deletion (or the chosen mitigation strategy).

**Dependencies:** none. TKT-007 already done.
