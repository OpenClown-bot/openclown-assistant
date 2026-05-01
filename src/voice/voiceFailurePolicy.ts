export const MSG_VOICE_TEXT_FALLBACK = "Не расслышал, напиши текстом.";

export const VOICE_FAILURE_ACTION_TEXT_FALLBACK = "text_fallback" as const;
export const VOICE_FAILURE_ACTION_MANUAL_ENTRY = "manual_entry" as const;

export type VoiceFailureAction =
  | typeof VOICE_FAILURE_ACTION_TEXT_FALLBACK
  | typeof VOICE_FAILURE_ACTION_MANUAL_ENTRY;

export function resolveFailureAction(
  consecutiveFailures: number
): VoiceFailureAction {
  if (consecutiveFailures >= 2) {
    return VOICE_FAILURE_ACTION_MANUAL_ENTRY;
  }
  return VOICE_FAILURE_ACTION_TEXT_FALLBACK;
}

export function getFailureMessage(consecutiveFailures: number): string {
  return MSG_VOICE_TEXT_FALLBACK;
}

export function advanceFailureState(
  currentState: { consecutiveFailures: number },
  transcriptionSucceeded: boolean
): { consecutiveFailures: number } {
  if (transcriptionSucceeded) {
    return { consecutiveFailures: 0 };
  }
  return { consecutiveFailures: currentState.consecutiveFailures + 1 };
}
