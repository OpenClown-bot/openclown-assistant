---
id: BACKLOG-002
title: "Food Lookup KBJU Estimator follow-ups (post TKT-006)"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-04-30
---

# Food Lookup KBJU Estimator follow-ups (post TKT-006)

Deferred low-severity work surfaced during the TKT-006 (Food Lookup KBJU Estimator) review cycle. Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations: `docs/reviews/RV-CODE-006-tkt-006-food-lookup-kbju-estimator.md` (Findings §Low). PO decision (Option A) on 2026-04-30 was to fix F-M1, F-M2, F-M3 in iter-2 and defer F-L1, F-L2, F-L3 to this backlog.

## TKT-NEW-E — Remove dead code `isPromptOrResponseSafeForLogging`

**Source:** RV-CODE-006 iter-1 finding F-L1 (low).

**The issue.** `src/llm/omniRouteClient.ts:316-326` exports `isPromptOrResponseSafeForLogging` but the function is never called anywhere in the codebase. `buildLogEvent` already handles redaction via `LOG_FORBIDDEN_FIELDS`. The dead export adds maintenance surface and confuses readers about whether observability redaction is centralised.

**Proposed fix (Architect to ratify).** Either: (a) remove the export and the function, OR (b) wire `isPromptOrResponseSafeForLogging` into the log-emit path with a regression test, replacing the implicit `LOG_FORBIDDEN_FIELDS` filter for prompt/response fields. Option (a) is the lower-risk default; option (b) would require an ADR if the intent was to have an additional defense-in-depth check.

**NOT in scope of the eventual TKT.** Refactoring `LOG_FORBIDDEN_FIELDS` itself; redesigning observability event schema; migrating to OpenTelemetry semantic conventions.

**Estimated size:** XS. Tests: existing observability tests stay green; one negative test confirming `prompt`/`response` fields never appear in any emitted log event regardless of input.

**Dependencies:** none. TKT-006 already done.

---

## TKT-NEW-F — Deep-freeze `MANUAL_ENTRY_FAILURE_RESULT`

**Source:** RV-CODE-006 iter-1 finding F-L2 (low).

**The issue.** `src/kbju/types.ts:58-64` defines `MANUAL_ENTRY_FAILURE_RESULT` as a module-level constant object. The estimator returns it via shallow spread (`{ ...MANUAL_ENTRY_FAILURE_RESULT }`), which copies the top-level object but shares the nested `items` array and `totalKBJU` object with the original constant. A downstream mutation (e.g. an aggregator pushing onto `items`) would corrupt the constant for all future callers.

**Proposed fix (Architect to ratify).** Either: (a) deep-freeze the constant via a recursive `Object.freeze` helper at module load, raising errors on any mutation attempt, OR (b) return a factory function `createManualEntryFailureResult(): EstimateResult` that constructs a fresh object each time, eliminating the shared-reference risk entirely. Option (b) is cleaner; option (a) is closer to the existing pattern but relies on strict-mode enforcement.

**NOT in scope of the eventual TKT.** General immutability audit of all module-level constants; introducing `immer` or other immutable libraries; rewriting `EstimateResult` shape.

**Estimated size:** XS. Tests: mutation attempts on the returned object do not affect subsequent callers (assertion: two parallel calls return independent objects whose `items.push` does not cross-contaminate).

**Dependencies:** none. TKT-006 already done.

---

## TKT-NEW-G — Decouple `LLM_TIMEOUT_MS` from KBJU domain

**Source:** RV-CODE-006 iter-1 finding F-L3 (low).

**The issue.** `src/llm/omniRouteClient.ts:10` imports `LLM_TIMEOUT_MS` from `../kbju/types.js`, coupling the generic LLM transport layer to the KBJU domain. This makes reuse of `omniRouteClient.ts` by non-KBJU tickets harder; any future TKT that calls OmniRoute for a non-KBJU purpose (e.g. summarisation, classification) would have to either import a misleadingly-named constant from `kbju/types` or override the timeout per-call.

**Proposed fix (Architect to ratify).** Move `LLM_TIMEOUT_MS` to a domain-neutral location, e.g. `src/shared/constants.ts` or `src/llm/constants.ts`. Update the existing import in `omniRouteClient.ts` and any KBJU-side import to point to the new location. Keep the same numeric value to avoid behavioural change.

**NOT in scope of the eventual TKT.** Restructuring `src/llm/` into a separate package; introducing per-purpose timeouts (would need an ArchSpec change); migration to a shared HTTP client library.

**Estimated size:** XS. Tests: existing KBJU + LLM tests stay green; no new test required (constant relocation is mechanical).

**Dependencies:** none. TKT-006 already done.
