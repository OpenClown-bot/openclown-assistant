export const STALL_THRESHOLD_MS = 120000;
export const STALL_POLL_INTERVAL_MS = Math.min(15000, Math.floor(STALL_THRESHOLD_MS / 2));
export const STALL_MAX_RETRIES = 2;

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

export interface StallWatchdogConfig {
  thresholdMs: number;
  pollIntervalMs: number;
  maxRetries: number;
}

export interface StallWatchdogDeps {
  now: () => number;
  emit: (event: StallEvent) => void;
  abort: () => void;
  onFallback: () => Promise<StallFallbackResult>;
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

  getRetryCount(): number {
    return this.retryCount;
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async handleStall(): Promise<StallFallbackResult> {
    this.retryCount++;
    this.stop();

    if (this.retryCount > this.config.maxRetries) {
      return {
        success: false,
        provider: this.provider,
        model: this.model,
        responseText: "",
      };
    }

    this.stalled = false;
    this.lastTokenAt = this.deps.now();
    return this.deps.onFallback();
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

export interface KillSwitchConfig {
  killSwitchFilePath: string;
}

export function checkKillSwitchActive(
  fileExists: (path: string) => boolean,
  killSwitchFilePath: string,
): boolean {
  return fileExists(killSwitchFilePath);
}
