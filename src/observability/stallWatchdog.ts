export const STALL_THRESHOLD_MS = 120000;
export const STALL_POLL_INTERVAL_MS = Math.min(15000, Math.floor(STALL_THRESHOLD_MS / 2));
export const STALL_MAX_RETRIES = 2;

export const KILL_SWITCH_DEFAULT_PATH = "/tmp/kbju_kill_switch_active";

export interface StallEvent {
  event_name: "kbju_llm_call_stalled";
  provider: string;
  model: string;
  tenant_id: string;
  threshold_ms: number;
  actual_stall_ms: number;
  retry_count: number;
  timestamp_utc: string;
}

export interface KillSwitchEvent {
  event_name: "kbju_runtime_kill_switch_active";
  kill_switch_path: string;
  timestamp_utc: string;
}

export interface StallWatchdogConfig {
  thresholdMs: number;
  pollIntervalMs: number;
  maxRetries: number;
}

export function defaultStallWatchdogConfig(): StallWatchdogConfig {
  return {
    thresholdMs: STALL_THRESHOLD_MS,
    pollIntervalMs: STALL_POLL_INTERVAL_MS,
    maxRetries: STALL_MAX_RETRIES,
  };
}

export interface StallWatchdogDeps {
  now: () => number;
  emit: (event: StallEvent) => void;
  abort: () => void;
}

export interface StallFallbackResult {
  success: boolean;
  provider: string;
  model: string;
  responseText: string;
}

export class StallWatchdog {
  private readonly config: StallWatchdogConfig;
  private readonly deps: StallWatchdogDeps;
  private lastTokenAt: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;
  private stalled = false;
  private provider: string;
  private model: string;
  private tenantId: string;
  private startedAt: number;

  constructor(
    config: StallWatchdogConfig,
    deps: StallWatchdogDeps,
    provider: string,
    model: string,
    tenantId: string,
  ) {
    this.config = config;
    this.deps = deps;
    this.provider = provider;
    this.model = model;
    this.tenantId = tenantId;
    this.lastTokenAt = 0;
    this.startedAt = 0;
  }

  start(): void {
    const now = this.deps.now();
    this.lastTokenAt = now;
    this.startedAt = now;
    this.stalled = false;

    this.pollTimer = setInterval(() => {
      const elapsed = this.deps.now() - this.lastTokenAt;
      if (elapsed > this.config.thresholdMs && !this.stalled) {
        this.stalled = true;
        this.deps.emit({
          event_name: "kbju_llm_call_stalled",
          provider: this.provider,
          model: this.model,
          tenant_id: this.tenantId,
          threshold_ms: this.config.thresholdMs,
          actual_stall_ms: elapsed,
          retry_count: this.retryCount,
          timestamp_utc: new Date(this.deps.now()).toISOString(),
        });
        this.deps.abort();
      }
    }, this.config.pollIntervalMs);
  }

  touch(): void {
    this.lastTokenAt = this.deps.now();
  }

  isStalled(): boolean {
    return this.stalled;
  }

  incrementRetry(): void {
    this.retryCount++;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  getConfig(): StallWatchdogConfig {
    return this.config;
  }

  reset(): void {
    this.stop();
    this.stalled = false;
    const now = this.deps.now();
    this.lastTokenAt = now;
  }

  restart(): void {
    this.reset();
    this.start();
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export class StallExhaustedError extends Error {
  public readonly provider: string;
  public readonly model: string;
  public readonly retryCount: number;

  constructor(provider: string, model: string, retryCount: number) {
    super(`stall_exhausted: ${provider}/${model} after ${retryCount} retries`);
    this.name = "StallExhaustedError";
    this.provider = provider;
    this.model = model;
    this.retryCount = retryCount;
  }
}

export interface ExecuteWithStallWatchdogParams<T> {
  config: StallWatchdogConfig;
  provider: string;
  model: string;
  tenantId: string;
  now: () => number;
  emit: (event: StallEvent) => void;
  execute: (signal: AbortSignal, onToken: () => void) => Promise<T>;
  onFallback: (retryCount: number, signal: AbortSignal, onToken: () => void) => Promise<T>;
}

export async function executeWithStallWatchdog<T>(
  params: ExecuteWithStallWatchdogParams<T>,
): Promise<T> {
  const { config, provider, model, tenantId, now, emit, execute, onFallback } = params;

  let attempt = 0;

  while (attempt <= config.maxRetries) {
    const controller = new AbortController();
    const watchdog = new StallWatchdog(
      config,
      {
        now,
        emit,
        abort: () => controller.abort(),
      },
      provider,
      model,
      tenantId,
    );

    if (attempt > 0) {
      for (let i = 0; i < attempt; i++) {
        watchdog.incrementRetry();
      }
    }

    watchdog.start();

    try {
      const result = await execute(controller.signal, () => watchdog.touch());
      watchdog.stop();
      return result;
    } catch (error) {
      watchdog.stop();

      const wasStalled = watchdog.isStalled();
      const wasAborted = error instanceof DOMException && error.name === "AbortError";

      if (wasStalled || wasAborted) {
        attempt++;
        if (attempt > config.maxRetries) {
          throw new StallExhaustedError(provider, model, attempt);
        }

        const fallbackController = new AbortController();
        const fallbackWatchdog = new StallWatchdog(
          config,
          {
            now,
            emit,
            abort: () => fallbackController.abort(),
          },
          provider,
          model,
          tenantId,
        );
        for (let i = 0; i < attempt; i++) {
          fallbackWatchdog.incrementRetry();
        }
        fallbackWatchdog.start();

        try {
          const result = await onFallback(
            attempt,
            fallbackController.signal,
            () => fallbackWatchdog.touch(),
          );
          fallbackWatchdog.stop();
          return result;
        } catch (fallbackError) {
          fallbackWatchdog.stop();

          const fallbackStalled = fallbackWatchdog.isStalled();
          const fallbackAborted =
            fallbackError instanceof DOMException && fallbackError.name === "AbortError";

          if (fallbackStalled || fallbackAborted) {
            attempt++;
            if (attempt > config.maxRetries) {
              throw new StallExhaustedError(provider, model, attempt);
            }
            continue;
          }

          throw fallbackError;
        }
      }

      throw error;
    }
  }

  throw new StallExhaustedError(provider, model, attempt);
}

export interface KillSwitchCheckResult {
  active: boolean;
  event?: KillSwitchEvent;
}

export function checkKillSwitch(
  fileExists: (path: string) => boolean,
  killSwitchFilePath: string,
  now: () => number,
): KillSwitchCheckResult {
  const active = fileExists(killSwitchFilePath);
  if (active) {
    return {
      active: true,
      event: {
        event_name: "kbju_runtime_kill_switch_active",
        kill_switch_path: killSwitchFilePath,
        timestamp_utc: new Date(now()).toISOString(),
      },
    };
  }
  return { active: false };
}
