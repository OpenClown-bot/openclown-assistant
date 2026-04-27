import { describe, it, expect } from "vitest";
import {
  createMetricsRegistry,
  createMetricsServer,
  renderMetricsToText,
  type MetricsRegistry,
} from "../../src/observability/metricsEndpoint.js";
import {
  PROMETHEUS_METRIC_NAMES,
  ALLOWED_METRIC_LABELS,
  FORBIDDEN_METRIC_LABELS,
} from "../../src/observability/kpiEvents.js";
import type { PrometheusMetricName } from "../../src/observability/kpiEvents.js";

describe("metricsEndpoint label policy", () => {
  let registry: MetricsRegistry;

  function getRenderedOutput(): string {
    return renderMetricsToText(registry);
  }

  it("output contains no Telegram ID in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      telegram_id: "123456789",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain("telegram_id");
    expect(output).not.toContain("123456789");
  });

  it("output contains no internal user_id in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      user_id: "uuid-abc-123",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain('user_id=');
    expect(output).not.toContain("uuid-abc-123");
  });

  it("output contains no username in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      username: "pilot_alice",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain("username");
    expect(output).not.toContain("pilot_alice");
  });

  it("output contains no meal text in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      meal_text: "курица с рисом",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain("meal_text");
    expect(output).not.toContain("курица");
  });

  it("output contains no free-form error text in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      error_text: "connection refused to database server at port 5432",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain("error_text");
    expect(output).not.toContain("connection refused");
  });

  it("output contains no chat_id in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      chat_id: "987654321",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain("chat_id");
  });

  it("output contains no first_name or last_name in metric labels", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      first_name: "Алиса",
      last_name: "Иванова",
    });
    const output = getRenderedOutput();
    expect(output).not.toContain("first_name");
    expect(output).not.toContain("last_name");
  });

  it("allows permitted labels: component, source, period_type, outcome, provider_alias, model_alias", () => {
    registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_updates_total, {
      component: "C4",
      source: "text",
      period_type: "daily",
      outcome: "success",
      provider_alias: "omniroute",
      model_alias: "gpt-oss-120b",
    });
    const output = getRenderedOutput();
    expect(output).toContain('component="C4"');
    expect(output).toContain('source="text"');
    expect(output).toContain('period_type="daily"');
    expect(output).toContain('outcome="success"');
    expect(output).toContain('provider_alias="omniroute"');
    expect(output).toContain('model_alias="gpt-oss-120b"');
  });
});

describe("metricsEndpoint metric names per ARCH-001 §8.2", () => {
  it("all required metric names from §8.2 are defined", () => {
    expect(PROMETHEUS_METRIC_NAMES.kbju_updates_total).toBe("kbju_updates_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_meal_draft_latency_ms).toBe("kbju_meal_draft_latency_ms");
    expect(PROMETHEUS_METRIC_NAMES.kbju_voice_roundtrip_latency_ms).toBe("kbju_voice_roundtrip_latency_ms");
    expect(PROMETHEUS_METRIC_NAMES.kbju_text_roundtrip_latency_ms).toBe("kbju_text_roundtrip_latency_ms");
    expect(PROMETHEUS_METRIC_NAMES.kbju_photo_roundtrip_latency_ms).toBe("kbju_photo_roundtrip_latency_ms");
    expect(PROMETHEUS_METRIC_NAMES.kbju_transcription_total).toBe("kbju_transcription_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_estimation_total).toBe("kbju_estimation_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_confirmation_total).toBe("kbju_confirmation_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_confirmed_meals_total).toBe("kbju_confirmed_meals_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_summary_delivery_total).toBe("kbju_summary_delivery_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_provider_cost_usd_total).toBe("kbju_provider_cost_usd_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_degrade_mode).toBe("kbju_degrade_mode");
    expect(PROMETHEUS_METRIC_NAMES.kbju_manual_fallback_total).toBe("kbju_manual_fallback_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_right_to_delete_total).toBe("kbju_right_to_delete_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_raw_media_delete_failures_total).toBe("kbju_raw_media_delete_failures_total");
    expect(PROMETHEUS_METRIC_NAMES.kbju_tenant_audit_cross_user_references).toBe("kbju_tenant_audit_cross_user_references");
  });

  it("renders counter metrics in Prometheus text format", () => {
    const registry = createMetricsRegistry();
    registry.increment(PROMETHEUS_METRIC_NAMES.kbju_confirmed_meals_total, {
      component: "C4",
      outcome: "success",
    });
    const output = renderMetricsToText(registry);
    expect(output).toContain("# TYPE kbju_confirmed_meals_total counter");
    expect(output).toContain("kbju_confirmed_meals_total");
  });

  it("renders gauge metrics in Prometheus text format", () => {
    const registry = createMetricsRegistry();
    registry.set(PROMETHEUS_METRIC_NAMES.kbju_degrade_mode, {
      component: "C10",
    }, 1);
    const output = renderMetricsToText(registry);
    expect(output).toContain("# TYPE kbju_degrade_mode gauge");
    expect(output).toContain("kbju_degrade_mode");
  });
});

describe("metricsEndpoint server factory", () => {
  it("rejects 0.0.0.0 as host per ARCH-001 §8.2 and §7", () => {
    expect(() => createMetricsServer("0.0.0.0", 9464)).toThrow(
      /0\.0\.0\.0 is forbidden/
    );
  });

  it("rejects empty string as host", () => {
    expect(() => createMetricsServer("", 9464)).toThrow();
  });

  it("accepts 127.0.0.1 as host", () => {
    const server = createMetricsServer("127.0.0.1", 9464);
    expect(server).toBeDefined();
    expect(server.registry).toBeDefined();
  });

  it("accepts Docker-internal hostnames", () => {
    const server = createMetricsServer("kbju-metrics-internal", 9464);
    expect(server).toBeDefined();
  });
});

describe("metricsEndpoint forbidden labels list", () => {
  it("includes all PII-sensitive label names per ARCH-001 §8.2", () => {
    expect(FORBIDDEN_METRIC_LABELS).toContain("telegram_id");
    expect(FORBIDDEN_METRIC_LABELS).toContain("user_id");
    expect(FORBIDDEN_METRIC_LABELS).toContain("username");
    expect(FORBIDDEN_METRIC_LABELS).toContain("meal_text");
    expect(FORBIDDEN_METRIC_LABELS).toContain("error_text");
    expect(FORBIDDEN_METRIC_LABELS).toContain("chat_id");
  });

  it("allowed labels are exactly the set from ARCH-001 §8.2", () => {
    expect(ALLOWED_METRIC_LABELS).toContain("component");
    expect(ALLOWED_METRIC_LABELS).toContain("source");
    expect(ALLOWED_METRIC_LABELS).toContain("period_type");
    expect(ALLOWED_METRIC_LABELS).toContain("outcome");
    expect(ALLOWED_METRIC_LABELS).toContain("provider_alias");
    expect(ALLOWED_METRIC_LABELS).toContain("model_alias");
  });
});
