export const KPI_EVENT_NAMES = {
  meal_content_received: "meal_content_received",
  draft_reply_sent: "draft_reply_sent",
  voice_transcription_completed: "voice_transcription_completed",
  voice_transcription_failed: "voice_transcription_failed",
  photo_recognition_completed: "photo_recognition_completed",
  photo_recognition_failed: "photo_recognition_failed",
  meal_confirmed: "meal_confirmed",
  meal_abandoned: "meal_abandoned",
  summary_delivered: "summary_delivered",
  summary_recommendation_blocked: "summary_recommendation_blocked",
  provider_call_started: "provider_call_started",
  provider_call_finished: "provider_call_finished",
  budget_blocked: "budget_blocked",
  degrade_mode_enabled: "degrade_mode_enabled",
  po_alert_sent: "po_alert_sent",
  raw_media_delete_failed: "raw_media_delete_failed",
  raw_media_delete_succeeded: "raw_media_delete_succeeded",
  telegram_send_failed: "telegram_send_failed",
  right_to_delete_requested: "right_to_delete_requested",
  right_to_delete_completed: "right_to_delete_completed",
  skill_ready: "skill_ready",
  onboarding_started: "onboarding_started",
  forget_me_requested: "forget_me_requested",
  history_query: "history_query",
  callback_received: "callback_received",
} as const;

export type KpiEventName = (typeof KPI_EVENT_NAMES)[keyof typeof KPI_EVENT_NAMES];

export const PROMETHEUS_METRIC_NAMES = {
  kbju_updates_total: "kbju_updates_total",
  kbju_meal_draft_latency_ms: "kbju_meal_draft_latency_ms",
  kbju_meal_draft_latency_ms_sum: "kbju_meal_draft_latency_ms_sum",
  kbju_meal_draft_latency_ms_count: "kbju_meal_draft_latency_ms_count",
  kbju_meal_draft_latency_ms_bucket: "kbju_meal_draft_latency_ms_bucket",
  kbju_voice_roundtrip_latency_ms: "kbju_voice_roundtrip_latency_ms",
  kbju_voice_roundtrip_latency_ms_sum: "kbju_voice_roundtrip_latency_ms_sum",
  kbju_voice_roundtrip_latency_ms_count: "kbju_voice_roundtrip_latency_ms_count",
  kbju_voice_roundtrip_latency_ms_bucket: "kbju_voice_roundtrip_latency_ms_bucket",
  kbju_text_roundtrip_latency_ms: "kbju_text_roundtrip_latency_ms",
  kbju_text_roundtrip_latency_ms_sum: "kbju_text_roundtrip_latency_ms_sum",
  kbju_text_roundtrip_latency_ms_count: "kbju_text_roundtrip_latency_ms_count",
  kbju_text_roundtrip_latency_ms_bucket: "kbju_text_roundtrip_latency_ms_bucket",
  kbju_photo_roundtrip_latency_ms: "kbju_photo_roundtrip_latency_ms",
  kbju_photo_roundtrip_latency_ms_sum: "kbju_photo_roundtrip_latency_ms_sum",
  kbju_photo_roundtrip_latency_ms_count: "kbju_photo_roundtrip_latency_ms_count",
  kbju_photo_roundtrip_latency_ms_bucket: "kbju_photo_roundtrip_latency_ms_bucket",
  kbju_transcription_total: "kbju_transcription_total",
  kbju_estimation_total: "kbju_estimation_total",
  kbju_confirmation_total: "kbju_confirmation_total",
  kbju_confirmed_meals_total: "kbju_confirmed_meals_total",
  kbju_summary_delivery_total: "kbju_summary_delivery_total",
  kbju_provider_cost_usd_total: "kbju_provider_cost_usd_total",
  kbju_degrade_mode: "kbju_degrade_mode",
  kbju_manual_fallback_total: "kbju_manual_fallback_total",
  kbju_right_to_delete_total: "kbju_right_to_delete_total",
  kbju_raw_media_delete_failures_total: "kbju_raw_media_delete_failures_total",
  kbju_tenant_audit_cross_user_references: "kbju_tenant_audit_cross_user_references",
} as const;

export type PrometheusMetricName = (typeof PROMETHEUS_METRIC_NAMES)[keyof typeof PROMETHEUS_METRIC_NAMES];

export const ALLOWED_METRIC_LABELS: readonly string[] = [
  "component",
  "source",
  "period_type",
  "outcome",
  "provider_alias",
  "model_alias",
  "le",
] as const;

export type AllowedMetricLabel = (typeof ALLOWED_METRIC_LABELS)[number];

export const FORBIDDEN_METRIC_LABELS: readonly string[] = [
  "telegram_id",
  "user_id",
  "username",
  "meal_text",
  "error_text",
  "chat_id",
  "first_name",
  "last_name",
] as const;

export const LOG_SCHEMA_VERSION = "1";

export const LOG_REQUIRED_FIELDS: readonly string[] = [
  "timestamp_utc",
  "level",
  "service",
  "component",
  "event_name",
  "request_id",
  "user_id",
  "outcome",
  "degrade_mode_enabled",
  "schema_version",
] as const;

export const LOG_FORBIDDEN_FIELDS: readonly string[] = [
  "raw_prompt",
  "raw_transcript",
  "raw_audio",
  "raw_photo",
  "telegram_bot_token",
  "provider_key",
  "username",
  "first_name",
  "last_name",
  "callback_payload_meal_text",
  "provider_response_raw",
] as const;
