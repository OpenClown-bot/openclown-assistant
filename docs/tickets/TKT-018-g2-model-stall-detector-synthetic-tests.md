---
id: TKT-018
title: "G2 model-stall detector and synthetic tests"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-018: G2 model-stall detector and synthetic tests

## 1. Goal
Wrap every routed streaming LLM call with a token-stall watchdog that alerts within 15 seconds after the configured threshold is crossed.

## 2. In Scope
- Add C13 per-call watchdog middleware around routed streaming LLM calls.
- Use the zeroclaw polling pattern as algorithm inspiration while implementing idiomatic TypeScript.
- Default threshold is 120000 ms; support per-role overrides.
- Add synthetic tests for 120 s, 300 s, and 600 s stalls using fake timers.

## 3. NOT In Scope
- No Rust/WASM dependency.
- No provider-health ping calls that spend extra tokens.
- No wrapping non-streaming image/batch calls unless they expose streaming token output.
- No changing model selection policy beyond invoking the existing fallback path on stall.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §3.13, §8, §12.
- ADR-012@0.1.0 and PRD-002@0.2.1 §2 G2.
- `src/llm/omniRouteClient.ts`, `src/observability/events.ts`, `src/observability/kpiEvents.ts`.
- Tests under `tests/llm/**` and `tests/observability/**`.

## 5. Outputs
- [ ] `src/observability/stallWatchdog.ts` or equivalent C13 module.
- [ ] Integration in the LLM-router call path for all streaming text LLM calls.
- [ ] Metrics/log event for `kbju_llm_call_stalled` with bounded labels.
- [ ] Synthetic fake-timer tests covering normal streaming, 120 s stall, 300 s stall, 600 s stall, and fallback exhaustion.

## 6. Acceptance Criteria
- [ ] With threshold 120000 ms, a fake streaming call with no token for 120001 ms emits `kbju_llm_call_stalled` within the next 15000 ms of fake time.
- [ ] The same assertion passes for 300000 ms and 600000 ms thresholds.
- [ ] A fake stream producing token deltas every threshold/4 emits zero stall events.
- [ ] On first stall, the original request is aborted through `AbortController` or equivalent typed cancellation and the configured fallback path is invoked once.
- [ ] After `STALL_MAX_RETRIES` fallback stalls, the call fails fast with a typed error and no stale late response is applied.
- [ ] `npm run lint`, `npm run typecheck`, targeted tests, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Source: PR-B supplies PRD-compatible 120 s default; PR-C supplies zeroclaw algorithm evidence; PR-A contributes no load-bearing G2 topology.
- The watchdog observes token velocity, not channel/WebSocket keepalive.
- Metric labels must not contain raw prompt text or full user identifiers.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-018@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-018-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets. Executor appends timestamped entries below this line.

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.

