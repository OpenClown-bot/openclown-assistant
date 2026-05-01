---
id: BACKLOG-005
title: "Meal Draft Orchestrator follow-ups (post TKT-009)"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-01
---

# Meal Draft Orchestrator follow-ups (post TKT-009)

Deferred work surfaced during the TKT-009 (Meal Draft Confirmation Flow) review cycle. Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations:
- Reviewer (Kimi K2.6): `docs/reviews/RV-CODE-009-tkt-009-meal-draft-confirmation-flow.md`. Iter-1 fail (1H + 2M + 4L), iter-2 pass_with_changes (F-H1/F-M1/F-M2/F-M3 RESOLVED), iter-3 pass (F-PA-18 + F-L1 RESOLVED), iter-4 pass_with_changes (F-H2 promoted from PR-Agent), iter-4 verify pass (F-H2 RESOLVED, PR-Agent c4fb9f2 findings A/B ruled non-substantive).
- Supplementary reviewer (PR-Agent / Qwen 3.6 Plus on OmniRoute): inline `/improve` comments on PR #59 across commits `cae5c03` (iter-1), `5e3edb3` (iter-2), `db96ec4` (iter-3), `c4fb9f2` (iter-4 fix), `8815fef` (iter-4 verify on rv-branch).

PO decision on 2026-05-01 was to fix all High and Medium findings in iter-2/3/4 and defer the three items below to this backlog. F-PA-17 (HTML-escape gap) was promoted to iter-4 as F-H2 and RESOLVED in-cycle — not a backlog entry. Cross-reviewer audit caught F-PA-17 only in the continuation session; the orchestrator pipeline rule for re-evaluating PR-Agent inline comments marked "old commit" on every audit pass is codified separately in the orchestrator handoff §5.

## TKT-NEW-O — Reconcile C1/C4 meal-draft creation lifecycle (estimating → awaiting_confirmation)

**Source:** Kimi iter-1 finding F-M1 (`docs/reviews/RV-CODE-009-tkt-009-meal-draft-confirmation-flow.md` §Findings/Medium). Ratified as Architect-responsibility CONTEXT-FINDING in iter-2 per Reviewer's `Suggested remediation` option (a).

**The issue.** TKT-009 implementation creates `meal_drafts` rows directly with `status="awaiting_confirmation"` for text, voice, and photo sources inside `MealOrchestrator.handleMealInput`. ARCH-001@0.4.0 §4.2 step 1 and §4.4 step 1 specify that C1 (Telegram entrypoint) creates the initial draft with `status="estimating"`; C4 (Meal Logging Orchestrator) is then expected to update the existing draft to `awaiting_confirmation` after C6 (KBJU estimator) or C7 (photo recognition) returns. The current C4 code skips the `estimating` state entirely. This removes the in-flight estimation audit trail (estimating-state drafts cannot be observed in `audit_events`) and breaks the C1→C4 state-handoff contract that future C1-integration tickets will rely on.

**Proposed fix (Architect to ratify).** Two paths, Architect picks one and amends ARCH-001:

(a) **Status-quo ratification.** Amend ARCH-001 §4.2 / §4.4 to remove the `estimating` intermediate state. C4 becomes the single creator of `meal_drafts` rows with `status="awaiting_confirmation"`; C1 is responsible only for transcript / image-pointer rows. Delete the `estimating` state from the schema (`meal_drafts.status` enum) or document it as deprecated.

(b) **Refactor C4 to update-only.** Amend ARCH-001 to keep the `estimating` state and clarify that C1 creates draft rows with `status="estimating"`; C4 receives a `draftId` in the orchestrator request and calls `repo.updateMealDraftWithVersion` to flip to `awaiting_confirmation`. This requires C1 integration changes (TKT-NEW-O downstream TKT) and a `MealOrchestratorRequest.draftId` parameter.

**NOT in scope of the eventual TKT.** Schema changes to `meal_drafts.status` beyond the chosen path; cross-cutting C1 access-control changes; user-facing UX changes.

**Estimated size:** S (path a — text-only ArchSpec amendment) or M (path b — C4 refactor + C1 integration + 2-3 new tests).

**Dependencies:** Architect must produce ARCH-001@0.5.0 amendment first; promotion to TKT only after Architect ratification.

---

## TKT-NEW-Q — Ratify ARCH-001 §4.5 replace-vs-append correction semantics + transcript_id linkage

**Source:** Kimi iter-1 finding F-L1 (`docs/reviews/RV-CODE-009-tkt-009-meal-draft-confirmation-flow.md` §Findings/Low) ratified by PR-Agent F-PA-12 cross-reviewer audit; Kimi iter-1 finding F-L2 (dead `transcriptId` parameter in voice path).

**The issue.** Two related Architect-responsibility gaps surfaced in TKT-009:

1. **Replace-vs-append semantics for `applyCorrection`.** ARCH-001@0.4.0 §4.5 (Manual entry, edit, and delete history) does not specify whether a correction must replace the prior `meal_draft_items` rows or append new rows. PR-Agent F-PA-18 forced a defect resolution in iter-3 (Executor adopted replace semantics via `deleteMealDraftItemsByDraftId` inside the transaction), but the underlying ArchSpec ambiguity remains. Future correction-flow tickets (TKT-010, TKT-014) need an explicit contract.

2. **`transcript_id` linkage for voice drafts.** ARCH-001@0.4.0 §5 schema lists `meal_drafts.transcript_id` as an optional column linking voice-sourced drafts to the originating row in `transcripts`. TKT-009 never populates this field — the dead `transcriptId` variable in `handleMealInput` (Kimi F-L2) was a vestigial attempt at the linkage. Without `transcript_id` populated, voice-meal audit reconstruction cannot trace back to the transcript row that produced the draft, breaking the data-integrity invariant for incident response.

**Proposed fix (Architect to ratify).** Single TKT covering both:

1. Amend ARCH-001@0.5.0 §4.5 to explicitly state: "When C4 receives a correction, it MUST delete all prior `meal_draft_items` rows for the draft inside the same transaction that increments the draft version, then insert the corrected items. Append semantics are not permitted." Cite the iter-3 implementation (`deleteMealDraftItemsByDraftId` followed by insert loop) as canonical.

2. Amend ARCH-001@0.5.0 §4.3 / §5 to require: "C4 MUST populate `meal_drafts.transcript_id` from `MealOrchestratorRequest.transcriptResult.transcriptId` when `source === \"voice\"`." Schema-side: confirm `meal_drafts.transcript_id` foreign key to `transcripts(id)` is correct in TKT-002 schema (verify, do not change).

3. Promote to TKT-NEW-Q implementation ticket after Architect amendment: Executor wires `request.transcriptResult.transcriptId` through `handleMealInput` to `repo.createMealDraft`. Add a regression test asserting voice-source drafts persist non-null `transcript_id`.

**NOT in scope of the eventual TKT.** Schema migrations; transcript-row TTL changes; multi-transcript draft support; backfill of historical drafts.

**Estimated size:** S (Architect amendment + 1-file Executor change + 1 test).

**Dependencies:** Architect must produce ARCH-001@0.5.0 amendment; TKT-002@0.1.0 schema confirmed.

---

## TKT-NEW-S — `escapeHtml` defensive-depth coverage for `"` and `'` if HTML attributes ever appear in messaging

**Source:** PR-Agent finding on iter-4 fix commit `c4fb9f2` (PR #59 persistent review block on commit c4fb9f25, plus `/improve` inline suggestion on iter-1 comment id 3172888561). Reviewer (Kimi K2.6) iter-4 verify ruling on commit `8815fef`: **non-substantive for current usage, defensive depth follow-up filed to BACKLOG**.

**The issue.** `src/shared/escapeHtml.ts` (added in TKT-009 iter-4 to fix F-H2) maps `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`. It does not escape `"` (double quote) or `'` (single quote). Telegram HTML `parseMode` (https://core.telegram.org/bots/api#html-style) reserves only `<`, `>`, `&` in plain text content; `"` and `'` are reserved ONLY inside HTML attribute values (e.g. `<a href="...">`). `buildDraftMessage` and all current HTML-mode message builders produce plain text with zero HTML tags and zero attributes, so the missing `"`/`'` escapes cannot break the current pipeline.

If a future messaging feature introduces HTML tags with attributes — for example, a `<a href="https://...">` link in a draft reply, a `<tg-emoji emoji-id="...">` element, a `<tg-spoiler>` wrapping with attributes, or any user-controlled string interpolated into an attribute value — unescaped `"` could break the attribute boundary and cause Telegram Bot API to reject the message with "Bad Request: can't parse entities".

**Proposed fix (Architect to ratify or Executor to apply directly when triggered).** When the first messaging feature that uses HTML attributes lands:

1. Expand `src/shared/escapeHtml.ts` to also map `"` → `&quot;` and `'` → `&#39;`.

2. Add regression tests in `tests/meals/messages.test.ts` (or wherever the new attribute-using messaging path lives) covering: (a) a string containing `"` is escaped to `&quot;` in rendered output; (b) a string containing `'` is escaped to `&#39;` in rendered output; (c) the existing `&`/`<`/`>` escapes still work; (d) the manual-entry passthrough test still passes.

3. Audit all existing HTML-mode message builders to confirm none use attributes today and add a code-comment to `escapeHtml` documenting the scope: "Escapes only the three characters reserved by Telegram HTML parseMode in plain text content. Expand to cover `\"` and `'` if HTML attributes are ever interpolated."

**NOT in scope of the eventual TKT.** Switching parseMode to MarkdownV2; supporting Telegram inline keyboards with HTML-mode buttons; escaping for non-Telegram destinations.

**Estimated size:** XS. Two `.replace()` calls + 4 new tests + 1 code comment.

**Dependencies:** Triggered when a messaging TKT introduces the first HTML attribute. No standalone Architect amendment required.

---

## Carry-forward note — orchestrator pipeline rule for cross-reviewer audit

The TKT-009 cycle exposed a procedural gap: the outgoing-Devin orchestrator's audit triage anchored on iter-2+ PR-Agent comments only, missing the iter-1 inline comments (3172888561 / 3172894543) that flagged the F-H2 HTML-escape gap. The continuation Devin session caught the gap on a re-audit triggered by PO push-back, dispatched iter-4, and resolved F-H2 in-cycle.

The pipeline rule that PR-Agent inline `/improve` comments marked "old commit" MUST be re-evaluated on every audit pass — and that substantive findings (importance ≥ 7 or security/correctness/data-integrity class) MUST be promoted to Reviewer iter-N scope alongside Kimi findings — is being codified in the next clerical PR (orchestrator handoff §5 + role templates). Not a BACKLOG entry; it is binding pipeline procedure for future cycles.
