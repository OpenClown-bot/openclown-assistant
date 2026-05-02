import http from "node:http";

const METRICS_HOST = process.env.METRICS_HOST ?? "127.0.0.1";
const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9464);

export interface HealthCheckResult {
  readonly status: "ok" | "unhealthy";
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

const startTime = Date.now();

export function healthCheck(): boolean {
  return true;
}

export function getHealthStatus(): HealthCheckResult {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  };
}

export function startMetricsServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === "/metrics" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
      res.end("# KBJU Coach metrics endpoint\nkbju_health_check_status 1\n");
    } else if (req.url === "/healthz" && req.method === "GET") {
      const status = getHealthStatus();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(status));
    } else {
      res.writeHead(404);
      res.end("Not Found\n");
    }
  });

  if (
    METRICS_HOST === "0.0.0.0" ||
    METRICS_HOST === "::" ||
    METRICS_HOST === "[::]" ||
    METRICS_HOST === "::ffff:0.0.0.0"
  ) {
    console.error(
      "Metrics server must bind to loopback or internal host; wildcard addresses forbidden per ARCH-001@0.3.0 §8.2"
    );
    process.exit(1);
  }

  server.listen(METRICS_PORT, METRICS_HOST, () => {
    console.log(`Metrics server listening on ${METRICS_HOST}:${METRICS_PORT}`);
  });
}
