import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadPersona, resetPersonaCache } from "../../src/summary/personaLoader.js";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

beforeEach(() => {
  resetPersonaCache();
});

describe("loadPersona", () => {
  it("loads a valid persona file", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    };
    const result = loadPersona(
      "docs/personality/PERSONA-001-kbju-coach.md",
      logger,
    );
    expect(result).toContain("КБЖУ-тренер");
    expect(logger.info).toHaveBeenCalledWith(
      "summary_persona_loaded",
      expect.objectContaining({ persona_path: "docs/personality/PERSONA-001-kbju-coach.md" }),
    );
  });

  it("caches persona on second call", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    };
    const first = loadPersona(
      "docs/personality/PERSONA-001-kbju-coach.md",
      logger,
    );
    const second = loadPersona(
      "docs/personality/PERSONA-001-kbju-coach.md",
      logger,
    );
    expect(first).toBe(second);
  });

  it("throws and logs critical when PERSONA_PATH is missing", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    };
    expect(() =>
      loadPersona("/nonexistent/path/persona.md", logger)
    ).toThrow('C9 startup failed: cannot load PERSONA_PATH="/nonexistent/path/persona.md"');
    expect(logger.critical).toHaveBeenCalledWith(
      "summary_persona_load_failed",
      expect.objectContaining({ persona_path: "/nonexistent/path/persona.md" }),
    );
  });

  it("fails startup for C9 when PERSONA_PATH is missing (AC proof)", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      critical: vi.fn(),
    };
    let threw = false;
    try {
      loadPersona("", logger);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("loads different content when called with a different personaPath", () => {
    const altPath = join("/tmp", "test-persona-alt.md");
    writeFileSync(altPath, "Альтернативный персонаж.", "utf-8");
    try {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        critical: vi.fn(),
      };
      const first = loadPersona(
        "docs/personality/PERSONA-001-kbju-coach.md",
        logger,
      );
      expect(first).toContain("КБЖУ-тренер");

      const second = loadPersona(altPath, logger);
      expect(second).toContain("Альтернативный персонаж");
      expect(second).not.toBe(first);

      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenNthCalledWith(
        1,
        "summary_persona_loaded",
        expect.objectContaining({ persona_path: "docs/personality/PERSONA-001-kbju-coach.md" }),
      );
      expect(logger.info).toHaveBeenNthCalledWith(
        2,
        "summary_persona_loaded",
        expect.objectContaining({ persona_path: altPath }),
      );
    } finally {
      if (existsSync(altPath)) unlinkSync(altPath);
    }
  });
});
