import { describe, it, expect } from "vitest";
import {
  buildRedactedEvent,
  redactPii,
  type ObservabilityEvent,
} from "../../src/observability/events.js";
import {
  KPI_EVENT_NAMES,
  LOG_FORBIDDEN_FIELDS,
} from "../../src/observability/kpiEvents.js";
import type { ComponentId, MetricOutcome } from "../../src/shared/types.js";

describe("events redaction", () => {
  function makeEvent(
    extra: Record<string, unknown> = {}
  ): ObservabilityEvent {
    return buildRedactedEvent(
      "info",
      "kbju-meal-logging",
      "C4" as ComponentId,
      KPI_EVENT_NAMES.meal_content_received,
      "req-001",
      "user-uuid-001",
      "success" as MetricOutcome,
      false,
      extra
    );
  }

  it("redacts raw prompt text from log events", () => {
    const event = makeEvent({
      raw_prompt: "You are a KBJU assistant. Parse the following meal: курица с рисом",
    });
    expect(event.raw_prompt).toBe("[REDACTED]");
  });

  it("redacts raw transcript text from log events", () => {
    const event = makeEvent({
      raw_transcript: "Я съел борщ и хлеб на обед",
    });
    expect(event.raw_transcript).toBe("[REDACTED]");
  });

  it("redacts raw audio markers from log events", () => {
    const event = makeEvent({
      raw_audio: "voice_clip_001.ogg",
    });
    expect(event.raw_audio).toBe("[REDACTED]");
  });

  it("redacts raw photo markers from log events", () => {
    const event = makeEvent({
      raw_photo: "photo_001.jpg bytes=204800",
    });
    expect(event.raw_photo).toBe("[REDACTED]");
  });

  it("redacts Telegram bot token from log events", () => {
    const event = makeEvent({
      telegram_bot_token: "bot1234567890:AAH_gt4r3w2q1_pOiUyTrEwQ1234567890",
    });
    expect(event.telegram_bot_token).toBe("[REDACTED]");
  });

  it("redacts Telegram token patterns in string values via PII patterns", () => {
    const redacted = redactPii({
      detail: "error using bot1234567890:AAH_gt4r3w2q1_pOiUyTrEwQ1234567890 for send",
    });
    expect(redacted.detail).not.toContain("bot1234567890");
    expect(redacted.detail).toContain("[TELEGRAM_TOKEN_REDACTED]");
  });

  it("redacts provider keys from log events", () => {
    const event = makeEvent({
      provider_key: "sk-proj-abc123def456ghi789jkl012mno345",
    });
    expect(event.provider_key).toBe("[REDACTED]");
  });

  it("redacts OpenAI-style API key patterns in string values", () => {
    const redacted = redactPii({
      url: "Authorization: Bearer sk-proj-abc123def456ghi789jkl012mno345",
    });
    expect(redacted.url).toContain("[PROVIDER_KEY_REDACTED]");
    expect(redacted.url).not.toContain("sk-proj-abc123def456ghi789jkl012mno345");
  });

  it("redacts username from log events", () => {
    const event = makeEvent({
      username: "pilot_user_alice",
    });
    expect(event.username).toBe("[REDACTED]");
  });

  it("redacts first_name and last_name from log events", () => {
    const event = makeEvent({
      first_name: "Алиса",
      last_name: "Иванова",
    });
    expect(event.first_name).toBe("[REDACTED]");
    expect(event.last_name).toBe("[REDACTED]");
  });

  it("redacts provider_response_raw from log events", () => {
    const event = makeEvent({
      provider_response_raw: '{"choices":[{"message":{"content":"Курица 200г 330 ккал"}}]}',
    });
    expect(event.provider_response_raw).toBe("[REDACTED]");
  });

  it("redacts callback_payload_meal_text from log events", () => {
    const event = makeEvent({
      callback_payload_meal_text: "съел тарелку супа",
    });
    expect(event.callback_payload_meal_text).toBe("[REDACTED]");
  });

  it("preserves allowed fields in log events", () => {
    const event = makeEvent({
      component: "C4",
      latency_ms: 1200,
      outcome: "success",
      provider_alias: "omniroute",
      model_alias: "gpt-oss-120b",
    });
    expect(event.component).toBe("C4");
    expect(event.latency_ms).toBe(1200);
    expect(event.outcome).toBe("success");
    expect(event.provider_alias).toBe("omniroute");
    expect(event.model_alias).toBe("gpt-oss-120b");
  });

  it("produces events with required log fields per ARCH-001 §8.1", () => {
    const event = makeEvent();
    expect(event).toHaveProperty("timestamp_utc");
    expect(event).toHaveProperty("level");
    expect(event).toHaveProperty("service");
    expect(event).toHaveProperty("component");
    expect(event).toHaveProperty("event_name");
    expect(event).toHaveProperty("request_id");
    expect(event).toHaveProperty("user_id");
    expect(event).toHaveProperty("outcome");
    expect(event).toHaveProperty("degrade_mode_enabled");
    expect(event).toHaveProperty("schema_version");
  });

  it("never includes any forbidden field as a key in produced events", () => {
    const event = makeEvent({
      raw_prompt: "test",
      raw_transcript: "test",
      provider_key: "test",
      telegram_bot_token: "test",
    });

    for (const forbidden of LOG_FORBIDDEN_FIELDS) {
      if (forbidden in event) {
        expect(event[forbidden]).toBe("[REDACTED]");
      }
    }
  });

  it("redacts PII in nested objects", () => {
    const event = makeEvent({
      nested: {
        raw_prompt: "system prompt here",
        safe_field: "kept",
        deeper: {
          username: "alice",
        },
      },
    });
    expect((event.nested as Record<string, unknown>).raw_prompt).toBe("[REDACTED]");
    expect((event.nested as Record<string, unknown>).safe_field).toBe("kept");
    expect(((event.nested as Record<string, unknown>).deeper as Record<string, unknown>).username).toBe("[REDACTED]");
  });

  it("redacts PII in arrays", () => {
    const event = makeEvent({
      items: [
        { raw_transcript: "voice text", safe: "value" },
        { provider_key: "sk-abc123", safe: "value2" },
      ],
    });
    const items = event.items as Record<string, unknown>[];
    expect(items[0].raw_transcript).toBe("[REDACTED]");
    expect(items[0].safe).toBe("value");
    expect(items[1].provider_key).toBe("[REDACTED]");
    expect(items[1].safe).toBe("value2");
  });
});
