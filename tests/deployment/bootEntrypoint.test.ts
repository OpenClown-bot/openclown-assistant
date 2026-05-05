import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import { createServer, stopServer, BRIDGE_VERSION } from "../../src/main.js";
import type { C1Deps, TelegramHandlers, NormalizedTelegramUpdate } from "../../src/telegram/types.js";
import type { RussianReplyEnvelope } from "../../src/shared/types.js";
import type { BridgeRequest } from "../../src/sidecar/types.js";
import { routeBridgeRequest } from "../../src/sidecar/seam.js";

const PORT = 32102;

interface FetchResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

function fetch(opts: {
  path: string;
  method: string;
  body?: unknown;
}): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: opts.path,
        method: opts.method,
        headers: {
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: data ? (JSON.parse(data) as Record<string, unknown>) : {},
          });
        });
      }
    );
    req.on("error", reject);
    if (opts.body !== undefined) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

function makeStubHandler(): {
  handler: (update: NormalizedTelegramUpdate) => Promise<RussianReplyEnvelope>;
  calls: NormalizedTelegramUpdate[];
} {
  const calls: NormalizedTelegramUpdate[] = [];
  const handler = async (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope> => {
    calls.push(update);
    return {
      chatId: update.telegramChatId,
      text: "Тестовый ответ шва C1",
      typingRenewalRequired: false,
    };
  };
  return { handler, calls };
}

function makeStubHandlers(): {
  handlers: TelegramHandlers;
  textMealCalls: NormalizedTelegramUpdate[];
  summaryDeliveryCalls: NormalizedTelegramUpdate[];
  callbackCalls: NormalizedTelegramUpdate[];
} {
  const textMeal = makeStubHandler();
  const summaryDelivery = makeStubHandler();
  const callback = makeStubHandler();
  const nullHandler = makeStubHandler();

  return {
    handlers: {
      start: nullHandler.handler,
      forgetMe: nullHandler.handler,
      textMeal: textMeal.handler,
      voiceMeal: nullHandler.handler,
      photoMeal: nullHandler.handler,
      history: nullHandler.handler,
      callback: callback.handler,
      summaryDelivery: summaryDelivery.handler,
    },
    textMealCalls: textMeal.calls,
    summaryDeliveryCalls: summaryDelivery.calls,
    callbackCalls: callback.calls,
  };
}

function makeC1Deps(
  handlers: TelegramHandlers,
  pilotUserIds: string[] = ["111", "222"]
): C1Deps {
  return {
    handlers,
    sendMessage: vi.fn(),
    sendChatAction: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    },
    pilotUserIds,
    metricsRegistry: {
      increment: vi.fn(),
      set: vi.fn(),
      observe: vi.fn(),
      getSamples: vi.fn().mockReturnValue([]),
      render: vi.fn().mockReturnValue(""),
    },
  };
}

describe("bootEntrypoint", () => {
  let server: ReturnType<typeof createServer>;
  const stubH = makeStubHandlers();
  const deps = makeC1Deps(stubH.handlers);

  beforeAll(async () => {
    process.env.TELEGRAM_PILOT_USER_IDS = "111,222";
    server = createServer({ pilotUserIds: ["111", "222"], deps });
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it("GET /kbju/health returns 200 with X-Kbju-Bridge-Version: 1.0 header", async () => {
    const result = await fetch({ path: "/kbju/health", method: "GET" });
    expect(result.status).toBe(200);
    expect(result.headers["x-kbju-bridge-version"]).toBe(BRIDGE_VERSION);
    expect(result.body.status).toBe("ok");
    expect(typeof result.body.uptime_seconds).toBe("number");
  });

  it("POST /kbju/message with missing fields returns 400 and error: invalid_request", async () => {
    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { text: "hello" },
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("invalid_request");
  });

  it("POST /kbju/message for a blocked Telegram ID returns 403 and error: tenant_not_allowed", async () => {
    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { telegram_id: 999, chat_id: 999, text: "hello" },
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("tenant_not_allowed");
    expect(result.body.telegram_id).toBe(999);
  });

  it("valid POST /kbju/message reaches C1 sidecar seam exactly once and returns Russian reply", async () => {
    stubH.textMealCalls.length = 0;

    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: {
        telegram_id: 111,
        chat_id: 111,
        text: "hello",
        message_id: 1001,
        source: "text",
      },
    });

    expect(result.status).toBe(200);
    expect(typeof result.body.reply_text).toBe("string");
    expect((result.body.reply_text as string).length).toBeGreaterThan(0);

    expect(stubH.textMealCalls.length).toBe(1);
    const call = stubH.textMealCalls[0];
    expect(call.telegramUserId).toBe(111);
    expect(call.telegramChatId).toBe(111);
    expect(call.routeKind).toBe("text_meal");
    expect(call.text).toBe("hello");
  });

  it("POST /kbju/callback reaches the callback handler through seam", async () => {
    stubH.callbackCalls.length = 0;

    const result = await fetch({
      path: "/kbju/callback",
      method: "POST",
      body: {
        callback_data: "confirm_meal:draft123",
        telegram_id: 111,
        chat_id: 111,
        message_id: 1002,
      },
    });

    expect(result.status).toBe(200);
    expect(stubH.callbackCalls.length).toBe(1);
    const call = stubH.callbackCalls[0];
    expect(call.routeKind).toBe("callback");
    expect(call.callbackData).toBe("confirm_meal:draft123");
  });

  it("POST /kbju/callback with missing telegram_id returns 400 invalid_request", async () => {
    const result = await fetch({
      path: "/kbju/callback",
      method: "POST",
      body: { callback_data: "confirm_meal:draft123" },
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe("invalid_request");
  });

  it("POST /kbju/callback for blocked Telegram ID returns 403 and does not invoke handler", async () => {
    stubH.callbackCalls.length = 0;

    const result = await fetch({
      path: "/kbju/callback",
      method: "POST",
      body: {
        callback_data: "confirm_meal:draft123",
        telegram_id: 999,
        chat_id: 999,
      },
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toBe("tenant_not_allowed");
    expect(result.body.telegram_id).toBe(999);
    expect(stubH.callbackCalls.length).toBe(0);
  });

  it("valid callback still reaches callback handler exactly once", async () => {
    stubH.callbackCalls.length = 0;

    const result = await fetch({
      path: "/kbju/callback",
      method: "POST",
      body: {
        callback_data: "confirm_meal:draft456",
        telegram_id: 222,
        chat_id: 222,
        message_id: 1003,
      },
    });

    expect(result.status).toBe(200);
    expect(result.headers["x-kbju-bridge-version"]).toBe("1.0");
    expect(stubH.callbackCalls.length).toBe(1);
    const call = stubH.callbackCalls[0];
    expect(call.telegramUserId).toBe(222);
    expect(call.callbackData).toBe("confirm_meal:draft456");
  });

  it("oversized /kbju/message returns 413 payload_too_large and does not invoke handler", async () => {
    stubH.textMealCalls.length = 0;
    const bigText = "x".repeat(70 * 1024);

    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { telegram_id: 111, chat_id: 111, text: bigText },
    });

    expect(result.status).toBe(413);
    expect(result.body.error).toBe("payload_too_large");
    expect(stubH.textMealCalls.length).toBe(0);
  });

  it("oversized /kbju/callback returns 413 payload_too_large and does not invoke handler", async () => {
    stubH.callbackCalls.length = 0;
    const bigData = "x".repeat(70 * 1024);

    const result = await fetch({
      path: "/kbju/callback",
      method: "POST",
      body: { telegram_id: 111, chat_id: 111, callback_data: bigData },
    });

    expect(result.status).toBe(413);
    expect(result.body.error).toBe("payload_too_large");
    expect(stubH.callbackCalls.length).toBe(0);
  });

  it("oversized /kbju/cron returns 413 payload_too_large and does not invoke handler", async () => {
    stubH.summaryDeliveryCalls.length = 0;
    const bigData = "x".repeat(70 * 1024);

    const result = await fetch({
      path: "/kbju/cron",
      method: "POST",
      body: { big: bigData },
    });

    expect(result.status).toBe(413);
    expect(result.body.error).toBe("payload_too_large");
    expect(stubH.summaryDeliveryCalls.length).toBe(0);
  });

  it("413 payload_too_large responses include X-Kbju-Bridge-Version: 1.0", async () => {
    const bigText = "x".repeat(70 * 1024);

    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { telegram_id: 111, chat_id: 111, text: bigText },
    });

    expect(result.status).toBe(413);
    expect(result.headers["x-kbju-bridge-version"]).toBe("1.0");
  });

  it("POST /kbju/cron reaches the summaryDelivery handler through seam", async () => {
    stubH.summaryDeliveryCalls.length = 0;

    const result = await fetch({
      path: "/kbju/cron",
      method: "POST",
      body: { trigger_type: "daily_summary" },
    });

    expect(result.status).toBe(200);
    expect(stubH.summaryDeliveryCalls.length).toBe(1);
    const call = stubH.summaryDeliveryCalls[0];
    expect(call.routeKind).toBe("summary_delivery");
    expect(Array.isArray(result.body.summary_sent_to)).toBe(true);
    expect(result.body.skipped_count).toBe(0);
  });

  it("unknown route returns 404", async () => {
    const result = await fetch({ path: "/unknown", method: "GET" });
    expect(result.status).toBe(404);
    expect(result.body.error).toBe("not_found");
  });

  it("every sidecar response includes X-Kbju-Bridge-Version: 1.0", async () => {
    const result200 = await fetch({ path: "/kbju/health", method: "GET" });
    const result400 = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { text: "x" },
    });
    const result403 = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { telegram_id: 999, chat_id: 999 },
    });
    const result404 = await fetch({ path: "/unknown", method: "GET" });

    expect(result200.headers["x-kbju-bridge-version"]).toBe("1.0");
    expect(result400.headers["x-kbju-bridge-version"]).toBe("1.0");
    expect(result403.headers["x-kbju-bridge-version"]).toBe("1.0");
    expect(result404.headers["x-kbju-bridge-version"]).toBe("1.0");
  });
});

describe("C1 sidecar seam unit", () => {
  it("routeBridgeRequest calls textMeal handler for text source", async () => {
    const stubH = makeStubHandlers();
    const deps = makeC1Deps(stubH.handlers);

    const request: BridgeRequest = {
      telegram_id: 111,
      chat_id: 111,
      source: "text",
      text: "test message",
    };

    const reply = await routeBridgeRequest(deps, request);

    expect(reply).not.toBeNull();
    expect(reply!.text).toBe("Тестовый ответ шва C1");
    expect(stubH.textMealCalls.length).toBe(1);
    expect(stubH.textMealCalls[0].routeKind).toBe("text_meal");
    expect(stubH.textMealCalls[0].sourceLabel).toBe("bridge:text");
  });

  it("routeBridgeRequest calls summaryDelivery handler for cron source", async () => {
    const stubH = makeStubHandlers();
    const deps = makeC1Deps(stubH.handlers);

    const request: BridgeRequest = {
      telegram_id: 0,
      chat_id: 0,
      source: "cron",
      trigger_type: "daily_summary",
    };

    const reply = await routeBridgeRequest(deps, request);

    expect(reply).not.toBeNull();
    expect(stubH.summaryDeliveryCalls.length).toBe(1);
    expect(stubH.summaryDeliveryCalls[0].routeKind).toBe("summary_delivery");
    expect(stubH.summaryDeliveryCalls[0].sourceLabel).toBe("bridge:cron");
  });

  it("routeBridgeRequest returns null for unsupported source", async () => {
    const stubH = makeStubHandlers();
    const deps = makeC1Deps(stubH.handlers);

    const request: BridgeRequest = {
      telegram_id: 111,
      chat_id: 111,
      source: "text",
      text: "",
    } as BridgeRequest;

    const typedRequest = { ...request, source: "unknown" } as unknown as BridgeRequest;
    // bridgeToRouteKind will return "unsupported" for unknown
    const reply = await routeBridgeRequest(deps, typedRequest);

    expect(reply).toBeNull();
  });
});