---
id: BACKLOG-009
title: "Deployment Packaging follow-ups (post TKT-013) + third TO pilot structural lessons"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-02
---

# Deployment Packaging follow-ups + third TO pilot lessons

This file collects the deferred follow-ups from the TKT-013 closure (PR #80 + PR #81 + closure-PR) and the structural lessons learned from the third end-to-end Ticket Orchestrator pilot. The first pilot (TKT-010) generated `BACKLOG-007` and `PR #71`; the second (TKT-011) generated `BACKLOG-008`; this third pilot generates `BACKLOG-009`.

The 7 entries below split into:
- **3× F-L carry-over** from Kimi K2.6 iter-4 review on PR #80 final HEAD `b50443e5` (low-severity, deferred per Reviewer rationale; PR-Agent informational items overlap with these).
- **4× structural TKT-NEW** from anomalies surfaced during this pilot or surfaced while preparing the next pilot (opencode session interrupt resilience, PR-Agent CI tail-latency escalation 3-of-3, AGENTS.md vs llm-routing.md runtime mismatch surfaced during 4th-pilot prep, RV file-naming canonical convention).

## TKT-NEW-migrate-script-cleaner-json-errors

**Source:** Kimi RV-CODE-013 finding `F-L3` on PR #80 final HEAD `b50443e5` (`scripts/migrate-vps-kbju.sh:78–93`); PR-Agent persistent review item #1 overlaps.

**The issue:** The migration script uses `node -e "JSON.parse(...)"` to parse Telegram API responses (`getWebhookInfo` verification). If Telegram returns HTTP 200 with malformed JSON (unlikely but possible), `JSON.parse` throws an uncaught exception inside the `node -e` command, producing a stack trace rather than a clean operator-facing error message. The fail-fast behavior is correct (`set -euo pipefail` ensures non-zero exit) — only the error-message clarity is at stake.

**Proposed fix:** Wrap the `node -e` blocks in a small helper that catches `SyntaxError` and emits a clean `"ERROR: Telegram API returned invalid JSON"` message before exiting 1. Add a corresponding test in `tests/deployment/scripts.test.ts` that stubs `curl` to return a 200 with a malformed body and asserts the cleaner error message.

**Severity:** Low (operator-UX / message clarity, no correctness impact; existing fail-fast behavior is correct). Defer to a future Polish-pass ticket once VPS migration has at least one production run to inform real-world error scenarios.

**ArchSpec dependency:** `ARCH-001@0.4.0 §10.6 VPS Migration Runbook` already specifies the `setWebhook` + `getWebhookInfo` verification surface; this ticket would tighten the error-message contract without changing it.

## TKT-NEW-rollback-success-path-test

**Source:** Kimi RV-CODE-013 finding `F-L4` on PR #80 final HEAD `b50443e5` (`tests/deployment/scripts.test.ts`); PR-Agent persistent review item #2 overlaps.

**The issue:** The TKT-013 test suite covers failure paths for both rollback and migration scripts (rollback aborts on health-check failure; migration fails fast on `last_error_date`), but contains no success-path test for `scripts/rollback-kbju.sh` — i.e., simulating a healthy `curl http://127.0.0.1:9464/metrics` response and asserting exit code 0 plus the success Telegram message. TKT-013@0.1.0 §6 AC 8 mandates the failure-path assertion explicitly but does not mandate success-path coverage, so this is a test-quality follow-up, not an AC violation.

**Proposed fix:** Add a rollback success-path test that stubs `curl` to return HTTP 200 on `/metrics`, asserts `exitCode === 0`, asserts the success Telegram message appears in stdout, and asserts the §10.5.1 pre-flight (DB snapshot + migration check) commands ran in the correct order. Reuse the existing test harness pattern from `scripts.test.ts`.

**Severity:** Low (test-quality / coverage, no correctness impact in production). Defer to the next deployment-area Polish-pass ticket; can be batched with `TKT-NEW-migrate-script-cleaner-json-errors` since both touch the same test file.

**ArchSpec dependency:** `ARCH-001@0.4.0 §10.5 Rollback` is unchanged; this ticket only expands test coverage of the existing contract.

## TKT-NEW-healthcheck-server-error-handler

**Source:** Kimi RV-CODE-013 finding `F-L6` on PR #80 final HEAD `b50443e5` (`src/deployment/healthCheck.ts:20–52`); PR-Agent persistent review item #6 overlaps.

**The issue:** The `http.createServer()` instance in `healthCheck.ts` does not register an `'error'` event listener on the server object. If `server.listen()` fails (e.g., port `9464` already in use, or the `metrics` Docker hostname fails to resolve at startup), the resulting `Error` event on the `server` object is unhandled and will crash the Node process with an opaque stack trace. In the dedicated `metrics` Docker service this is an unlikely race condition (the container is the only listener on port 9464 inside its network), but an unhandled error event is a reliability gap that could surface during VPS migration when the metrics service starts before the port is free, or during local dev when an operator forgets to stop a prior instance.

**Proposed fix:** Add `server.on('error', (err) => { console.error('Metrics server error:', err.message); process.exit(1); });` immediately before `server.listen()`. Add a test in `tests/deployment/healthCheck.test.ts` that simulates a `listen()` failure (port already in use) and asserts the error handler runs + the process exits non-zero with the cleaner message.

**Severity:** Low (reliability / observability gap, low-likelihood failure in dedicated metrics container). Defer; can be batched with the two TKT-NEW above as a single deployment-area Polish-pass ticket.

**ArchSpec dependency:** `ARCH-001@0.4.0 §8.2 metrics endpoint binding` is unchanged; this ticket only hardens the error path of the existing contract.

## TKT-NEW-opencode-session-interrupt-resilience

**Source:** Operational anomaly observed during TKT-013 cycle (PO screenshot 2026-05-02): both Executor and Reviewer opencode sessions were interrupted mid-iter (TUI showed "continue" prompt with non-exhausted token budget — 49% used per the screenshot context indicator). PO confirmation: `"по какой-то причине и экзекутор и ревьюер прерывались"`. The cycle still reached closure-ready state because TO recovered and continued, but the recovery was ad-hoc — there is no codified protocol for resuming an interrupted iter.

**The issue:** Without a documented resume protocol, an interrupted Executor or Reviewer iter risks (a) TO accidentally starting iter-N+1 while iter-N's git state is partially written but uncommitted, (b) TO mis-counting which iter is "in flight" vs "complete", (c) Reviewer-reengagement-after-substantive-pushes constraint (BACKLOG-008) being violated because the substantive iter-N commit-or-not state is ambiguous. The TKT-013 pilot survived by luck (no partial commits left dangling); a stricter pipeline must not depend on luck.

**Proposed fix:** Codify in `docs/prompts/ticket-orchestrator.md` (and reflect in the Executor + Reviewer prompts where they describe iter-N continuation) a short ITER-N RESUME protocol: when the PO reports an interruption mid-iter, TO drafts a 5-line RESUME nudge that asks the Executor / Reviewer to (1) `git status` + `git log -1 --oneline` + show pending tool calls, (2) explicitly classify what was committed vs in-flight, (3) re-read the iter-N contract surface, (4) decide whether to continue from the in-flight state or rewind to the last clean commit, (5) report back before any new write. TO then makes the strategic call (continue vs rewind) before authorizing further work.

**Severity:** Medium (process invariant; not yet a correctness incident, but trusted-pipeline confidence depends on resilience to this class of operational anomaly). Implement before the fourth TO pilot; the launcher-asserts entry from BACKLOG-008 is also still pending and the two should land together for a "TO pipeline hardening" mini-ticket.

**ArchSpec dependency:** None — this is process / prompt-level, not code/ArchSpec.

## TKT-NEW-pr-agent-ci-tail-latency-investigation-CRITICAL

**Source:** TKT-013 closure cross-reviewer audit (Devin Orchestrator ratification pass-2). PR-Agent CI workflow on PR #80 final HEAD `b50443e5` cancelled at 12m12s (PR #71 hard-timeout). PR-Agent CI workflow on PR #81 also cancelled at ~12m. **This is the third pilot in a row exhibiting the pattern: TKT-010 final-HEAD run = 22-min outlier (normal 3–9 min), TKT-011 final-HEAD run = stuck IN_PROGRESS then cancelled, TKT-013 final-HEAD run on both Executor and Reviewer PRs = cancelled at hard-timeout. 3 of 3 final-HEAD runs across 3 pilots = structural, not random.**

**The issue:** `BACKLOG-008 §TKT-NEW-pr-agent-tail-latency` originally classified this as "Medium-High" with "investigate when convenient" tone, on the hypothesis that the pattern might still be coincidental. The third pilot rules that out. The PR #71 12-min hard-timeout mitigates *impact* (workflow does not hang indefinitely; Devin Orchestrator overrides formal CI conclusion under BACKLOG-008 §pr-agent-tail-latency rule when persistent review settles to final HEAD with clean verdict), but does not address the *root cause*. Likely candidates: OmniRoute throughput collapse on long-prompt code-review jobs (TKT-013 had the largest diff of the three pilots — Docker + Compose + scripts + tests + healthCheck — and still hit the same wall as the smaller TKT-011 diff, suggesting the throughput issue is not strictly diff-size-dependent); Qwen 3.6 Plus tail-latency under specific token-shape conditions; PR-Agent action's internal retry behavior on first-token-timeout. Without infrastructure-level investigation we cannot distinguish these.

**Severity:** **Critical** (escalated from Medium-High in BACKLOG-008). This now blocks confidence in the cross-reviewer audit pipeline for production-pace work — the Devin Orchestrator override is currently load-bearing for every closure, which means a single mis-classification of the override would let a real PR-Agent failure slip through. The override should be a fallback, not the steady-state path.

**Proposed fix:**
1. **Short-term (this sprint):** Capture in `docs/session-log/` for next 1–2 pilots the per-PR PR-Agent timing breakdown — which step inside the action is consuming the 12m. If the GitHub Actions log of the cancelled run shows a specific subprocess (e.g. `pr_reviewer.run`) hung on first-token, that narrows the hypothesis.
2. **Medium-term:** Run a controlled experiment — submit a synthetic PR with a known prompt size and re-run PR-Agent against it 3 times back-to-back. If the cancellation is reproducible at that prompt size, the issue is structural; if not, it is OmniRoute load-dependent.
3. **Long-term:** Open a Q-INFRA ticket against the OmniRoute / Qwen-routing layer with the gathered timing data; consider switching PR-Agent's reviewer model to a different OmniRoute backend (Kimi K2.6 is already used by primary Reviewer; PR-Agent could trial GLM 5.1 for the second-reviewer role to test whether the tail-latency is Qwen-specific).

**ArchSpec dependency:** None directly. ADR-002@0.1.0 (OmniRoute-First LLM Routing) governs the routing layer; this investigation may surface an ADR amendment or new ADR if the root cause is in the OmniRoute layer.

**Update 2026-05-02 (post TKT-014 closure, 5-of-5 evidence — investigation track #3 narrowed):** TKT-012 PR #84 final HEAD `24e0c42` cancelled at 12m11s; TKT-014 PR #89 final HEAD `3c6ff96` cancelled at ~12m. **5 of 5 pilots now exhibit the pattern.** The TKT-014 cycle provides decisive direction-finding evidence for investigation track #3 (Qwen-routing-layer hypothesis): the TKT-014 Executor was originally Qwen 3.6 Plus but mid-cycle switched to Codex GPT-5.5 high after Qwen iter-2 stalled on context exhaustion (see `BACKLOG-011 §TKT-NEW-qwen-3.6-plus-128k-context-insufficient-for-executor`). The final HEAD diff on PR #89 was therefore authored by **Codex GPT-5.5 high**, not Qwen. PR-Agent (which always runs on Qwen 3.6 Plus through OmniRoute) still cancelled at ~12m despite the Codex-authored diff. **This rules out Executor-authorship as the latency-amplifier and confirms the tail-latency is PR-Agent reviewer-side: specifically Qwen 3.6 Plus throughput on the multi-thousand-line code-review prompt independent of who authored the diff.** Combined with the TKT-014 Qwen-context-fail finding, the strongest single explanation is now: **Qwen 3.6 Plus's effective throughput collapses on long prompts** (whether the long prompt is "review this large code diff" or "fix this large code diff with this large set of review findings" doesn't matter — the model degrades on context size, not on diff authorship). Recommended action accelerated to **medium-term**: swap PR-Agent's reviewer model from Qwen 3.6 Plus to a different OmniRoute backend (candidates: Kimi K2.6 reusing the primary-Reviewer model — counter-indicated by uncorrelation principle in CONTRIBUTING.md §7; or GLM 5.1 / DeepSeek-V4-Pro / MiniMax M2.7 — to be assessed in the model re-evaluation research-PR). The model re-evaluation research-PR (PO Meta-feedback #4 chat 2026-05-02) is the natural successor to this investigation track.

**Update 2026-05-02 (pt2 — research note opened in PR #93):** `docs/knowledge/llm-model-evaluation-2026-05.md` compiles BenchLM provisional / lmarena verified / Fireworks operational specs for the six candidate models (GPT-5.5 family + GLM 5.1 + DeepSeek V4 Pro + Qwen 3.6 Plus + Kimi K2.6 + MiniMax M2.7) and proposes a role→model matrix for PO review.

**Update 2026-05-02 (pt3 — PO Q1–Q6 round-trip finalised):** PO accepted PR-Agent swap from Qwen 3.6 Plus to **GPT-5.3 Codex** (per Q5 chat 2026-05-02: «вот об этом я говорил, мб будем 5.3 использовать как пр-агент?»). Rationale (research note §3 finding #3 + §4 row): GPT-5.3 Codex BenchLM aggregate 88 / Coding 63.1 substantially outscores MiniMax M2.7 (originally proposed) at BenchLM 64 / Coding 56.2 — the quality gap matters for PR-Agent's value-add (catching what primary-Reviewer Kimi K2.6 missed). Cost impact ~$2-5/month at 30 PRs/month — manageable share of PO's GPT budget. **No pilot+rollback needed** because the Codex CLI route is already empirically validated in this pipeline (TKT-012 + TKT-014 Executor specialist runs). Successor PR #94 will edit `.pr_agent.toml` model identifier from Qwen 3.6 Plus to GPT-5.3 Codex per CONTRIBUTING.md row 23 PO-authorisation-verbatim protocol. See research note §4.1 Architect Quick Reference Card for GPT-5.3 Codex spec (per PO request: «архитектор может не знать. нужно учесть этот момент»).

## TKT-NEW-agents-md-vs-llm-routing-md-runtime-mismatch

**Source:** Triage performed during 4th-pilot (TKT-012) preparation 2026-05-02. PO asked whether `codex-gpt-5.5` Executor must run via Codex CLI or whether opencode + Codex GPT-5.5 (high) is acceptable. Cross-checked two repo sources of truth and found contradictory answers.

**The issue:**
- `AGENTS.md` row "Code Executor" lists runtime as `opencode + OmniRoute` for ALL three Executor model variants (GLM 5.1 default, Qwen 3.6 Plus parallel, Codex GPT-5.5 specialist). This implies all three route the same way.
- `docs/knowledge/llm-routing.md` is more specific: "Executor (default) GLM 5.1 — opencode + OmniRoute → Fireworks", "Executor (parallel) Qwen 3.6 Plus — opencode + OmniRoute → Fireworks", but **"Executor (specialist) Codex GPT-5.5 — Codex CLI"** (no `opencode`, no `OmniRoute`). The likely root cause is that GLM/Qwen/Kimi all live behind OmniRoute → Fireworks (non-OpenAI providers), whereas Codex GPT-5.5 is OpenAI and reaches the agent through a different path. AGENTS.md was last updated 2026-04-30 (Devin Review deprecation) and may not have synced with the runtime split that llm-routing.md documents.

**Concrete operational impact:** When PO dispatches the TKT-012 4th TO pilot, both BACKLOG-008 §launcher-asserts-frontmatter-executor (frontmatter `codex-gpt-5.5` must match the actual Executor model) and the runtime question (which CLI) are pending. If opencode happens to support routing to OpenAI Codex GPT-5.5 through OmniRoute, AGENTS.md is correct and llm-routing.md is stale; if not, llm-routing.md is correct and AGENTS.md needs a per-model runtime split.

**Proposed fix:** Triage path before TKT-012 dispatch (or as part of its cycle) — PO empirically tries opencode + Codex GPT-5.5 high in a NEW session; (a) if the model is reachable through OmniRoute, update `docs/knowledge/llm-routing.md` row "Executor (specialist)" to `Codex GPT-5.5 | opencode + OmniRoute` to match AGENTS.md; (b) if the model is NOT reachable, update the AGENTS.md "Code Executor" row to split runtime per-model (`GLM 5.1 / Qwen 3.6 Plus → opencode + OmniRoute; Codex GPT-5.5 → Codex CLI`). Either way, the two sources of truth must converge before the 5th pilot to prevent operational drift on TKT-014.

**Severity:** Low (clerical inconsistency, no immediate correctness or security impact; 4th-pilot can proceed empirically). Resolve as part of TKT-012 closure-PR or as a standalone clerical PR — whichever the empirical answer dictates.

**ArchSpec dependency:** None directly. `ADR-002@0.1.0 OmniRoute-First LLM Routing` governs the routing layer; if the resolution shows OmniRoute does NOT reach OpenAI Codex GPT-5.5, an ADR amendment may be warranted.

## TKT-NEW-rv-code-file-naming-canonical

**Source:** TKT-013 closure cross-reviewer audit (Devin Orchestrator ratification pass-2). Reviewer correctly used `RV-CODE-013` for the artifact id (the BACKLOG-008 `§reviewer-rv-code-numbering-convention` guardrail, enforced by TO via explicit Reviewer NUDGE language, prevented the TKT-011 `RV-CODE-016` mis-numbering). However, the **filename** Reviewer chose was `RV-CODE-013-pr-80-tkt-013.md` — a slightly different format from the canonical TKT-009/010/011 closure pattern (`RV-CODE-NNN-tkt-NNN-{title}.md`). The repo currently has both formats live (e.g. `RV-CODE-005-pr-34-tkt-005-onboarding-target-calculator.md` includes both PR# and title; `RV-CODE-007-pr-50-tkt-007.md` has PR# but no title; `RV-CODE-009/010/011-tkt-NNN-{title}.md` has title but no PR#). The 3 most recent closures all converged on the title-only canonical pattern, so the inconsistency is a tail of the older convention.

**The issue:** Inconsistent RV file naming makes `git log` / `gh pr list` / repo-grep less predictable. It also adds a clerical fix step to every closure-PR (the TKT-013 closure-PR renames the file via `git mv`).

**Proposed fix:** Reinforce in `docs/prompts/reviewer.md` and in TO's Reviewer NUDGE template the canonical pattern: `docs/reviews/RV-CODE-NNN-tkt-NNN-{title-slug}.md` where `NNN` matches the target TKT and `{title-slug}` is the lowercase-hyphenated TKT title. Mirror the change in `docs/meta/devin-session-handoff.md` §11 if the section enumerates Reviewer dispatch files. Optionally update `scripts/validate_docs.py` to warn (not fail) on RV files that include `pr-NN` segments — would auto-surface drift.

**Severity:** Low (clerical, no correctness or process impact; closure-PR rename is a 1-line `git mv`). Implement opportunistically; can ride along with the next Reviewer-prompt edit.

**ArchSpec dependency:** None.

## TKT-NEW-v0.1-runnable-entrypoint-missing-CRITICAL

**Source:** PO empirical deployment attempt 2026-05-04 following `docs/meta/po-self-testing-guide.md` §1; PO chat (verbatim, 2026-05-04): «инструкция предполагала, что в репе есть готовый main-файл, запускающий Telegram-бота. Его нет.». Devin Orchestrator code-audit confirmed all three symptoms below on `main` HEAD `a2cb490` during the 2026-05-04 cold-handoff session.

**The issue:** v0.1 KBJU Coach has no runnable boot path on `main`. Three concrete defects compound:

1. **Dockerfile CMD path mismatch with `tsconfig.json` rootDir.** `Dockerfile:10` declares `CMD ["node", "dist/index.js"]`, but `tsconfig.json:15` sets `rootDir: "."` and `tsconfig.json:18` sets `include: ["src/**/*.ts", "tests/**/*.ts"]`, so `src/index.ts` compiles to `dist/src/index.js`, not `dist/index.js`. `docker compose up -d --build` from a clean clone produces a container that immediately exits with `Cannot find module '/app/dist/index.js'`. Symptom verified empirically by PO + DeepSeek deployment helper on the dev-VPS and reproduced locally on the cold-handoff Devin VM.

2. **`src/index.ts` is a barrel-file with zero executable code.** All 46 lines are `export type` re-exports from `src/shared/config.ts` and `src/shared/types.ts`. Even after the Dockerfile CMD path is corrected to `dist/src/index.js`, `node` exits with code 0 immediately because nothing runs.

3. **No integration layer between OpenClaw and KBJU handlers.** `routeMessage` and `routeCallbackQuery` are defined in `src/telegram/entrypoint.ts` and tested in `tests/telegram/entrypoint.test.ts`, but no source file in `src/` calls them. No code constructs the `C1Deps` object (sendMessage / sendChatAction / logger / metricsRegistry). No code instantiates `TenantStore`, `MealOrchestrator`, `HistoryService`. No code starts a Telegram long-polling loop or registers a webhook. `package.json` `dependencies` contains only `{ "pg": "^8.20.0" }` — no `openclaw` runtime dep, no Telegram-bot library. Verified via `grep -rln "routeMessage\|routeCallbackQuery" src/` returning only the defining file plus tests.

**Why every prior closure-audit missed it:** The pilot-readiness smoke suite (`src/pilot/pilotReadinessReport.ts`, `tests/pilot/*.test.ts` from TKT-014) is mocked at every external boundary; no test in `tests/` ever actually starts the application process. Five Ticket Orchestrator pilots × (Reviewer Kimi K2.6 + PR-Agent + Ticket Orchestrator audit pass-1 + Devin Orchestrator ratification audit pass-2) = 15+ audit gates, plus the `docs/meta/po-self-testing-guide.md` §1 path that PO followed, all rely on artefacts being present in `src/` and on green unit-test mocks rather than on a green container start. Captured separately in `docs/backlog/pilot-kpi-smoke-followups.md §TKT-NEW-mocked-end-to-end-smoke-tests-false-confidence-process-retro` as a process-retro entry.

**Proposed fix shape (Architect Phase-0 Recon owns the design):** Resolution lands in ARCH-001 v0.5.0 (or sibling ARCH-002, Architect chooses) as part of the combined v0.1-integration-fix + PRD-002@0.2.1 Observability ArchSpec dispatch (Option A authorised by PO chat 2026-05-04: «1. А»). The ArchSpec must specify:
- The boot entry point shape (where `main()` lives, who imports it, how `Dockerfile` CMD references it).
- The `C1Deps` factory contract (how `sendMessage`/`sendChatAction`/`logger`/`metricsRegistry` are constructed from env vars + which Telegram client library powers them).
- The OpenClaw runtime integration shape (resolved jointly with §TKT-NEW-openclaw-runtime-shape-recon-CRITICAL below).
- The `Dockerfile` CMD path correction.
- An ArchSpec-mandated test that **actually starts the application process** as a smoke test (per the `pilot-kpi-smoke-followups.md` process retro entry).

Implementation tickets follow the normal pipeline (Architect produces TKT-NNN, Executor implements, Reviewer reviews, PO merges).

**Severity:** CRITICAL — blocks the entire v0.1 organic 30-day pilot (PRD-001@0.2.0 §6 K1-K7 baselines remain `n/a` until a real Telegram message actually reaches a KBJU handler) and blocks PRD-002@0.2.1 G1/G2/G3 telemetry deployment (the breach detector / stall detector / PR-Agent telemetry instrumentation all assume an instrumentable boot path).

**ArchSpec dependency:** ARCH-001@0.4.0 §3 Components and §10 Operational Procedures collectively assume a runnable boot path; the gap is in the level of detail, not in the existence of components. Resolution = ARCH-001 v0.5.0 expansion (Option A) covering both this gap and PRD-002@0.2.1.

**Forensics inputs (PO-side empirical Recon material for Architect):** PO ran a deployment-helper opencode session (DeepSeek V4 Pro) on the dev-VPS (`/home/adminpzfq/openclown-assistant`) which empirically discovered (a) the Dockerfile CMD path mismatch (compensated locally by patching CMD to `dist/src/index.js`, then to `openclaw gateway`), (b) the barrel-file problem, (c) a working `openclaw gateway` configuration with `channels.telegram.enabled: true` and `gateway.mode: "local"`. None of these patches landed in `main` or in any branch — they live only on the dev-VPS as untracked working-directory state, plus a `Dockerfile` modification flagged by `git status`. They are valid PO-side scouting per CONTRIBUTING.md row 9 («Product Owner — MAY write Anything (final authority)»). The 8-file forensics-bundle (`forensics-git-status.txt`, `forensics-git-diff.txt`, `forensics-dockerfile-modified.txt`, `forensics-openclaw-json.txt`, `forensics-compose-ps.txt`, `forensics-app-logs.txt`, `forensics-pg-logs.txt`, `forensics-openclaw-state.txt`) is preserved locally with PO and is available as Recon input for the Architect dispatch.

## TKT-NEW-openclaw-runtime-shape-recon-CRITICAL

**Source:** PO deployment forensics 2026-05-04 (`forensics-app-logs.txt` lines 13, 14, 21-24); Devin Orchestrator empirical check via `npm view openclaw` and `openclaw --help` output forwarded by PO from the dev-VPS opencode session.

**The issue:** `docs/knowledge/openclaw.md` (Architect Phase-0 Recon required reading per CONTRIBUTING.md hard rule 5) describes OpenClaw as «a self-hosted gateway / agent-runtime that hosts "skills" written in TypeScript on Node 24» and specifies a skill anatomy («`metadata` / `init(ctx)` / `handle(input, ctx)` / optional `cron(ctx)`»). The npm package `openclaw@2026.5.3-1` (npmjs.org, MIT, multi-channel AI gateway) is a **finished gateway product** that ships an embedded LLM agent (default `agent model: openai/gpt-5.5`) and 7 channel/sidecar plugins (`browser`, `device-pair`, `file-transfer`, `memory-core`, `phone-control`, `talk-voice`, `telegram`). When invoked as `openclaw gateway` with `channels.telegram.enabled: true`, the gateway routes incoming Telegram messages to its **embedded** agent, not to externally-registered skill classes — at least when no skill / plugin registration is performed.

Empirically verified on the dev-VPS:
- `forensics-app-logs.txt:14` — `[gateway] http server listening (7 plugins: browser, device-pair, file-transfer, memory-core, phone-control, talk-voice, telegram; 10.0s)`.
- `forensics-app-logs.txt:13` — `[gateway] agent model: openai/gpt-5.5`.
- `forensics-app-logs.txt:21-24` — Telegram update reached the gateway, was dispatched to `lane=main` (the embedded agent), and failed with `Error: No API key found for provider "openai". Auth store: /root/.openclaw/agents/main/agent/auth-profiles.json` — confirming that `routeMessage`/`routeCallbackQuery` from `src/telegram/entrypoint.ts` were never invoked, because the gateway has no registration linking them to the Telegram channel.

PO-forwarded `openclaw --help` (chat 2026-05-04) lists subcommands including `agent`, `agents`, `channels`, `chat`, `clawbot`, `commitments`, `cron`, `gateway`, `plugin`, `skills`, `tools`. The presence of `skills` and `plugin` subcommands strongly suggests the npm package **does** support custom skill / plugin loading — the integration mechanism described in `docs/knowledge/openclaw.md` likely exists in some form, but the exact contract (config file location, plugin manifest schema, how a custom skill claims a channel/route, how `OMNIROUTE_API_KEY` env var is wired into the gateway's `auth-profiles.json` store, what `gateway.mode` values mean in practice) was not exercised by the forensics-bundle and is not documented in the repo.

**Proposed Architect Phase-0 Recon outcome:** The combined ARCH-001 v0.5.0 ArchSpec (Option A) MUST resolve in §0 Recon Report and §3 Components:
- Empirical mapping of the npm `openclaw` skill / plugin loading mechanism (read `openclaw skills --help`, `openclaw plugin --help`, [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw#readme), and the npm package's bundled docs).
- A build-vs-fork-vs-skip decision per `docs/prompts/architect.md` Phase-0: either (a) integrate via the `openclaw skills` registration mechanism if it exists and matches our needs; (b) integrate via a webhook-channel pattern where openclaw forwards Telegram messages to our HTTP endpoint; (c) abandon the openclaw runtime and use a raw Telegram bot library (e.g. `grammy`, already a transitive dep of openclaw, or `node-telegram-bot-api`).
- Update `docs/knowledge/openclaw.md` (within Architect Phase-0 write-zone) so future Architects do not re-incur this mismatch.
- A new ADR (numbering continues from ADR-010, e.g. `ADR-011-openclaw-integration-shape.md`) documenting the chosen integration option and its trade-offs.

**Severity:** CRITICAL — gates the resolution of `§TKT-NEW-v0.1-runnable-entrypoint-missing-CRITICAL` above. Cannot author the integration-layer ArchSpec section without first resolving which integration mechanism the chosen runtime supports.

**ArchSpec dependency:** ARCH-001@0.4.0 §3.1 (C1 Access-Controlled Telegram Entrypoint) asserts the `routeMessage`/`routeCallbackQuery` shape; the gap is between that interface and the actual openclaw runtime that hosts (or doesn't host) it. `docs/knowledge/openclaw.md` is the proximal Recon-knowledge source affected.
