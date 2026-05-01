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
