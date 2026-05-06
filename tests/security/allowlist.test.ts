import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Allowlist, isOperationAllowed } from "../../src/security/allowlist.js";
import type { MetricsRegistry } from "../../src/observability/metricsEndpoint.js";
import { PROMETHEUS_METRIC_NAMES } from "../../src/observability/kpiEvents.js";

function makeMetrics(): MetricsRegistry {
  return {
    increment: vi.fn(),
    set: vi.fn(),
    observe: vi.fn(),
    getSamples: vi.fn().mockReturnValue([]),
    render: vi.fn().mockReturnValue(""),
  } as unknown as MetricsRegistry;
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeAllowlist(filePath: string, users: number[], mode?: string): void {
  const contents: Record<string, unknown> = { users };
  if (mode) contents.mode = mode;
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(contents), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

describe("Allowlist", () => {
  describe("load from file", () => {
    let allowlist: Allowlist;
    let metrics: MetricsRegistry;
    let logger: ReturnType<typeof makeLogger>;
    let filePath: string;

    afterEach(() => {
      if (allowlist) allowlist.close();
    });

    it("loads users from allowlist.json and uses Set.has for O(1) lookup", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111, 222]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.isAllowed(222)).toBe(true);
      expect(allowlist.isAllowed(999)).toBe(false);
      expect(allowlist.isAllowed(0)).toBe(false);
      expect(allowlist.isAllowed(NaN)).toBe(false);
      expect(allowlist.isAllowed(-1)).toBe(false);
      expect(allowlist.getSize()).toBe(2);
    });

    it("increments kbju_allowlist_blocked when user is not allowed", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      allowlist.isAllowed(999);
      expect(metrics.increment).toHaveBeenCalledWith(
        PROMETHEUS_METRIC_NAMES.kbju_allowlist_blocked,
        { component: "C15" }
      );
    });

    it("sets kbju_allowlist_size gauge on load", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111, 222, 333]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(metrics.set).toHaveBeenCalledWith(
        PROMETHEUS_METRIC_NAMES.kbju_allowlist_size,
        { component: "C15" },
        3
      );
    });

    it("increments kbju_allowlist_reload on successful load", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(metrics.increment).toHaveBeenCalledWith(
        PROMETHEUS_METRIC_NAMES.kbju_allowlist_reload,
        { component: "C15", outcome: "success" }
      );
    });

    it("ignores non-finite and negative user IDs in the array", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      const tmpPath = filePath + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify({ users: [111, NaN, -5, 0, 222] }), "utf-8");
      fs.renameSync(tmpPath, filePath);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.isAllowed(222)).toBe(true);
      expect(allowlist.getSize()).toBe(2);
    });
  });

  describe("hot-reload via fs.watchFile", () => {
    let allowlist: Allowlist;
    let metrics: MetricsRegistry;
    let logger: ReturnType<typeof makeLogger>;
    let filePath: string;

    afterEach(() => {
      if (allowlist) allowlist.close();
    });

    it("propagates file update to isAllowed within allowed interval", { timeout: 10000 }, async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.isAllowed(222)).toBe(false);

      writeAllowlist(filePath, [111, 222]);

      await new Promise<void>((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
          if (allowlist.isAllowed(222)) {
            clearInterval(interval);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(5000);
            resolve();
          } else if (Date.now() - start > 5000) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

      expect(allowlist.isAllowed(222)).toBe(true);
      expect(allowlist.getSize()).toBe(2);
    });

    it("preserves last valid set when file is deleted", { timeout: 10000 }, async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111, 222]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      fs.unlinkSync(filePath);

      await new Promise<void>((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
          const recentWarnCalls = logger.warn.mock.calls.length;
          if (recentWarnCalls > 0) {
            clearInterval(interval);
            resolve();
          } else if (Date.now() - start > 5000) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.isAllowed(222)).toBe(true);
      expect(allowlist.getSize()).toBe(2);
    });

    it("preserves last valid set on bad JSON", { timeout: 10000 }, async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111, 222]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      fs.writeFileSync(filePath, "not json at all", "utf-8");

      await new Promise<void>((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
          const reloadFailedCalls = (metrics.increment as ReturnType<typeof vi.fn>).mock.calls.filter(
            (c: unknown[]) => c[0] === PROMETHEUS_METRIC_NAMES.kbju_allowlist_reload && (c[1] as Record<string, string>)?.outcome === "failed"
          ).length;
          if (reloadFailedCalls > 0) {
            clearInterval(interval);
            resolve();
          } else if (Date.now() - start > 5000) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.isAllowed(222)).toBe(true);
    });
  });

  describe("migration from env", () => {
    it("seeds from TELEGRAM_PILOT_USER_IDS when file is absent on first boot", async () => {
      const filePath = path.join(tmpDir, "allowlist.json");

      const metrics = makeMetrics();
      const logger = makeLogger();
      const allowlist = new Allowlist(filePath, ["111", "222", "333"], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.isAllowed(222)).toBe(true);
      expect(allowlist.isAllowed(333)).toBe(true);
      expect(allowlist.getSize()).toBe(3);

      expect(fs.existsSync(filePath)).toBe(true);

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.users).toEqual([111, 222, 333]);
      expect(parsed.comment).toContain("TELEGRAM_PILOT_USER_IDS");

      allowlist.close();
    });

    it("handles empty or whitespace-only seed ids gracefully", async () => {
      const filePath = path.join(tmpDir, "allowlist.json");
      const metrics = makeMetrics();
      const logger = makeLogger();
      const allowlist = new Allowlist(filePath, ["", "  ", "111"], metrics, logger);

      expect(allowlist.isAllowed(111)).toBe(true);
      expect(allowlist.getSize()).toBe(1);

      allowlist.close();
    });
  });

  describe("failure modes", () => {
    let allowlist: Allowlist;
    let metrics: MetricsRegistry;
    let logger: ReturnType<typeof makeLogger>;
    let filePath: string;

    afterEach(() => {
      if (allowlist) allowlist.close();
    });

    it("defaults to normal mode when no mode specified", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.getMode()).toBe("normal");
    });

    it("loads block_all mode from file", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111], "block_all");

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.getMode()).toBe("block_all");
    });

    it("loads safe_mode from file", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111], "safe_mode");

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.getMode()).toBe("safe_mode");
    });

    it("loads read_only mode from file", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111], "read_only");

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.getMode()).toBe("read_only");
    });

    it("falls back to normal for unknown mode value", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111], "invalid_mode");

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.getMode()).toBe("normal");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("hot-reloads mode changes from file", { timeout: 10000 }, async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111], "normal");

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      expect(allowlist.getMode()).toBe("normal");

      writeAllowlist(filePath, [111], "block_all");

      await new Promise<void>((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
          if (allowlist.getMode() === "block_all") {
            clearInterval(interval);
            resolve();
          } else if (Date.now() - start > 5000) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });

      expect(allowlist.getMode()).toBe("block_all");
    });
  });

  describe("blocked-user response", () => {
    let allowlist: Allowlist;
    let metrics: MetricsRegistry;
    let logger: ReturnType<typeof makeLogger>;
    let filePath: string;

    afterEach(() => {
      if (allowlist) allowlist.close();
    });

    it("returns false and increments blocked metric for non-allowlisted user", async () => {
      filePath = path.join(tmpDir, "allowlist.json");
      writeAllowlist(filePath, [111]);

      metrics = makeMetrics();
      logger = makeLogger();
      allowlist = new Allowlist(filePath, [], metrics, logger);

      const result = allowlist.isAllowed(999);
      expect(result).toBe(false);
      expect(metrics.increment).toHaveBeenCalledWith(
        PROMETHEUS_METRIC_NAMES.kbju_allowlist_blocked,
        { component: "C15" }
      );
    });
  });
});

describe("isOperationAllowed", () => {
  it("allows all operations in normal mode", () => {
    expect(isOperationAllowed("start", "normal")).toBe(true);
    expect(isOperationAllowed("text_meal", "normal")).toBe(true);
    expect(isOperationAllowed("voice_meal", "normal")).toBe(true);
    expect(isOperationAllowed("photo_meal", "normal")).toBe(true);
    expect(isOperationAllowed("history", "normal")).toBe(true);
    expect(isOperationAllowed("callback", "normal")).toBe(true);
    expect(isOperationAllowed("summary_delivery", "normal")).toBe(true);
    expect(isOperationAllowed("forget_me", "normal")).toBe(true);
  });

  it("blocks all operations in block_all mode", () => {
    expect(isOperationAllowed("start", "block_all")).toBe(false);
    expect(isOperationAllowed("text_meal", "block_all")).toBe(false);
    expect(isOperationAllowed("history", "block_all")).toBe(false);
    expect(isOperationAllowed("callback", "block_all")).toBe(false);
    expect(isOperationAllowed("summary_delivery", "block_all")).toBe(false);
    expect(isOperationAllowed("forget_me", "block_all")).toBe(false);
  });

  it("allows only read-only + safe start operations in safe_mode", () => {
    expect(isOperationAllowed("start", "safe_mode")).toBe(true);
    expect(isOperationAllowed("history", "safe_mode")).toBe(true);
    expect(isOperationAllowed("summary_delivery", "safe_mode")).toBe(true);
    expect(isOperationAllowed("text_meal", "safe_mode")).toBe(false);
    expect(isOperationAllowed("voice_meal", "safe_mode")).toBe(false);
    expect(isOperationAllowed("photo_meal", "safe_mode")).toBe(false);
    expect(isOperationAllowed("callback", "safe_mode")).toBe(false);
    expect(isOperationAllowed("forget_me", "safe_mode")).toBe(false);
  });

  it("allows only strict read paths in read_only mode (no start)", () => {
    expect(isOperationAllowed("history", "read_only")).toBe(true);
    expect(isOperationAllowed("summary_delivery", "read_only")).toBe(true);
    expect(isOperationAllowed("start", "read_only")).toBe(false);
    expect(isOperationAllowed("text_meal", "read_only")).toBe(false);
    expect(isOperationAllowed("voice_meal", "read_only")).toBe(false);
    expect(isOperationAllowed("photo_meal", "read_only")).toBe(false);
    expect(isOperationAllowed("callback", "read_only")).toBe(false);
    expect(isOperationAllowed("forget_me", "read_only")).toBe(false);
  });

  it("blocks all for unknown mode", () => {
    expect(isOperationAllowed("history", "unknown" as "normal")).toBe(false);
  });
});