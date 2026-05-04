---
id: RV-SPEC-010
type: spec_review
target_ref: ARCH-001@0.5.0
status: in_review
reviewer_model: "kimi-k2.6"
related: ["RV-SPEC-001", "RV-SPEC-002", "RV-SPEC-003", "RV-SPEC-004", "RV-SPEC-005", "RV-SPEC-006", "RV-SPEC-007", "RV-SPEC-008", "RV-SPEC-009"]
created: 2026-05-04
---

# Spec Review — ARCH-001@0.5.0 (PR-D #110)

## Summary

One **BLOCKER**, two **MAJOR**, one **MINOR**, one **NIT**. All other review questions (12 total) **PASS**.

The PR-D #110 synthesis correctly preserves OpenClaw load-bearing surfaces, splices PRD-002@0.2.1 C12-C15, maintains machine-checkable acceptance criteria, version-pins upstream PRDs, traces all PRD goals, mandates boot-smoke tests, and stays within write-zone boundaries. However, it **fails to incorporate the single most important finding from SPIKE-001@0.1.0**: the bridge MUST be an OpenClaw plugin using the `inbound_claim` hook + registered tools (`kbju_cron`, `kbju_callback`, `kbju_message`). ADR-011@0.1.0 and ARCH-001@0.5.0 instead describe a generic HTTP sidecar with no OpenClaw plugin contract, leaving the bridge unbuildable. Additionally, deterministic execution mode for cron-triggered runs (SPIKE-001@0.1.0 Q2) is missing.

---

## Findings Table

| # | Severity | Question / Finding | Location | Status |
|---|----------|-------------------|----------|--------|
| 1 | **PASS** | OpenClaw load-bearing preservation | ARCH-001@0.5.0 §1.1, §2, §6.1 | OpenClaw retains Telegram channel, agent orchestration, cron triggers, voice-call, phone-control. |
| 2 | **PASS** | Synthesis splicing PRD-002@0.2.1 C12-C15 | ARCH-001@0.5.0 §6.1-6.5 | Correctly spliced into Goal A-E. |
| 3 | **BLOCKER** | SPIKE-001@0.1.0 `inbound_claim` + registered tools missing | ADR-011@0.1.0 §1; ARCH-001@0.5.0 §6.1 | Bridge contract underspecified; zero `inbound_claim` matches in PR docs. |
| 4 | **PASS** | TKT-016@0.1.0 machine-checkable path | TKT-016@0.1.0 §4 AC1-AC6 | All acceptance criteria are machine-checkable (file existence, import resolution, port, HTTP 200, body, Docker health). |
| 5 | **PASS** | Callback fallback acceptability | ARCH-001@0.5.0 §6.2 | Matched callbacks are pure state updates (no LLM); unmatched callbacks route to `/kbju/message` as a new command (single LLM hop, no agent hop). |
| 6 | **PASS** | SPIKE-002@0.1.0 community audit safety | SPIKE-002@0.1.0 §8.1-8.3 | Safe: community plugins are **recommendations** (§8.2), not vendored dependencies (§8.1). |
| 7 | **PASS** | SecureClaw / Riphook / Calorie Visualizer safety | SPIKE-002@0.1.0 §4.1-4.3, §6.1 | Licenses correct (AGPL-3.0 SecureClaw, MIT Riphook & Calorie Visualizer). Calorie Visualizer is data-pattern reference only. |
| 8 | **PASS** | AC machine-checkability | TKT-016@0.1.0..TKT-020@0.1.0 | Every ticket AC includes a concrete, verifiable command or assertion. |
| 9 | **PASS** | Version pins | ARCH-001@0.5.0 frontmatter; ADR-011@0.1.0, ADR-012@0.1.0, ADR-013@0.1.0 frontmatter | All `prd_ref` and `arch_ref` point to upstream approved versions (PRD-001@0.2.0, PRD-002@0.2.1). |
| 10 | **PASS** | PRD goal traceability | ARCH-001@0.5.0 §6.1-6.5 | Goals A-E cover PRD-001@0.2.0 G1-G4 and PRD-002@0.2.1 C12-C15 completely. |
| 11 | **PASS** | Boot-smoke non-negotiability | ARCH-001@0.5.0 §11.1; TKT-016@0.1.0 §4 | `tests/deployment/bootEntrypoint.test.ts` or equivalent is explicitly mandated, satisfying BACKLOG-011@0.1.0 process-retro. |
| 12 | **PASS** | Write-zone compliance | PR diff (`git diff --name-only`) | Only `docs/architecture/`, `docs/architecture/adr/`, `docs/tickets/`, `docs/knowledge/` modified. No `src/` or `config/` changes. |

---

## Detailed Findings

### F-B1 — BLOCKER: SPIKE-001@0.1.0 `inbound_claim` + registered tools bridge pattern completely absent from synthesis

**Evidence:**
- SPIKE-001@0.1.0 (branch `arch/SPIKE-001-openclaw-bridge-feasibility`) §3.1 concludes the bridge **MUST** be an OpenClaw plugin using `api.on("inbound_claim", ...)` plus registered tools (`kbju_cron`, `kbju_callback`, `kbju_message`) to receive Gateway events. It explicitly rules out skill `handle(input, ctx)` and generic HTTP outbound webhooks from the Gateway itself ("NO — OpenClaw Gateway does not have a generic HTTP outbound webhook mechanism").
- ADR-011@0.1.0 §1 (`Runtime topology`) states: "OpenClaw Gateway retains Telegram channel + agent orchestration + cron triggers + voice-call + phone-control surfaces. KBJU business logic runs as a separate sidecar Node 24 process bridged via HTTP." It does **not** specify that the bridge itself must be an OpenClaw plugin, nor does it mention `inbound_claim`, registered tools, `openclaw.plugin.json`, or plugin registration code.
- ARCH-001@0.5.0 §6.1 describes `POST /kbju/message`, `/kbju/callback`, `/kbju/cron`, `GET /kbju/health` as sidecar HTTP contracts, but never specifies the **OpenClaw-side** mechanism that invokes these endpoints.
- Shell command `grep -rn "inbound_claim\|registered tool\|kbju_cron\|kbju_callback\|kbju_message"` against the main ArchSpec and the runtime ADR returns **zero matches** on the PR branch.

**Impact:**
The Executor will not know how to wire the OpenClaw Gateway to the sidecar. Without `inbound_claim`, the Gateway cannot feed Telegram messages, callbacks, or cron events into the bridge. The bridge contract is therefore **unbuildable** as written. This directly violates the "keep OpenClaw load-bearing" principle (Question #1) because the only viable load-bearing path (`inbound_claim`) is omitted.

**Fix:**
Add a subsection to ADR-011@0.1.0 §1 (or ARCH-001@0.5.0 §6.1) explicitly defining the bridge as an **OpenClaw plugin** with:
1. `openclaw.plugin.json` manifest declaring `register` entry point.
2. `register(api: PluginApi)` implementation that calls `api.on("inbound_claim", handler)` to receive bound-conversation events and `api.registerCommand("kbju_cron", ...)` / `api.registerCommand("kbju_callback", ...)` for registered tool routing.
3. Internal proxy logic that forwards decoded events to the sidecar HTTP endpoints (`POST /kbju/message`, etc.).
Reference SPIKE-001@0.1.0 §3.1 and SPIKE-002@0.1.0 §3.3 (openclown dual-hook pattern) as synthesis sources.

---

### F-M1 — MAJOR: Deterministic execution mode for cron-triggered runs missing

**Evidence:**
- SPIKE-001@0.1.0 Q2 mandates a **deterministic execution mode** (`DELEGATE_BLOCKED_TOOLS` or no-tool agent) for cron-registered tools. Without it, the agent may hallucinate extra tool calls during recurring runs, causing cost overruns and safety violations.
- ARCH-001@0.5.0 §6.4 (Goal D — Voice + cron / timer reminders) describes the cron flow as: "OpenClaw Gateway's built-in `cron_tools` fires a `cron_changed` event → bridge intercepts → POST `/kbju/cron`". It does **not** constrain the agent/tool context to deterministic mode.
- ADR-011@0.1.0 does not mention deterministic mode for any trigger type.

**Impact:**
Recurring cron jobs (e.g., daily 09:00 reminders) could invoke unexpected tools (file reads, shell commands, external APIs) if the LLM context drifts or is poisoned. This undermines TKT-019@0.1.0 G3 (prompt injection filter) and TKT-020@0.1.0 G5 (cron abuse / cost control).

**Fix:**
Add a requirement in ARCH-001@0.5.0 §6.4 and ADR-011@0.1.0 §1 stating: "Cron-triggered bridge calls MUST execute with `DELEGATE_BLOCKED_TOOLS` or an equivalent no-tool agent configuration, preventing tool hallucination during automated recurring runs." Cite SPIKE-001@0.1.0 Q2.

---

### F-M2 — MAJOR: OpenClaw plugin manifest / registration code absent

**Evidence:**
- SPIKE-001@0.1.0 §3.1 provided a concrete plugin registration sketch (`register(api: PluginApi)`, `api.on("inbound_claim", handler)`, `api.registerCommand("kbju_cron", ...)`).
- ADR-011@0.1.0 §1 treats the bridge as a black-box HTTP contract: "KBJU business logic runs as a separate sidecar Node 24 process bridged via HTTP." It does not say **who** implements the bridge (skill vs plugin vs standalone server) or how it is wired into the Gateway process.
- ARCH-001@0.5.0 §6.1 describes the HTTP request/response envelope but omits the OpenClaw plugin side entirely.

**Impact:**
The Executor lacks the architectural boundary needed to decide whether to write a skill JSON, a TypeScript plugin, or a raw Express server. This ambiguity will produce a non-functional integration even if F-B1 is partially addressed.

**Fix:**
Add a declarative code sketch or contract paragraph in ARCH-001@0.5.0 §6.1 (or a new ADR-011@0.1.0 §1.x) showing:
```
// OpenClaw bridge plugin (runs inside Gateway process)
register(api: PluginApi) {
  api.on("inbound_claim", (event) => {
    // decode event → HTTP POST to sidecar
  });
  api.registerCommand("kbju_cron", (ctx) => { ... });
  api.registerCommand("kbju_callback", (ctx) => { ... });
}
```
This is non-runnable documentation-only code, consistent with the ArchSpec declarative style.

---

### F-m1 — MINOR: SPIKE-002@0.1.0 SecureClaw cost-monitor recommendation for cron not propagated

**Evidence:**
- SPIKE-002@0.1.0 §3.4 recommends using SecureClaw cost-monitor (via `openclaw plugins install @adversa/secureclaw`) to prevent cron cost overruns, with circuit breaker at monthly limit.
- ARCH-001@0.5.0 §6.4 (cron) and §11 G5 (cron abuse) do not mention SecureClaw cost-monitor as a deployment hardening step.

**Impact:**
v0.1 deployment may miss a low-effort operational safety net that is already proven in the community (SPIKE-002@0.1.0 §4.2).

**Fix:**
Add a deployment note in ARCH-001@0.5.0 §10 (Operational Procedures) or §11 G5 referencing SecureClaw cost-monitor as a recommended v0.1 hardening step, with the exact CLI commands from SPIKE-002@0.1.0 §8.2.

---

### F-n1 — NIT: `agent-runtime-comparison.md` lacks backlink to ADR-011@0.1.0 runtime synthesis

**Evidence:**
- `docs/knowledge/agent-runtime-comparison.md` is included in PR scope (PO authorization) and is referenced by ADR-012@0.1.0 §1 (`hermes-agent comparison source`).
- ARCH-001@0.5.0 §7 (`Tech Stack Decisions`) and ADR-011@0.1.0 §1 do not reference it, even though the document directly compares runtimes (nanobot vs OpenClaw) that influenced ADR-011@0.1.0's HYBRID choice.

**Impact:**
None functional; knowledge file is reachable via ADR-012@0.1.0.

**Fix:**
Optional cross-reference in ARCH-001@0.5.0 §7 or ADR-011@0.1.0 §1 citing `agent-runtime-comparison.md` as a Phase 0 recon input.

---

## Scope Note

The notional `ADR-005@X.Y.Z-telegram-channel-multimodality-v0-2-0.md` file was listed in the review scope prompt but does not exist on the PR branch or `main`. The existing `docs/architecture/adr/ADR-005@2.2.0-hybrid-kbju-estimation.md` (accepted per RV-SPEC-004) is correctly version-pinned and referenced throughout ARCH-001@0.5.0 (e.g., §6.2 line 488, §7 line 956). No defect.

---

## Next Steps

1. **Architect-4** must patch ADR-011@0.1.0 §1 and ARCH-001@0.5.0 §6.1 to incorporate:
   - The OpenClaw plugin bridge contract (`inbound_claim` hook + registered tools).
   - The deterministic execution mode requirement for cron (`DELEGATE_BLOCKED_TOOLS`).
2. Re-run `python3 scripts/validate_docs.py` to ensure frontmatter compliance.
3. Re-request review via PR-D #110 update; do **not** close PR-A/B/C or modify PRD/ARCH-001@0.5.0 source code.

---

## Methodology

- Fetched SPIKE-001@0.1.0 from branch `arch/SPIKE-001-openclaw-bridge-feasibility` (340 lines, 6 section headers).
- Fetched SPIKE-002@0.1.0 from branch `arch/SPIKE-002-openclaw-community-ecosystem-audit` (519 lines).
- Read ARCH-001@0.5.0 (1322 lines), ADR-011@0.1.0, ADR-012@0.1.0, ADR-013@0.1.0, TKT-016@0.1.0..TKT-020@0.1.0 on PR branch.
- Verified zero `inbound_claim` / `registered tool` matches across PR `docs/` via `grep`.
- Cross-referenced all `prd_ref` and `arch_ref` version pins against upstream approved commits.
- Checked `git diff --name-only` for write-zone compliance.
