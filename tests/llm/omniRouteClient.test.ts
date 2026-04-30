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
