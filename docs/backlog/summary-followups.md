---
id: BACKLOG-008
title: "Summary Recommendation Scheduler follow-ups (post TKT-011) + second TO pilot structural lessons"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-02
---

# Summary Recommendation Scheduler follow-ups + second TO pilot lessons

This file collects the deferred follow-ups from the TKT-011 closure (PR #75 + PR #76 + closure-PR) and the structural lessons learned from the second end-to-end Ticket Orchestrator pilot. The first pilot (TKT-010) generated `BACKLOG-007` and `PR #71`; this pilot generates `BACKLOG-008`.

The 6 entries below split into:
- **2× F-PA carry-over** from PR-Agent persistent review on PR #75 final HEAD `4e3e818` (informational, non-blocking — defer-to-BACKLOG was the audit verdict).
- **4× structural TKT-NEW** from anomalies surfaced during the cycle (executor model mismatch, reviewer re-engagement gap, PR-Agent CI tail-latency, RV-CODE numbering).

## TKT-NEW-loader-context-error-message

**Source:** PR-Agent F-PA-1 on PR #75 final HEAD `4e3e818` (`src/summary/summaryScheduler.ts:286` cited; root cause in `src/summary/personaLoader.ts`).

**The issue:** `loadPersona` is called in two contexts: at C9 startup (where a missing/corrupt persona file should fail-closed loudly) and inside `processDueSchedule` (where the persona is loaded for each scheduled summary). Both paths share the same error message — `"C9 startup failed: <reason>"`. Runtime persona-file failures (file deleted post-startup, disk error, etc.) will be misattributed by operators as a startup issue when they are runtime issues.

**Proposed fix:** Differentiate the error contexts. Either (a) accept a `context: "startup" | "runtime"` parameter on `loadPersona` and use it in the thrown message, or (b) wrap the runtime call in `processDueSchedule` with a try/catch that re-throws with a runtime-context message. Tests should cover both contexts.

**Severity:** Low (operator-UX / observability clarity, no correctness or security impact). Defer to a future Polish-pass ticket once C9 has at least one production incident to inform the right wording.

**ArchSpec dependency:** `ARCH-001@0.4.0 §3.9` describes C9 startup behavior; this ticket would tighten the runtime-error contract without changing it.

## TKT-NEW-loader-async-fs

**Source:** PR-Agent F-PA-2 on PR #75 final HEAD `4e3e818` (`src/summary/personaLoader.ts:12`).

**The issue:** `loadPersona` uses `readFileSync` to load the persona file. The first invocation inside the async `processDueSchedule` will block the event loop. The cache mitigates repeated calls (so this is one-time-per-process latency in the steady state), and the bot is single-process with a small persona file, so impact is bounded — but for a production-grade implementation, async `fs.readFile` is the right primitive.

**Proposed fix:** Convert `loadPersona` to an async function using `fs.promises.readFile`. Make the cache async-safe (single-flight pattern: concurrent first calls share one read). Update `processDueSchedule` and tests accordingly.

**Severity:** Low (performance, not correctness; cache-mitigated; persona file is small). Defer to a future Polish-pass ticket once C9 has measurable latency data showing the synchronous read is observable.

**ArchSpec dependency:** `ARCH-001@0.4.0 §3.9` is silent on sync-vs-async for persona loading.

## TKT-NEW-launcher-asserts-frontmatter-executor

**Source:** Cross-reviewer audit pass-2 anomaly during TKT-011 closure (Devin Orchestrator ratification).

**The issue:** TKT-011 frontmatter `assigned_executor: "qwen-3.6-plus"` was set per the original ticket design. PO launched the actual opencode Executor session on `glm-5.1` (PO confirmation: "это формальность, ТО почему-то указывал квен, хотя мы делаем и я делал на глм"). The deviation was not visible until post-hoc audit when the Devin Orchestrator's cross-review noticed the model footer in the opencode UI. The TKT-011 frontmatter was bumped post-hoc to `glm-5.1` to match reality, but in a stricter pipeline this should be caught at launch time.

**Proposed fix:** The launcher (whatever wraps the opencode-session start) should read the frontmatter `assigned_executor` field for the target Ticket and either (a) auto-select that model in OmniRoute / opencode, or (b) compare the PO-selected model against the frontmatter value and fail-closed with a visible error message if they differ. Option (a) is preferable because it removes a manual step. If option (b), the error message should include both values and a one-liner on how to override the frontmatter (with PO authorization in the closure-PR).

**Severity:** Medium (process-discipline; current run produced clean code, but executor-uncorrelation calibration is silently violated when executor model differs from frontmatter; could lead to subtler issues on future tickets where executor profile actually matters for the work).

**Cross-reference:** This is the structural fix for the procedural anomaly in TKT-011 closure noted at `docs/tickets/TKT-011-summary-recommendation-scheduler.md` `completed_note` (frontmatter post-hoc bump to glm-5.1).

## TKT-NEW-reviewer-reengagement-after-substantive-pushes

**Source:** Cross-reviewer audit pass-2 anomaly during TKT-011 closure (Devin Orchestrator ratification, procedural gap covered substantively by PR-Agent + Devin Review).

**The issue:** Reviewer (Kimi K2.6) returned verdict `pass` on TKT-011 iter-2 (Executor commit `f195017`). After that pass, the Executor pushed 6 more substantive commits (`31062e4` blocked_reason → error_code, `ee5ef88` NFKC normalization + zero-width stripping, `55b56e8c` persona delimiters, `9f456e41` homoglyph + persona cache path, `11ee175d` actual month-length targets + delta JSON keys, `4e3e818` persona escape) in response to PR-Agent inline findings + one Devin Review correctness fix. Kimi was not formally re-engaged on any of those iters. This is a procedural gap: the contract is "Reviewer pass means no further substantive code change without re-review", but the actual pipeline lets the Executor keep pushing against PR-Agent / Devin Review findings without re-invoking Kimi. In TKT-011 the resulting code happened to be clean (PR-Agent persistent review on final HEAD: ⚡ no major issues, 🔒 no security concerns), but the contract was technically broken.

**Proposed fix:** Codify in `docs/prompts/ticket-orchestrator.md` (or `docs/prompts/executor.md`) that any substantive Executor commit pushed after Reviewer verdict `pass` must trigger a fresh Reviewer iteration on the same opencode session per the iter-N continuation rule (`PR #71`). Define "substantive" precisely: any change touching `src/`, `tests/`, or any executable code; clerical edits to comments / docs / formatting are exempt. The Ticket Orchestrator is responsible for detecting post-pass substantive pushes and dispatching the Reviewer iter-N+1.

**Severity:** Medium (process-discipline; substance was clean in TKT-011 thanks to PR-Agent + Devin Review, but the contract gap means future tickets could merge unreviewed substantive code if PR-Agent / Devin Review miss something).

**Cross-reference:** This is one of the four structural lessons from the TKT-011 pilot. The lesson is parallel to F-PA-17 from TKT-010 (which spawned the cross-reviewer audit Hard rule); together they harden the post-Reviewer-pass invariants.

## TKT-NEW-pr-agent-tail-latency

**Source:** Cross-reviewer audit pass-2 anomaly during TKT-011 closure (Devin Orchestrator strategic decision to treat stuck workflow as CI infrastructure failure).

**The issue:** PR-Agent persistent review settled correctly on TKT-011 final HEAD `4e3e818` with verdict ⚡ no major issues. However, the GitHub Actions workflow run `25240991302` was formally stuck IN_PROGRESS on that HEAD after a prior CANCELLED run (after 9 min on the same HEAD). This is the second TO pilot showing PR-Agent CI tail-latency anomalies on the final Executor HEAD: TKT-010 had a 22-min OmniRoute / Fireworks tail-latency outlier on its final HEAD `5127bf1` (normal 3-9 min; documented in `docs/session-log/2026-05-01-session-4.md §6.6`). 2 of 2 final-HEAD runs across 2 TO pilots show the pattern. `PR #71` codified a 12-min hard timeout to mitigate impact, but the root cause is upstream of our orbit (likely OmniRoute throughput / Fireworks queueing on long context).

**Proposed fix:** Investigate the OmniRoute / Fireworks throughput on PR-Agent's specific prompt shape (full-PR diff + persistent-review context). Options: (a) request a higher-tier OmniRoute slot for `qodo-pr-agent` route, (b) split PR-Agent invocation into smaller per-file calls instead of one large per-PR call, (c) tune `.pr_agent.toml` `max_completion_tokens` / `max_input_tokens` lower, (d) accept the pattern and codify "stuck PR-Agent on final HEAD = treated as CI infrastructure tail-latency under Devin Orchestrator authority" in `docs/meta/devin-session-handoff.md §11.4`. Until the root cause is fixed, the 12-min hard timeout (`PR #71`) plus the Devin Orchestrator override path is the working mitigation.

**Severity:** Medium (operations-discipline; pattern is reliable enough across 2 of 2 pilots that it should be investigated upstream rather than absorbed indefinitely as DO override).

**Cross-reference:** Session-log `2026-05-01-session-4.md §6.6` (TKT-010 tail-latency); this closure (`docs/tickets/TKT-011-summary-recommendation-scheduler.md` `completed_note`); `PR #71` (12-min timeout + cancel-in-progress); `docs/meta/devin-session-handoff.md §11.4` (DO ratification authority).

## TKT-NEW-reviewer-rv-code-numbering-convention

**Source:** Cross-reviewer audit pass-2 anomaly during TKT-011 closure (Devin Orchestrator clerical fix in this closure-PR).

**The issue:** The Reviewer (Kimi K2.6) opened the TKT-011 review artifact as `docs/reviews/RV-CODE-016-pr-75-tkt-011.md` with frontmatter `id: RV-CODE-016`. The repo convention is `TKT-N ↔ RV-CODE-N` (verified across `RV-CODE-001`..`RV-CODE-010` and `RV-CODE-015`). The Reviewer apparently picked the next-sequential available number (after `RV-CODE-015` for TKT-015) instead of consulting the TKT-N being reviewed (`RV-CODE-011` for TKT-011). The RV file was renamed to `RV-CODE-011-tkt-011-summary-recommendation-scheduler.md` in this closure-PR, with frontmatter `id` and approved_note text adjusted accordingly.

**Proposed fix:** Add an explicit rule to `docs/prompts/reviewer.md` (under file-naming) that the RV-CODE-N artifact MUST take its numeric suffix from the target Ticket's TKT-N (not next-sequential). Add a CI check in `scripts/validate_docs.py` that asserts every RV file's `id` field matches its `ticket_ref` field's numeric suffix (e.g., `id: RV-CODE-011` requires `ticket_ref: TKT-011@*` and the file name must follow `RV-CODE-011-*.md`).

**Severity:** Low (clerical, no substance impact; renamed in this closure-PR; CI check would prevent recurrence).

**Cross-reference:** `docs/prompts/reviewer.md` (target file for the rule); `scripts/validate_docs.py` (target file for the CI check).
