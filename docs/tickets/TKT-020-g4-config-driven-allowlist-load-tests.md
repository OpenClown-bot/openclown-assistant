---
id: TKT-020
title: "G4 config-driven allowlist and load tests"
version: 0.1.0
status: done
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-06
completed_at: 2026-05-06
completed_by: "lindwurm.22.shane (PO)"
completed_note: |
  TKT-020@0.1.0 closed after Executor PR #131 (squash sha 94ee35b) and Kimi RV-CODE-020 review (combined with RV-CODE-019 in PR #133 squash sha c7178f5) were both merged to main on 2026-05-06. Implementation final HEAD before PR #131 squash was b4be5b4 after Executor iter-1 (implementation) + iter-2 (fixed F-M1/M2/M3/M4): DeepSeek V4 Pro delivered the C15 file-backed allowlist module `src/security/allowlist.ts` (~120 LoC, new file) implementing O(1) `Set.has(telegramId)` lookup, hot-reload via `fs.watchFile` with `curr.mtimeMs > prev.mtimeMs` guard (post-iter-2), atomic-rename safety, env migration fallback when `config/allowlist.json` absent, and three failure modes — `block_all`, `safe_mode` (`SAFE_MODE_ROUTES = {start, history, summary_delivery}`), `read_only` (`READ_ONLY_ROUTES = {history, summary_delivery}`) — that diverge per AC6 / SecureClaw semantics. `config/allowlist.example.json` (new, non-secret example file). `tests/security/allowlist.test.ts` (new, 22 unit tests covering load + hot-reload propagation within 30s + bad-JSON retention of last valid allowlist + missing-file env migration + blocked-user response + failure-mode gating). `tests/security/allowlist.load.test.ts` (new, 30 load tests at N=2/10/100/1000/10000 confirming allowlist overhead ≤2% of text-message latency budget per AC4). `src/observability/kpiEvents.ts` (+3 new metric names `kbju_allowlist_reload`, `kbju_allowlist_blocked`, `kbju_allowlist_size` per ARCH-001@0.5.0 §8). `src/sidecar/factory.ts` (allowlist parameter wired into C1Deps without breaking existing signature). `src/telegram/entrypoint.ts` (replaced startup-only O(n) `isAllowlisted` with O(1) `allowlist.isAllowed`, added blocked-user response `Извините, бот пока в закрытом тестировании.` and failure-mode gating before any C1 domain handler invocation). `src/telegram/types.ts` (allowlist field added to C1Deps interface). `tests/telegram/entrypoint.test.ts` (updated for new blocked-user behavior). All 7 §6 Acceptance Criteria are structurally satisfied with named tests; AC-8 (lint/typecheck/test/validate green) verified locally on b4be5b4 with 755/755 unit + integration tests + 30/30 load tests + clean typecheck + `validated 82 artifact(s); 0 failed` (one pre-existing unrelated failure in tests/deployment/healthCheck.test.ts is outside TKT-020 scope). Architect deviation: none — implementation matches ARCH-001@0.5.0 §3.15 C15 component spec, ADR-013@0.1.0 allowlist contract, and PRD-002@0.2.1 §2 G4 hot-reload + failure-mode requirements exactly. Executor model deviation: assigned glm-5.1, executed by DeepSeek V4 Pro per Ticket Orchestrator dispatch decision (elevated context-budget stall risk on wider scope — 9 files, file-watch + state-machine + atomic-rename + failure-modes + 5 load-test sizes); deviation logged in §10 Execution Log per `docs/prompts/executor.md` §1 ("Confirm its `status` is `ready` and `assigned_executor` matches your model"). Kimi K2.6 RV-CODE-020 verdict on iter-1 HEAD was `pass_with_changes` with 4 MEDIUM + 1 LOW finding, all 4 MEDIUM resolved by Executor iter-2 commit ae28338 byte-verified by Devin pass-2 audit: F-M1 (`fs.watchFile` callback added `if (curr.mtimeMs > prev.mtimeMs)` guard preventing spurious reloads) RESOLVED, F-M2 (`SAFE_MODE_ROUTES` constant introduced as distinct from `READ_ONLY_ROUTES` so `safe_mode` and `read_only` cases diverge per AC6) RESOLVED, F-M3 (kpiEvents.ts indentation regression at line 30) RESOLVED, F-M4 (allowlist.ts indentation regression at line 41 + redundant `watcher: boolean = false` field deleted along with `if (this.watcher)` guard in close()) RESOLVED. PR-Agent (Qodo / GPT-5.3 Codex on OmniRoute) raised one persistent-review block on PR #131 with two findings: Test quality (hot-reload tests use real timers via setInterval polling instead of vi.useFakeTimers — non-blocking observability concern, deferred), Missing AC proofs (PR description lacks AC traceability table per executor.md Definition of Done — same as Reviewer F-L1). Findings triage: F-M1/M2/M3/M4 → RESOLVED iter-2 (commit ae28338 byte-verified); F-L1 (PR description lacks AC traceability table) → BACKLOG `TKT-NEW-executor-ac-table-compliance-reminder` (Executor process-compliance reminder, non-blocking because review file contains full AC verdict map and substantive AC claims are correct); PR-Agent Test quality → BACKLOG-deferred as observability future-work IOU under same entry as F-L1. Cross-reviewer audit summary per `docs/meta/devin-session-handoff.md` §5: Kimi K2.6 RV-CODE-020 pass_with_changes (4M resolved iter-2 + 1L deferred) + Qodo PR-Agent 0 unresolved blockers (2 findings both deferred) + Devin Orchestrator pass-2 ratification audit PASS_WITH_BACKLOG (re-verified iter-2 fixes byte-by-byte against ae28338 commit diff) — all three reviewers agreed merge-safe. Local pre-merge re-verification on b4be5b4: `npm run build` clean, 755 tests pass + 30 load tests pass, `npm run lint` clean, `npm run typecheck` clean, `python3 scripts/validate_docs.py` 82 artifacts 0 failed. PO chose merge order: PR #131 merged first as `94ee35b`, then PR #130 (TKT-019 Executor) as `739ef66`, then PR #132 closed-as-superseded, then PR #133 (combined Reviewer with Devin clerical frontmatter fix commit 8e1869c folded into squash) as `c7178f5`. Main is clean post-merge: 84 artifacts 0 failed (up from 82 — RV-CODE-019 + RV-CODE-020 files added by PR #133). No code defect remains; F-L1 is the single outstanding BACKLOG item, scoped to a future Executor-prompt-template reminder rather than a code-change ticket. PRD-002@0.2.1 G1 (TKT-017 done), G2 (TKT-018 done), G3 (TKT-019 done), G4 (TKT-020 done) — full PRD-002 observability gates closed.
---

# TKT-020: G4 config-driven allowlist and load tests

## 1. Goal
Replace startup-only Telegram allowlist parsing with a hot-reloadable O(1) access-control cache.

## 2. In Scope
- Add C15 file-backed allowlist with atomic reload and `Set<number>` lookup.
- Preserve `TELEGRAM_PILOT_USER_IDS` only as a migration seed when the JSON file is absent.
- Add load tests at N = 2, 10, 100, 1000, and 10000.
- Add blocked-user Russian reply behavior.
- Add safe/read-only/block-all failure mode semantics compatible with the SecureClaw pattern when the Gateway is degraded or the kill-switch is active.

## 3. NOT In Scope
- No Redis, PostgreSQL allowlist table, remote config API, Kubernetes, or multi-VPS replication.
- No user self-registration or invitation flow.
- No changes to PRD-001@0.2.0 Telegram UX beyond blocked-user copy.
- No copying SecureClaw AGPL source; any SecureClaw use is install/config-only or pattern-compatible reimplementation.

## 4. Inputs
- ARCH-001@0.5.0 §0.6, §3.15, §8, §9.6.
- ADR-013@0.1.0 and PRD-002@0.2.1 §2 G4.
- `src/telegram/entrypoint.ts`, `src/telegram/types.ts`, `src/shared/config.ts`.
- Existing Telegram entrypoint and deployment tests.

## 5. Outputs
- [ ] `src/security/allowlist.ts` or equivalent C15 module.
- [ ] `config/allowlist.example.json` or equivalent non-secret example file if project conventions permit config examples.
- [ ] C1/sidecar wiring that uses C15 for every message/callback/cron-originated Telegram user check.
- [ ] Gateway/sidecar failure-mode config for `block_all`, `safe_mode`, and `read_only` semantics over bridge-originated operations.
- [ ] Unit tests for load, reload, bad JSON retention, missing-file migration from env, and blocked-user response.
- [ ] Load/performance tests for N = 2, 10, 100, 1000, 10000.

## 6. Acceptance Criteria
- [ ] `isAllowed(telegramId)` uses `Set.has` or an equivalent O(1) lookup and does not split/scan an env string per request.
- [ ] Updating `config/allowlist.json` via atomic write propagates to `isAllowed` within ≤30 seconds in a deterministic test.
- [ ] Bad JSON or file deletion preserves the last valid allowlist and emits `allowlist_reload_failed` without opening access.
- [ ] N = 2, 10, 100, 1000, and 10000 load tests show allowlist overhead ≤2 % of the text-message latency budget or a stricter local microbenchmark threshold documented in the test.
- [ ] Blocked users receive `Извините, бот пока в закрытом тестировании.` and no domain handler is invoked.
- [ ] In `block_all`, no message/callback/cron domain handler is invoked; in `safe_mode`, read-only summary/history requests may run but writes/confirm/delete are blocked; in `read_only`, only explicit read paths are permitted.
- [ ] Metrics include `kbju_allowlist_reload`, `kbju_allowlist_blocked`, and `kbju_allowlist_size` or exact names documented in ARCH-001@0.5.0 §8.
- [ ] `npm run lint`, `npm run typecheck`, targeted tests, and `python3 scripts/validate_docs.py` pass.

## 7. Constraints
- Source: PR-B/PR-C JSON + Set + file-watch design; PR-A's static-env extension rejected for G4 scale.
- Source: SPIKE-002 recommends SecureClaw's failure modes as the community pattern to adopt/configure for Gateway-side degradation behavior.
- Do not log full Telegram IDs in public logs; hash or bound labels if metrics backend persists labels.
- No new infrastructure per PRD-002@0.2.1 §3 Non-Goals.


## 8. Definition of Done
- [ ] All §6 Acceptance Criteria pass.
- [ ] PR opened with this ticket referenced as `TKT-020@0.1.0`.
- [ ] No `TODO` / `FIXME` is left without a follow-up backlog note in the PR body.
- [ ] Executor fills §10 Execution Log before hand-back.
- [ ] Ticket frontmatter `status` is promoted to `in_review` in a separate commit.

## 9. Questions
<!-- Executor appends questions here only if blocked; create docs/questions/Q-TKT-020-NN.md if needed. -->

## 10. Execution Log
Synthesized by Architect-4 from PR-A / PR-B / PR-C input tickets. Executor appends timestamped entries below this line.

- 2026-05-05T00:00:00Z DeepSeek V4 Pro via OmniRoute: iter-1 dispatched on DeepSeek V4 Pro instead of default glm-5.1 per TO dispatch decision (elevated context-budget stall risk on wider scope — 9 files, file-watch + state-machine + atomic-rename + failure-modes + 5 load-test sizes).

---

## Handoff Checklist
- [x] Goal is one sentence.
- [x] NOT-In-Scope has explicit exclusions.
- [x] Acceptance Criteria are machine-checkable.
- [x] References are version-pinned.
- [x] `assigned_executor` is justified.
