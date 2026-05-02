---
id: TKT-013
title: "Deployment Packaging"
status: done
arch_ref: ARCH-001@0.4.0
component: "Deployment / ADR-008"
depends_on: ["TKT-001@0.1.0", "TKT-002@0.1.0", "TKT-003@0.1.0"]
blocks: ["TKT-014@0.1.0"]
estimate: M
assigned_executor: "glm-5.1"
created: 2026-04-26
updated: 2026-05-02
completed_at: 2026-05-02
completed_by: glm-5.1
completed_note: "Executor PR #80 + Reviewer PR #81 merged after Kimi K2.6 iter-4 pass_with_changes; Ticket Orchestrator cross-reviewer audit pass-1 + Devin Orchestrator ratification audit pass-2 both clean; PR-Agent CI workflow stalled @12m12s (3-of-3 final-HEAD pilot pattern) — classified as infra failure under DO authority per BACKLOG-008 §pr-agent-tail-latency; 3 low follow-ups (F-L3, F-L4, F-L6) deferred to BACKLOG-009."
---

# TKT-013: Deployment Packaging

## 1. Goal (one sentence, no "and")
Package the KBJU Coach stack for portable Docker Compose deployment.

## 2. In Scope
- Add Docker build files for the Node 24 OpenClaw skill package.
- Add Docker Compose services for the app, PostgreSQL, and optional local/private OmniRoute endpoint wiring.
- Add `.env.example` with variable names only and no secret values.
- Add Docker log rotation settings and loopback/internal metrics binding.
- Add backup, rollback, and VPS migration helper scripts matching ARCH-001@0.4.0 §10.

## 3. NOT In Scope (Executor must NOT touch these — Reviewer fails on violation)
- No application feature implementation beyond health checks.
- No production secret values.
- No Kubernetes, systemd unit, host-network, or host bind-mount deployment path.

## 4. Inputs (Executor MUST read before writing code; nothing else)
- ARCH-001@0.4.0 §6 External Interfaces
- ARCH-001@0.4.0 §8 Observability
- ARCH-001@0.4.0 §9 Security
- ARCH-001@0.4.0 §10 Deployment
- ADR-002@0.1.0
- ADR-008@0.1.0
- ADR-009@0.1.0
- docs/knowledge/llm-routing.md
- `package.json`
- `src/index.ts`
- `src/shared/config.ts`
- `src/store/schema.sql`
- `src/observability/metricsEndpoint.ts`

## 5. Outputs (deliverables — Executor's diff MUST match this list exactly)
- [ ] `.env.example` documenting required variable names with blank/example-safe values only
- [ ] `Dockerfile`
- [ ] `docker-compose.yml`
- [ ] `infra/omniroute/README.md` documenting router-first config expectations without secrets
- [ ] `scripts/backup-kbju.sh`
- [ ] `scripts/rollback-kbju.sh`
- [ ] `scripts/migrate-vps-kbju.sh` (operator-facing helper that runs the ARCH-001@0.4.0 §10.6 sequence, including `setWebhook` + `getWebhookInfo` verification — reference: `scripts/migrate-vps.sh` already in repo)
- [ ] `src/deployment/healthCheck.ts` exporting a health check used by the container
- [ ] `tests/deployment/compose.test.ts`
- [ ] `tests/deployment/envExample.test.ts`

## 6. Acceptance Criteria (machine-checkable)
- [ ] `npm test -- tests/deployment/compose.test.ts tests/deployment/envExample.test.ts` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `docker compose config` succeeds.
- [ ] Tests prove `.env.example` contains every required variable from ARCH-001@0.4.0 §9.1 and contains no plausible secret values.
- [ ] Tests prove `docker-compose.yml` uses named volumes for PostgreSQL/OpenClaw state and no host bind mounts for production data.
- [ ] Tests prove metrics bind to loopback/internal network only and Docker logs have bounded rotation.
- [ ] Scripts include backup, rollback, and VPS migration command sequences from ARCH-001@0.4.0 §10.
- [ ] `scripts/rollback-kbju.sh` runs the §10.5.1 pre-flight (DB snapshot, migration check), the §10.5.2 health-check loop on `http://127.0.0.1:9464/metrics`, and posts a Telegram PO ping to `$PO_ALERT_CHAT_ID` on success; tests assert the script aborts (non-zero exit) when health checks fail.
- [ ] `scripts/migrate-vps-kbju.sh` calls Telegram `setWebhook` and verifies `getWebhookInfo` returns the new URL with `last_error_date: null`; tests assert the script fails fast if `getWebhookInfo` reports an error.

## 7. Constraints (hard rules for Executor)
- Do NOT add new runtime dependencies.
- Do NOT commit real secrets, tokens, Telegram IDs, provider keys, or DB passwords.
- Do NOT use host networking or systemd.
- Do NOT use host bind mounts for production data; named Docker volumes only.
- Do NOT change ADR-selected providers or routing topology.
- GLM assignment is appropriate because this is packaging with concrete file-based ACs.

## 8. Definition of Done
- [ ] All Acceptance Criteria pass
- [ ] PR opened with link to this TKT in description (version-pinned)
- [ ] No `TODO` / `FIXME` left in code without a follow-up TKT suggestion logged in PR body
- [ ] Executor filled §10 Execution Log
- [ ] Ticket frontmatter `status: in_review` in a separate commit

## 9. Questions (empty at creation; Executor appends here ONLY if blocked — do NOT start code)
<!-- Q1 (YYYY-MM-DD, model-id): question text — see docs/questions/Q-TKT-013-NN.md -->

## 10. Execution Log (Executor fills as work proceeds)
<!-- 2026-05-02 08:50 glm-5.1: started iter-1 -->
2026-05-02 08:51 glm-5.1: all §5 Outputs implemented; tests (14/14), lint, typecheck, docker compose config, validate_docs all pass
<!-- 2026-05-02 08:52 glm-5.1: opened PR #80 -->
2026-05-02 09:35 glm-5.1: iter-3 pushed — fixed F-H1 (metrics reachable via loopback port mapping), F-H2 (shell-script tests added), F-M1 (openclaw_state mounted), F-M2/F-L2 (migrate service names aligned), F-L1 (uptime from serverStartTime), F-PA-1 (healthCheck validates env vars + Dockerfile queries /healthz), F-PA-2 (node -e JSON parsing), F-PA-3 (dirty-tree pre-flight), F-PA-4 (dead code removed)
2026-05-02 09:51 glm-5.1: iter-4 pushed — fixed F-M3 (removed image-level HEALTHCHECK from Dockerfile, added service-specific healthcheck on metrics only; app has no healthcheck)
2026-05-02 10:14 glm-5.1: iter-5 pushed — reject wildcard metrics bind (0.0.0.0); METRICS_HOST now 'metrics' (Docker-internal hostname); healthCheck.ts bans 0.0.0.0/::/[::] per ARCH-001@0.4.0 §8.2/§11 C10; added healthCheck.test.ts
2026-05-02 kimi-k2.6: Reviewer iter-4 verdict pass_with_changes on Executor HEAD `b50443e5097b9cfa3b54ec98f4220ea46f94f1f9` (RV-CODE-013); all High (F-H1, F-H2) and all Medium (F-M1, F-M2, F-M3) findings RESOLVED; 3 Low deferred (F-L3 cleaner JSON parse error in migrate-vps-kbju.sh, F-L4 rollback success-path test, F-L6 server.on('error') handler in healthCheck.ts); F-L5 classified no-action (correct Docker network detail).
2026-05-02 pr-agent (qwen-3.6-plus): persistent review settled to final HEAD `b50443e5` with verdict ⚡ no major issues + 🔒 no security concerns; 6 informational items independently classified — 3 RESOLVED in iter-4/5, 3 matched Kimi's Low classification, 1 not-a-finding (`infra/omniroute/README.md` is in TKT-013 §5 Outputs but outside validate_docs artifact scope); workflow check cancelled @12m12s (3-of-3 final-HEAD pilot pattern, structural — see BACKLOG-009 §pr-agent-ci-tail-latency-investigation).
2026-05-02 ticket-orchestrator (gpt-5.5-thinking): cross-reviewer audit pass-1 — confirmed Reviewer re-engaged for every substantive Executor push (iter-1 → iter-4, BIG IMPROVEMENT vs TKT-011@0.1.0 procedural gap); confirmed RV-CODE-013 numbering correct per BACKLOG-008 §reviewer-rv-code-numbering; closure-ready signal handed back to Devin Orchestrator with infra caveat for stalled PR-Agent workflow.
2026-05-02 devin-orchestrator (glm-5.1): ratification audit pass-2 — independently re-verified Kimi iter-4 verdict + AC matrix 9/9 PASS + scope compliance + 35/35 tests + lint/typecheck/docker-config/validate_docs clean; classified PR-Agent stall as infra failure under DO authority per session-4 §6.6 + BACKLOG-008 §pr-agent-tail-latency rule (override formal CI conclusion); merge-safe sign-off issued.
2026-05-02 devin-orchestrator (glm-5.1): PO merged Executor PR #80 + Reviewer PR #81; Devin Orchestrator opened closure-PR with TKT-013 status flip + RV-CODE-013 frontmatter promotion + RV file rename to canonical pattern + BACKLOG-009 (3 low follow-ups + 3 structural lessons + 1 critical-escalation).

---

## Handoff Checklist
- [x] Goal is one sentence, no conjunctions
- [x] NOT-In-Scope has ≥1 explicit item
- [x] Acceptance Criteria are machine-checkable (no "looks good")
- [x] Constraints explicitly list forbidden actions
- [x] All ArchSpec / ADR references are version-pinned
- [x] `depends_on` accurately reflects prerequisites; no cycles
- [x] `assigned_executor` is justified (especially Codex — explain why GLM cannot)
