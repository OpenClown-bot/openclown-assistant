import { describe, it, expect } from "vitest";
import {
  resolveFailureAction,
  getFailureMessage,
  advanceFailureState,
  MSG_VOICE_TEXT_FALLBACK,
  VOICE_FAILURE_ACTION_TEXT_FALLBACK,
  VOICE_FAILURE_ACTION_MANUAL_ENTRY,
} from "../../src/voice/voiceFailurePolicy.js";

describe("resolveFailureAction", () => {
  it("returns text_fallback on first consecutive failure", () => {
    expect(resolveFailureAction(1)).toBe(VOICE_FAILURE_ACTION_TEXT_FALLBACK);
  });

  it("returns manual_entry on second consecutive failure", () => {
    expect(resolveFailureAction(2)).toBe(VOICE_FAILURE_ACTION_MANUAL_ENTRY);
  });

  it("returns manual_entry on third consecutive failure", () => {
    expect(resolveFailureAction(3)).toBe(VOICE_FAILURE_ACTION_MANUAL_ENTRY);
  });

  it("returns text_fallback on zero consecutive failures", () => {
    expect(resolveFailureAction(0)).toBe(VOICE_FAILURE_ACTION_TEXT_FALLBACK);
  });
});

describe("getFailureMessage", () => {
  it("returns MSG_VOICE_TEXT_FALLBACK for first failure", () => {
    expect(getFailureMessage(1)).toBe(MSG_VOICE_TEXT_FALLBACK);
  });

  it("returns MSG_VOICE_TEXT_FALLBACK for second failure", () => {
    expect(getFailureMessage(2)).toBe(MSG_VOICE_TEXT_FALLBACK);
  });
});

describe("advanceFailureState", () => {
  it("resets to 0 on transcription success", () => {
    const result = advanceFailureState(
      { consecutiveFailures: 3 },
      true
    );
    expect(result.consecutiveFailures).toBe(0);
  });

  it("increments on transcription failure", () => {
    const result = advanceFailureState(
      { consecutiveFailures: 0 },
      false
    );
    expect(result.consecutiveFailures).toBe(1);
  });

  it("increments from 1 to 2 on consecutive failure", () => {
    const result = advanceFailureState(
      { consecutiveFailures: 1 },
      false
    );
    expect(result.consecutiveFailures).toBe(2);
  });

  it("resets from any count on success", () => {
    const result = advanceFailureState(
      { consecutiveFailures: 5 },
      true
    );
    expect(result.consecutiveFailures).toBe(0);
  });
});
