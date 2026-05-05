import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginApi, InboundClaimEvent } from "../../packages/kbju-bridge-plugin/src/types.js";
import {
  isCronAllowed,
  assertCronAllowed,
  createCronFilter,
  CRON_RESTRICTED_TOOLS,
} from "../../packages/kbju-bridge-plugin/src/cronPolicy.js";

function makePluginApi(): PluginApi {
  return {
    on: vi.fn(),
    registerCommand: vi.fn(),
  };
}

function makeTextEvent(overrides?: Partial<InboundClaimEvent>): InboundClaimEvent {
  return {
    telegramUserId: 111,
    chatId: 111,
    messageId: 1001,
    text: "я съел курицу и рис",
    ...overrides,
  };
}

describe("kbju-bridge plugin register", () => {
  let api: PluginApi;

  beforeEach(() => {
    api = makePluginApi();
    vi.resetModules();
  });

  it("register(api: PluginApi) installs inbound_claim, kbju_message, kbju_cron, and kbju_callback", async () => {
    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    register(api);

    expect(api.on).toHaveBeenCalledWith("inbound_claim", expect.any(Function));
    expect(api.registerCommand).toHaveBeenCalledWith(
      "kbju_message",
      expect.any(Function)
    );
    expect(api.registerCommand).toHaveBeenCalledWith(
      "kbju_cron",
      expect.any(Function)
    );
    expect(api.registerCommand).toHaveBeenCalledWith(
      "kbju_callback",
      expect.any(Function)
    );
  });
});

describe("kbju-bridge plugin inbound_claim handler", () => {
  it("inbound_claim handler returns handled: true with a reply text for a text event", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          reply_text: "Приблизительно: 450 ккал",
          needs_confirmation: true,
        }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const handler = (api.on as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      event: InboundClaimEvent
    ) => Promise<{ handled: boolean; reply?: { text: string } }>;

    const result = await handler(makeTextEvent());

    expect(result.handled).toBe(true);
    expect(result.reply?.text).toBe("Приблизительно: 450 ккал");
  });

  it("inbound_claim handler POSTs to /kbju/message with correct payload", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply_text: "OK" }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const handler = (api.on as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      event: InboundClaimEvent
    ) => Promise<unknown>;

    await handler(makeTextEvent());

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const url = callArgs[0] as string;
    const init = callArgs[1] as { method: string; headers: Record<string, string>; body: string };

    expect(url).toContain("/kbju/message");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Kbju-Bridge-Version"]).toBe("1.0");

    const sentBody = JSON.parse(init.body) as Record<string, unknown>;
    expect(sentBody.telegram_id).toBe(111);
    expect(sentBody.text).toBe("я съел курицу и рис");
    expect(sentBody.source).toBe("text");
    expect(sentBody.message_id).toBe(1001);
  });

  it("inbound_claim handler detects voice source from event", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply_text: "OK" }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const handler = (api.on as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      event: InboundClaimEvent
    ) => Promise<unknown>;

    await handler(
      makeTextEvent({
        text: undefined,
        voice: { fileId: "v1", durationSeconds: 5, mimeType: "ogg" },
      })
    );

    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      body: string;
    };
    const sentBody = JSON.parse(init.body) as Record<string, unknown>;
    expect(sentBody.source).toBe("voice");
  });

  it("inbound_claim handler detects photo source from event", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply_text: "OK" }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const handler = (api.on as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      event: InboundClaimEvent
    ) => Promise<unknown>;

    await handler(
      makeTextEvent({
        text: undefined,
        photo: { fileId: "p1", fileSizeBytes: 1000, width: 800, height: 600 },
      })
    );

    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      body: string;
    };
    const sentBody = JSON.parse(init.body) as Record<string, unknown>;
    expect(sentBody.source).toBe("photo");
  });

  it("inbound_claim handler returns generic error reply on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const handler = (api.on as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      event: InboundClaimEvent
    ) => Promise<{ handled: boolean; reply?: { text: string } }>;

    const result = await handler(makeTextEvent());

    expect(result.handled).toBe(true);
    expect(result.reply?.text).toContain("Извините");
  });
});

describe("kbju-bridge plugin registered tools", () => {
  it("kbju_cron tool POSTs to /kbju/cron", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          summary_sent_to: [111, 222],
          skipped_count: 0,
        }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const cronHandler = (api.registerCommand as ReturnType<typeof vi.fn>).mock
      .calls[1][1] as (args: unknown) => Promise<unknown>;

    const result = await cronHandler({
      trigger: "daily_summary",
      timezone: "Europe/Moscow",
    });

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.summary_sent_to).toEqual([111, 222]);
    expect(resultObj.skipped_count).toBe(0);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(callArgs[0]).toContain("/kbju/cron");
  });

  it("kbju_callback tool POSTs to /kbju/callback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          reply_text: "Запись подтверждена!",
          edit_message_id: 1001,
        }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const callbackHandler = (api.registerCommand as ReturnType<typeof vi.fn>)
      .mock.calls[2][1] as (args: unknown) => Promise<unknown>;

    const result = await callbackHandler({
      callback_data: "confirm_meal:draft_uuid",
      telegram_id: 111,
      message_id: 1002,
    });

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.reply_text).toBe("Запись подтверждена!");

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(callArgs[0]).toContain("/kbju/callback");
  });

  it("kbju_message tool POSTs to /kbju/message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply_text: "OK" }),
    });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const messageToolHandler = (
      api.registerCommand as ReturnType<typeof vi.fn>
    ).mock.calls[0][1] as (args: unknown) => Promise<unknown>;

    await messageToolHandler({
      telegram_id: 111,
      text: "hello",
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(callArgs[0]).toContain("/kbju/message");
  });
});

describe("cron restricted context", () => {
  it("isCronAllowed returns true only for kbju_cron", () => {
    expect(isCronAllowed("kbju_cron")).toBe(true);
    expect(isCronAllowed("kbju_message")).toBe(false);
    expect(isCronAllowed("kbju_callback")).toBe(false);
    expect(isCronAllowed("unknown_tool")).toBe(false);
  });

  it("assertCronAllowed throws for non-kbju_cron tools", () => {
    expect(() => assertCronAllowed("kbju_cron")).not.toThrow();
    expect(() => assertCronAllowed("kbju_message")).toThrow(
      /not allowed in cron restricted context/
    );
    expect(() => assertCronAllowed("kbju_callback")).toThrow(
      /not allowed in cron restricted context/
    );
  });

  it("createCronFilter returns true only for allowed tools", () => {
    const filter = createCronFilter();

    expect(filter("kbju_cron")).toBe(true);
    expect(filter("kbju_message")).toBe(false);
    expect(filter("kbju_callback")).toBe(false);
    expect(filter("unknown_tool")).toBe(false);
  });

  it("CRON_RESTRICTED_TOOLS contains only kbju_cron", () => {
    expect(CRON_RESTRICTED_TOOLS).toEqual(["kbju_cron"]);
    expect(CRON_RESTRICTED_TOOLS).toHaveLength(1);
  });

  it("cron filter blocks all non-kbju_cron bridge tools", () => {
    const filter = createCronFilter();
    const allTools = ["kbju_message", "kbju_cron", "kbju_callback"];

    const allowed = allTools.filter(filter);
    const blocked = allTools.filter((t) => !filter(t));

    expect(allowed).toEqual(["kbju_cron"]);
    expect(blocked).toEqual(["kbju_message", "kbju_callback"]);
  });

  it("cron restricted context dispatches only kbju_cron to /kbju/cron", async () => {
    const cronFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          summary_sent_to: [111, 222],
          skipped_count: 0,
        }),
    });
    const messageFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply_text: "OK" }),
    });

    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(async (url: string) => {
        if (typeof url === "string" && url.includes("/kbju/cron")) {
          return cronFetch();
        }
        return messageFetch();
      });

    const { register } = await import(
      "../../packages/kbju-bridge-plugin/src/index.js"
    );
    const api = makePluginApi();
    register(api);

    const cronHandler = (api.registerCommand as ReturnType<typeof vi.fn>).mock
      .calls[1][1] as (args: unknown) => Promise<unknown>;
    const filter = createCronFilter();

    expect(filter("kbju_cron")).toBe(true);

    const result = await cronHandler({
      trigger: "daily_summary",
      timezone: "Europe/Moscow",
    });
    const resultObj = result as Record<string, unknown>;

    expect(resultObj.summary_sent_to).toEqual([111, 222]);
    expect(resultObj.skipped_count).toBe(0);

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const cronCalls = calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/kbju/cron")
    );
    expect(cronCalls).toHaveLength(1);
  });
});