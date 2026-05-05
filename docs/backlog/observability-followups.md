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
