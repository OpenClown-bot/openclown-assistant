---
id: TKT-016
title: "Runnable Telegram Integration Layer"
status: draft
arch_ref: ARCH-001@0.5.0
component: "C1 Access-Controlled Telegram Entrypoint; ADR-011@0.1.0"
depends_on: ["TKT-001@0.1.0", "TKT-004@0.1.0", "TKT-013@0.1.0", "TKT-015@0.1.0"]
blocks: ["TKT-017@0.1.0", "TKT-018@0.1.0", "TKT-019@0.1.0", "TKT-020@0.1.0"]
estimate: M
assigned_executor: "codex-gpt-5.5"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-016: Runnable Telegram Integration Layer

## 1. Goal (one sentence, no "and")
Make the Dockerized KBJU app boot into a real Telegram adapter.

## 2. In Scope
- Add a Node 24 executable entrypoint that wires config, dependencies, metrics, and Telegram routing.
- Add a raw grammY adapter that normalizes Telegram messages/callbacks into the existing C1 routing functions.
- Fix Docker runtime command path to match the actual TypeScript compile output.
- Add runtime boot-smoke tests proving a mocked Telegram update reaches the real handler call.
- Add only the ADR-011@0.1.0-approved Telegram runtime dependency.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No PRD-002@0.2.1 tenant-breach, model-stall, PR-Agent, or allowlist-scale implementation; see TKT-017@0.1.0 through TKT-020@0.1.0.
- No native OpenClaw plugin/channel bridge.
- No new user-facing bot copy beyond existing fallback/ready diagnostics required for tests.
- No database schema changes except a deployment metadata row if already required by existing health checks.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.5.0 §0.1
- ARCH-001@0.5.0 §3.1
- ARCH-001@0.5.0 §4.9
- ARCH-001@0.5.0 §10.1
- ADR-011@0.1.0
- `docs/knowledge/openclaw.md`
- `package.json`
- `tsconfig.json`
- `Dockerfile`
- `docker-compose.yml`
- `src/index.ts`
- `src/telegram/entrypoint.ts`
- `src/telegram/types.ts`
- `src/shared/config.ts`
- `src/deployment/healthCheck.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `package.json` adding `grammy` only if absent and updating scripts only if required for boot-smoke.
- [ ] `package-lock.json` reflecting the allowed dependency change.
- [ ] `src/main.ts` exporting/starting the executable application entrypoint.
- [ ] `src/telegram/adapter.ts` mapping grammY updates/callbacks to existing C1 handlers.
- [ ] `src/telegram/adapter.test.ts` proving message/callback normalization reaches real handler seams.
- [ ] `tests/deployment/runtimeBoot.test.ts` proving the compiled entrypoint or container emits `[gateway] ready` and a mocked Telegram update reaches a handler.
- [ ] `Dockerfile` using the correct compiled entrypoint path.
- [ ] `docker-compose.yml` updated only if the service command/name must align with the runnable app.
- [ ] `src/deployment/healthCheck.ts` updated only if boot readiness requires it.

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- src/telegram/adapter.test.ts tests/deployment/runtimeBoot.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `docker compose config` succeeds.
- [ ] The Docker runtime command points at a file that exists after `npm run build`.
- [ ] A mocked Telegram text update from an allowlisted user reaches `routeMessage` through the grammY adapter.
- [ ] A mocked Telegram callback update reaches `routeCallbackQuery` through the grammY adapter.
- [ ] Startup emits `[gateway] ready` only after dependencies and Telegram adapter startup succeed.
- [ ] Changing `src/main.ts`, `src/index.ts`, `Dockerfile`, `docker-compose.yml`, `src/deployment/**`, or `src/telegram/entrypoint.ts` without the runtime boot-smoke test fails Reviewer review.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies except `grammy`.
- Do NOT implement an OpenClaw plugin bridge.
- Do NOT remove existing C1 access-control, C10 redaction, or metrics behavior.
- Do NOT log Telegram bot tokens, usernames, raw prompts, raw transcripts, raw media, provider keys, or provider responses.
- Do NOT modify files outside §5 Outputs.
- Codex is required because this ticket is runtime-critical and fixes a deploy-blocking false-positive test gap.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-016-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- YYYY-MM-DD HH:MM model-id: started -->
<!-- YYYY-MM-DD HH:MM model-id: opened PR #NN -->

---

## Handoff Checklist (Architect ticks before setting status to `ready`)
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
