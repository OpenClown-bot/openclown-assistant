import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("src/deployment/healthCheck.ts", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("healthCheck returns true when all required env vars are set", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "tok";
    process.env.TELEGRAM_PILOT_USER_IDS = "1";
    process.env.DATABASE_URL = "pg://x";
    process.env.POSTGRES_PASSWORD = "pw";
    process.env.OMNIROUTE_BASE_URL = "http://omni";
    process.env.OMNIROUTE_API_KEY = "key";
    process.env.FIREWORKS_API_KEY = "fw";
    process.env.USDA_FDC_API_KEY = "usda";
    process.env.PERSONA_PATH = "/p";
    process.env.PO_ALERT_CHAT_ID = "999";
    process.env.MONTHLY_SPEND_CEILING_USD = "10";
    process.env.AUDIT_DB_URL = "pg://audit";

    const { healthCheck } = await import(
      ROOT + "/src/deployment/healthCheck.ts"
    );
    expect(healthCheck()).toBe(true);
  });

  it("healthCheck returns false when a required env var is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    const { healthCheck } = await import(
      ROOT + "/src/deployment/healthCheck.ts"
    );
    expect(healthCheck()).toBe(false);
  });

  it("startMetricsServer rejects 0.0.0.0 wildcard (ARCH-001 §8.2/§11 C10)", () => {
    const result = spawnSync(
      "node",
      ["-e", "process.env.METRICS_HOST='0.0.0.0'; require('./dist/src/deployment/healthCheck.js').startMetricsServer()"],
      { cwd: ROOT, encoding: "utf-8", timeout: 5000 }
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("0.0.0.0");
  });

  it("startMetricsServer rejects :: wildcard", () => {
    const result = spawnSync(
      "node",
      ["-e", "process.env.METRICS_HOST='::'; require('./dist/src/deployment/healthCheck.js').startMetricsServer()"],
      { cwd: ROOT, encoding: "utf-8", timeout: 5000 }
    );
    expect(result.status).not.toBe(0);
  });

  it("startMetricsServer rejects [::] wildcard", () => {
    const result = spawnSync(
      "node",
      ["-e", "process.env.METRICS_HOST='[::]'; require('./dist/src/deployment/healthCheck.js').startMetricsServer()"],
      { cwd: ROOT, encoding: "utf-8", timeout: 5000 }
    );
    expect(result.status).not.toBe(0);
  });
});
