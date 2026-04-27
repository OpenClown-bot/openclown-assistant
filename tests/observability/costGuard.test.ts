import { describe, it, expect } from "vitest";
import {
  MONTHLY_SPEND_CEILING_USD,
  worstCaseCostForCall,
  shouldDegrade,
  shouldSuppressPoAlert,
  WORST_CASE_PRICES,
} from "../../src/observability/costGuard.js";
import type { CallType } from "../../src/shared/types.js";

describe("costGuard worst-case prices", () => {
  it("returns a non-zero cost for text_llm per ADR-002@0.1.0", () => {
    const cost = worstCaseCostForCall("text_llm");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns a non-zero cost for vision_llm per ADR-004@0.1.0", () => {
    const cost = worstCaseCostForCall("vision_llm");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns a non-zero cost for transcription per ADR-003@0.1.0", () => {
    const cost = worstCaseCostForCall("transcription");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns zero cost for lookup per ADR-005@0.1.0", () => {
    const cost = worstCaseCostForCall("lookup");
    expect(cost).toBe(0);
  });

  it("returns fallback cost for unknown call type", () => {
    const cost = worstCaseCostForCall("unknown_type" as CallType);
    expect(cost).toBe(0.001);
  });

  it("text_llm worst-case is based on ADR-002 gpt-oss-120b pricing", () => {
    const textPrice = WORST_CASE_PRICES.find((p) => p.callType === "text_llm");
    expect(textPrice).toBeDefined();
    expect(textPrice!.modelAlias).toBe("gpt-oss-120b");
    expect(textPrice!.maxInputUnits).toBe(1500);
    expect(textPrice!.maxOutputUnits).toBe(600);
  });

  it("transcription worst-case is based on ADR-003 Whisper V3 Turbo pricing", () => {
    const transPrice = WORST_CASE_PRICES.find((p) => p.callType === "transcription");
    expect(transPrice).toBeDefined();
    expect(transPrice!.modelAlias).toBe("whisper-v3-turbo");
    expect(transPrice!.maxInputUnits).toBe(15);
  });
});

describe("costGuard shouldDegrade", () => {
  it("does not degrade when spend is below $10 ceiling", () => {
    expect(shouldDegrade(5.0)).toBe(false);
  });

  it("enables degrade mode when projected spend reaches $10 ceiling per ARCH-001@0.2.0 §4.8", () => {
    expect(shouldDegrade(10.0)).toBe(true);
  });

  it("enables degrade mode when projected spend exceeds $10", () => {
    expect(shouldDegrade(10.01)).toBe(true);
  });

  it("enables degrade mode when projected spend is well above $10", () => {
    expect(shouldDegrade(15.0)).toBe(true);
  });

  it("MONTHLY_SPEND_CEILING_USD is $10 per ARCH-001 §4.8", () => {
    expect(MONTHLY_SPEND_CEILING_USD).toBe(10);
  });
});

describe("costGuard shouldSuppressPoAlert", () => {
  it("does not suppress alert when no alert has been sent this month", () => {
    expect(shouldSuppressPoAlert(null, "2026-04")).toBe(false);
  });

  it("suppresses duplicate PO alert within the same UTC month", () => {
    const alertSentAt = "2026-04-15T10:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(true);
  });

  it("allows PO alert in a new UTC month after previous alert", () => {
    const alertSentAt = "2026-03-28T10:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(false);
  });

  it("suppresses duplicate alert when alert sent at start of month", () => {
    const alertSentAt = "2026-04-01T00:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(true);
  });

  it("allows alert in next month even if same month number different year", () => {
    const alertSentAt = "2025-04-15T10:00:00.000Z";
    const currentMonth = "2026-04";
    expect(shouldSuppressPoAlert(alertSentAt, currentMonth)).toBe(false);
  });
});

describe("costGuard worst-case price coverage per ADR", () => {
  it("covers all four call types from ADR-002/003/004/005", () => {
    const callTypes = WORST_CASE_PRICES.map((p) => p.callType);
    expect(callTypes).toContain("text_llm");
    expect(callTypes).toContain("vision_llm");
    expect(callTypes).toContain("transcription");
    expect(callTypes).toContain("lookup");
  });

  it("all prices use the omniroute provider alias per ADR-002", () => {
    for (const price of WORST_CASE_PRICES) {
      expect(price.providerAlias).toBe("omniroute");
    }
  });
});
