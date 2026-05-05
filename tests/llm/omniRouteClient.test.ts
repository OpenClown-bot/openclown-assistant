import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callOmniRoute } from "../../src/llm/omniRouteClient.js";
import type { OmniRouteConfig, OmniRouteCallOptions } from "../../src/llm/omniRouteClient.js";
import type { SpendTracker, PreflightResult } from "../../src/observability/costGuard.js";
import type { OpenClawLogger } from "../../src/shared/types.js";

const mockConfig: OmniRouteConfig = {
  baseUrl: "https://omniroute.example.com",
  apiKey: "test-key",
  textModelAlias: "gpt-oss-120b",
  maxInputTokens: 1500,
  maxOutputTokens: 600,
};

function makeMockLogger(): OpenClawLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  };
}

function makeMockSpendTracker(): SpendTracker {
  return {
    preflightCheck: vi.fn().mockResolvedValue({
      allowed: true,
      projectedSpendUsd: 0.001,
      estimatedCallCostUsd: 0.001,
    } as PreflightResult),
    recordCostAndCheckBudget: vi.fn().mockResolvedValue({
      estimatedSpendUsd: 0.001,
      degradeModeEnabled: false,
      poAlertSentAt: null,
      monthUtc: "2026-04",
    }),
  } as unknown as SpendTracker;
}

function makeOptions(overrides?: Partial<OmniRouteCallOptions>): OmniRouteCallOptions {
  return {
    callType: "text_llm",
    systemPrompt: "You are a food estimator.",
    userContent: JSON.stringify({ meal_text_ru: "гречка" }),
    requestId: "req-001",
    userId: "user-001",
    degradeModeEnabled: false,
    logger: makeMockLogger(),
    spendTracker: makeMockSpendTracker(),
    ...overrides,
  };
}

describe("callOmniRoute retry backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits 500ms before retry on HTTP 429", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 429, text: async () => "rate limited" };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"items":[],"total_calories_kcal":0,"total_protein_g":0,"total_fat_g":0,"total_carbs_g":0}' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20 },
        }),
      };
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;

    const promise = callOmniRoute(mockConfig, makeOptions());

    await vi.advanceTimersByTimeAsync(499);
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    const result = await promise;

    expect(callCount).toBe(2);
    expect(result.outcome).toBe("success");

    globalThis.fetch = originalFetch;
  });

  it("waits 500ms before retry on HTTP 500", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, text: async () => "server error" };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"items":[],"total_calories_kcal":0,"total_protein_g":0,"total_fat_g":0,"total_carbs_g":0}' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20 },
        }),
      };
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;

    const promise = callOmniRoute(mockConfig, makeOptions());

    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(callCount).toBe(2);
    expect(result.outcome).toBe("success");

    globalThis.fetch = originalFetch;
  });
});

describe("callOmniRoute kill-switch", () => {
  it("AC6: returns stall_detected outcome when kill-switch file is present without spending tokens", async () => {
    const existingPaths = new Set(["/tmp/kbju_kill_switch_active"]);
    const fileExists = (path: string) => existingPaths.has(path);

    const logger = makeMockLogger();
    const spendTracker = makeMockSpendTracker();

    const result = await callOmniRoute(mockConfig, {
      ...makeOptions(),
      logger,
      spendTracker,
      killSwitchPath: "/tmp/kbju_kill_switch_active",
      fileExists,
    });

    expect(result.outcome).toBe("stall_detected");
    expect(result.rawResponseText).toBe("");
    expect(result.inputUnits).toBe(0);
    expect(result.outputUnits).toBe(0);
    expect(result.estimatedCostUsd).toBe(0);

    const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls;
    const killSwitchCall = warnCalls.find(
      (c: unknown[]) => typeof c[1] === "object" && c[1] !== null && "kill_switch_path" in (c[1] as Record<string, unknown>),
    );
    expect(killSwitchCall).toBeDefined();

    expect(spendTracker.recordCostAndCheckBudget).not.toHaveBeenCalled();
  });
});
