import type { ProviderAlias, OpenClawLogger } from "../shared/types.js";
import type { SpendTracker } from "../observability/costGuard.js";

export const MAX_VOICE_DURATION_SECONDS = 15;

export const VOICE_LATENCY_BUDGET_MS = 8000;

export const TRANSCRIPTION_TIMEOUT_MS = 7000;

export const TRANSCRIPTION_RETRY_DELAY_MS = 500;

export const WHISPER_MODEL_ALIAS = "whisper-v3-turbo";

export interface TranscriptionConfig {
  baseUrl: string;
  apiKey: string;
  modelAlias: string;
  languageHint: string;
  maxLatencyMs: number;
}

export interface AudioFileReader {
  (filePath: string): Promise<Uint8Array>;
}

export interface TranscriptionRequest {
  userId: string;
  requestId: string;
  telegramMessageId: string;
  audioFilePath: string;
  durationSeconds: number;
  degradeModeEnabled: boolean;
  logger: OpenClawLogger;
  spendTracker: SpendTracker;
  deleteAudioFile: () => Promise<void>;
  audioFileReader?: AudioFileReader;
}

export interface TranscriptionResult {
  providerAlias: ProviderAlias;
  modelAlias: string;
  transcriptText: string;
  confidence: number | null;
  estimatedCostUsd: number;
  outcome: TranscriptionOutcome;
  audioDeleted: boolean;
}

export type TranscriptionOutcome =
  | "success"
  | "duration_exceeded"
  | "provider_failure"
  | "budget_blocked"
  | "deletion_failed";

export interface VoiceFailureState {
  consecutiveFailures: number;
}
