import { readFile } from "node:fs/promises";
import type { ProviderAlias } from "../shared/types.js";
import type { PreflightResult } from "../observability/costGuard.js";
import { buildRedactedEvent, emitLog } from "../observability/events.js";
import { KPI_EVENT_NAMES } from "../observability/kpiEvents.js";
import { MSG_VOICE_TOO_LONG } from "../telegram/messages.js";
import {
  MAX_VOICE_DURATION_SECONDS,
  TRANSCRIPTION_TIMEOUT_MS,
  TRANSCRIPTION_RETRY_DELAY_MS,
  type TranscriptionConfig,
  type TranscriptionRequest,
  type TranscriptionResult,
} from "./types.js";

async function defaultAudioFileReader(filePath: string): Promise<Uint8Array> {
  const buffer = await readFile(filePath);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

interface InternalAttemptResult extends TranscriptionResult {
  retryable: boolean;
}

export class DurationExceededError extends Error {
  public readonly durationSeconds: number;
  public readonly maxDurationSeconds: number;

  constructor(durationSeconds: number) {
    super(
      `Voice duration ${durationSeconds}s exceeds maximum ${MAX_VOICE_DURATION_SECONDS}s`
    );
    this.name = "DurationExceededError";
    this.durationSeconds = durationSeconds;
    this.maxDurationSeconds = MAX_VOICE_DURATION_SECONDS;
  }
}

export async function transcribeVoice(
  config: TranscriptionConfig,
  request: TranscriptionRequest
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const readAudio = request.audioFileReader ?? defaultAudioFileReader;

  if (request.durationSeconds > MAX_VOICE_DURATION_SECONDS) {
    emitLog(
      request.logger,
      buildRedactedEvent(
        "info",
        "kbju-meal-logging",
        "C5",
        KPI_EVENT_NAMES.voice_transcription_failed,
        request.requestId,
        request.userId,
        "user_fallback",
        request.degradeModeEnabled,
        {
          provider_alias: config.providerAlias,
          duration_seconds: request.durationSeconds,
        }
      )
    );

    await safeDeleteAudio(request, config.providerAlias);

    return {
      providerAlias: config.providerAlias,
      modelAlias: config.modelAlias,
      transcriptText: MSG_VOICE_TOO_LONG,
      confidence: null,
      estimatedCostUsd: 0,
      outcome: "duration_exceeded",
      audioDeleted: true,
    };
  }

  const preflight = await request.spendTracker.preflightCheck("transcription");
  if (!preflight.allowed) {
    emitLog(
      request.logger,
      buildRedactedEvent(
        "warn",
        "kbju-meal-logging",
        "C5",
        KPI_EVENT_NAMES.budget_blocked,
        request.requestId,
        request.userId,
        "budget_blocked",
        request.degradeModeEnabled,
        {
          call_type: "transcription",
          estimated_cost_usd: preflight.estimatedCallCostUsd,
          provider_alias: config.providerAlias,
        }
      )
    );

    await safeDeleteAudio(request, config.providerAlias);

    return {
      providerAlias: config.providerAlias,
      modelAlias: config.modelAlias,
      transcriptText: "",
      confidence: null,
      estimatedCostUsd: 0,
      outcome: "budget_blocked",
      audioDeleted: true,
    };
  }

  emitLog(
    request.logger,
    buildRedactedEvent(
      "info",
      "kbju-meal-logging",
      "C5",
      KPI_EVENT_NAMES.provider_call_started,
      request.requestId,
      request.userId,
      "success",
      request.degradeModeEnabled,
      {
        call_type: "transcription",
        provider_alias: config.providerAlias,
        model_alias: config.modelAlias,
      }
    )
  );

  const firstAttempt = await attemptTranscription(
    config,
    request,
    preflight,
    startTime,
    readAudio
  );

  if (firstAttempt.outcome === "success") {
    return firstAttempt;
  }

  if (
    firstAttempt.retryable &&
    isWithinLatencyBudget(startTime, config.maxLatencyMs)
  ) {
    await new Promise<void>((r) =>
      setTimeout(r, TRANSCRIPTION_RETRY_DELAY_MS)
    );

    if (!isWithinLatencyBudget(startTime, config.maxLatencyMs)) {
      await safeDeleteAudio(request, config.providerAlias);
      return stripRetryable(firstAttempt, true);
    }

    const retryAttempt = await attemptTranscription(
      config,
      request,
      preflight,
      startTime,
      readAudio
    );
    if (retryAttempt.outcome === "success") {
      return retryAttempt;
    }
  }

  await safeDeleteAudio(request, config.providerAlias);
  return stripRetryable(firstAttempt, true);
}

function stripRetryable(
  result: InternalAttemptResult,
  audioDeleted: boolean
): TranscriptionResult {
  return {
    providerAlias: result.providerAlias,
    modelAlias: result.modelAlias,
    transcriptText: result.transcriptText,
    confidence: result.confidence,
    estimatedCostUsd: result.estimatedCostUsd,
    outcome: result.outcome,
    audioDeleted,
  };
}

function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

async function attemptTranscription(
  config: TranscriptionConfig,
  request: TranscriptionRequest,
  preflight: PreflightResult,
  startTime: number,
  readAudio: (filePath: string) => Promise<Uint8Array>
): Promise<InternalAttemptResult> {
  try {
    const audioBytes = await readAudio(request.audioFilePath);
    const audioBlob = new Blob([new Uint8Array(audioBytes)]);

    const formData = new FormData();
    formData.append("file", audioBlob, "voice.ogg");
    formData.append("model", config.modelAlias);
    formData.append("language", config.languageHint);
    formData.append("response_format", "json");

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      TRANSCRIPTION_TIMEOUT_MS
    );

    const httpResponse = await fetch(
      `${config.baseUrl}/v1/audio/transcriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (!httpResponse.ok) {
      const retryable = isRetryableHttpStatus(httpResponse.status);

      emitLog(
        request.logger,
        buildRedactedEvent(
          "warn",
          "kbju-meal-logging",
          "C5",
          KPI_EVENT_NAMES.provider_call_finished,
          request.requestId,
          request.userId,
          "provider_failure",
          request.degradeModeEnabled,
          {
            call_type: "transcription",
            provider_alias: config.providerAlias,
            model_alias: config.modelAlias,
            error_code: `http_${httpResponse.status}`,
          }
        )
      );

      return {
        providerAlias: config.providerAlias,
        modelAlias: config.modelAlias,
        transcriptText: "",
        confidence: null,
        estimatedCostUsd: preflight.estimatedCallCostUsd,
        outcome: "provider_failure",
        audioDeleted: false,
        retryable,
      };
    }

    const json = (await httpResponse.json()) as {
      text?: string;
      confidence?: number;
    };

    const transcriptText = json.text ?? "";
    const confidence =
      typeof json.confidence === "number" ? json.confidence : null;

    const deletionOk = await safeDeleteAudio(request, config.providerAlias);

    await request.spendTracker.recordCostAndCheckBudget(
      preflight.estimatedCallCostUsd,
      false
    );

    const latencyMs = Date.now() - startTime;

    emitLog(
      request.logger,
      buildRedactedEvent(
        "info",
        "kbju-meal-logging",
        "C5",
        KPI_EVENT_NAMES.voice_transcription_completed,
        request.requestId,
        request.userId,
        "success",
        request.degradeModeEnabled,
        {
          call_type: "transcription",
          provider_alias: config.providerAlias,
          model_alias: config.modelAlias,
          estimated_cost_usd: preflight.estimatedCallCostUsd,
          latency_ms: latencyMs,
        }
      )
    );

    return {
      providerAlias: config.providerAlias,
      modelAlias: config.modelAlias,
      transcriptText,
      confidence,
      estimatedCostUsd: preflight.estimatedCallCostUsd,
      outcome: "success",
      audioDeleted: deletionOk,
      retryable: false,
    };
  } catch (error) {
    const errorCode =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : "fetch_error";

    emitLog(
      request.logger,
      buildRedactedEvent(
        "warn",
        "kbju-meal-logging",
        "C5",
        KPI_EVENT_NAMES.provider_call_finished,
        request.requestId,
        request.userId,
        "provider_failure",
        request.degradeModeEnabled,
        {
          call_type: "transcription",
          provider_alias: config.providerAlias,
          model_alias: config.modelAlias,
          error_code: errorCode,
        }
      )
    );

    return {
      providerAlias: config.providerAlias,
      modelAlias: config.modelAlias,
      transcriptText: "",
      confidence: null,
      estimatedCostUsd: preflight.estimatedCallCostUsd,
      outcome: "provider_failure",
      audioDeleted: false,
      retryable: true,
    };
  }
}

function isWithinLatencyBudget(
  startTime: number,
  maxLatencyMs: number
): boolean {
  return Date.now() - startTime < maxLatencyMs;
}

async function safeDeleteAudio(
  request: TranscriptionRequest,
  providerAlias: ProviderAlias
): Promise<boolean> {
  try {
    await request.deleteAudioFile();
    return true;
  } catch {
    emitLog(
      request.logger,
      buildRedactedEvent(
        "critical",
        "kbju-meal-logging",
        "C5",
        KPI_EVENT_NAMES.raw_media_delete_failed,
        request.requestId,
        request.userId,
        "provider_failure",
        request.degradeModeEnabled,
        {
          call_type: "transcription",
          provider_alias: providerAlias,
        }
      )
    );
    return false;
  }
}
