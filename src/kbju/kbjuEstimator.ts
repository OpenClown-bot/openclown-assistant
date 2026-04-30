import type { EstimatorRequest, EstimatorResult, EstimatorItemResult } from "./types.js";
import { MANUAL_ENTRY_FAILURE_RESULT } from "./types.js";
import type { CachedFoodLookupClient } from "./foodLookup.js";
import { lookupResultToEstimatorItem } from "./foodLookup.js";
import type { OmniRouteConfig, OmniRouteCallResult } from "../llm/omniRouteClient.js";
import {
  callOmniRoute,
  buildMealParsingSystemPrompt,
  buildMealParsingUserContent,
} from "../llm/omniRouteClient.js";
import {
  validateLlmStructuredOutput,
  isSuspiciousLlmOutput,
  checkForForbiddenAdvice,
  validateKbjuTotalsPresent,
} from "./validation.js";
import type { KBJUValues, OpenClawLogger } from "../shared/types.js";
import type { SpendTracker } from "../observability/costGuard.js";

export class KbjuEstimator {
  private readonly lookupClient: CachedFoodLookupClient;
  private readonly omniRouteConfig: OmniRouteConfig;
  private readonly spendTracker: SpendTracker;
  private readonly logger: OpenClawLogger;

  constructor(deps: {
    lookupClient: CachedFoodLookupClient;
    omniRouteConfig: OmniRouteConfig;
    spendTracker: SpendTracker;
    logger: OpenClawLogger;
  }) {
    this.lookupClient = deps.lookupClient;
    this.omniRouteConfig = deps.omniRouteConfig;
    this.spendTracker = deps.spendTracker;
    this.logger = deps.logger;
  }

  public async estimate(request: EstimatorRequest): Promise<EstimatorResult> {
    const { mealTextRu, userId, requestId, degradeModeEnabled } = request;

    const foodItems = await this.parseFoodItems(mealTextRu);
    const lookupItems: EstimatorItemResult[] = [];
    const llmNeededItems: string[] = [];

    for (const item of foodItems) {
      const lookupResult = await this.lookupClient.lookupFood(item);
      if (lookupResult) {
        lookupItems.push(lookupResultToEstimatorItem(lookupResult, 100));
      } else {
        llmNeededItems.push(item);
      }
    }

    if (lookupItems.length === foodItems.length && foodItems.length > 0) {
      const totalKbju = sumKbju(lookupItems);
      return {
        items: lookupItems,
        totalKBJU: totalKbju,
        confidence01: averageConfidence(lookupItems),
        source: "lookup",
        validationErrors: [],
      };
    }

    const llmResult = await this.callLlm(mealTextRu, requestId, userId, degradeModeEnabled);

    if (llmResult === null || llmResult.outcome !== "success") {
      if (lookupItems.length > 0) {
        const totalKbju = sumKbju(lookupItems);
        return {
          items: lookupItems,
          totalKBJU: totalKbju,
          confidence01: averageConfidence(lookupItems),
          source: "lookup",
          validationErrors: ["llm_fallback_failed"],
        };
      }
      return { ...MANUAL_ENTRY_FAILURE_RESULT };
    }

    if (isSuspiciousLlmOutput(llmResult.rawResponseText)) {
      this.logger.warn("C6 suspicious LLM output detected, returning manual-entry failure", {
        request_id: requestId,
        user_id: userId,
        outcome: "suspicious_output_rejected",
      });
      if (lookupItems.length > 0) {
        const totalKbju = sumKbju(lookupItems);
        return {
          items: lookupItems,
          totalKBJU: totalKbju,
          confidence01: averageConfidence(lookupItems),
          source: "lookup",
          validationErrors: ["suspicious_llm_output_rejected"],
        };
      }
      return { ...MANUAL_ENTRY_FAILURE_RESULT };
    }

    if (checkForForbiddenAdvice(llmResult.rawResponseText)) {
      this.logger.warn("C6 forbidden advice detected in LLM output", {
        request_id: requestId,
        user_id: userId,
        outcome: "forbidden_advice_rejected",
      });
      if (lookupItems.length > 0) {
        const totalKbju = sumKbju(lookupItems);
        return {
          items: lookupItems,
          totalKBJU: totalKbju,
          confidence01: averageConfidence(lookupItems),
          source: "lookup",
          validationErrors: ["forbidden_advice_rejected"],
        };
      }
      return { ...MANUAL_ENTRY_FAILURE_RESULT };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(llmResult.rawResponseText.trim());
    } catch {
      if (lookupItems.length > 0) {
        const totalKbju = sumKbju(lookupItems);
        return {
          items: lookupItems,
          totalKBJU: totalKbju,
          confidence01: averageConfidence(lookupItems),
          source: "lookup",
          validationErrors: ["llm_output_parse_error"],
        };
      }
      return { ...MANUAL_ENTRY_FAILURE_RESULT };
    }

    const validation = validateLlmStructuredOutput(parsed);
    if (!validation.valid || !validation.parsed) {
      if (lookupItems.length > 0) {
        const totalKbju = sumKbju(lookupItems);
        return {
          items: lookupItems,
          totalKBJU: totalKbju,
          confidence01: averageConfidence(lookupItems),
          source: "lookup",
          validationErrors: validation.errors,
        };
      }
      return { ...MANUAL_ENTRY_FAILURE_RESULT, validationErrors: validation.errors };
    }

    if (!validateKbjuTotalsPresent(validation.parsed)) {
      if (lookupItems.length > 0) {
        const totalKbju = sumKbju(lookupItems);
        return {
          items: lookupItems,
          totalKBJU: totalKbju,
          confidence01: averageConfidence(lookupItems),
          source: "lookup",
          validationErrors: ["invalid_llm_totals"],
        };
      }
      return { ...MANUAL_ENTRY_FAILURE_RESULT, validationErrors: ["invalid_llm_totals"] };
    }

    const llmItems: EstimatorItemResult[] = validation.parsed.items.map((item) => ({
      itemNameRu: item.itemNameRu,
      portionTextRu: item.portionTextRu,
      portionGrams: item.portionGrams,
      caloriesKcal: item.caloriesKcal,
      proteinG: item.proteinG,
      fatG: item.fatG,
      carbsG: item.carbsG,
      source: "llm_fallback" as const,
      sourceRef: null,
      confidence01: 0.5,
    }));

    const allItems = [...lookupItems, ...llmItems];
    const totalKbju = sumKbju(allItems);

    return {
      items: allItems,
      totalKBJU: totalKbju,
      confidence01: averageConfidence(allItems),
      source: llmNeededItems.length > 0 || llmItems.length > 0 ? "llm_fallback" : "lookup",
      validationErrors: [],
    };
  }

  private async parseFoodItems(mealTextRu: string): Promise<string[]> {
    const items = mealTextRu
      .split(/[;,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (items.length === 0) {
      return [mealTextRu.trim()];
    }

    return items;
  }

  private async callLlm(
    mealTextRu: string,
    requestId: string,
    userId: string,
    degradeModeEnabled: boolean
  ): Promise<OmniRouteCallResult | null> {
    const systemPrompt = buildMealParsingSystemPrompt();
    const userContent = buildMealParsingUserContent(mealTextRu);

    return callOmniRoute(this.omniRouteConfig, {
      callType: "text_llm",
      systemPrompt,
      userContent,
      requestId,
      userId,
      degradeModeEnabled,
      logger: this.logger,
      spendTracker: this.spendTracker,
    });
  }
}

function sumKbju(items: EstimatorItemResult[]): KBJUValues {
  return items.reduce(
    (acc, item) => ({
      caloriesKcal: acc.caloriesKcal + item.caloriesKcal,
      proteinG: acc.proteinG + item.proteinG,
      fatG: acc.fatG + item.fatG,
      carbsG: acc.carbsG + item.carbsG,
    }),
    { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  );
}

function averageConfidence(items: EstimatorItemResult[]): number | null {
  if (items.length === 0) return null;
  const withConfidence = items.filter((i) => i.confidence01 !== null);
  if (withConfidence.length === 0) return null;
  const sum = withConfidence.reduce((acc, i) => acc + (i.confidence01 ?? 0), 0);
  return Math.round((sum / withConfidence.length) * 100) / 100;
}
