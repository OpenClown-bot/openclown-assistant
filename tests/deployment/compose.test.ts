import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const COMPOSE_PATH = resolve(ROOT, "docker-compose.yml");

function readCompose(): string {
  return readFileSync(COMPOSE_PATH, "utf-8");
}

function parseYamlLines(content: string): string[] {
  return content.split("\n");
}

describe("docker-compose.yml", () => {
  const content = readCompose();
  const lines = parseYamlLines(content);

  it("exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it("uses named volumes for PostgreSQL (kbju_pgdata)", () => {
    expect(content).toContain("kbju_pgdata:");
  });

  it("uses named volumes for OpenClaw state (openclaw_state)", () => {
    expect(content).toContain("openclaw_state:");
  });

  it("does not use host bind mounts for production data", () => {
    const bindMountPattern = /\/[a-zA-Z]:/.test(content) ? /- [./~]/ : null;
    const volumeLines = lines.filter(
      (line) => line.trim().startsWith("- ") && line.includes(":") && !line.includes("${")
    );
    const hostBindMounts = volumeLines.filter((line) => {
      const match = line.trim().match(/-\s+(.+):/);
      if (!match) return false;
      const source = match[1].trim();
      return (
        (source.startsWith("/") || source.startsWith("./") || source.startsWith("~")) &&
        !source.includes("var/lib/postgresql")
      );
    });
    expect(
      hostBindMounts,
      `host bind mounts for production data found: ${hostBindMounts.join("; ")}`
    ).toHaveLength(0);
  });

  it("does not use host networking", () => {
    expect(content).not.toMatch(/network_mode:\s*host/);
  });

  it("metrics bind to loopback/internal network only (no 0.0.0.0)", () => {
    const wildcardPatterns = ["0.0.0.0", '"::"', "[::]"];
    const metricsSection = content;
    for (const pat of wildcardPatterns) {
      expect(
        metricsSection,
        `metrics or any service binds to wildcard address: ${pat}`
      ).not.toContain(pat);
    }
  });

  it("Docker logs have bounded rotation (max-size and max-file)", () => {
    const services = content.split(/^  \w/m);
    for (const svc of services) {
      if (svc.includes("logging:")) {
        expect(svc).toContain("max-size");
        expect(svc).toContain("max-file");
      }
    }
  });

  it("uses internal network (not host)", () => {
    expect(content).toContain("internal:");
  });

  it("postgres uses the named volume kbju_pgdata", () => {
    const pgSection = content;
    expect(pgSection).toContain("kbju_pgdata:/var/lib/postgresql/data");
  });
});
