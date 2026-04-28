import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startTypingRenewal, TYPING_RENEWAL_INTERVAL_MS } from "../../src/telegram/typing.js";

describe("startTypingRenewal", () => {
  let sendChatAction: ReturnType<typeof vi.fn>;
  const chatId = 12345;

  beforeEach(() => {
    vi.useFakeTimers();
    sendChatAction = vi.fn().mockResolvedValue(undefined);
  });

  it("sends typing action immediately on start", async () => {
    const handle = startTypingRenewal(sendChatAction, chatId);
    await vi.advanceTimersByTimeAsync(0);
    expect(sendChatAction).toHaveBeenCalledWith(chatId, "typing");
    handle.cancel();
  });

  it("renews typing action at the configured interval", async () => {
    const handle = startTypingRenewal(sendChatAction, chatId);

    await vi.advanceTimersByTimeAsync(0);
    expect(sendChatAction).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS);
    expect(sendChatAction).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS);
    expect(sendChatAction).toHaveBeenCalledTimes(3);

    handle.cancel();
  });

  it("stops renewing after cancel is called", async () => {
    const handle = startTypingRenewal(sendChatAction, chatId);

    await vi.advanceTimersByTimeAsync(0);
    expect(sendChatAction).toHaveBeenCalledTimes(1);

    handle.cancel();

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS * 5);
    expect(sendChatAction).toHaveBeenCalledTimes(1);
  });

  it("stops after handler resolves (cancel called externally)", async () => {
    const handle = startTypingRenewal(sendChatAction, chatId);
    await vi.advanceTimersByTimeAsync(0);

    handle.cancel();
    const countAfterCancel = sendChatAction.mock.calls.length;

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS * 3);
    expect(sendChatAction.mock.calls.length).toBe(countAfterCancel);
  });

  it("stops after handler returns user fallback (cancel called externally)", async () => {
    const handle = startTypingRenewal(sendChatAction, chatId);
    await vi.advanceTimersByTimeAsync(0);

    handle.cancel();
    const countAfterCancel = sendChatAction.mock.calls.length;

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS * 3);
    expect(sendChatAction.mock.calls.length).toBe(countAfterCancel);
  });

  it("stops after handler throws (cancel called externally)", async () => {
    const handle = startTypingRenewal(sendChatAction, chatId);
    await vi.advanceTimersByTimeAsync(0);

    handle.cancel();
    const countAfterCancel = sendChatAction.mock.calls.length;

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS * 3);
    expect(sendChatAction.mock.calls.length).toBe(countAfterCancel);
  });

  it("does not throw if sendChatAction rejects", async () => {
    sendChatAction.mockRejectedValueOnce(new Error("network"));
    const handle = startTypingRenewal(sendChatAction, chatId);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS);

    handle.cancel();
    expect(sendChatAction).toHaveBeenCalled();
  });

  it("cancel during in-flight sendChatAction prevents subsequent calls (F-M3 race)", async () => {
    let resolveInFlight!: () => void;
    const inFlightPromise = new Promise<void>((resolve) => {
      resolveInFlight = resolve;
    });
    sendChatAction.mockReturnValueOnce(inFlightPromise);

    const handle = startTypingRenewal(sendChatAction, chatId);

    await vi.advanceTimersByTimeAsync(0);
    expect(sendChatAction).toHaveBeenCalledTimes(1);

    handle.cancel();
    resolveInFlight();

    await vi.advanceTimersByTimeAsync(TYPING_RENEWAL_INTERVAL_MS * 5);
    expect(sendChatAction).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
