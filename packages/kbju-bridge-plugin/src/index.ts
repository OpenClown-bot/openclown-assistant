import type {
  PluginApi,
  InboundClaimEvent,
  InboundClaimResult,
  KbjuMessageToolArgs,
  KbjuCronToolArgs,
  KbjuCallbackToolArgs,
} from "./types.js";

const SIDECAR_BASE_URL = process.env.KBJU_SIDECAR_URL ?? "http://localhost:3000";
const BRIDGE_VERSION = "1.0";

interface SidecarMessageResponse {
  reply_text: string;
  needs_confirmation?: boolean;
  reply_to_message_id?: number;
}

async function postToSidecar(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${SIDECAR_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Kbju-Bridge-Version": BRIDGE_VERSION,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((data.error as string) ?? "bridge_request_failed");
  }
  return data;
}

async function inboundClaimHandler(event: InboundClaimEvent): Promise<InboundClaimResult> {
  let source: string;
  if (event.voice) {
    source = "voice";
  } else if (event.photo) {
    source = "photo";
  } else {
    source = "text";
  }

  try {
    const data = (await postToSidecar("/kbju/message", {
      telegram_id: event.telegramUserId,
      text: event.text,
      source,
      message_id: event.messageId,
      chat_id: event.chatId,
    })) as unknown as SidecarMessageResponse;

    return {
      handled: true,
      reply: { text: data.reply_text },
    };
  } catch {
    return {
      handled: true,
      reply: { text: "Извините, произошла ошибка. Попробуйте позже." },
    };
  }
}

async function kbjuMessageTool(args: KbjuMessageToolArgs): Promise<Record<string, unknown>> {
  return postToSidecar("/kbju/message", args);
}

async function kbjuCronTool(args: KbjuCronToolArgs): Promise<Record<string, unknown>> {
  return postToSidecar("/kbju/cron", args);
}

async function kbjuCallbackTool(args: KbjuCallbackToolArgs): Promise<Record<string, unknown>> {
  return postToSidecar("/kbju/callback", args);
}

export function register(api: PluginApi): void {
  api.on("inbound_claim", inboundClaimHandler as (...args: unknown[]) => unknown);
  api.registerCommand("kbju_message", kbjuMessageTool as (...args: unknown[]) => unknown);
  api.registerCommand("kbju_cron", kbjuCronTool as (...args: unknown[]) => unknown);
  api.registerCommand("kbju_callback", kbjuCallbackTool as (...args: unknown[]) => unknown);
}