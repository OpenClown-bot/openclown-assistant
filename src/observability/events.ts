import type { OpenClawLogger } from "../shared/types.js";
import type { ComponentId, MetricOutcome } from "../shared/types.js";
import {
  LOG_SCHEMA_VERSION,
  LOG_FORBIDDEN_FIELDS,
  type KpiEventName,
} from "./kpiEvents.js";

type LogLevel = "info" | "warn" | "error" | "critical";

export interface ObservabilityEvent {
  timestamp_utc: string;
  level: LogLevel;
  service: string;
  component: ComponentId;
  event_name: KpiEventName | string;
  request_id: string;
  user_id: string;
  outcome: MetricOutcome | string;
  degrade_mode_enabled: boolean;
  schema_version: string;
  telegram_message_id_hash?: string;
  source?: string;
  latency_ms?: number;
  provider_alias?: string;
  model_alias?: string;
  estimated_cost_usd?: number;
  error_code?: string;
  [key: string]: unknown;
}

const PII_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b\d{8,10}:\S{30,}\b/g, "[TELEGRAM_TOKEN_REDACTED]"],
  [/bot\d{8,10}:[A-Za-z0-9_-]{30,}/g, "[TELEGRAM_TOKEN_REDACTED]"],
  [/sk-[A-Za-z0-9]{20,}/g, "[PROVIDER_KEY_REDACTED]"],
  [/Bearer\s+[A-Za-z0-9._-]+/gi, "[PROVIDER_KEY_REDACTED]"],
  [/API_KEY[=:]\s*\S+/gi, "[PROVIDER_KEY_REDACTED]"],
  [/audio_duration_seconds.*?raw_audio/g, "[AUDIO_MARKER_REDACTED]"],
  [/raw_audio.*?(bytes|clip|file)/gi, "[AUDIO_MARKER_REDACTED]"],
  [/raw_photo.*?(bytes|file|image)/gi, "[PHOTO_MARKER_REDACTED]"],
];

const FORBIDDEN_KEY_SUBSTRINGS: readonly string[] = [
  "raw_prompt",
  "raw_transcript",
  "raw_audio",
  "raw_photo",
  "telegram_bot_token",
  "provider_key",
  "provider_response_raw",
  "callback_payload_meal_text",
  "first_name",
  "last_name",
  "username",
];

function redactStringValues(value: string): string {
  let result = value;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function hasForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_SUBSTRINGS.some(
    (forbidden) => lower === forbidden || lower.includes(forbidden)
  );
}

export function redactPii(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (hasForbiddenKey(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") {
      result[key] = redactStringValues(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? redactStringValues(item)
          : item !== null && typeof item === "object"
            ? redactPii(item as Record<string, unknown>)
            : item
      );
    } else if (value !== null && typeof value === "object") {
      result[key] = redactPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildLogEvent(params: {
  level: LogLevel;
  service: string;
  component: ComponentId;
  eventName: KpiEventName | string;
  requestId: string;
  userId: string;
  outcome: MetricOutcome | string;
  degradeModeEnabled: boolean;
  extra?: Record<string, unknown>;
}): ObservabilityEvent {
  const event: ObservabilityEvent = {
    timestamp_utc: new Date().toISOString(),
    level: params.level,
    service: params.service,
    component: params.component,
    event_name: params.eventName,
    request_id: params.requestId,
    user_id: params.userId,
    outcome: params.outcome,
    degrade_mode_enabled: params.degradeModeEnabled,
    schema_version: LOG_SCHEMA_VERSION,
  };

  if (params.extra) {
    const redactedExtra = redactPii(params.extra);
    for (const [key, value] of Object.entries(redactedExtra)) {
      event[key] = value;
    }
  }

  for (const forbidden of LOG_FORBIDDEN_FIELDS) {
    if (forbidden in event && event[forbidden] !== "[REDACTED]") {
      event[forbidden] = "[REDACTED]";
    }
  }

  return event;
}

export function emitLog(
  logger: OpenClawLogger,
  event: ObservabilityEvent
): void {
  const { level } = event;
  const message = `${event.component}:${event.event_name}`;
  const meta: Record<string, unknown> = { ...event };
  delete (meta as Record<string, unknown>).level;

  switch (level) {
    case "critical":
      logger.critical(message, meta);
      break;
    case "error":
      logger.error(message, meta);
      break;
    case "warn":
      logger.warn(message, meta);
      break;
    default:
      logger.info(message, meta);
  }
}

export function buildRedactedEvent(
  level: LogLevel,
  service: string,
  component: ComponentId,
  eventName: KpiEventName | string,
  requestId: string,
  userId: string,
  outcome: MetricOutcome | string,
  degradeModeEnabled: boolean,
  extra?: Record<string, unknown>
): ObservabilityEvent {
  return buildLogEvent({
    level,
    service,
    component,
    eventName,
    requestId,
    userId,
    outcome,
    degradeModeEnabled,
    extra,
  });
}
