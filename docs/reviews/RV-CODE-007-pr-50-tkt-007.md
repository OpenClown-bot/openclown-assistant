---
id: RV-CODE-007
type: code_review
target_pr: "https://github.com/OpenClown-bot/openclown-assistant/pull/50"
ticket_ref: TKT-007@0.1.0
status: in_review
reviewer_model: "kimi-k2.6"
created: 2026-05-01
---

# Code Review — PR #50 (TKT-007@0.1.0)

## Summary
The implementation satisfies all 8 Acceptance Criteria with 29/29 tests passing, lint/typecheck clean, no new runtime dependencies, and scope-compliant diff. Two medium findings remain: providerAlias is hardcoded to "omniroute" despite ADR-003@0.1.0 permitting a direct Fireworks fallback path, and the PR body omits a rollback procedure.

## Verdict
- [ ] pass
- [x] pass_with_changes
- [ ] fail

One-sentence justification: All ACs are met and the code is well-structured, but hardcoded providerAlias corrupts fallback-path observability, and the PR body lacks a rollback note.
Recommendation to PO: approve & merge after Executor addresses M1 and M2 (patch-bump scope, no re-review required).

## Contract compliance
- [x] PR modifies ONLY files listed in TKT §5 Outputs (`src/voice/types.ts`, `src/voice/transcriptionAdapter.ts`, `src/voice/voiceFailurePolicy.ts`, `tests/voice/transcriptionAdapter.test.ts`, `tests/voice/voiceFailurePolicy.test.ts`) plus permitted Ticket frontmatter edits.
- [x] No changes to TKT §3 NOT-In-Scope items (no Telegram routing, no KBJU parsing, no local Whisper).
- [x] No new runtime dependencies beyond TKT §7 Constraints allowlist (package.json unchanged).
- [x] All Acceptance Criteria from TKT §6 are verifiably satisfied (file:line or test name cited below).
- [x] CI green — `npm test` 29/29 pass, `npm run lint` / `npm run typecheck` (`tsc --noEmit`) exit 0.
- [x] Definition of Done complete (no TODO/FIXME, execution log appended, ticket status flipped).
- [x] Ticket frontmatter `status: in_review` in a separate commit.

## Findings

### High (blocking)
None.

### Medium
- **F-M1 (src/voice/transcriptionAdapter.ts:68,102,252,339 and log emission lines):** `providerAlias` is hardcoded to `"omniroute"` in every `TranscriptionResult` return value and every `buildRedactedEvent` call, even though ADR-003@0.1.0 explicitly allows a "runtime-level Fireworks fallback secret" when OmniRoute audio path is unavailable. `ProviderAlias` in `src/shared/types.ts:185` includes `"fireworks"` as a valid value. If the runtime config points to a direct Fireworks URL, downstream cost attribution and KPI metrics will falsely report OmniRoute, corrupting spend tracking. — *Responsible role:* Executor. *Suggested remediation:* add `providerAlias: ProviderAlias` to `TranscriptionConfig` and use `config.providerAlias` in results/logs instead of the literal string.
- **F-M2 (PR body):** The PR body omits a rollback command or procedure. CONTRIBUTING.md § Definition of Done and §B.8 require the PR to state how to revert the change in production. — *Responsible role:* Executor. *Suggested remediation:* append a single line to the PR body: "Rollback: revert PR #50 (`git revert f81966c`)."

### Low
- **F-L1 (src/observability/kpiEvents.ts:102-114):** `LOG_FORBIDDEN_FIELDS` forbids `raw_transcript` but not `transcriptText` (the camelCase key used in `TranscriptionResult`). The adapter currently never emits `transcriptText` in log `extra`, so AC#8 is satisfied. Defense-in-depth would be improved if the allowlist also blocked the field name used in the codebase to prevent future refactoring leaks. — *Responsible role:* Architect. *Suggested remediation:* patch-bump `LOG_FORBIDDEN_FIELDS` to include `"transcriptText"` in TKT-015@0.1.0 or a quick ADR-009@0.1.0 patch.
- **F-L2 (src/voice/types.ts:12):** `WHISPER_MODEL_ALIAS` is exported but never referenced inside the adapter or its tests; the adapter uses `config.modelAlias`. This is unused dead code. — *Responsible role:* Executor. *Suggested remediation:* remove the unused export, or wire it as the default value for `TranscriptionConfig.modelAlias`.

## Red-team probes (Reviewer must address each)
- **Error paths (Whisper API failure):** Covered — 500/429 trigger one retry within latency budget; 4xx is terminal; fetch AbortError is treated as timeout (retryable); deletion is called on terminal failure and on success; deletion failure emits `raw_media_delete_failed` at `critical` level.
- **Concurrency:** The adapter is stateless per-request. The `consecutiveFailures` counter lives in `VoiceFailureState` managed by the caller (C1/C4); atomicity of that counter across concurrent voice messages is the caller's concern, not C5's. Within the adapter, there is no shared mutable state.
- **Input validation (malformed voice):** Duration check is `> MAX_VOICE_DURATION_SECONDS` before any provider call or file read. Boundary test confirms `durationSeconds: 15` is accepted, `16` is rejected. File read errors bubble as `fetch_error` (retryable) if the file is missing, which is reasonable since the temp file is caller-managed.
- **Prompt injection:** The adapter returns `transcriptText` as a plain string to the caller; it never feeds the text into an LLM prompt. Prompt-injection mitigation is C6's responsibility per TKT-006@0.1.0.
- **Secrets:** `apiKey` comes from `config` parameter (runtime secret). No secrets are committed, logged, or hard-coded.
- **PII in logs:** Verified by test at `tests/voice/transcriptionAdapter.test.ts:291-312` — no logger call contains `raw_transcript`, `transcriptText`, or Cyrillic text. The adapter uses `buildRedactedEvent` with an allowlist of known-safe keys.

## AC verification detail
| AC | Proof | Verdict |
|---|---|---|
| AC#1 | `npm test -- tests/voice/...` 29/29 pass (19 adapter + 10 policy) | Pass |
| AC#2 | `npm run lint` (`tsc --noEmit`) exits 0 | Pass |
| AC#3 | `npm run typecheck` (`tsc --noEmit`) exits 0 | Pass |
| AC#4 | `tests/voice/transcriptionAdapter.test.ts:87` — `fetch` never called when `durationSeconds=16`; `outcome: "duration_exceeded"`. Boundary test `:98` confirms `15` is accepted. | Pass |
| AC#5 | Retry on 500 (`:135`), no retry beyond budget (`:152`), retry on 429 (`:262`), no retry on 401 (`:278`). AbortError handled as timeout (`:195`). | Pass |
| AC#6 | Deletion called on terminal failure (`:164`), on success (`:174`), and deletion failure logged at `critical` (`:184`). | Pass |
| AC#7 | `resolveFailureAction(1) === "text_fallback"` (`:13`), `resolveFailureAction(2) === "manual_entry"` (`:16`), `advanceFailureState` resets on success (`:41`). | Pass |
| AC#8 | `tests/voice/transcriptionAdapter.test.ts:291` — all logger calls inspected; no `raw_transcript`, `transcriptText`, or Cyrillic content in meta. Adapter never passes transcript text to `buildRedactedEvent`. | Pass |

## Hostile-reader pass
- **Malformed JSON from Whisper / unexpected schema:** `httpResponse.json()` is inside the `try` block of `attemptTranscription`. If JSON parsing throws, the `catch` block returns `provider_failure` with `retryable: true`. This is acceptable — a transient parse failure is treated as retryable. The code uses `json.text ?? ""` and `typeof json.confidence === "number" ? json.confidence : null`, which safely handles missing fields.
- **OmniRoute unavailable and fallback not enabled:** The adapter relies on the caller (C1/C4) to set `config.baseUrl` appropriately. If OmniRoute is down and no fallback is configured, the `fetch` will throw/reject and the adapter returns `provider_failure` with `retryable: true`. This is consistent with ADR-003@0.1.0.
- **Consecutive-failure counter atomicity:** As noted above, this is a caller concern. The adapter exposes pure functions (`resolveFailureAction`, `advanceFailureState`) that are deterministic and side-effect-free.
- **Exactly 15.0 seconds boundary:** Closed at 15 (`> 15` rejects, `<= 15` accepts). Tests confirm.
- **Race between deletion and re-read:** The adapter calls `deleteAudioFile` after transcription. A concurrent re-read attempt is the caller's responsibility; C4 should not re-read the temp file after handing it to C5.

## Follow-up / context notes for orchestrator
- **ADR-003@0.1.0 fallback providerAlias:** If the PO wants accurate provider attribution when direct Fireworks fallback is active, TKT-NEW may be needed to wire `providerAlias` through `TranscriptionConfig` (or the C1 caller can inspect `baseUrl`).
- **LOG_FORBIDDEN_FIELDS gap:** `transcriptText` is not in the allowlist. While the current adapter is safe, future refactors could leak it. A quick patch to `kpiEvents.ts` closes the gap.
