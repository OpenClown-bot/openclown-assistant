---
id: TKT-020
title: "G4 config-driven allowlist and load tests"
version: 0.1.0
status: in_progress
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "claude-opus-4.7-thinking"
assigned_executor: "glm-5.1"
created: 2026-05-04
updated: 2026-05-05
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
