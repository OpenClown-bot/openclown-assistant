---
id: RV-CODE-015
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/58"
ticket_ref: TKT-015@0.1.0
status: approved
reviewer_model: "kimi-k2.6"
created: 2026-05-01
updated: 2026-05-01
approved_at: 2026-05-01
approved_after_iters: 2
approved_by: "yourmomsenpai (PO)"
approved_note: "RV-CODE-015 reached effective verdict pass on iter-2 (Executor commit fb4e7ba, Reviewer commit on rv-branch). Reviewer iter-1 verdict was pass_with_changes blocked on F-M1 (broken security-invariant test in events.test.ts:199-211 — title claimed forbidden-field redaction but mutated user_id which is core, not forbidden; would pass even if force-redaction loop were deleted) and F-M2 (AC #6 partially unverified — PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count constant existed but was never incremented in C1 and no test asserted increment) plus 2 low findings (F-L1 unused PROMETHEUS_METRIC_NAMES import collateral on F-M2; F-L2 IPv4-mapped IPv6 wildcard bypass in metricsEndpoint bind guard). Iter-2 fixes RESOLVED all four: F-M1 test rename to 'core keys pass through verbatim even if directly mutated' + new test injecting raw_transcript directly into event object asserting [REDACTED] coercion + emitLog implementation hardened to check forbidden-field membership against unfiltered original event copy rather than allowlist-filtered redactedMeta; F-M2 metricsRegistry wired into C1Deps in src/telegram/types.ts:94 + mock in tests/telegram/entrypoint.test.ts:35-41 + increment call inside the unsupported switch case in src/telegram/entrypoint.ts:266-269 ensuring metric is incremented in the routing path not merely a logging path + new test at entrypoint.test.ts:725-738 asserts metricsRegistry.increment called with kbju_route_unmatched_count and objectContaining({ component: 'C1', source: 'sticker' }); F-L1 RESOLVED automatically by F-M2 wiring; F-L2 bind guard extended with || host === '::ffff:0.0.0.0' at src/observability/metricsEndpoint.ts:206 + new rejection test. Iter-2 metrics: 106/106 targeted tests pass (up from 104/104, +2 new tests for F-M2 metric increment and F-L2 IPv4-mapped wildcard rejection), lint zero errors, typecheck zero errors, validate_docs 39/39 on rv-branch. One PR-Agent finding F-PA-15 was VALID and independently identified F-M1; promoted into Kimi iter-2 scope and RESOLVED. One PR-Agent finding F-PA-16 (metric/log emission ordering on send failure — synchronous deps.metricsRegistry.increment() before await sendWithRetry() creates metric/log mismatch when send throws) DEFERRED to BACKLOG-006@0.1.0 §TKT-NEW-P per PO decision on 2026-05-01 (importance 7, observability class, non-blocking for AC verification because tests assert success path and Telegram sendMessage rarely throws). Both branches merged: PR #58 (squash commit on main 2026-05-01) Executor implementation, PR #62 (squash commit on main 2026-05-01) clerical-renamed review artifact (replacing closed PR #61 due to original RV-CODE-009 id-clash with parallel TKT-009 review). PR-Agent supplementary review on PR #58: 2 distinct findings (F-PA-15 promoted, F-PA-16 deferred); cosmetic Operator Precedence Clarity nit on ternary || chain skipped as non-substantive. Reviewer Kimi K2.6 remains the load-bearing CODE-mode reviewer."
superseded_by: null
---

<!--
Orchestrator clerical note (2026-05-01):
Reviewer (Kimi K2.6) initially scaffolded this artifact under id `RV-CODE-009`, clashing with the parallel review of `TKT-009@0.1.0` PR #59. Orchestrator performed a verbatim-content rename to the correct artifact id `RV-CODE-015` and the correct filename `RV-CODE-015-tkt-015-observability-hardening.md`. Body content below is unchanged from Kimi's iter-1 verdict; only frontmatter `id` was touched. The original misnamed artifact PR (#61) was closed without merge. See PR #62 for the renamed artifact.
-->


# Code Review — PR #58 (TKT-015@0.1.0 — Observability Hardening)

## Summary

TKT-015@0.1.0 hardens C1 unsupported-message handling (stickers), C1 history-command routing (256-char lowercase cap), C10 emit-boundary redaction, and C10 metrics bind guard (IPv6 wildcard rejection). The Executor correctly implements the core logic for all four deferred post-review findings (D-I5, D-I9, F-L2, IPv6 wildcard) and 104/104 targeted tests pass with zero lint or typecheck regressions. However, two medium findings block a clean `pass` verdict: (1) PR-Agent finding F-PA-15 is valid — a broken security-invariant test misleads readers by claiming to test forbidden-field redaction on core keys but actually testing a non-forbidden core key; (2) AC #6 (`kbju_route_unmatched_count` metric emission) is only partially satisfied — the constant exists but C1 never increments it and no test asserts it. One low finding notes an unused import, and a second low finding flags an IPv4-mapped IPv6 wildcard bypass in the metrics bind guard.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: Core functionality is correct and well-tested, but two medium findings (broken security-invariant test + missing metric increment for AC #6) must be addressed before merge; remaining issues are low-severity nits.
Recommendation to PO: request changes from Executor (iter-2 NUDGE) to fix F-M1 and F-M2; low findings may be bundled in the same commit or deferred.

## Contract compliance (each must be ticked or marked finding)

- [x] PR modifies ONLY files listed in TKT §5 Outputs (`src/shared/types.ts`, `src/telegram/types.ts`, `src/telegram/entrypoint.ts`, `src/observability/events.ts`, `src/observability/kpiEvents.ts`, `src/observability/metricsEndpoint.ts`, `tests/telegram/entrypoint.test.ts`, `tests/observability/events.test.ts`, `tests/observability/metricsEndpoint.test.ts`).
- [x] No changes to TKT §3 NOT-In-Scope items (no meals, onboarding voice/photo, summary, storage, or deployment flows touched).
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist (`package.json` unchanged).
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied **except** AC #6 metric emission (see F-M2 below).
- [x] CI green: `npm test -- tests/telegram/entrypoint.test.ts tests/observability/events.test.ts tests/observability/metricsEndpoint.test.ts` → 104/104 pass; `npm run lint` → zero new errors; `npm run typecheck` → zero new errors.
- [x] Definition of Done complete: no `TODO` / `FIXME` left in changed code; PR body links version-pinned TKT; `status: in_review` flip in separate commit `2c56549`.

## Findings

### Medium (must fix before merge)

- **F-M1 (tests/observability/events.test.ts:199-211):** Broken security-invariant test — PR-Agent finding **F-PA-15 is VALID**. The test is named `"emitLog forces LOG_FORBIDDEN_FIELDS to [REDACTED] if present in core keys"`, but it mutates `user_id` (a **core** field, **not** a member of `LOG_FORBIDDEN_FIELDS`) and asserts the mutated value passes through. The test therefore proves nothing about forbidden-field redaction. It is a security-test integrity defect: it would continue to pass even if the forbidden-field loop were deleted, giving a false sense of safety. The actual forbidden-field guarantee **is** covered by the adjacent test at lines 214-225 (`raw_transcript` injection), but this broken test should be renamed/rewritten to test a real intersection case (e.g. inject a key that is **both** in `ALLOWED_EXTRA_KEYS` and `LOG_FORBIDDEN_FIELDS`, or a key in `LOG_FORBIDDEN_FIELDS` that bypasses the allowlist filter). *Responsible role:* Executor. *Suggested remediation:* rename the test to `"core keys pass through verbatim even if directly mutated"` and add a **new** test that injects a key present in `LOG_FORBIDDEN_FIELDS` but absent from `CORE_EVENT_KEYS` and `ALLOWED_EXTRA_KEYS`, asserting it is dropped or coerced to `[REDACTED]`.

- **F-M2 (src/telegram/entrypoint.ts:3,276-278 + tests/telegram/entrypoint.test.ts):** AC #6 partially unverified — `PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count` exists in `src/observability/kpiEvents.ts` but is **never incremented** in the C1 unsupported-message path and **no test asserts metric emission**. `entrypoint.ts` imports the constant (line 3) but never references it. The sticker tests (lines 674-714) only assert `logger.info` calls with `event_name === KPI_EVENT_NAMES.route_unmatched` and `message_subtype === "sticker"`; they do not verify `deps.registry.increment(...)` or any equivalent. RV-SPEC-003@0.1.0 already elevated this metric from conditional to unconditional (F-M1 fix commit `f061992`), so the Executor was expected to wire it. *Responsible role:* Executor. *Suggested remediation:* add a `metricsRegistry: MetricsRegistry` field to `C1Deps` (`src/telegram/types.ts`), inject a mock registry in `makeDeps` (`tests/telegram/entrypoint.test.ts`), call `registry.increment(PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count, { component: "C1", source: "sticker" })` inside the `"unsupported"` switch case in `routeMessage`, and assert the increment in the sticker test suite. This stays within TKT §5 Outputs.

### Low (may be bundled or deferred)

- **F-L1 (src/telegram/entrypoint.ts:3):** Unused import `PROMETHEUS_METRIC_NAMES` — imported but never referenced in the module. While `tsconfig.json` does not enable `noUnusedLocals`, dead imports create reader confusion and will become a type error if stricter checks are enabled later. *Suggested remediation:* remove the import; re-add it once F-M2 remediation wires the metric increment.

- **F-L2 (src/observability/metricsEndpoint.ts:140):** IPv4-mapped IPv6 wildcard bypass — the bind guard rejects exact matches for `"0.0.0.0"`, `"::"`, and `"[::]"`, but accepts `"::ffff:0.0.0.0"`. Node.js `server.listen(port, "::ffff:0.0.0.0")` binds to all IPv4 interfaces, effectively bypassing the wildcard prohibition. The ArchSpec §10.7 does not explicitly mention this form, but the hostile-reader probe (d) identifies it as a gap. *Suggested remediation:* extend the guard with `|| host === "::ffff:0.0.0.0"` (simple string check, compliant with TKT §7 constraint on simple host-string normalization).

## Red-team probes (Reviewer must address each)

- **Error paths:** What happens on Telegram/OpenFoodFacts/Whisper API failure, DB lock, LLM timeout?
  - *Assessment:* Not in scope for TKT-015@0.1.0. C1 already delegates to downstream handlers; error paths are unchanged. The unsupported-message path sends `MSG_GENERIC_RECOVERY` synchronously and does not invoke downstream handlers, so no new failure surface is introduced.

- **Concurrency:** Can two messages from the same user be processed simultaneously?
  - *Assessment:* C1 is stateless per-message; no shared mutable state is added by TKT-015@0.1.0. The sticker/unsupported path is a synchronous `sendMessage` + log, so it is atomic with respect to concurrent messages. No regression.

- **Input validation:** Malformed voice / corrupt photo / huge text / unicode edge cases?
  - *Assessment:* The 256-char lowercase cap (F-L2) correctly prevents `toLowerCase()` on >256 chars, preserving performance for 4096-char Cyrillic payloads. The sticker branch checks `message.sticker` truthiness (not `fileId`), so a malformed but truthy sticker object routes to unsupported without crashing. The `text || undefined` normalization preserves empty-string handling. No new validation gaps.

- **Prompt injection:** Does any external string reach an LLM unsanitised (vs ARCH §9)?
  - *Assessment:* No. TKT-015@0.1.0 does not introduce new LLM call paths. The unsupported-message path short-circuits before any domain handler or LLM invocation. The 256-char cap applies only to routing normalization, not to the text passed downstream.

- **Secrets:** Any credential creep (new env vars, hardcoded tokens, scope increases)?
  - *Assessment:* No new secrets introduced. The emit-boundary redaction in `events.ts` adds `redactStringValues` for allowed string extra keys and drops non-allowlisted keys entirely, which hardens (not weakens) the secrets posture. No env vars or hardcoded tokens added.

## Hostile-reader pass

*(Pre-investigation by the Orchestrator identified specific scenarios that the Kimi Reviewer must independently verify.)*

- **(a) Sticker from non-allowlisted user:** Does C1 short-circuit at access control before route-unmatched telemetry fires?
  - *Verified:* `routeMessage` calls `normalizeMessage` first (yielding `routeKind: "unsupported"`), then `isAllowlisted` (line ~193). For a non-allowlisted user, `logAccessDenied` is emitted and the function returns **before** the switch statement, so `route_unmatched` telemetry is correctly suppressed. The user receives no message (pre-existing behavior for non-allowlisted users).

- **(b) 4096-char text starting with `/история` followed by 4090 chars of Cyrillic:** Is routing check capped at 256 chars and does it still recognize the command?
  - *Verified:* The guard `text.slice(0, ROUTING_LOWERCASE_CAP).toLowerCase().startsWith("/история")` only inspects the first 256 chars. If `/история` is within the first 256 chars, it is recognized; if it starts after char 257, it is not. Test at `entrypoint.test.ts:731` covers the latter case (history handler NOT called, textMeal called). Correct.

- **(c) Emit-boundary redaction with BOTH forbidden field AND non-allowlisted core key:** What is the order of operations?
  - *Verified:* `emitLog` performs two passes: (1) allowlist filter — only `CORE_EVENT_KEYS` and `ALLOWED_EXTRA_KEYS` pass through; everything else is dropped. (2) forbidden-field loop — any surviving key in `LOG_FORBIDDEN_FIELDS` is coerced to `[REDACTED]`. Since no current core key is in `LOG_FORBIDDEN_FIELDS`, there is no overlap. A key injected directly into the event object that is in `LOG_FORBIDDEN_FIELDS` but **not** in `CORE_EVENT_KEYS` or `ALLOWED_EXTRA_KEYS` is dropped in pass (1) and never reaches pass (2). Test at `events.test.ts:214-225` verifies this for `raw_transcript`. Order is safe (allowlist-first), but the broken test at line 199 should be fixed (see F-M1).

- **(d) `createMetricsServer` with host `"::ffff:0.0.0.0"` (IPv4-mapped IPv6 wildcard):** Is it rejected?
  - *Finding:* **NO** — it is accepted. The guard only checks exact equality with `"::"` and `"[::]"`. Node.js treats `"::ffff:0.0.0.0"` as an all-interfaces IPv4 wildcard, bypassing the prohibition. See F-L2.

- **(e) Sticker handling with malformed sticker payload (missing `file_id`):** Does C1 still emit route-unmatched telemetry without crashing?
  - *Verified:* `normalizeMessage` checks `message.sticker` truthiness (not `message.sticker.fileId`). A truthy but malformed sticker object routes to `unsupported`, `sourceLabel: "sticker"`, and `messageSubtype: "sticker"`. The `sticker` property is copied into `NormalizedTelegramUpdate` but is never dereferenced in the unsupported handler path (line 265-279), so no crash occurs and telemetry is emitted correctly.

## Suggested follow-up TKTs

- **TKT-FOLLOWUP-001@0.1.0** (deferred): Harden `createMetricsServer` host validation to reject all IPv4/IPv6 wildcard forms (including `::ffff:0.0.0.0`, `0:0:0:0:0:0:0:0`, etc.) with a robust allowlist approach rather than exact-string denylist. This is a security enhancement beyond TKT-015@0.1.0 scope.

## Rollback command if PR must be reverted

```bash
git checkout main && git revert -m 1 <merge-commit-sha>
```

(Replace `<merge-commit-sha>` with the actual merge commit SHA after merge.)

---

## Iter-2 review (head: fb4e7ba)

### Per-finding outcomes

- **F-M1**: **RESOLVED** — Test renamed to `"core keys pass through verbatim even if directly mutated (F-M1 rename)"` at `events.test.ts:196`; new test added at lines 206-217 `"emitLog forces LOG_FORBIDDEN_FIELDS to [REDACTED] when injected into event (F-M1 fix)"` injects `raw_transcript` directly into event object (bypassing `buildRedactedEvent` allowlist) and asserts `meta.raw_transcript === "[REDACTED]"`. The `emitLog` implementation was also hardened: the force-redaction loop now checks `forbidden in meta` (the original, unfiltered event copy) rather than `forbidden in redactedMeta`, so keys dropped by the allowlist are still caught and coerced to `[REDACTED]`. Verified: no overlap exists between `LOG_FORBIDDEN_FIELDS` and `CORE_EVENT_KEYS`, so core keys cannot be accidentally redacted. The test would **fail** if the force-redaction loop were removed, proving it exercises the security boundary.

- **F-M2**: **RESOLVED** — `MetricsRegistry` wired into `C1Deps` at `src/telegram/types.ts:94`; mock registry added to `makeDeps` in `tests/telegram/entrypoint.test.ts:35-41`; `deps.metricsRegistry.increment(PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count, { component: "C1", source: update.messageSubtype ?? "unknown" })` added in `src/telegram/entrypoint.ts` at the `"unsupported"` switch case (line 266-269), ensuring the metric is incremented **in the routing path**, not merely in a logging path. New test at `entrypoint.test.ts:725-738` asserts `metricsRegistry.increment` was called with `PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count` and `expect.objectContaining({ component: "C1", source: "sticker" })`.

- **F-L1**: **RESOLVED automatically** — `PROMETHEUS_METRIC_NAMES` import at `src/telegram/entrypoint.ts:3` is now consumed by the F-M2 metric increment call, so the unused-import warning is eliminated.

- **F-L2**: **RESOLVED** — Bind guard extended with `|| host === "::ffff:0.0.0.0"` at `src/observability/metricsEndpoint.ts:206`; error message updated to include `::ffff:0.0.0.0`. New test added at `tests/observability/metricsEndpoint.test.ts:264-269` asserting `createMetricsServer("::ffff:0.0.0.0", 9464)` throws.

### Iter-2 metrics

- `npm test -- tests/telegram/entrypoint.test.ts tests/observability/events.test.ts tests/observability/metricsEndpoint.test.ts`: **106/106 pass** (up from 104/104 — 2 new tests added for F-M2 metric increment + F-L2 IPv4-mapped wildcard rejection).
- `npm run lint`: zero errors.
- `npm run typecheck`: zero errors.
- `python3 scripts/validate_docs.py`: **39/39 artifacts pass**.

### Iter-2 verdict

- [x] pass
- [ ] pass_with_changes
- [ ] fail

One-sentence justification: Both medium findings (F-M1 broken security test, F-M2 missing metric increment) are fully resolved with correct implementation, proper test coverage, and no regressions; low findings resolved as collateral.

Recommendation to PO: **Approve for merge** — all iter-1 blockers addressed, all 106 targeted tests pass, lint/typecheck/docs clean. Low findings resolved, no additional iterations required.

### Iter-2 hostil-reader probe (delta)

- **(d) `createMetricsServer` with `"::ffff:0.0.0.0"`:** Now correctly rejected with the same error constructor as `"0.0.0.0"` rejection. Verified by test `metricsEndpoint.test.ts:264-269` and confirmed by reading `metricsEndpoint.ts:206`.

### No new findings in iter-2

All changed codepaths were already within the TKT-015@0.1.0 scope. No new runtime dependencies, no TODOs/FIXMEs, no scope creep.

