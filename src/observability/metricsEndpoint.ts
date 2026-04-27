import http from "node:http";
import {
  PROMETHEUS_METRIC_NAMES,
  ALLOWED_METRIC_LABELS,
  FORBIDDEN_METRIC_LABELS,
  type PrometheusMetricName,
} from "./kpiEvents.js";

export type MetricType = "counter" | "gauge" | "histogram";

export interface MetricSample {
  name: PrometheusMetricName;
  type: MetricType;
  help: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricsRegistry {
  increment(name: PrometheusMetricName, labels?: Record<string, string>, delta?: number): void;
  set(name: PrometheusMetricName, labels: Record<string, string>, value: number): void;
  observe(name: PrometheusMetricName, labels: Record<string, string>, valueMs: number): void;
  getSamples(): MetricSample[];
  render(): string;
}

function validateLabels(labels: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    const isAllowed = (ALLOWED_METRIC_LABELS as readonly string[]).includes(key);
    const isForbidden = (FORBIDDEN_METRIC_LABELS as readonly string[]).some(
      (f) => key === f || key.toLowerCase().includes(f)
    );
    if (!isAllowed || isForbidden) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function sanitizeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  const pairs = entries.map(
    ([k, v]) => `${k}="${sanitizeLabelValue(v)}"`
  );
  return `{${pairs.join(",")}}`;
}

export function createMetricsRegistry(): MetricsRegistry {
  const counters = new Map<string, number>();
  const gauges = new Map<string, number>();
  const histograms = new Map<string, number[]>();

  function key(name: string, labels: Record<string, string>): string {
    const safeLabels = validateLabels(labels);
    const labelStr = formatLabels(safeLabels);
    return `${name}${labelStr}`;
  }

  return {
    increment(name, labels = {}, delta = 1) {
      const k = key(name, labels);
      counters.set(k, (counters.get(k) ?? 0) + delta);
    },

    set(name, labels, value) {
      const k = key(name, labels);
      gauges.set(k, value);
    },

    observe(name, labels, valueMs) {
      const k = key(name, labels);
      const bucket = histograms.get(k) ?? [];
      bucket.push(valueMs);
      histograms.set(k, bucket);
    },

    getSamples() {
      const samples: MetricSample[] = [];

      for (const [k, v] of counters) {
        const { name, labels } = parseKey(k);
        samples.push({ name, type: "counter", help: "", value: v, labels });
      }

      for (const [k, v] of gauges) {
        const { name, labels } = parseKey(k);
        samples.push({ name, type: "gauge", help: "", value: v, labels });
      }

      for (const [k, observations] of histograms) {
        const { name, labels } = parseKey(k);
        const sum = observations.reduce((a, b) => a + b, 0);
        const count = observations.length;
        samples.push({ name, type: "histogram", help: "", value: sum, labels });
        const countKey = key(name + "_count", labels);
        samples.push({
          name: name as PrometheusMetricName,
          type: "counter",
          help: "",
          value: count,
          labels,
        });
      }

      return samples;
    },

    render() {
      const lines: string[] = [];
      const seen = new Set<string>();

      const samples = this.getSamples();

      for (const sample of samples) {
        const name = sample.name as string;
        if (!seen.has(name)) {
          seen.add(name);
          lines.push(`# HELP ${name} ${name}`);
          lines.push(`# TYPE ${name} ${sample.type}`);
        }
        const labelStr = formatLabels(validateLabels(sample.labels));
        lines.push(`${name}${labelStr} ${sample.value}`);
      }

      return lines.join("\n") + "\n";
    },
  };
}

function parseKey(k: string): { name: PrometheusMetricName; labels: Record<string, string> } {
  const braceIdx = k.indexOf("{");
  if (braceIdx === -1) {
    return { name: k as PrometheusMetricName, labels: {} };
  }
  const name = k.substring(0, braceIdx) as PrometheusMetricName;
  const labelsStr = k.substring(braceIdx + 1, k.length - 1);
  const labels: Record<string, string> = {};
  if (labelsStr) {
    for (const pair of labelsStr.split(",")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const lKey = pair.substring(0, eqIdx).trim();
      const lVal = pair.substring(eqIdx + 2, pair.length - 1);
      labels[lKey] = lVal;
    }
  }
  return { name, labels };
}

export interface MetricsServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registry: MetricsRegistry;
  address(): string;
}

export function createMetricsServer(
  host: string,
  port: number
): MetricsServer {
  if (!host || host === "0.0.0.0") {
    throw new Error(
      "Metrics server must bind to an explicit loopback or internal host; 0.0.0.0 is forbidden per ARCH-001@0.2.0 §8.2"
    );
  }

  const registry = createMetricsRegistry();
  let server: http.Server | null = null;

  return {
    registry,

    async start() {
      server = http.createServer((req, res) => {
        if (req.url === "/metrics" && req.method === "GET") {
          const body = registry.render();
          res.writeHead(200, {
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          });
          res.end(body);
        } else {
          res.writeHead(404);
          res.end("Not Found\n");
        }
      });

      await new Promise<void>((resolve, reject) => {
        if (!server) {
          reject(new Error("Server not initialized"));
          return;
        }
        server.listen(port, host, () => resolve());
      });
    },

    async stop() {
      if (!server) return;
      await new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((err) => (err ? reject(err) : resolve()));
      });
      server = null;
    },

    address() {
      if (!server) return "";
      const addr = server.address();
      if (typeof addr === "string") return addr;
      if (addr) return `${addr.address}:${addr.port}`;
      return "";
    },
  };
}

export function renderMetricsToText(registry: MetricsRegistry): string {
  return registry.render();
}
