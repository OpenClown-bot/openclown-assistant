import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const COMPOSE_PATH = resolve(ROOT, "docker-compose.yml");

function readCompose(): string {
  return readFileSync(COMPOSE_PATH, "utf-8");
}

describe("docker-compose.yml", () => {
  const content = readCompose();

  it("exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it("uses named volumes for PostgreSQL (kbju_pgdata)", () => {
    expect(content).toContain("kbju_pgdata:");
  });

  it("uses named volumes for OpenClaw state (openclaw_state)", () => {
    expect(content).toContain("openclaw_state:");
  });

  it("mounts openclaw_state into a service", () => {
    expect(content).toMatch(/openclaw_state:\/[^\s]+/);
  });

  it("does not use host bind mounts for production data", () => {
    const lines = content.split("\n");
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

  it("metrics service binds to host loopback only via ports", () => {
    expect(content).toMatch(/127\.0\.0\.1:9464:9464/);
  });

  it("does not expose metrics on wildcard host addresses", () => {
    const portLines = content
      .split("\n")
      .filter((l) => l.trim().startsWith("- ") && l.includes(":9464"));
    for (const line of portLines) {
      expect(line, `wildcard port mapping found: ${line}`).not.toMatch(
        /-\s*"0\.0\.0\.0:9464/
      );
      expect(line, `wildcard port mapping found: ${line}`).not.toMatch(/-\s*":::9464/);
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
    expect(content).toContain("kbju_pgdata:/var/lib/postgresql/data");
  });

  it("metrics service has a healthcheck querying /healthz", () => {
    expect(content).toMatch(/metrics:[\s\S]*healthcheck:[\s\S]*\/healthz/);
  });

  it("app service does not inherit a metrics-port healthcheck", () => {
    const appMatch = content.match(/^  app:[\s\S]*?(?=\n  \w|(?<!\n)$)/m);
    expect(appMatch, "app service section not found").not.toBeNull();
    const appSection = appMatch![0];
    expect(appSection).not.toContain("9464/healthz");
    expect(appSection).not.toContain("9464/metrics");
  });
});

describe("Dockerfile", () => {
  const dockerfilePath = resolve(ROOT, "Dockerfile");
  const dockerfileContent = readFileSync(dockerfilePath, "utf-8");

  it("does not define image-level HEALTHCHECK", () => {
    expect(dockerfileContent).not.toContain("HEALTHCHECK");
  });
});
