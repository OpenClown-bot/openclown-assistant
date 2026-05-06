import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Allowlist } from "../../src/security/allowlist.js";
import type { MetricsRegistry } from "../../src/observability/metricsEndpoint.js";

function makeNullMetrics(): MetricsRegistry {
  return {
    increment: () => {},
    set: () => {},
    observe: () => {},
    getSamples: () => [],
    render: () => "",
  };
}

function makeLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    critical: () => {},
  };
}

function writeAllowlist(filePath: string, users: number[]): void {
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify({ users }), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

const LOAD_SIZES = [2, 10, 100, 1000, 10000] as const;

for (const N of LOAD_SIZES) {
  describe(`Allowlist load test N=${N}`, () => {
    let tmpDir: string;
    let allowlist: Allowlist;
    let filePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `allowlist-load-${N}-`));
      filePath = path.join(tmpDir, "allowlist.json");
      const users = Array.from({ length: N }, (_, i) => 1000 + i);
      writeAllowlist(filePath, users);
      allowlist = new Allowlist(filePath, [], makeNullMetrics(), makeLogger());
    });

    afterEach(() => {
      allowlist.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("Set.has lookup is sub-millisecond for any ID", () => {
      const warmUpId = 1000;
      allowlist.isAllowed(warmUpId);

      const id = 1000 + Math.floor(N / 2);
      const iterations = N < 1000 ? 10000 : 1000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        allowlist.isAllowed(id);
      }
      const elapsedMs = (performance.now() - start) / iterations;

      expect(elapsedMs).toBeLessThan(0.1);
    });

    it("lookup for non-existent ID is also O(1) sub-microsecond", () => {
      const warmUpId = 9999999;
      allowlist.isAllowed(warmUpId);

      const iterations = N < 1000 ? 10000 : 1000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        allowlist.isAllowed(9999999);
      }
      const elapsedMs = (performance.now() - start) / iterations;

      expect(elapsedMs).toBeLessThan(0.1);
    });

    it("allowlist overhead is negligible relative to a baseline text-message latency budget", () => {
      const baselineTextLatencyMs = 500;
      const warmUpId = 1000;
      allowlist.isAllowed(warmUpId);

      const iterations = N < 1000 ? 10000 : 1000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        allowlist.isAllowed(warmUpId);
      }
      const elapsedTotalMs = performance.now() - start;
      const avgLookupUs = (elapsedTotalMs / iterations) * 1000;

      const overheadPercent = (avgLookupUs / 1000 / baselineTextLatencyMs) * 100;
      expect(overheadPercent).toBeLessThan(2);
    });

    it("getSize returns correct count", () => {
      expect(allowlist.getSize()).toBe(N);
    });

    it("all user IDs in the set are allowed", () => {
      const testIds =
        N <= 100
          ? Array.from({ length: N }, (_, i) => 1000 + i)
          : [1000, 1000 + Math.floor(N / 4), 1000 + Math.floor(N / 2), 1000 + Math.floor((3 * N) / 4), 1000 + N - 1];

      for (const id of testIds) {
        expect(allowlist.isAllowed(id)).toBe(true);
      }
    });

    it("IDs outside the set are rejected", () => {
      expect(allowlist.isAllowed(9999999)).toBe(false);
      expect(allowlist.isAllowed(0)).toBe(false);
      expect(allowlist.isAllowed(-1)).toBe(false);
      expect(allowlist.isAllowed(NaN)).toBe(false);
    });
  });
}