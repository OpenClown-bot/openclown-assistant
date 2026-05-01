---
id: BACKLOG-004
title: "Photo Recognition Adapter follow-ups (post TKT-008)"
status: open
spec_ref: ARCH-001@0.4.0
created: 2026-05-01
---

# Photo Recognition Adapter follow-ups (post TKT-008)

Deferred low-severity work surfaced during the TKT-008 (Photo Recognition Adapter) review cycle. Captured here per `docs/backlog/README.md` rules — not yet Tickets, not yet estimated; promotion to TKT happens when the Architect produces an ArchSpec section that covers the item.

Source-of-record for finding text and code locations:
- Reviewer (Kimi K2.6): `docs/reviews/RV-CODE-008-tkt-008-photo-recognition-adapter.md`. All 7 iter-1 findings (1H + 3M + 3L) were RESOLVED in iter-2; no Reviewer-deferred items remain.
- Supplementary reviewer (PR-Agent / Qwen 3.6 Plus on OmniRoute): inline `/improve` comments on PR #51 (commits 4ba7c3b iter-1 and bb40216 iter-2).

PO decision on 2026-05-01 was to defer the four PR-Agent supplementary findings below (discovered after iter-2 merge) to this backlog. All Kimi iter-1 findings were RESOLVED in iter-2 — no Reviewer-originated BACKLOG entries.

## TKT-NEW-M — Replace `typeof x !== "number"` with `Number.isFinite(x)` in `validateVisionOutput`

**Source:** PR #51 PR-Agent `/improve` inline suggestion on iter-1 commit 4ba7c3b (line 104, importance 7).

**The issue.** In `src/photo/photoRecognitionAdapter.ts`, `validateVisionOutput` guards numeric fields (`calories_kcal`, `protein_g`, `fat_g`, `carbs_g`, `portion_grams`) with `typeof x !== "number"`. This check passes `NaN` and `Infinity` (both satisfy `typeof x === "number"`), which would propagate invalid values to the KBJU aggregation layer and to the database. JavaScript's `NaN !== NaN` and `Infinity > 0` further cause silent downstream logic failures. For `portion_grams`, the iter-2 fix added a negative-value guard but still uses `typeof` for the baseline check, leaving NaN/Infinity unguarded on that field too.

**Proposed fix (Architect to ratify).** Replace `typeof x !== "number"` with `!Number.isFinite(x)` uniformly across all numeric field validations in `validateVisionOutput`. `Number.isFinite(x)` returns `false` for `NaN`, `Infinity`, `-Infinity`, non-numbers, and `null`/`undefined` — covering all invalid cases in one check. Apply to `calories_kcal`, `protein_g`, `fat_g`, `carbs_g`, and `portion_grams`. Add boundary tests: `NaN` → rejected; `Infinity` → rejected; `-Infinity` → rejected; `0` → accepted; `100.5` → accepted.

**NOT in scope of the eventual TKT.** Introducing a schema-validation library (e.g. zod) for the full VisionStructuredResponse; redesigning the validation pipeline to a declarative schema approach; fixing NaN/Infinity in other adapters (C5/C6 — those are covered by separate BACKLOG entries if applicable).

**Estimated size:** XS. Tests: existing validation tests stay green; 3–5 new boundary tests for NaN/Infinity/-Infinity per field.

**Dependencies:** none. TKT-008 already done.

---

## TKT-NEW-N — Capture `safeDeletePhoto` deletion result on remaining outcome paths

**Source:** PR #51 PR-Agent `/improve` inline suggestions on iter-2 commit bb40216 (lines 403, 444, 484; importance 8 each). Same fix pattern as Kimi F-L2 which was applied only to the `budget_blocked` path during iter-2.

**The issue.** In `src/photo/photoRecognitionAdapter.ts`, three additional outcome paths — suspicious-output detection (line 403), JSON parse error (line 444), and schema validation failure (line 484) — call `safeDeletePhoto(request)` but discard its return value and hardcode `photoDeleted: true` in the result object. If `safeDeletePhoto` fails (e.g. the file was already deleted by another process, or the file system is temporarily unavailable), the returned `PhotoRecognitionResult` incorrectly reports the photo as deleted when it is not. This inconsistency propagates to the Telegram response layer, which may tell the user their photo has been cleaned up when it hasn't.

The `budget_blocked` path (line 188) was fixed during iter-2 for Kimi finding F-L2: `const deletionOk = await safeDeletePhoto(request); ... photoDeleted: deletionOk`. The three paths above were NOT fixed because Kimi's F-L2 finding was scoped only to the `budget_blocked` path. PR-Agent `/improve` on the iter-2 commit (after merge) identified the same pattern on the remaining paths.

**Proposed fix (Architect to ratify).** Apply the identical fix from the `budget_blocked` path to all three remaining paths: `const deletionOk = await safeDeletePhoto(request);` → use `photoDeleted: deletionOk` in the return object. Add one test per path asserting `photoDeleted === false` when `safeDeletePhoto` mock returns `false`. This is a mechanical copy of the F-L2 pattern.

**NOT in scope of the eventual TKT.** Introducing a helper function to DRY the pattern (e.g. `returnWithDeletion(request, partialResult)` that wraps the `safeDeletePhoto` call and sets `photoDeleted` — this is nice-to-have but crosses the "refactor" line and should be ratified separately). No changes to the happy-path outcome flow.

**Estimated size:** XS. Tests: 3 new tests (one per path); existing tests stay green.

**Dependencies:** none. TKT-008 already done.
