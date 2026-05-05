import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  StallWatchdog,
  StallExhaustedError,
  executeWithStallWatchdog,
  checkKillSwitch,
  defaultStallWatchdogConfig,
  STALL_THRESHOLD_MS,
  STALL_MAX_RETRIES,
  KILL_SWITCH_DEFAULT_PATH,
  type StallWatchdogConfig,
  type StallEvent,
} from "../../src/observability/stallWatchdog.js";

describe("StallWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC1: emits kbju_llm_call_stalled within 15s after 120s threshold with no token", () => {
    const emitted: StallEvent[] = [];
    let aborted = false;
    const config: StallWatchdogConfig = {
      thresholdMs: 120000,
      pollIntervalMs: 15000,
      maxRetries: STALL_MAX_RETRIES,
    };

    const watchdog = new StallWatchdog(
      config,
      {
        now: Date.now,
        emit: (e) => emitted.push(e),
        abort: () => { aborted = true; },
      },
      "omniroute",
      "gpt-oss-120b",
      "tenant-001",
    );

    watchdog.start();

    vi.advanceTimersByTime(135001);

    expect(emitted.length).toBeGreaterThanOrEqual(1);
    expect(emitted[0].event_name).toBe("kbju_llm_call_stalled");
    expect(emitted[0].provider).toBe("omniroute");
    expect(emitted[0].model).toBe("gpt-oss-120b");
    expect(emitted[0].tenant_id).toBe("tenant-001");
    expect(emitted[0].threshold_ms).toBe(120000);
    expect(emitted[0].actual_stall_ms).toBeGreaterThan(120000);
    expect(aborted).toBe(true);

    const detectionLatency = emitted[0].actual_stall_ms - config.thresholdMs;
    expect(detectionLatency).toBeLessThanOrEqual(15000);

    watchdog.stop();
  });

  it("AC2: emits kbju_llm_call_stalled within 15s after 300s threshold with no token", () => {
    const emitted: StallEvent[] = [];
    let aborted = false;
    const config: StallWatchdogConfig = {
      thresholdMs: 300000,
      pollIntervalMs: 15000,
      maxRetries: STALL_MAX_RETRIES,
    };

    const watchdog = new StallWatchdog(
      config,
      {
        now: Date.now,
        emit: (e) => emitted.push(e),
        abort: () => { aborted = true; },
      },
      "omniroute",
      "gpt-oss-120b",
      "tenant-001",
    );

    watchdog.start();

    vi.advanceTimersByTime(315001);

    expect(emitted.length).toBeGreaterThanOrEqual(1);
    expect(emitted[0].event_name).toBe("kbju_llm_call_stalled");
    expect(emitted[0].threshold_ms).toBe(300000);
    expect(emitted[0].actual_stall_ms).toBeGreaterThan(300000);
    expect(aborted).toBe(true);

    const detectionLatency = emitted[0].actual_stall_ms - config.thresholdMs;
    expect(detectionLatency).toBeLessThanOrEqual(15000);

    watchdog.stop();
  });

  it("AC2: emits kbju_llm_call_stalled within 15s after 600s threshold with no token", () => {
    const emitted: StallEvent[] = [];
    let aborted = false;
    const config: StallWatchdogConfig = {
      thresholdMs: 600000,
      pollIntervalMs: 15000,
      maxRetries: STALL_MAX_RETRIES,
    };

    const watchdog = new StallWatchdog(
      config,
      {
        now: Date.now,
        emit: (e) => emitted.push(e),
        abort: () => { aborted = true; },
      },
      "omniroute",
      "gpt-oss-120b",
      "tenant-001",
    );

    watchdog.start();

    vi.advanceTimersByTime(615001);

    expect(emitted.length).toBeGreaterThanOrEqual(1);
    expect(emitted[0].event_name).toBe("kbju_llm_call_stalled");
    expect(emitted[0].threshold_ms).toBe(600000);
    expect(emitted[0].actual_stall_ms).toBeGreaterThan(600000);
    expect(aborted).toBe(true);

    const detectionLatency = emitted[0].actual_stall_ms - config.thresholdMs;
    expect(detectionLatency).toBeLessThanOrEqual(15000);

    watchdog.stop();
  });

  it("AC3: emits zero stall events when token deltas arrive every threshold/4", () => {
    const emitted: StallEvent[] = [];
    const config: StallWatchdogConfig = {
      thresholdMs: 120000,
      pollIntervalMs: 15000,
      maxRetries: STALL_MAX_RETRIES,
    };

    const watchdog = new StallWatchdog(
      config,
      {
        now: Date.now,
        emit: (e) => emitted.push(e),
        abort: () => {},
      },
      "omniroute",
      "gpt-oss-120b",
      "tenant-001",
    );

    watchdog.start();

    const touchInterval = config.thresholdMs / 4;
    const totalDuration = config.thresholdMs * 2;

    for (let elapsed = 0; elapsed < totalDuration; elapsed += touchInterval) {
      vi.advanceTimersByTime(touchInterval);
      watchdog.touch();
    }

    expect(emitted).toHaveLength(0);
    expect(watchdog.isStalled()).toBe(false);

    watchdog.stop();
  });

  it("AC4: on first stall, aborts the original request and invokes fallback once", async () => {
    const config: StallWatchdogConfig = {
      thresholdMs: 120000,
      pollIntervalMs: 15000,
      maxRetries: STALL_MAX_RETRIES,
    };

    let fallbackCallCount = 0;
    const emitted: StallEvent[] = [];

    const execute = vi.fn().mockImplementation(
      (signal: AbortSignal, _onToken: () => void) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );

    const onFallback = vi.fn().mockImplementation(
      (_retryCount: number, _signal: AbortSignal, onToken: () => void) => {
        fallbackCallCount++;
        onToken();
        return Promise.resolve({
          rawResponseText: "fallback response",
        });
      },
    );

    const resultPromise = executeWithStallWatchdog({
      config,
      provider: "omniroute",
      model: "gpt-oss-120b",
      tenantId: "tenant-001",
      now: Date.now,
      emit: (e) => emitted.push(e),
      execute,
      onFallback,
    });

    await vi.advanceTimersByTimeAsync(135001);

    const result = await resultPromise;

    expect(emitted.length).toBeGreaterThanOrEqual(1);
    expect(emitted[0].event_name).toBe("kbju_llm_call_stalled");
    expect(fallbackCallCount).toBe(1);
    expect(result).toEqual(
      expect.objectContaining({ rawResponseText: "fallback response" }),
    );
  });

  it("AC5: throws StallExhaustedError after STALL_MAX_RETRIES fallback stalls with no stale response", async () => {
    const config: StallWatchdogConfig = {
      thresholdMs: 120000,
      pollIntervalMs: 15000,
      maxRetries: STALL_MAX_RETRIES,
    };

    const emitted: StallEvent[] = [];

    const makeStallingCall = (signal: AbortSignal, _onToken: () => void) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });

    const resultPromise = executeWithStallWatchdog({
      config,
      provider: "omniroute",
      model: "gpt-oss-120b",
      tenantId: "tenant-001",
      now: Date.now,
      emit: (e) => emitted.push(e),
      execute: makeStallingCall,
      onFallback: (_retryCount: number, signal: AbortSignal, _onToken: () => void) =>
        makeStallingCall(signal, _onToken),
    });

    const catchPromise = resultPromise.catch((error) => error);

    for (let i = 0; i < STALL_MAX_RETRIES + 2; i++) {
      await vi.advanceTimersByTimeAsync(135001);
    }

    const error = await catchPromise;
    expect(error).toBeInstanceOf(StallExhaustedError);
    const exhausted = error as StallExhaustedError;
    expect(exhausted.provider).toBe("omniroute");
    expect(exhausted.model).toBe("gpt-oss-120b");
    expect(exhausted.retryCount).toBeGreaterThan(STALL_MAX_RETRIES);
  });
});

describe("checkKillSwitch", () => {
  it("AC6: returns active=true and emits kbju_runtime_kill_switch_active when kill-switch file exists", () => {
    const existingPaths = new Set(["/tmp/kbju_kill_switch_active"]);
    const fileExists = (path: string) => existingPaths.has(path);
    const now = () => 1714800000000;

    const result = checkKillSwitch(fileExists, KILL_SWITCH_DEFAULT_PATH, now);

    expect(result.active).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event!.event_name).toBe("kbju_runtime_kill_switch_active");
    expect(result.event!.kill_switch_path).toBe(KILL_SWITCH_DEFAULT_PATH);
  });

  it("returns active=false when kill-switch file does not exist", () => {
    const fileExists = () => false;
    const now = () => 1714800000000;

    const result = checkKillSwitch(fileExists, KILL_SWITCH_DEFAULT_PATH, now);

    expect(result.active).toBe(false);
    expect(result.event).toBeUndefined();
  });

  it("returns active=false for a different file path that does not exist", () => {
    const existingPaths = new Set(["/tmp/some_other_file"]);
    const fileExists = (path: string) => existingPaths.has(path);
    const now = () => 1714800000000;

    const result = checkKillSwitch(fileExists, "/tmp/kbju_kill_switch_active", now);

    expect(result.active).toBe(false);
  });
});

describe("defaultStallWatchdogConfig", () => {
  it("returns the ADR-012 defaults", () => {
    const config = defaultStallWatchdogConfig();
    expect(config.thresholdMs).toBe(120000);
    expect(config.pollIntervalMs).toBe(Math.min(15000, Math.floor(120000 / 2)));
    expect(config.maxRetries).toBe(2);
  });
});
