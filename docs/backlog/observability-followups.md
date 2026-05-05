---
id: BACKLOG-006
title: "Observability follow-ups (post TKT-015)"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-01
---

# Observability follow-ups (post TKT-015)

Deferred work surfaced during the TKT-015 (Observability Hardening) review cycle. Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations:
- Reviewer (Kimi K2.6): `docs/reviews/RV-CODE-015-tkt-015-observability-hardening.md`. Iter-1 pass_with_changes (2M + 2L), iter-2 pass (all four RESOLVED including F-M1 promoted from PR-Agent F-PA-15).
- Supplementary reviewer (PR-Agent / Qwen 3.6 Plus on OmniRoute): persistent review block on PR #58 (commit `fb4e7ba`).

PO decision on 2026-05-01 was to fix all Kimi findings (1M-promoted-from-PR-Agent + 1M + 2L) in iter-2 and defer the single PR-Agent observability-class finding below to this backlog. F-PA-15 was VALID and was promoted into Kimi iter-2 scope as F-M1, resolved in-cycle — not a backlog entry. The cosmetic Operator Precedence Clarity nit on the routing-condition ternary `||` chain was skipped as non-substantive.

## TKT-NEW-P — Reorder C1 unsupported-message metric increment vs send-with-retry to prevent metric/log mismatch on send failure

**Source:** PR #58 PR-Agent persistent review on iter-2 commit `fb4e7ba` ("Observability Gap on Send Failure", importance 7, observability/correctness class).

**The issue.** In `src/telegram/entrypoint.ts:266-283`, the `"unsupported"` switch case in `routeMessage` invokes:

```
deps.metricsRegistry.increment(
  PROMETHEUS_METRIC_NAMES.kbju_route_unmatched_count,
  { component: "C1", source: update.messageSubtype ?? "unknown" }
);
await sendWithRetry(deps, { chatId, text: MSG_GENERIC_RECOVERY, ... }, ...);
logRouteOutcome(deps, update, "unsupported_message_type", { message_subtype: ... });
```

The `metricsRegistry.increment(...)` call is synchronous and happens **before** `await sendWithRetry(...)`. If `sendWithRetry` throws (e.g. Telegram Bot API 5xx after exhausted retries, network failure, or any unhandled rejection inside the retry helper), execution unwinds out of the switch block before reaching `logRouteOutcome`. The result is a Prometheus metric increment that records "we routed an unsupported message" without a corresponding `route_unmatched` log entry — creating a metric/log emission mismatch that breaks the observability invariant that every metric increment has a corresponding structured log row.

For incident response, this means a Prometheus alert based on `kbju_route_unmatched_count` cannot be cross-referenced against logs to identify which user / chat / message_id triggered the unsupported-message path when the send fails. The drift is bounded — `sendWithRetry` rarely throws under normal Telegram operation — but the invariant should hold under all conditions, especially during outage windows when alerting matters most.

**Proposed fix (Architect to ratify or Executor to apply directly when triggered).** Two approaches; Architect picks one based on whether observability invariants should be enforced in shared utilities or per-call-site:

(a) **Per-call-site try/finally.** Wrap the increment + send + log block in `try { ... } finally { logRouteOutcome(...); }`, with the metric increment INSIDE the try block AFTER the `await sendWithRetry`. This guarantees the log row is emitted even if send throws, and the metric is incremented only on the path that actually emitted a Telegram response. Add a regression test injecting a `sendWithRetry` failure and asserting both: (i) `logRouteOutcome` was called with `outcome: "unsupported_message_type"` and `error: <err>`, (ii) `metricsRegistry.increment` was NOT called when send failed.

(b) **Shared invariant helper.** Refactor the increment + send + log triplet into a `recordRouteOutcome(deps, update, outcome, extra, sendFn)` helper in `src/observability/`. Helper internally guarantees log-then-metric ordering with try/finally semantics. Apply to both the unsupported-message path and any future C1 routing branches that need similar ordering. Add tests for the helper covering success path, send-throws path, and log-throws path.

Apply the same pattern to any other call site found via `grep -rn "metricsRegistry.increment" src/telegram/` to prevent recurrence in future C1 branches.

**NOT in scope of the eventual TKT.** Schema changes to log/metric formats; introducing a metrics-aggregation library; reordering metric/log emission in non-C1 components (C4, C6, C7) — those are evaluated as separate backlog items if surfaced.

**Estimated size:** XS (path a — local refactor + 1 regression test) to S (path b — new helper + per-site migration + 3 tests).

**Dependencies:** None. TKT-015@0.1.0 already done.

## TKT-NEW-wire-breach-detector-into-production-boot-path — Wire BreachDetector + BreachDetectingTenantStore into the sidecar production boot path so /kbju/health and breach events fire under real traffic

**Source:** Reviewer (Kimi K2.6) finding `F-M1` on RV-CODE-017 PR #121 against TKT-017@0.1.0 PR #120 final HEAD `d227b6bf1314ab6b480827254dcad448b5885902`. Severity Medium. Accepted as BACKLOG-deferred per Devin Orchestrator triage on 2026-05-05; Reviewer accepted the deferral on iter-2 verify pass. Cross-referenced in `docs/reviews/RV-CODE-017-tkt-017-g1-tenant-isolation-breach-detector.md` § Findings § Medium § F-M1, § Iter-2 verification block § F-M1, and TKT-017@0.1.0 frontmatter `completed_note`.

**The issue.** TKT-017@0.1.0 delivered a working, well-tested `BreachDetector` class (`src/observability/breachDetector.ts`) and a `BreachDetectingTenantStore` wrapper (`src/store/tenantStore.ts:910`). The TKT also added an optional `breachDetector?: BreachDetector` slot on `C1Deps` (`src/telegram/types.ts:95`) and surfaced `breach_count_last_hour` in the `/kbju/health` JSON response (`src/main.ts:78`). All six §6 acceptance criteria are satisfied by tests (`tests/observability/breachDetector.test.ts`, 36 tests under fake timers and a live `/kbju/health` `http.request`).

However, `createSidecarDeps()` in `src/sidecar/factory.ts` does NOT instantiate a `BreachDetector` and does NOT wrap the inner `TenantPostgresStore` with `BreachDetectingTenantStore` before returning `C1Deps`. The production boot path is `src/main.ts:268` → `createServer()` (no explicit `deps` argument) → `effectiveDeps = createSidecarDeps(pilotUserIds)` — which leaves `deps.breachDetector` `undefined` and the underlying `TenantStore` unguarded. The functional consequences:

1. `/kbju/health` will always serialize `breach_count_last_hour: 0` because `src/main.ts:78` reads `deps.breachDetector?.getBreachCountLastHour() ?? 0` and the optional chain short-circuits.
2. No real cross-tenant access via the production `TenantStore` will ever emit a `kbju_tenant_breach_detected` event because the wrapper is not in the dependency graph. PostgreSQL Row-Level Security (`set_config('app.user_id', $1, true)` inside `TenantPostgresStore.withTransaction`, per ADR-001@0.1.0 §Decision and ARCH-001@0.5.0 §9.2) will still block the data access — so this is NOT a data-isolation regression — but the G1 alarm is silent for any real attempt, defeating the intent of PRD-002@0.2.1 §2 G1 ("detect every cross-tenant access").

The detector is correct in synthesis but inert in production. This is the gap Kimi flagged as F-M1 importance Medium.

**Why this was deferred to BACKLOG instead of resolved in TKT-017 iter-2.** TKT-017@0.1.0 §5 Outputs lists `src/observability/breachDetector.ts`, `src/observability/kpiEvents.ts`, `src/store/tenantStore.ts`, `src/main.ts`, `src/telegram/types.ts`, and the test file — but does NOT list `src/sidecar/factory.ts`. TKT-017@0.1.0 §6 Acceptance Criteria require synthetic detection (cross-tenant attempts in tests) plus the `/kbju/health` numeric field — both verified by AC-1 through AC-6 — but do NOT mandate production boot-path wiring as part of the same ticket. Wiring the detector is a follow-up that touches the sidecar seam and crosses into the C1Deps initialization layer (which TKT-016@0.1.0 owned end-to-end). It deserves a focused ticket rather than scope-creep on TKT-017@0.1.0 iter-2.

**Proposed fix (Architect to ratify into a TKT, then Executor to apply).** Touch ONLY `src/sidecar/factory.ts:53` (or wherever `createSidecarDeps()` builds the dependency graph) and a corresponding boot-path test. Specifically:

1. Inside `createSidecarDeps(pilotUserIds, ...)`:
   - Instantiate one `BreachDetector` per process: `const breachDetector = new BreachDetector({ emit: deps.observability.emit, now: () => new Date(), hashUserId: (id) => createHash('sha256').update(id).digest('hex').slice(0, 16) })`. Inject `emit` from the existing observability dep, NOT a new sink — this routes redacted breach events through the same logging pipeline as other KPI events and lets PII patterns from `src/observability/events.ts` audit them in transit.
   - Wrap the inner `TenantPostgresStore` (or whichever production `TenantStore` implementation `createSidecarDeps` constructs) with `new BreachDetectingTenantStore(innerStore, authenticatedUserId, breachDetector)`. The `authenticatedUserId` is the per-request authenticated user; if `createSidecarDeps` returns a singleton store, the wrapper must be created per-request inside the C1 dispatcher rather than at boot. Architect to choose between (a) per-request wrapping inside the C1 router or (b) a `TenantStoreFactory` that mints a fresh wrapped store given an authenticated `userId`.
   - Return both fields on `C1Deps`: `breachDetector` (so `/kbju/health` reads the live count) and the wrapped `tenantStore` factory.

2. Add a deployment / boot-path test in `tests/deployment/bootEntrypoint.test.ts` (or `tests/sidecar/factory.test.ts` if it exists) that:
   - Boots the sidecar via the production entrypoint with a mock or in-memory `TenantStore`.
   - Issues a synthetic cross-tenant access through the C1 router with `authenticatedUserId !== dataOwnerUserId`.
   - Asserts that exactly one `kbju_tenant_breach_detected` event was emitted via the production observability sink AND that `GET /kbju/health` returns `breach_count_last_hour: 1`.
   - Does NOT use the `BreachDetectingTenantStore` constructor directly — the test must exercise `createSidecarDeps` so that any future regression in the boot path (e.g., someone removing the wrap) breaks this test.

3. Update ADR-001@0.1.0 OR open a new ADR to document the per-request-wrapping vs factory choice, since this affects the C1Deps lifecycle contract. Architect calls.

**NOT in scope of the eventual TKT.** Persisting breach events to a durable store (TKT-017@0.1.0 §3 explicitly excluded this; rolling-hour counter remains ephemeral). Adding new metric names beyond `kbju_tenant_breach_detected`. Changing the redaction model. Wiring breach events into the Prometheus exporter (separate ADR if needed). Refactoring `createSidecarDeps` in ways that don't directly serve this wiring. Adding a `BreachDetectingTenantScopedRepository` proxy for transaction-internal cross-tenant access — that path is documented by JSDoc on `BreachDetectingTenantStore.withTransaction` as relying on RLS per ADR-001@0.1.0 §Decision and ARCH-001@0.5.0 §3.12 + §9.2; reopening that decision is out of scope here.

**Estimated size:** S (focused boot-path wire + 1 deployment test + minor C1Deps lifecycle decision). Roughly 80–150 LoC in `src/sidecar/factory.ts` + test, plus an ADR update if the per-request-wrapping decision warrants it.

**Dependencies:** TKT-016@0.1.0 (boot entrypoint + sidecar seam, done) and TKT-017@0.1.0 (BreachDetector + BreachDetectingTenantStore implementation, done) must already be on `main` — both are as of 2026-05-05.

## TKT-NEW-wire-stall-watchdog-per-delta-after-streaming-refactor — Wire C13 StallWatchdog `touch()` into the per-delta streaming-token receive path of `callOmniRoute()` after the upcoming streaming refactor

**Source:** Reviewer (Kimi K2.6) finding `F-LOW-1` on RV-CODE-018 PR #126 against TKT-018@0.1.0 PR #125 final HEAD `0c7a76e`. Severity Low. Accepted as BACKLOG-deferred per Devin Orchestrator triage on 2026-05-05; Kimi did not require iter-2. Cross-referenced in `docs/reviews/RV-CODE-018-tkt-018-g2-model-stall-detector-synthetic-tests.md` § Findings § Low § F-LOW-1 and TKT-018@0.1.0 frontmatter `completed_note`.

**The issue.** TKT-018@0.1.0 delivered the C13 `StallWatchdog` middleware (`src/observability/stallWatchdog.ts`) and integrated it into `callOmniRoute()` in `src/llm/omniRouteClient.ts` at the **request boundary** — the watchdog is started before `await fetch(...)`, observes `AbortError` from `AbortController.abort()` if the fetch never resolves within `STALL_THRESHOLD_MS` per `ADR-012@0.1.0`, and either fires `kbju_llm_call_stalled` + invokes the fallback path via `retryOnce()` or returns a `stall_detected` outcome. All seven §6 Acceptance Criteria are satisfied by tests under fake timers (10 cases in `tests/observability/stallWatchdog.test.ts` + 1 kill-switch integration in `tests/llm/omniRouteClient.test.ts`).

However, `StallWatchdog.touch()` is **not invoked per streaming token delta** in the production integration. The watchdog interval poll (`setInterval(check, STALL_DETECTION_WINDOW_MS)`) still detects stalls correctly because the request itself never resolves while no tokens flow — but the semantic the PRD-002@0.2.1 §2 G2 promises is "watchdog observes token velocity" (`docs/prd/PRD-002-observability-and-scale-readiness.md` §2 G2 acceptance: "no token within `STALL_THRESHOLD_MS`"). With the current request-boundary integration, a slow-but-not-stalled provider that streams one token every `STALL_THRESHOLD_MS - 1` seconds would never fire `touch()`, but also would never stall by the watchdog's definition, so detection still works. The gap is conceptual: the watchdog reacts to *fetch-completion* timing, not *token-delta* timing.

This becomes a real correctness gap once `callOmniRoute()` is refactored to consume an async iterable / SSE stream of token deltas (the upcoming streaming refactor). At that point, the fetch promise resolves quickly with a `Response` object whose `body` is a stream that may stall mid-emit. Without per-delta `touch()` calls, the watchdog would see the request as "completed" and stop, even though the stream stalled. The G2 detector would silently fail in production for streaming providers.

**Why this was deferred to BACKLOG instead of resolved in TKT-018.** TKT-018@0.1.0 §5 Outputs lists "Integration in the LLM-router call path for all streaming text LLM calls" — but `callOmniRoute()` as it exists on main is **not** a streaming consumer; it does a single `await fetch(...)` with `LLM_TIMEOUT_MS=15000` client-side abort and returns the parsed JSON body. There is no per-delta callback to wire `touch()` into yet. The streaming refactor that introduces async-iterable response handling is a separate architectural change (likely a new ADR + a new TKT covering both the client refactor and the watchdog per-delta wiring), and Kimi's F-LOW-1 explicitly notes the watchdog's `touch()` API is correctly designed for streaming use ("the public API is sound; the integration site does not yet exist") and that the current request-boundary integration is sufficient for the synthetic ACs of TKT-018 (which use fake timers around fake `Promise<never>` fetches).

**Proposed fix (Architect to ratify into a TKT, then Executor to apply alongside the streaming refactor).** Touch ONLY `src/llm/omniRouteClient.ts` and the relevant test files. Specifically:

1. Inside the streaming-refactored `callOmniRoute()` (whichever shape the Architect specifies — `for await (const delta of response.body)`, `EventSource` SSE handler, or chunked-transfer-decoded `ReadableStreamDefaultReader`):
   - Inside the per-delta loop, call `watchdog.touch()` on every non-empty token delta. Skip empty / heartbeat deltas (provider-specific) to avoid false-negative reset of the stall counter on keepalive frames that don't carry tokens.
   - Preserve the request-boundary `start()` / `stop()` calls; the per-delta `touch()` is *additive*, not a replacement for the boundary integration.
   - Architect to decide whether `kbju_llm_call_stalled` event labels need a new bounded `last_delta_age_ms` field for diagnostic purposes, or whether the existing `actual_stall_ms` is sufficient.

2. Add a synthetic streaming test under `tests/llm/omniRouteClient.test.ts` (or a new `tests/llm/omniRouteClientStreaming.test.ts` if the test surface area justifies a new file):
   - Fake an SSE / async-iterable response that emits tokens for `STALL_THRESHOLD_MS / 2`, then halts mid-stream for `STALL_THRESHOLD_MS + 1` ms of fake time without emitting `[DONE]`.
   - Assert exactly one `kbju_llm_call_stalled` event is emitted within `STALL_DETECTION_WINDOW_MS` of the last delta, with `actual_stall_ms` rounded to the threshold-window precision.
   - Assert the per-delta `touch()` resets the watchdog correctly across multiple delta-batch boundaries (not just the first batch).

3. Update `ADR-012@0.1.0` OR open a new ADR to document the "streaming watchdog wiring contract" if the Architect decides the per-delta `touch()` semantics warrant explicit specification rather than being left as an integration-level convention. Architect calls.

**NOT in scope of the eventual TKT.** Refactoring the OmniRoute provider abstraction itself (separate concern handled by the streaming-refactor TKT). Adding new metric names beyond what the G2 watchdog already emits. Changing `STALL_THRESHOLD_MS` defaults. Wiring `touch()` into non-streaming code paths (e.g., image / batch endpoints — those don't stream tokens). Adding a `StreamingStallWatchdog` subclass — the existing `StallWatchdog` API is sufficient per Kimi's review.

**Estimated size:** XS (one `touch()` call inside the streaming refactor's per-delta loop + one regression test). Roughly 5–15 LoC of integration code + 30–60 LoC of test setup. Most of the size is in the streaming refactor itself, which this ticket explicitly does NOT cover.

**Dependencies:** Hard-blocked on the streaming refactor TKT (not yet filed). Soft-blocked on the same Architect decision that produces the streaming refactor's ADR. Likely batched with `TKT-NEW-rewrite-callomniroute-stall-retry-loop-after-streaming-refactor` and `TKT-NEW-reconcile-llm-timeout-ms-with-stall-threshold-default` into a single follow-up since all three resolve once `callOmniRoute()` consumes streams natively.

## TKT-NEW-reconcile-llm-timeout-ms-with-stall-threshold-default — Reconcile the 15-second `LLM_TIMEOUT_MS` client abort with the 120-second default `STALL_THRESHOLD_MS` so the watchdog's stall-detection window is reachable for non-streaming calls

**Source:** Reviewer (Kimi K2.6) finding `F-LOW-2` on RV-CODE-018 PR #126 against TKT-018@0.1.0 PR #125 final HEAD `0c7a76e`. Severity Low. Accepted as BACKLOG-deferred per Devin Orchestrator triage on 2026-05-05; Kimi did not require iter-2. Cross-referenced in `docs/reviews/RV-CODE-018-tkt-018-g2-model-stall-detector-synthetic-tests.md` § Findings § Low § F-LOW-2 and TKT-018@0.1.0 frontmatter `completed_note`. Architecturally subsumes Qodo PR-Agent Finding A on PR #125 ("stallRetryCount re-initialized in retryOnce recursion" — the literal recursion claim was false, but the retry-loop coverage gap PR-Agent surfaced is a downstream consequence of this same `LLM_TIMEOUT_MS` vs `STALL_THRESHOLD_MS` mismatch).

**The issue.** `src/llm/omniRouteClient.ts` reads two independent timeouts:

```
LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS ?? "15000", 10)  // default 15s
STALL_THRESHOLD_MS = parseInt(process.env.STALL_THRESHOLD_MS ?? "120000", 10)  // default 120s per ADR-012@0.1.0
```

`LLM_TIMEOUT_MS` is enforced as a `setTimeout(() => abortController.abort(), LLM_TIMEOUT_MS)` on the outer fetch. `STALL_THRESHOLD_MS` is enforced by the `StallWatchdog` interval poll. For a non-streaming call (current `callOmniRoute()` shape), the fetch must complete within 15s or the client-abort fires first — long before the 120s watchdog window can elapse. Practically, no real-world non-streaming LLM call will ever trigger `kbju_llm_call_stalled` with the default thresholds, because `LLM_TIMEOUT_MS=15000` will always abort first with a generic `AbortError` that does not hit the watchdog's `isStallAbort()` discriminator.

The watchdog still works for the synthetic ACs (which use fake timers around `Promise<never>` fetches with `LLM_TIMEOUT_MS` overridden to a much larger value or disabled), and it will work for streaming calls once the streaming refactor lands and the per-delta `touch()` is wired (see `TKT-NEW-wire-stall-watchdog-per-delta-after-streaming-refactor`). But on production main as of 2026-05-05, the G2 detector is correctly deployed and instrumented yet effectively unreachable for the non-streaming code path.

PR-Agent's Finding A on PR #125 surfaced the related symptom from a different angle: the `executeWithStallWatchdog` retry loop's `STALL_MAX_RETRIES=2` bound is implemented inside `omniRouteClient.ts` via a counter that resets between callOmniRoute invocations, but the `retryOnce()` fallback helper does not iterate (it is a one-shot non-recursive helper, contrary to PR-Agent's literal claim). The architectural gap PR-Agent partially surfaced — that the retry loop never actually iterates beyond one fallback attempt in non-streaming mode — is the same surface as F-LOW-2: with `LLM_TIMEOUT_MS=15000`, the loop never gets a chance to iterate because the outer abort fires first.

**Why this was deferred to BACKLOG instead of resolved in TKT-018.** TKT-018@0.1.0 §5 Outputs are scoped to the watchdog implementation and its synthetic tests, not to the broader timeout-policy reconciliation that touches deployment configuration (`.env.example`, deployment docs) and may require an ADR amendment to clarify which timeout is the "outer envelope" and which is the "inner stall floor". Kimi's F-LOW-2 explicitly notes the gap is reachable only when `LLM_TIMEOUT_MS` is configured >= `STALL_THRESHOLD_MS + STALL_DETECTION_WINDOW_MS`, which is a configuration-policy decision the Architect should ratify rather than the Executor patching unilaterally.

**Proposed fix (Architect to ratify into a TKT, then Executor to apply).** Touch ONLY `src/llm/omniRouteClient.ts`, `.env.example` (or wherever defaults are documented), and either `ADR-012@0.1.0` (amendment) or a new ADR. Specifically:

1. Architect decides one of three policy options:
   - (a) **Outer-envelope-wins.** Document that `LLM_TIMEOUT_MS` is intentionally tighter than `STALL_THRESHOLD_MS`; the watchdog is purely defense-in-depth for streaming calls where `LLM_TIMEOUT_MS` does not apply per-delta. Update `.env.example` defaults so production sets `LLM_TIMEOUT_MS=180000` (or unset for streaming endpoints) when streaming is enabled. Document the reconciliation rule in `ADR-012@0.1.0` §Constraints.
   - (b) **Stall-threshold-wins.** Raise `LLM_TIMEOUT_MS` default to `STALL_THRESHOLD_MS + STALL_DETECTION_WINDOW_MS + buffer` (e.g., 150s) so the watchdog window is always reachable. Document in `ADR-012@0.1.0`.
   - (c) **Per-call-type policy.** Different timeouts for streaming vs non-streaming endpoints, with a `LLMCallKind` discriminator on `callOmniRoute()` arguments. New ADR.

2. Update `src/llm/omniRouteClient.ts` to enforce whichever policy is chosen with a runtime assertion (e.g., `assert(LLM_TIMEOUT_MS > STALL_THRESHOLD_MS + STALL_DETECTION_WINDOW_MS)` for option b) and emit a startup warning event if misconfigured.

3. Add a regression test asserting the policy invariant under both default and overridden environment variable values.

**NOT in scope of the eventual TKT.** Refactoring the timeout primitive itself (retain `setTimeout(() => abortController.abort())`). Introducing a third timeout (e.g., per-delta deadline) — that belongs to the streaming refactor TKT. Removing `LLM_TIMEOUT_MS` entirely.

**Estimated size:** S (one ADR amendment or new ADR + 5–10 LoC config + 1 regression test). Most of the size is in the Architect's policy decision documentation.

**Dependencies:** None hard. Soft-blocked on the streaming refactor decision, since option (c) above only makes sense if streaming is being added in the same cycle. Likely batched with `TKT-NEW-wire-stall-watchdog-per-delta-after-streaming-refactor` and `TKT-NEW-rewrite-callomniroute-stall-retry-loop-after-streaming-refactor` into a single follow-up.

## TKT-NEW-rewrite-callomniroute-stall-retry-loop-after-streaming-refactor — Rewrite the `callOmniRoute()` stall-retry loop so `STALL_MAX_RETRIES` actually bounds iteration count under streaming consumption

**Source:** Qodo PR-Agent (GPT-5.3 Codex via OmniRoute) Finding A on PR #125 persistent review block, posted 2026-05-05 21:29 UTC after PR un-draft. Severity Low. Importance 7. Triaged by Devin Orchestrator on 2026-05-05: literal claim ("stallRetryCount re-initialized in retryOnce recursion") was false — `retryOnce()` is a one-shot non-recursive helper at lines 341–420 of `src/llm/omniRouteClient.ts` that does its own `await fetch(...)` without invoking `callOmniRoute()` recursively. Subsurface architectural truth was valid: the outer retry loop in `callOmniRoute()` never iterates beyond one fallback attempt in non-streaming mode because of the same `LLM_TIMEOUT_MS` vs `STALL_THRESHOLD_MS` mismatch covered by `TKT-NEW-reconcile-llm-timeout-ms-with-stall-threshold-default`. Filed as F-LOW-PA1 in TKT-018@0.1.0 frontmatter `completed_note` triage. Cross-referenced in `docs/reviews/RV-CODE-018-tkt-018-g2-model-stall-detector-synthetic-tests.md` (Kimi F-LOW-2 covers the same architectural surface from the timeout-reconciliation angle).

**The issue.** `src/llm/omniRouteClient.ts:64` declares `let stallRetryCount = 0` once per `callOmniRoute()` invocation. The intent (per `ADR-012@0.1.0` §Decision: "fail fast after `STALL_MAX_RETRIES` consecutive stalls") is that on each detected stall, the function aborts the current attempt, increments `stallRetryCount`, calls the fallback (`retryOnce()`), and either returns the fallback's result or — if the fallback also stalls — increments again and either retries again or throws `StallExhaustedError`.

The actual implementation linearises this: `try fetch → if stall detected → retryOnce → return`. `retryOnce()` does its own non-watchdog'd `await fetch(...)` and returns. There is no outer `while (stallRetryCount < STALL_MAX_RETRIES)` loop in `callOmniRoute()`. So:

- AC-5 of TKT-018@0.1.0 §6 ("After `STALL_MAX_RETRIES` fallback stalls, the call fails fast with a typed error") is satisfied **only** by the `executeWithStallWatchdog()` middleware function in `src/observability/stallWatchdog.ts` (which DOES have the bounded loop), and AC-5's named test in `tests/observability/stallWatchdog.test.ts` covers the middleware in isolation.
- AC-5 is **not** structurally enforced by the integration site `callOmniRoute()`. If `retryOnce()` hangs, no second-level stall counter exists. PR-Agent caught this asymmetry but mis-described its mechanism as recursion.

This works correctly for the synthetic ACs because the middleware test exercises the loop directly. In production, with the current `LLM_TIMEOUT_MS=15000` outer abort, the loop never has a chance to iterate anyway (covered by F-LOW-2). Once the streaming refactor + timeout reconciliation lands, `callOmniRoute()` needs to be rewritten to invoke `executeWithStallWatchdog()` as its single entry point so the bounded loop is reachable from production code paths, not just from test code.

**Why this was deferred to BACKLOG instead of resolved in TKT-018.** TKT-018@0.1.0 §5 Outputs include the `StallWatchdog` middleware AND its integration into `callOmniRoute()`, but the integration as delivered satisfies AC-5 by middleware-isolation testing rather than by integration-level path coverage. Kimi accepted this as F-LOW-2 (timeout-reconciliation surface) and PR-Agent surfaced it as Finding A (retry-loop surface). Both findings collapse to the same fix: rewrite `callOmniRoute()` to consume `executeWithStallWatchdog()`'s loop directly once the streaming refactor allows the loop to actually iterate. Architect should ratify the rewrite scope; Executor applies.

**Proposed fix (Architect to ratify into a TKT, then Executor to apply alongside the streaming refactor).** Touch ONLY `src/llm/omniRouteClient.ts` and the relevant test files. Specifically:

1. Refactor `callOmniRoute()` to call `executeWithStallWatchdog(operation, { maxRetries: STALL_MAX_RETRIES, ... })` as its top-level execution wrapper. The `operation` callback contains the per-attempt fetch + parsing logic. The `executeWithStallWatchdog` middleware owns the retry loop, abort-and-fallback discipline, and `StallExhaustedError` emission.

2. Inline `retryOnce()` into the `operation` callback or remove it entirely if the middleware's bounded loop subsumes its purpose. Keep the kill-switch fail-closed check at the top of `callOmniRoute()` before invoking the middleware.

3. Add an integration-level regression test under `tests/llm/omniRouteClient.test.ts` that:
   - Configures the `LLM_TIMEOUT_MS` policy per the chosen option from `TKT-NEW-reconcile-llm-timeout-ms-with-stall-threshold-default`.
   - Stubs the underlying fetch to stall on every attempt with fake timers.
   - Asserts `callOmniRoute()` throws `StallExhaustedError` after exactly `STALL_MAX_RETRIES + 1` attempts (initial + retries).
   - Asserts exactly `STALL_MAX_RETRIES + 1` `kbju_llm_call_stalled` events are emitted, none with `actual_stall_ms < STALL_THRESHOLD_MS`.

**NOT in scope of the eventual TKT.** Changing the `StallWatchdog` API itself (Kimi already approved). Adding new event names. Modifying `STALL_MAX_RETRIES` default beyond what `ADR-012@0.1.0` specifies (currently 2). Refactoring the OmniRoute provider abstraction.

**Estimated size:** XS to S (~50–150 LoC rewrite of `callOmniRoute()` + 1 integration test). Most of the size is in unwinding the existing linear retry sequence into the middleware's bounded-loop call shape.

**Dependencies:** Hard-blocked on `TKT-NEW-reconcile-llm-timeout-ms-with-stall-threshold-default` (the timeout policy must be settled before the retry loop is rewritten, since the loop's iteration count is bounded by whichever timeout fires first). Hard-blocked on the streaming refactor TKT for the same reasons as `TKT-NEW-wire-stall-watchdog-per-delta-after-streaming-refactor`. Likely batched with both into a single follow-up TKT once the Architect ratifies the streaming refactor scope.
