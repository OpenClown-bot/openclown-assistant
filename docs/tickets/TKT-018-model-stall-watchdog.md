---
id: TKT-018
title: "G2 C13 Model Stall Watchdog — streaming token-watchdog + Promise-race fallback"
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
component: "C13 Model Stall Watchdog"
depends_on: ["TKT-016@0.1.0"]
blocks: []
estimate: M
assigned_executor: "deepseek-v4-pro"
author_model: "claude-opus-4.7-thinking"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-018: G2 C13 Model Stall Watchdog — streaming token-watchdog + Promise-race fallback

## 1. Goal (one sentence, no "and")
Implement C13 by wrapping every `llmRouter.call(req)` invocation with a streaming token-watchdog that aborts on a configurable zero-token-output threshold (default 120000 ms per PRD-002@0.2.1 §2 G2) — emitting `stall_event` rows + PO Telegram alerts + `kbju_llm_stall_count_total` metric — with a Promise-race fallback for non-streaming call paths.

## 2. In Scope
- `src/llm/stallWatchdog.ts` — exports `withStallWatchdog<T>(callRole, threshold, run): Promise<T>` middleware function; updates `lastTokenAt` on each streaming chunk; `setInterval(threshold/2, checkStall)` polls; `AbortController.abort()` aborts on stall.
- `src/llm/router.ts` — wire `withStallWatchdog` around the existing `llmRouter.call` body; thread `call_role` from each call site.
- `src/observability/stallEvents.ts` — `recordStallEvent({request_id, call_role, elapsed_ms, prompt_token_count, provider_alias, model_alias})`; persists row + sends Telegram alert via the gateway send-message bridge endpoint + increments metric counter.
- `migrations/018_stall_events.sql` — creates `stall_events` table per ARCH-001@0.5.0 §5.2.
- `tests/llm/stallWatchdog.streaming.test.ts` — synthetic streaming-stall tests at 60s / 120s / 300s / 600s thresholds (zero-output never-resolves case + delayed-recovery case).
- `tests/llm/stallWatchdog.promiseRace.test.ts` — non-streaming Promise-race fallback tests.
- `tests/llm/stallWatchdog.staleResponse.test.ts` — stale-response discard test (recovery after abort).
- `tests/llm/stallWatchdog.dedup.test.ts` — request_id dedup window test (5-min LRU; same request_id within window → only one alert).
- Config validation for `STALL_THRESHOLD_MS_TEXT_LLM`, `STALL_THRESHOLD_MS_VISION_LLM`, `STALL_THRESHOLD_MS_TRANSCRIPTION` env vars (range `[60000, 600000]` ms; out-of-range clamps + warn).

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- LLM provider failover logic — already exists per ADR-002@0.1.0; this ticket only adds a stall-detection layer at `llmRouter.call()`.
- LLM response-content validation — only token-velocity timing is monitored.
- C12 tenant breach detection — that is TKT-017@0.1.0.
- Sidecar boot entrypoint — that is TKT-016@0.1.0.
- LLM cost tracking — already exists per TKT-003@0.1.0 / TKT-015@0.1.0.
- Manual stall recovery (the user gets `[STALL] please retry your request`; automatic retry is out of scope at v0.5.0 — future PRD).

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §3.13 (C13 Model Stall Watchdog), §4.9 (data flow), §5.2 (stall_events schema), §8.2 (G2 metric names), §9 (env vars), §11.2 (component-level tests).
- ADR-012@0.1.0 (full mechanism: threshold matrix, polling interval, dedup window, stale-response handling, synthetic test mandate).
- PRD-002@0.2.1 §2 G2 (120 s default, ≤15 s emission, 60s/300s/600s synthetic tests, ≤5% overhead).
- BACKLOG-011 §qwen-3.6-plus-128k-context-insufficient-for-executor.
- `docs/knowledge/llm-routing.md` (placement reference).
- `src/llm/router.ts` — current `llmRouter.call` shape.
- `src/observability/events.ts` — `buildRedactedEvent`, `emitLog`.
- zeroclaw `stall_watchdog.rs:29-124` — algorithmic reference (preserved in `docs/knowledge/agent-runtime-comparison.md` §zeroclaw).

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `src/llm/stallWatchdog.ts` exporting `withStallWatchdog<T>(opts: {callRole, threshold, requestId, run}): Promise<T>`.
- [ ] `src/llm/router.ts` updated to wrap each `llmRouter.call` invocation with `withStallWatchdog` (no other behavior changes).
- [ ] `src/observability/stallEvents.ts` exporting `recordStallEvent(payload): Promise<void>`.
- [ ] `migrations/018_stall_events.sql` creating `stall_events` table.
- [ ] `tests/llm/stallWatchdog.streaming.test.ts` (≥80% coverage; 4 thresholds × 2 cases = 8 sub-tests).
- [ ] `tests/llm/stallWatchdog.promiseRace.test.ts` (≥80% coverage; non-streaming fallback).
- [ ] `tests/llm/stallWatchdog.staleResponse.test.ts` (recovery-after-abort discard test).
- [ ] `tests/llm/stallWatchdog.dedup.test.ts` (5-min LRU dedup window test).
- [ ] No README / CONTRIBUTING / AGENTS.md edits.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm run typecheck` clean.
- [ ] `npm run lint` clean.
- [ ] `npm test -- tests/llm/stallWatchdog.streaming.test.ts` passes; coverage ≥80%.
- [ ] `npm test -- tests/llm/stallWatchdog.promiseRace.test.ts` passes; coverage ≥80%.
- [ ] `npm test -- tests/llm/stallWatchdog.staleResponse.test.ts` passes.
- [ ] `npm test -- tests/llm/stallWatchdog.dedup.test.ts` passes.
- [ ] Synthetic streaming-stall test at threshold=60000 ms: a fake LLM that never emits a chunk after 60 s causes `withStallWatchdog` to abort within `60000 + 30000` ms (30s = polling-interval ceiling) AND inserts a `stall_events` row with `elapsed_ms ≥ 60000`.
- [ ] Synthetic streaming-stall test at threshold=120000 ms: same as above with 120s threshold.
- [ ] Synthetic streaming-stall test at threshold=300000 ms: same as above with 300s threshold.
- [ ] Synthetic streaming-stall test at threshold=600000 ms: same as above with 600s threshold.
- [ ] Delayed-recovery test (chunks emitted at intervals smaller than threshold): watchdog does NOT abort; no stall_events row.
- [ ] Stale-response test: when LLM resumes after the watchdog has aborted, the late chunk is discarded (logged `stale_response_discarded`) and NO user reply is sent for the stale chunk.
- [ ] Dedup test: two stalls with the same `request_id` within a 5-minute window cause exactly ONE Telegram alert (not two); both still persist `stall_events` rows.
- [ ] PO_ALERT_CHAT_ID receives the Telegram alert via the gateway bridge (asserted via mock send) with body matching `[STALL] model {model_alias} stalled after {elapsed_ms}ms (threshold {threshold}ms). role={call_role}, request={request_id}, tokens={prompt_token_count}` exactly.
- [ ] Forbidden-payload guard test: alert body and `stall_events.findings` contain NO raw prompts, transcripts, media bytes, provider keys.
- [ ] Out-of-range threshold env (e.g. `STALL_THRESHOLD_MS_TEXT_LLM=30000`) clamps to 60000 ms and emits `kbju_stall_threshold_clamped_total{role=text_llm}` warn at boot.
- [ ] Per-call overhead micro-benchmark: `withStallWatchdog` adds ≤0.5 ms p95 wall-clock per LLM call (PRD-002@0.2.1 §7 ≤5% budget).

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- The watchdog MUST use the streaming-chunk timestamp algorithm from ADR-012@0.1.0 §D2 (zeroclaw `stall_watchdog.rs:29-124` port). Do NOT implement a generic Promise-race timeout for streaming calls — that conflates "slow" with "stalled" and fails PRD-002@0.2.1 §2 G2.
- The Promise-race fallback applies ONLY to non-streaming `llmRouter.call` paths (deterministic single-response endpoints).
- `stall_events.findings` MUST NOT include raw prompts, transcripts, media, provider keys, or full Telegram usernames (PRD-002@0.2.1 §7 redaction rules).
- `PO_ALERT_CHAT_ID` env var: if unset, log `kbju_stall_alert_skipped_no_po_chat` warning at boot; persist `stall_events` row anyway.
- All Telegram alerts MUST be dispatched via the gateway send-message bridge (a back-channel HTTP call from the sidecar to the gateway), NOT directly to the Telegram Bot API. This preserves ADR-011@0.1.0's invariant that the sidecar opens no outbound Telegram connections.
- Dedup window LRU map size 1024; dedup key is `request_id`.
- Do NOT modify the `llmRouter.call` public signature — wrap, don't change.
- Synthetic-test framework MUST mock the streaming-response source — do NOT call real LLM providers in CI.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass.
- [ ] PR opened with link to TKT-018@0.1.0 in description (version-pinned).
- [ ] No `TODO` / `FIXME` left in committed code without a follow-up TKT suggestion logged in the PR body.
- [ ] Executor filled §10 Execution Log.
- [ ] Ticket frontmatter `status: in_review` in a separate commit after the implementation commit.

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-018-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-04 (architect-4 synthesizer claude-opus-4.7-thinking): synthesized this ticket from PR-B's TKT-018 (full mechanism + threshold matrix + dedup + 8-test matrix) + PR-C's TKT-018 (zeroclaw algorithmic provenance citation + stale-response handling). PR-A's equivalent (split across smaller tickets) had less complete acceptance criteria — rejected. assigned_executor=deepseek-v4-pro because: (1) DeepSeek V4 Pro authored both PR-B and PR-C's variants; (2) the Rust→TypeScript port of zeroclaw's algorithm requires careful handling of Node.js streaming-response semantics, which DeepSeek V4 Pro has demonstrated competence on in PR-B's recon. -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions (single atomic deliverable: a stall-detecting middleware around `llmRouter.call`).
- [x] NOT-In-Scope has ≥1 explicit item (6 items listed).
- [x] Acceptance Criteria are machine-checkable.
- [x] Constraints explicitly list forbidden actions.
- [x] All ArchSpec / ADR references are version-pinned.
- [x] `depends_on: [TKT-016@0.1.0]` correct (sidecar must boot before stall watchdog can wrap `llmRouter.call`); no cycles.
- [x] `assigned_executor: deepseek-v4-pro` justified — see Execution Log seed.
