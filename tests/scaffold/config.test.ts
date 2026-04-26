import { describe, it, expect } from "vitest";
import { parseConfig, ConfigError, REQUIRED_CONFIG_NAMES, redactSecrets } from "../../src/shared/config.js";

function makeFullEnv(): Record<string, string> {
  return {
    TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
    TELEGRAM_PILOT_USER_IDS: "111,222",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/kbju",
    POSTGRES_PASSWORD: "secret_pg_pass",
    OMNIROUTE_BASE_URL: "http://localhost:8000/v1",
    OMNIROUTE_API_KEY: "omni-key-abc",
    FIREWORKS_API_KEY: "fw-key-xyz",
    USDA_FDC_API_KEY: "fdc-key-123",
    PERSONA_PATH: "/app/persona.md",
    PO_ALERT_CHAT_ID: "999",
    MONTHLY_SPEND_CEILING_USD: "10",
    AUDIT_DB_URL: "postgresql://audit:pass@localhost:5432/kbju",
  };
}

describe("parseConfig", () => {
  it("parses a complete valid environment", () => {
    const config = parseConfig(makeFullEnv());
    expect(config.telegramBotToken).toBe("123456:ABC-DEF");
    expect(config.telegramPilotUserIds).toEqual(["111", "222"]);
    expect(config.databaseUrl).toBe("postgresql://user:pass@localhost:5432/kbju");
    expect(config.monthlySpendCeilingUsd).toBe(10);
    expect(config.auditDbUrl).toBe("postgresql://audit:pass@localhost:5432/kbju");
  });

  it("throws ConfigError with field names only when required names are missing", () => {
    const env = makeFullEnv();
    delete env["TELEGRAM_BOT_TOKEN"];
    delete env["DATABASE_URL"];

    try {
      parseConfig(env);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.missingNames).toContain("TELEGRAM_BOT_TOKEN");
      expect(ce.missingNames).toContain("DATABASE_URL");
      expect(ce.message).not.toContain("secret_pg_pass");
      expect(ce.message).not.toContain("omni-key-abc");
      expect(ce.message).not.toContain("fw-key-xyz");
    }
  });

  it("treats blank values as missing", () => {
    const env = makeFullEnv();
    env["PERSONA_PATH"] = "   ";
    env["PO_ALERT_CHAT_ID"] = "";

    try {
      parseConfig(env);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.missingNames).toContain("PERSONA_PATH");
      expect(ce.missingNames).toContain("PO_ALERT_CHAT_ID");
    }
  });

  it("ConfigError never exposes any secret values from the environment", () => {
    const env = makeFullEnv();
    delete env["FIREWORKS_API_KEY"];
    delete env["OMNIROUTE_API_KEY"];
    delete env["POSTGRES_PASSWORD"];

    try {
      parseConfig(env);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.message).not.toContain("fw-key-xyz");
      expect(ce.message).not.toContain("omni-key-abc");
      expect(ce.message).not.toContain("secret_pg_pass");
      expect(ce.message).not.toContain("123456:ABC-DEF");
      expect(ce.message).not.toContain("fdc-key-123");
    }
  });

  it("lists all REQUIRED_CONFIG_NAMES", () => {
    expect(REQUIRED_CONFIG_NAMES.length).toBe(12);
    expect(REQUIRED_CONFIG_NAMES).toContain("TELEGRAM_BOT_TOKEN");
    expect(REQUIRED_CONFIG_NAMES).toContain("TELEGRAM_PILOT_USER_IDS");
    expect(REQUIRED_CONFIG_NAMES).toContain("DATABASE_URL");
    expect(REQUIRED_CONFIG_NAMES).toContain("POSTGRES_PASSWORD");
    expect(REQUIRED_CONFIG_NAMES).toContain("OMNIROUTE_BASE_URL");
    expect(REQUIRED_CONFIG_NAMES).toContain("OMNIROUTE_API_KEY");
    expect(REQUIRED_CONFIG_NAMES).toContain("FIREWORKS_API_KEY");
    expect(REQUIRED_CONFIG_NAMES).toContain("USDA_FDC_API_KEY");
    expect(REQUIRED_CONFIG_NAMES).toContain("PERSONA_PATH");
    expect(REQUIRED_CONFIG_NAMES).toContain("PO_ALERT_CHAT_ID");
    expect(REQUIRED_CONFIG_NAMES).toContain("MONTHLY_SPEND_CEILING_USD");
    expect(REQUIRED_CONFIG_NAMES).toContain("AUDIT_DB_URL");
  });
});

describe("redactSecrets", () => {
  it("redacts known secret names from log-like strings", () => {
    const logLine = "TELEGRAM_BOT_TOKEN=123456:ABC-DEF db connected";
    const result = redactSecrets(logLine, ["TELEGRAM_BOT_TOKEN"]);
    expect(result).toBe("TELEGRAM_BOT_TOKEN=[REDACTED] db connected");
  });

  it("does not redact non-secret content", () => {
    const logLine = "event=skill_ready component=C1";
    const result = redactSecrets(logLine, ["TELEGRAM_BOT_TOKEN"]);
    expect(result).toBe("event=skill_ready component=C1");
  });

  it("redacts multiple secret names", () => {
    const logLine = "FIREWORKS_API_KEY=abc123 OMNIROUTE_API_KEY=xyz789";
    const result = redactSecrets(logLine, ["FIREWORKS_API_KEY", "OMNIROUTE_API_KEY"]);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("xyz789");
  });
});
