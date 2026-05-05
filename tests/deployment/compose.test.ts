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

  it("metrics METRICS_HOST is not a wildcard address", () => {
    expect(content).not.toMatch(/METRICS_HOST:\s*"0\.0\.0\.0"/);
    expect(content).not.toMatch(/METRICS_HOST:\s*"::"/);
    expect(content).not.toMatch(/METRICS_HOST:\s*"\[::\]"/);
    const hostMatch = content.match(/METRICS_HOST:\s*"([^"]+)"/);
    expect(hostMatch, "METRICS_HOST not found").not.toBeNull();
    const host = hostMatch![1];
    expect(
      host === "127.0.0.1" || host === "::1" || /^[a-zA-Z]/.test(host),
      `METRICS_HOST "${host}" is neither loopback nor Docker-internal hostname`
    ).toBe(true);
  });

  it("metrics healthcheck uses container-internal hostname, not loopback", () => {
    const healthcheckLine = content
      .split("\n")
      .find((l) => l.includes("healthz") && l.includes("metrics:9464"));
    expect(healthcheckLine, "no healthcheck line with metrics:9464 found").toBeDefined();
    expect(healthcheckLine!).toContain("http://metrics:9464/healthz");
  });

  it("kbju-sidecar service has a healthcheck using /kbju/health, not metrics port", () => {
    const sidecarStart = content.indexOf("  kbju-sidecar:");
    expect(sidecarStart).toBeGreaterThanOrEqual(0);

    const gatewayStart = content.indexOf("\n  openclaw-gateway:", sidecarStart + 1);
    const postgresStart = content.indexOf("\n  postgres:", sidecarStart + 1);
    const endBoundary =
      gatewayStart > sidecarStart && postgresStart > sidecarStart
        ? Math.min(gatewayStart, postgresStart)
        : Math.max(gatewayStart, postgresStart);

    const sidecarSection = content.substring(
      sidecarStart,
      endBoundary > sidecarStart ? endBoundary : content.length
    );
    expect(sidecarSection).not.toContain("9464/healthz");
    expect(sidecarSection).not.toContain("9464/metrics");
    expect(sidecarSection).toContain("/kbju/health");
    expect(sidecarSection).toContain("healthcheck:");
  });

  it("openclaw-gateway service exists and depends on kbju-sidecar", () => {
    expect(content).toContain("openclaw-gateway:");
    expect(content).toContain("KBJU_SIDECAR_URL");
  });
});

describe("Dockerfile", () => {
  const dockerfilePath = resolve(ROOT, "Dockerfile");
  const dockerfileContent = readFileSync(dockerfilePath, "utf-8");

  it("does not define image-level HEALTHCHECK", () => {
    expect(dockerfileContent).not.toContain("HEALTHCHECK");
  });
});
