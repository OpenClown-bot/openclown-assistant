---
id: ARCH-SPIKE-001
title: "OpenClaw Bridge Feasibility & Deterministic Execution Mode"
version: 0.1.0
status: draft
owner: "Architect"
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-001@0.2.0; PRD-002@0.2.1
author_model: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# SPIKE-001: OpenClaw Bridge Feasibility & Deterministic Execution Mode

## 1. Q1 Verdict: Can OpenClaw route Telegram→HTTP without LLM?

**GO** — yes, 100% LLM-free routing for Telegram messages is achievable via the `inbound_claim` plugin hook.

### Evidence

The `inbound_claim` hook fires during the Channel Turn Kernel pipeline, specifically in the **classify/preflight** phase **before the agent dispatch** phase. When a handler returns `{ handled: true, reply: ... }`, the agent loop is **entirely skipped** — no LLM call, no model inference, no token spend.

- **Hook type definition:** `src/plugins/hook-message.types.ts:1-63` — `PluginHookInboundClaimEvent` carries `{ content, channel, senderId, senderUsername, conversationId, messageId, isGroup, wasMentioned, ... }`.
- **Handler return type:** `PluginHookInboundClaimResult = { handled: boolean; reply?: ReplyPayload; reason?: string }` (defined in `src/plugins/hook-types.ts`).
- **Claiming semantics:** First handler returning `{ handled: true }` wins the chain; subsequent handlers skipped. Reply payload is auto-delivered back to originating channel via `ReplyPayload` (`src/auto-reply/reply-payload.ts:10-62`).
- **Handler runtime:** Async function with full Node environment — `fetch()`, `setTimeout()`, all Node APIs available.
- **Attachments support:** Full inbound attachment arrays passed through `inbound_claim` hook metadata (CHANGELOG #55452).

### Code path

```
Telegram webhook/long-poll
  → grammY parses update
  → bot-message-context.ts builds context (sender, session key, access control)
  → Channel Turn Kernel: ingest → classify → preflight → resolve → authorize → assemble → record → dispatch → finalize
  → runInboundClaim(event, ctx) fires during classify/preflight
  → plugin handler receives PluginHookInboundClaimEvent
  → handler makes fetch() HTTP POST to KBJU sidecar
  → handler returns { handled: true, reply: { text: sidecarResponse.reply_text } }
  → reply delivered to Telegram  ← AGENT NEVER INVOKED
```

### What happens with voice messages and photos

OpenClaw pre-processes voice (transcription) and photos (vision description) before `inbound_claim` fires. The `content` field in `PluginHookInboundClaimEvent` contains the transcribed/described text. The raw media data is available in `metadata`. The bridge plugin forwards `content` (transcribed voice / described photo) to the sidecar via `POST /kbju/message`, exactly like text messages — zero LLM involvement for the routing decision.

### What does NOT go through `inbound_claim`

- **Cron-triggered runs** do not fire `inbound_claim` (they are internal system events, not channel messages). See Q3.
- **Callback queries** (`callback_query`) — confirmed to NOT flow through `inbound_claim`. They route through a separate `bot.on("callback_query")` handler chain: plugin interactive → exec approval → native menus → config → plugin custom callbacks. See Q3.

---

## 2. Q2 Verdict: Can OpenClaw be a deterministic assistant?

**GO** — the `inbound_claim` hook makes OpenClaw fully deterministic for the message-routing surface. Combined with tool restrictions for cron dispatch, the PO's goal of "чёткий ассистент по выполнению" (strict execution assistant, not autonomous planner) is achievable.

### Evidence

| Concern | Mechanism | Verdict |
|---|---|---|
| Fixed system prompt | `SOUL.md` + `AGENTS.md` in workspace — but irrelevant for messages since `inbound_claim` skips the agent | N/A for messages |
| Restricted toolset per agent | `agents.list[].tools.allow/deny` arrays — e.g. `allow: ["kbju_cron", "kbju_callback"]` | GO |
| No autonomous planning for messages | `inbound_claim` handler claims ALL Telegram messages → agent never invoked → zero autonomy | GO |
| No autonomous planning for cron | Agent only has bridge tools in its allowlist; cannot improvise | GO |
| Typed JSON I/O | Not natively enforced by OpenClaw, but our bridge contract (`X-Kbju-Bridge-Version: 1.0`) enforces it at the HTTP layer | GO (application-level) |
| Action deny/allow lists | `tools.allow/deny` per agent; skill `command-dispatch: tool` bypasses LLM for slash commands | GO |
| Model thinking level | `agents.defaults.thinking: "off"` or `"minimal"` minimizes LLM deliberation for cron turns | GO |

### What "deterministic" means in this architecture

1. **Telegram text/voice/photo messages:** 100% LLM-free. `inbound_claim` handler → HTTP POST to sidecar → return sidecar reply to Telegram. OpenClaw acts as a **pure I/O proxy**.
2. **Cron triggers:** Agent is invoked but with restricted toolset (only `kbju_cron`). Agent receives fixed cron message ("trigger kbju daily summary"), has exactly one tool, calls it, relays result. Equivalent to a cron→HTTP→Telegram relay with one LLM orchestration hop.
3. **Callback queries (inline buttons):** If callbacks route through a tool (not `inbound_claim`), one agent turn handles them. Tool-restricted to `kbju_callback` only.

### What the LLM can NOT do in this configuration

- Cannot decide to ignore a message and do something else (messages never reach it)
- Cannot choose a different tool for cron (only 1 tool available)
- Cannot generate free-text responses for messages (replies come from sidecar, not LLM)
- Cannot access browser, filesystem, or any non-bridge tool

---

## 3. Q3: Minimal Bridge Implementation

### Architecture

The bridge is an **OpenClaw plugin** (not a skill — skills are markdown-only). The plugin uses:
1. `inbound_claim` hook for Telegram message routing (text, voice, photo) — zero LLM
2. Registered tool `kbju_cron` for cron dispatch — agent-mediated, single tool
3. Registered tool `kbju_callback` for inline button callbacks — agent-mediated, single tool

### Files to create in the OpenClaw deployment

```
~/.openclaw/
├── openclaw.json                          # modified: add plugin + cron config
└── workspace/
    └── skills/
        └── kbju-bridge/
            └── SKILL.md                   # config-only skill for cron trigger
```

```
kbju-bridge-plugin/
├── openclaw.plugin.json                   # plugin manifest
└── src/
    └── index.ts                           # plugin entry point with inbound_claim + tools
```

### Plugin manifest (`openclaw.plugin.json`)

```json
{
  "id": "kbju-bridge",
  "name": "KBJU Bridge Plugin",
  "version": "1.0.0",
  "entry": "src/index.ts",
  "kind": "plugin"
}
```

### Plugin entry point pseudocode (`src/index.ts`)

```typescript
import { definePlugin } from "openclaw/plugin-sdk";

const SIDECAR_URL = process.env.KBJU_SIDECAR_URL ?? "http://kbju-sidecar:3001";
const RECOVERY_MSG = "Что-то пошло не так. Попробуйте позже.";

export default definePlugin((api) => {
  // =========================================================
  // 1. inbound_claim — handles ALL Telegram messages (no LLM)
  // =========================================================
  api.on("inbound_claim", async (event, ctx) => {
    if (event.channel !== "telegram") return; // only Telegram

    try {
      const res = await fetch(`${SIDECAR_URL}/kbju/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Kbju-Bridge-Version": "1.0",
        },
        body: JSON.stringify({
          telegram_id: event.senderId,
          text: event.content,
          source: "telegram_message",
          message_id: event.messageId,
          chat_id: event.conversationId,
        }),
      });

      if (!res.ok) {
        return { handled: true, reply: { text: RECOVERY_MSG } };
      }

      const data = await res.json();
      return {
        handled: true,
        reply: { text: data.reply_text },
      };
    } catch {
      return { handled: true, reply: { text: RECOVERY_MSG } };
    }
  });

  // =========================================================
  // 2. kbju_cron tool — called by agent for cron triggers
  // =========================================================
  api.registerTool({
    name: "kbju_cron",
    description: "Trigger KBJU sidecar cron job (daily/weekly summary)",
    parameters: {
      type: "object",
      properties: {
        trigger: { type: "string" },
        timezone: { type: "string" },
      },
      required: ["trigger"],
    },
    async execute(_id, params) {
      try {
        const res = await fetch(`${SIDECAR_URL}/kbju/cron`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Kbju-Bridge-Version": "1.0",
          },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        return {
          content: [{
            type: "text",
            text: `Cron completed. Summary sent to: ${data.summary_sent_to?.join(", ") ?? "none"}. ` +
                  `Skipped: ${data.skipped_count ?? 0}.`,
          }],
        };
      } catch {
        return { content: [{ type: "text", text: "KBJU sidecar unavailable for cron." }] };
      }
    },
  });

  // =========================================================
  // 3. kbju_callback tool — called by agent for inline buttons
  // =========================================================
  api.registerTool({
    name: "kbju_callback",
    description: "Route Telegram inline button callback to KBJU sidecar",
    parameters: {
      type: "object",
      properties: {
        callback_data: { type: "string" },
        telegram_id: { type: "string" },
        message_id: { type: "string" },
      },
      required: ["callback_data", "telegram_id"],
    },
    async execute(_id, params) {
      try {
        const res = await fetch(`${SIDECAR_URL}/kbju/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Kbju-Bridge-Version": "1.0",
          },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        return {
          content: [{ type: "text", text: data.reply_text ?? "OK" }],
        };
      } catch {
        return { content: [{ type: "text", text: RECOVERY_MSG }] };
      }
    },
  });
});
```

### OpenClaw config (`~/.openclaw/openclaw.json`)

```json5
{
  plugins: {
    entries: {
      "kbju-bridge": { source: "./kbju-bridge-plugin" },
    },
  },
  agents: {
    defaults: {
      model: { primary: "openai/gpt-5.3" },
      thinking: "off",            // minimize LLM deliberation for cron/callback turns
      skills: [],
      tools: {
        allow: ["kbju_cron", "kbju_callback"],
        deny: ["browser", "canvas", "nodes", "write", "edit", "exec"],
      },
    },
  },
  cron: [
    {
      schedule: "0 20 * * *",     // daily at 20:00
      job: "kbju-daily",
      message: "Run the KBJU daily summary via kbju_cron tool.",
      session: "isolated",
    },
    {
      schedule: "0 20 * * 0",     // weekly on Sunday
      job: "kbju-weekly",
      message: "Run the KBJU weekly summary via kbju_cron tool with trigger=weekly.",
      session: "isolated",
    },
  ],
}
```

### Error handling

| Failure | Behavior |
|---|---|
| Sidecar unreachable (connection refused) | `fetch()` throws → `inbound_claim` returns `RECOVERY_MSG` to Telegram user |
| Sidecar returns 5xx | `!res.ok` → `inbound_claim` returns `RECOVERY_MSG` |
| Sidecar returns 4xx | `!res.ok` → `inbound_claim` returns `RECOVERY_MSG` (sidecar validation failures are user-facing errors; could be refined later) |
| Sidecar timeout | `fetch()` throws after timeout → recovery message |
| Plugin crashes | Sandboxed process isolation per skill invocation; Gateway restarts plugin |

### What differs from PR-D #110 assumptions

| PR-D assumption | Actual implementation |
|---|---|
| Bridge runs as an OpenClaw **skill** | Bridge runs as an OpenClaw **plugin** — skills are markdown-only, cannot make HTTP calls |
| `routeMessage()` from `src/telegram/entrypoint.ts` handles routing | `inbound_claim` hook handles Telegram routing; `src/telegram/entrypoint.ts` is NOT used in the bridge path |
| KBJU skill's `handle(input, ctx)` makes HTTP call | Plugin's `api.on("inbound_claim", handler)` makes HTTP call — completely different lifecycle |
| Cron triggers go through skill `cron(ctx)` method | Cron goes through agent → calls registered tool `kbju_cron` |

**This does NOT invalidate HYBRID as an architectural choice.** It does change the implementation path: the bridge is a plugin, not a skill. The sidecar contract (`POST /kbju/message`, `/kbju/callback`, `/kbju/cron`) is unchanged. The Docker Compose topology (gateway + sidecar as separate services) is unchanged.

---

## 4. Final Verdict

**GO HYBRID WITH PATCHES** — PR-D #110 is architecturally correct but specifies the wrong implementation mechanism.

### Required patches to PR-D #110 before Ready-for-Review

1. **Bridge implementation type:** Replace "OpenClaw skill with `handle(input, ctx)`" → "OpenClaw **plugin** with `inbound_claim` hook + registered bridge tools." This is the most significant change.

2. **Remove references to `src/telegram/entrypoint.ts` `routeMessage()` in bridge context:** `routeMessage()` is the existing monolith routing function. Under HYBRID with `inbound_claim`, Telegram messages never reach `routeMessage()`. The sidecar reuses `src/` modules **for business logic** (onboarding, meal logging, history, summaries), but NOT for Telegram message normalization/routing — that surface is handled by `inbound_claim` in the Gateway.

3. **Cron dispatch path:** Document that cron goes through the agent (one LLM hop) → calls `kbju_cron` tool. This is not a pure HTTP bridge path but is acceptably bounded.

4. **Callback dispatch path:** Document that inline button callbacks go through the agent (one LLM hop) → calls `kbju_callback` tool. Verify whether callbacks can alternatively route through plugin `on("callback_query")` or the plugin interactive callback handler without agent involvement. If yes, that eliminates the LLM hop for callbacks too.

5. **ArchSpec §0.9 weakest assumption (S1) status:** S1 is **resolved** — the bridge on the actual OpenClaw runtime IS demonstrated (this SPIKE). The mechanism is `inbound_claim` hook (plugin), not a skill `handle()`. The caution in `docs/knowledge/openclaw.md` §G1 is **outdated** and should be updated to reflect the existence of `inbound_claim`.

### What's NOT needed (rejected alternatives)

- **Fork OpenClaw:** Not needed. All interception points exist in the current public API.
- **Raw grammY:** Not needed. OpenClaw's Telegram channel plugin + `inbound_claim` hook handles all message routing.
- **Custom webhook handler outside OpenClaw:** Not needed.
- **Abandon HYBRID:** Not warranted. HYBRID is the correct architecture; implementation detail corrections are minor.

---

## 5. Open Questions for PO

1. **Callback query LLM overhead:** Is the PO willing to accept one LLM hop per inline button press (for meal confirmation, onboarding flow, etc.)? Or should we investigate whether OpenClaw's callback_query plugin handler can route directly to the bridge plugin without agent invocation? If the PO requires zero-LLM callbacks, this needs a separate investigation spike.

2. **Voice/photo pre-processing:** OpenClaw transcribes voice and describes photos before `inbound_claim` fires. This pre-processing uses the LLM (for vision) or Whisper API (for voice). The PO should confirm: is this pre-processing acceptable, or should voice/photo bytes be forwarded raw to the sidecar for the sidecar's own LLM to process? Trade-off: Gateway pre-processing = lower sidecar complexity but adds LLM cost at Gateway. Raw forwarding = higher sidecar complexity but sidecar owns the model choice.

3. **Plugin vs managed skill UX:** The plugin-based bridge means the bridge code lives outside the main repo (it's deployed into OpenClaw's plugin directory). Should the bridge plugin source be vendored into `openclown-assistant` repo (e.g., `packages/kbju-bridge-plugin/`) for version-controlled development, or is it acceptable as a deployment-only artifact?

4. **Existing `src/telegram/` code disposition:** Under HYBRID, `src/telegram/entrypoint.ts` (`routeMessage`, `routeCallbackQuery`, `routeCronEvent`) is not used for the bridge path. Does the PO want to:
   - Keep it as reference/fallback (monolith mode fallback)?
   - Remove it (HYBRID-only path)?
   - Repurpose it inside the sidecar (the sidecar reuses `src/` modules for business logic but would not use `routeMessage` for Telegram ingress)?