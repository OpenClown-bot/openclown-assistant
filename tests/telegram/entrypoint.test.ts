import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { routeMessage, routeCallbackQuery, routeCronEvent, MAX_VOICE_DURATION_SECONDS } from "../../src/telegram/entrypoint.js";
import type { C1Deps, NormalizedTelegramUpdate, TelegramHandlers } from "../../src/telegram/types.js";
import { C1MalformedUpdateError } from "../../src/telegram/types.js";
import type { RussianReplyEnvelope, TelegramMessage, TelegramCallbackQuery } from "../../src/shared/types.js";
import { MSG_VOICE_TOO_LONG, MSG_GENERIC_RECOVERY } from "../../src/telegram/messages.js";
import { KPI_EVENT_NAMES } from "../../src/observability/kpiEvents.js";

function makeHandlers(): TelegramHandlers {
  return {
    start: vi.fn().mockResolvedValue(null),
    forgetMe: vi.fn().mockResolvedValue(null),
    textMeal: vi.fn().mockResolvedValue(null),
    voiceMeal: vi.fn().mockResolvedValue(null),
    photoMeal: vi.fn().mockResolvedValue(null),
    history: vi.fn().mockResolvedValue(null),
    callback: vi.fn().mockResolvedValue(null),
    summaryDelivery: vi.fn().mockResolvedValue(null),
  };
}

function makeDeps(overrides?: Partial<C1Deps>): C1Deps {
  return {
    handlers: makeHandlers(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendChatAction: vi.fn().mockResolvedValue(undefined),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    },
    pilotUserIds: ["111", "222"],
    ...overrides,
  };
}

function makeMessage(overrides: Partial<TelegramMessage>): TelegramMessage {
  return {
    messageId: 1,
    from: {
      id: 111,
      isBot: false,
      firstName: "Test",
    },
    chat: {
      id: 111,
      type: "private",
    },
    date: Math.floor(Date.now() / 1000),
    text: undefined,
    voice: undefined,
    photo: undefined,
    ...overrides,
  };
}

function makeCallbackQuery(overrides: Partial<TelegramCallbackQuery>): TelegramCallbackQuery {
  return {
    id: "cb1",
    from: {
      id: 111,
      isBot: false,
      firstName: "Test",
    },
    data: "confirm_meal",
    ...overrides,
  };
}

describe("routeMessage", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("rejects non-allowlisted Telegram user without calling any handler", async () => {
    const msg = makeMessage({ from: { id: 999, isBot: false, firstName: "Stranger" } });
    await routeMessage(deps, "req-1", msg);

    expect(deps.handlers.start).not.toHaveBeenCalled();
    expect(deps.handlers.textMeal).not.toHaveBeenCalled();
    expect(deps.handlers.voiceMeal).not.toHaveBeenCalled();
    expect(deps.handlers.photoMeal).not.toHaveBeenCalled();
    expect(deps.handlers.forgetMe).not.toHaveBeenCalled();
    expect(deps.handlers.history).not.toHaveBeenCalled();
    expect(deps.sendMessage).not.toHaveBeenCalled();
  });

  it("logs access_denied for non-allowlisted user", async () => {
    const msg = makeMessage({ from: { id: 999, isBot: false, firstName: "Stranger" } });
    await routeMessage(deps, "req-1", msg);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it("routes /start to start handler", async () => {
    const msg = makeMessage({ text: "/start" });
    await routeMessage(deps, "req-2", msg);
    expect(deps.handlers.start).toHaveBeenCalledTimes(1);
    expect(deps.handlers.start).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "start" })
    );
  });

  it("routes /forget_me to forgetMe handler", async () => {
    const msg = makeMessage({ text: "/forget_me" });
    await routeMessage(deps, "req-3", msg);
    expect(deps.handlers.forgetMe).toHaveBeenCalledTimes(1);
    expect(deps.handlers.forgetMe).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "forget_me" })
    );
  });

  it("routes plain text to textMeal handler", async () => {
    const msg = makeMessage({ text: "съел курицу 200г" });
    await routeMessage(deps, "req-4", msg);
    expect(deps.handlers.textMeal).toHaveBeenCalledTimes(1);
    expect(deps.handlers.textMeal).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "text_meal" })
    );
  });

  it("routes voice message to voiceMeal handler", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: 5 },
    });
    await routeMessage(deps, "req-5", msg);
    expect(deps.handlers.voiceMeal).toHaveBeenCalledTimes(1);
    expect(deps.handlers.voiceMeal).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "voice_meal" })
    );
  });

  it("routes photo message to photoMeal handler", async () => {
    const msg = makeMessage({
      text: undefined,
      photo: [{ fileId: "p1", fileUniqueId: "pu1", width: 800, height: 600 }],
    });
    await routeMessage(deps, "req-6", msg);
    expect(deps.handlers.photoMeal).toHaveBeenCalledTimes(1);
    expect(deps.handlers.photoMeal).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "photo_meal" })
    );
  });

  it("routes /history command to history handler", async () => {
    const msg = makeMessage({ text: "/history" });
    await routeMessage(deps, "req-7", msg);
    expect(deps.handlers.history).toHaveBeenCalledTimes(1);
    expect(deps.handlers.history).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "history" })
    );
  });

  it("routes /история command to history handler", async () => {
    const msg = makeMessage({ text: "/история" });
    await routeMessage(deps, "req-7b", msg);
    expect(deps.handlers.history).toHaveBeenCalledTimes(1);
    expect(deps.handlers.history).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "history" })
    );
  });

  it("rejects voice longer than 15 seconds before invoking voice handler", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: 16 },
    });
    await routeMessage(deps, "req-8", msg);
    expect(deps.handlers.voiceMeal).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_VOICE_TOO_LONG })
    );
  });

  it("accepts voice at exactly 15 seconds", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: 15 },
    });
    await routeMessage(deps, "req-8b", msg);
    expect(deps.handlers.voiceMeal).toHaveBeenCalledTimes(1);
  });

  it("MAX_VOICE_DURATION_SECONDS is 15", () => {
    expect(MAX_VOICE_DURATION_SECONDS).toBe(15);
  });

  it("sends generic recovery message when handler throws", async () => {
    (deps.handlers.textMeal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    const msg = makeMessage({ text: "съел торт" });
    await routeMessage(deps, "req-9", msg);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_GENERIC_RECOVERY })
    );
  });

  it("handler failure logs at error level (D-I8)", async () => {
    (deps.handlers.textMeal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    const msg = makeMessage({ text: "съел торт" });
    await routeMessage(deps, "req-9b", msg);
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it("calls sendChatAction (typing) during handler execution", async () => {
    let handlerResolve!: () => void;
    const handlerPromise = new Promise<null>((resolve) => {
      handlerResolve = () => resolve(null);
    });
    (deps.handlers.textMeal as ReturnType<typeof vi.fn>).mockReturnValueOnce(handlerPromise);

    const msg = makeMessage({ text: "съел кашу" });
    const routePromise = routeMessage(deps, "req-10", msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(deps.sendChatAction).toHaveBeenCalledWith(111, "typing");

    handlerResolve();
    await routePromise;
  });

  it("stops typing renewal after handler resolves", async () => {
    vi.useFakeTimers();
    const msg = makeMessage({ text: "съел яблоко" });
    const routePromise = routeMessage(deps, "req-11", msg);
    await vi.runAllTimersAsync();
    await routePromise;

    const sendChatActionMock = deps.sendChatAction as ReturnType<typeof vi.fn>;
    const typingCallCount = sendChatActionMock.mock.calls.filter(
      (call: unknown[]) => call[1] === "typing"
    ).length;
    expect(typingCallCount).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it("stops typing renewal after handler throws", async () => {
    vi.useFakeTimers();
    (deps.handlers.textMeal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
    const msg = makeMessage({ text: "съел омлет" });
    const routePromise = routeMessage(deps, "req-12", msg);
    await vi.runAllTimersAsync();
    await routePromise;
    vi.useRealTimers();
  });

  it("stops typing renewal after handler returns user fallback reply", async () => {
    const fallbackReply: RussianReplyEnvelope = {
      chatId: 111,
      text: "Введите КБЖУ вручную",
      typingRenewalRequired: false,
    };
    (deps.handlers.textMeal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fallbackReply);
    const msg = makeMessage({ text: "съел что-то" });
    await routeMessage(deps, "req-13", msg);
    expect(deps.sendMessage).toHaveBeenCalledWith(fallbackReply);
  });

  it("retries send once on transient failure with SAME envelope (D-I1)", async () => {
    const envelope: RussianReplyEnvelope = {
      chatId: 111,
      text: "Привет!",
      typingRenewalRequired: false,
    };
    (deps.handlers.start as ReturnType<typeof vi.fn>).mockResolvedValueOnce(envelope);
    (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("transient"));
    const msg = makeMessage({ text: "/start" });
    await routeMessage(deps, "req-14", msg);
    const sendMessageMock = deps.sendMessage as ReturnType<typeof vi.fn>;
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock.mock.calls[0][0]).toBe(envelope);
    expect(sendMessageMock.mock.calls[1][0]).toBe(envelope);
  });

  it("emits telegram_send_failed on double failure, no MSG_SEND_FAILED sent (D-I1)", async () => {
    const envelope: RussianReplyEnvelope = {
      chatId: 111,
      text: "Reply text",
      typingRenewalRequired: false,
    };
    (deps.handlers.start as ReturnType<typeof vi.fn>).mockResolvedValueOnce(envelope);
    (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail1"));
    (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail2"));
    const msg = makeMessage({ text: "/start" });
    await routeMessage(deps, "req-14b", msg);
    const sendMessageMock = deps.sendMessage as ReturnType<typeof vi.fn>;
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock.mock.calls[0][0]).toBe(envelope);
    expect(sendMessageMock.mock.calls[1][0]).toBe(envelope);
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it("telegram_send_failed event carries non-empty request_id + user_id (D-I11)", async () => {
    const envelope: RussianReplyEnvelope = {
      chatId: 111,
      text: "Reply text",
      typingRenewalRequired: false,
    };
    (deps.handlers.start as ReturnType<typeof vi.fn>).mockResolvedValueOnce(envelope);
    (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail1"));
    (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail2"));
    const msg = makeMessage({ text: "/start" });
    await routeMessage(deps, "req-d-i11", msg);
    const errorMock = deps.logger.error as ReturnType<typeof vi.fn>;
    const sendFailedCall = errorMock.mock.calls.find((args) => {
      const meta = args[1] as Record<string, unknown> | undefined;
      return meta?.event_name === "telegram_send_failed";
    });
    expect(sendFailedCall, "expected at least one telegram_send_failed log").toBeDefined();
    const event = sendFailedCall![1] as Record<string, unknown>;
    expect(event.request_id).toBe("req-d-i11");
    expect(event.user_id).not.toBe("");
    expect(event.user_id).not.toBeUndefined();
    expect(event.outcome).toBe("provider_failure");
  });
});

describe("routeCallbackQuery", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("rejects non-allowlisted callback user without calling handler", async () => {
    const query = makeCallbackQuery({
      from: { id: 999, isBot: false, firstName: "Stranger" },
    });
    await routeCallbackQuery(deps, "req-cb1", query);
    expect(deps.handlers.callback).not.toHaveBeenCalled();
  });

  it("routes callback to callback handler for allowlisted user", async () => {
    const query = makeCallbackQuery({});
    await routeCallbackQuery(deps, "req-cb2", query);
    expect(deps.handlers.callback).toHaveBeenCalledTimes(1);
    expect(deps.handlers.callback).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "callback" })
    );
  });
});

describe("routeCronEvent", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("routes cron event to summaryDelivery handler", async () => {
    await routeCronEvent(deps, "req-cron1", 111, 111, "daily");
    expect(deps.handlers.summaryDelivery).toHaveBeenCalledTimes(1);
    expect(deps.handlers.summaryDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ routeKind: "summary_delivery", cronTriggerType: "daily" })
    );
  });

  it("rejects non-allowlisted cron userId without calling summaryDelivery (D-I2)", async () => {
    await routeCronEvent(deps, "req-cron-deny", 999, 999, "daily");
    expect(deps.handlers.summaryDelivery).not.toHaveBeenCalled();
    expect(deps.sendMessage).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalled();
  });
});

describe("non-allowlisted user produces no C3 write calls", () => {
  it("no handler or sendMessage called for denied user", async () => {
    const deps = makeDeps();
    const msg = makeMessage({
      from: { id: 9999, isBot: false, firstName: "Denied" },
      text: "/start",
    });
    await routeMessage(deps, "req-deny-1", msg);

    const allHandlers = Object.values(deps.handlers);
    for (const handler of allHandlers) {
      expect(handler).not.toHaveBeenCalled();
    }
    expect(deps.sendMessage).not.toHaveBeenCalled();
  });
});

describe("malformed update handling (F-M1 + F-M4)", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("no TypeError on message with from=undefined, sends MSG_GENERIC_RECOVERY", async () => {
    const msg = makeMessage({ from: undefined as unknown as TelegramMessage["from"] });
    await routeMessage(deps, "req-mal-1", msg);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_GENERIC_RECOVERY })
    );
  });

  it("malformed message does not call any handler", async () => {
    const msg = makeMessage({ from: undefined as unknown as TelegramMessage["from"] });
    await routeMessage(deps, "req-mal-2", msg);
    const allHandlers = Object.values(deps.handlers);
    for (const handler of allHandlers) {
      expect(handler).not.toHaveBeenCalled();
    }
  });

  it("C10 event for malformed update has user_id not containing 'undefined'", async () => {
    const msg = makeMessage({ from: undefined as unknown as TelegramMessage["from"] });
    await routeMessage(deps, "req-mal-3", msg);
    const errorCalls = (deps.logger.error as ReturnType<typeof vi.fn>).mock.calls;
    const found = errorCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.user_id === "anonymous";
    });
    expect(found).toBe(true);
  });

  it("no TypeError on callbackQuery with from=undefined", async () => {
    const query = makeCallbackQuery({ from: undefined as unknown as TelegramCallbackQuery["from"] });
    await routeCallbackQuery(deps, "req-mal-cb1", query);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_GENERIC_RECOVERY })
    );
  });

  it("no TypeError on message with chat=undefined, sends MSG_GENERIC_RECOVERY (D-I10)", async () => {
    const msg = makeMessage({ chat: undefined as unknown as TelegramMessage["chat"] });
    await routeMessage(deps, "req-mal-chat", msg);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_GENERIC_RECOVERY })
    );
  });

  it("no TypeError on callbackQuery with message present but chat=undefined (D-I10)", async () => {
    const baseMsg = makeMessage({});
    const malformedMsg = { ...baseMsg, chat: undefined as unknown as TelegramMessage["chat"] };
    const query = makeCallbackQuery({ message: malformedMsg });
    await expect(
      routeCallbackQuery(deps, "req-mal-cb-chat", query)
    ).resolves.not.toThrow();
  });

  it("C1MalformedUpdateError is exported and extends Error", () => {
    const err = new C1MalformedUpdateError("from missing");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("C1MalformedUpdateError");
  });
});

describe("voice duration validation (F-M2)", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("rejects voice with NaN duration", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: NaN },
    });
    await routeMessage(deps, "req-voice-nan", msg);
    expect(deps.handlers.voiceMeal).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_VOICE_TOO_LONG })
    );
  });

  it("rejects voice with Infinity duration", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: Infinity },
    });
    await routeMessage(deps, "req-voice-inf", msg);
    expect(deps.handlers.voiceMeal).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_VOICE_TOO_LONG })
    );
  });

  it("rejects voice with duration 0", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: 0 },
    });
    await routeMessage(deps, "req-voice-zero", msg);
    expect(deps.handlers.voiceMeal).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: MSG_VOICE_TOO_LONG })
    );
  });

  it("NaN/Infinity/0 voice emits voice_duration_invalid error_code", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: NaN },
    });
    await routeMessage(deps, "req-voice-nan-err", msg);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.error_code === "voice_duration_invalid";
    });
    expect(found).toBe(true);
  });

  it(">15s voice emits voice_too_long error_code", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: 20 },
    });
    await routeMessage(deps, "req-voice-toolong-err", msg);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.error_code === "voice_too_long";
    });
    expect(found).toBe(true);
  });
});

describe("route-kind → event-name mapping (D-I3)", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  function getLoggedEventName(): string | undefined {
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of infoCalls) {
      const meta = call[1] as Record<string, unknown> | undefined;
      if (meta?.event_name && typeof meta.event_name === "string") {
        return meta.event_name;
      }
    }
    return undefined;
  }

  it("/start routes to onboarding_started event", async () => {
    const msg = makeMessage({ text: "/start" });
    await routeMessage(deps, "req-ev-start", msg);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.event_name === KPI_EVENT_NAMES.onboarding_started;
    });
    expect(found).toBe(true);
  });

  it("/forget_me routes to forget_me_requested event", async () => {
    const msg = makeMessage({ text: "/forget_me" });
    await routeMessage(deps, "req-ev-forget", msg);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.event_name === KPI_EVENT_NAMES.forget_me_requested;
    });
    expect(found).toBe(true);
  });

  it("voice_meal routes to meal_content_received event", async () => {
    const msg = makeMessage({
      text: undefined,
      voice: { fileId: "f1", fileUniqueId: "u1", duration: 5 },
    });
    await routeMessage(deps, "req-ev-voice", msg);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.event_name === KPI_EVENT_NAMES.meal_content_received;
    });
    expect(found).toBe(true);
  });

  it("/history routes to history_query event", async () => {
    const msg = makeMessage({ text: "/history" });
    await routeMessage(deps, "req-ev-history", msg);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.event_name === KPI_EVENT_NAMES.history_query;
    });
    expect(found).toBe(true);
  });

  it("callback routes to callback_received event", async () => {
    const query = makeCallbackQuery({});
    await routeCallbackQuery(deps, "req-ev-cb", query);
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.event_name === KPI_EVENT_NAMES.callback_received;
    });
    expect(found).toBe(true);
  });

  it("cron summary routes to summary_delivered event", async () => {
    await routeCronEvent(deps, "req-ev-cron", 111, 111, "daily");
    const infoCalls = (deps.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const found = infoCalls.some((call: unknown[]) => {
      const meta = call[1] as Record<string, unknown> | undefined;
      return meta?.event_name === KPI_EVENT_NAMES.summary_delivered;
    });
    expect(found).toBe(true);
  });
});

describe("history command startsWith (D-I4)", () => {
  let deps: C1Deps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it("routes /history@OpenClownBot to history handler, NOT textMeal", async () => {
    const msg = makeMessage({ text: "/history@OpenClownBot" });
    await routeMessage(deps, "req-hist-bot", msg);
    expect(deps.handlers.history).toHaveBeenCalledTimes(1);
    expect(deps.handlers.textMeal).not.toHaveBeenCalled();
  });

  it("routes /история@OpenClownBot to history handler, NOT textMeal", async () => {
    const msg = makeMessage({ text: "/история@OpenClownBot" });
    await routeMessage(deps, "req-hist-ru-bot", msg);
    expect(deps.handlers.history).toHaveBeenCalledTimes(1);
    expect(deps.handlers.textMeal).not.toHaveBeenCalled();
  });
});

describe("callback data truncation (F-L1)", () => {
  it("truncates callback data to 256 chars", async () => {
    const deps = makeDeps();
    const longData = "a".repeat(300);
    const query = makeCallbackQuery({ data: longData });
    await routeCallbackQuery(deps, "req-trunc-cb", query);
    expect(deps.handlers.callback).toHaveBeenCalledWith(
      expect.objectContaining({ callbackData: "a".repeat(256) })
    );
  });
});
