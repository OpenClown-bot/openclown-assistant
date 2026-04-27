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

  it("drops raw prompt text from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      raw_prompt: "You are a KBJU assistant",
    });
    expect(event.raw_prompt).toBeUndefined();
  });

  it("drops raw transcript text from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      raw_transcript: "some transcript",
    });
    expect(event.raw_transcript).toBeUndefined();
  });

  it("drops raw audio markers from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      raw_audio: "voice_clip_001.ogg",
    });
    expect(event.raw_audio).toBeUndefined();
  });

  it("drops raw photo markers from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      raw_photo: "photo_001.jpg bytes=204800",
    });
    expect(event.raw_photo).toBeUndefined();
  });

  it("drops Telegram bot token from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      telegram_bot_token: "bot1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(event.telegram_bot_token).toBeUndefined();
  });

  it("drops provider key from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      provider_key: "sk-abc1234567890def1234567890",
    });
    expect(event.provider_key).toBeUndefined();
  });

  it("drops provider_response_raw from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      provider_response_raw: '{"choices":[{"message":{"content":"hello"}}]}',
    });
    expect(event.provider_response_raw).toBeUndefined();
  });

  it("drops callback_payload_meal_text from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      callback_payload_meal_text: "borscht",
    });
    expect(event.callback_payload_meal_text).toBeUndefined();
  });

  it("drops first_name and last_name from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      first_name: "Ivan",
      last_name: "Ivanov",
    });
    expect(event.first_name).toBeUndefined();
    expect(event.last_name).toBeUndefined();
  });

  it("drops username from log events (F-M1 allowlist)", () => {
    const event = makeEvent({
      username: "ivan_pilot",
    });
    expect(event.username).toBeUndefined();
  });

  it("redacts Telegram token patterns in allowed-key string values via PII patterns", () => {
    const redacted = redactPii({
      error_code: "error using bot1234567890:AAH_gt4r3w2q1_pOiUyTrEwQ1234567890 for send",
    });
    expect(redacted.error_code).not.toContain("bot1234567890");
    expect(redacted.error_code).toContain("[TELEGRAM_TOKEN_REDACTED]");
  });

  it("drops provider_key key entirely (F-M1 allowlist)", () => {
    const event = makeEvent({
      provider_key: "sk-proj-abc123def456ghi789jkl012mno345",
    });
    expect(event.provider_key).toBeUndefined();
  });

  it("redacts API key patterns in allowed-key string values", () => {
    const redacted = redactPii({
      error_code: "Authorization: Bearer sk-proj-abc123def456ghi789jkl012mno345",
    });
    expect(redacted.error_code).toContain("[PROVIDER_KEY_REDACTED]");
    expect(redacted.error_code).not.toContain("sk-proj-abc123");
  });

  it("drops telegram_chat_id from extra (F-M1 allowlist)", () => {
    const event = makeEvent({
      telegram_chat_id: "123",
    });
    expect(event.telegram_chat_id).toBeUndefined();
  });

  it("extra does not overwrite core event properties (D-I1)", () => {
    const event = makeEvent({
      timestamp_utc: "fake-timestamp",
    });
    expect(event.timestamp_utc).not.toBe("fake-timestamp");
  });

  it("allows permitted extra keys through allowlist", () => {
    const event = makeEvent({
      call_type: "text_llm",
      model_alias: "gpt-oss-120b",
      estimated_cost_usd: 0.001,
    });
    expect(event.call_type).toBe("text_llm");
    expect(event.model_alias).toBe("gpt-oss-120b");
    expect(event.estimated_cost_usd).toBe(0.001);
  });

  it("preserves all LOG_FORBIDDEN_FIELDS as a safety net", () => {
    expect(LOG_FORBIDDEN_FIELDS.length).toBeGreaterThan(0);
  });
});
