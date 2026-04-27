import type {
  CallType,
  ProviderAlias,
  ComponentId,
} from "../shared/types.js";
import type { TenantStore } from "../store/types.js";
import type {
  UpsertMonthlySpendCounterRequest,
  MonthlySpendCounterRow,
} from "../store/types.js";
import { KPI_EVENT_NAMES } from "./kpiEvents.js";

export const MONTHLY_SPEND_CEILING_USD = 10;

export interface WorstCasePrice {
  callType: CallType;
  providerAlias: ProviderAlias;
  modelAlias: string;
  pricePerUnitUsd: number;
  billingUnit: "token" | "audio_second" | "request";
  maxInputUnits: number;
  maxOutputUnits: number;
}

export const WORST_CASE_PRICES: readonly WorstCasePrice[] = [
  {
    callType: "text_llm",
    providerAlias: "omniroute",
    modelAlias: "gpt-oss-120b",
    pricePerUnitUsd: 0.00000075,
    billingUnit: "token",
    maxInputUnits: 1500,
    maxOutputUnits: 600,
  },
  {
    callType: "vision_llm",
    providerAlias: "omniroute",
    modelAlias: "qwen3-vl-30b-a3b-instruct",
    pricePerUnitUsd: 0.00000075,
    billingUnit: "token",
    maxInputUnits: 6000,
    maxOutputUnits: 800,
  },
  {
    callType: "transcription",
    providerAlias: "omniroute",
    modelAlias: "whisper-v3-turbo",
    pricePerUnitUsd: 0.000015,
    billingUnit: "audio_second",
    maxInputUnits: 15,
    maxOutputUnits: 1,
  },
  {
    callType: "lookup",
    providerAlias: "omniroute",
    modelAlias: "usda-fdc-lookup",
    pricePerUnitUsd: 0,
    billingUnit: "request",
    maxInputUnits: 1,
    maxOutputUnits: 1,
  },
] as const;

export function worstCaseCostForCall(callType: CallType): number {
  const price = WORST_CASE_PRICES.find((p) => p.callType === callType);
  if (!price) {
    return 0.001;
  }
  if (price.billingUnit === "token") {
    return (
      (price.maxInputUnits + price.maxOutputUnits) * price.pricePerUnitUsd
    );
  }
  if (price.billingUnit === "audio_second") {
    return price.maxInputUnits * price.pricePerUnitUsd;
  }
  return price.pricePerUnitUsd;
}

export interface PreflightResult {
  allowed: boolean;
  projectedSpendUsd: number;
  estimatedCallCostUsd: number;
  reason?: string;
}

export interface SpendState {
  estimatedSpendUsd: number;
  degradeModeEnabled: boolean;
  poAlertSentAt: string | null;
  monthUtc: string;
}

function getCurrentMonthUtc(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function rowToState(row: MonthlySpendCounterRow): SpendState {
  return {
    estimatedSpendUsd: row.estimated_spend_usd,
    degradeModeEnabled: row.degrade_mode_enabled,
    poAlertSentAt: row.po_alert_sent_at,
    monthUtc: row.month_utc,
  };
}

export class SpendTracker {
  private readonly store: TenantStore;
  private readonly userId: string;
  private cache: SpendState | null = null;

  constructor(store: TenantStore, userId: string) {
    this.store = store;
    this.userId = userId;
  }

  async getState(): Promise<SpendState> {
    const monthUtc = getCurrentMonthUtc();
    if (this.cache && this.cache.monthUtc === monthUtc) {
      return this.cache;
    }

    const request: UpsertMonthlySpendCounterRequest = {
      monthUtc,
      estimatedSpendUsd: this.cache?.estimatedSpendUsd ?? 0,
      degradeModeEnabled: this.cache?.degradeModeEnabled ?? false,
      poAlertSentAt: this.cache?.poAlertSentAt ?? undefined,
    };
    const row = await this.store.upsertMonthlySpendCounter(this.userId, request);
    this.cache = rowToState(row);
    return this.cache;
  }

  async preflightCheck(callType: CallType): Promise<PreflightResult> {
    const estimatedCallCost = worstCaseCostForCall(callType);
    const state = await this.getState();
    const projectedSpend = state.estimatedSpendUsd + estimatedCallCost;

    if (projectedSpend > MONTHLY_SPEND_CEILING_USD) {
      return {
        allowed: false,
        projectedSpendUsd: projectedSpend,
        estimatedCallCostUsd: estimatedCallCost,
        reason: `projected spend $${projectedSpend.toFixed(4)} would exceed ceiling $${MONTHLY_SPEND_CEILING_USD}`,
      };
    }

    return {
      allowed: true,
      projectedSpendUsd: projectedSpend,
      estimatedCallCostUsd: estimatedCallCost,
    };
  }

  async recordCostAndCheckBudget(
    estimatedCostUsd: number,
    degradeModeEnabled: boolean
  ): Promise<SpendState> {
    const monthUtc = getCurrentMonthUtc();
    const currentState = await this.getState();
    const newEstimatedSpend = currentState.estimatedSpendUsd + estimatedCostUsd;
    const shouldDegradeNow = newEstimatedSpend > MONTHLY_SPEND_CEILING_USD;

    const request: UpsertMonthlySpendCounterRequest = {
      monthUtc,
      estimatedSpendUsd: newEstimatedSpend,
      degradeModeEnabled: shouldDegradeNow || degradeModeEnabled,
      poAlertSentAt: currentState.poAlertSentAt ?? undefined,
    };

    const row = await this.store.upsertMonthlySpendCounter(this.userId, request);
    this.cache = rowToState(row);
    return this.cache;
  }

  async markPoAlertSent(): Promise<void> {
    const monthUtc = getCurrentMonthUtc();
    const currentState = await this.getState();
    const now = new Date().toISOString();

    const request: UpsertMonthlySpendCounterRequest = {
      monthUtc,
      estimatedSpendUsd: currentState.estimatedSpendUsd,
      degradeModeEnabled: currentState.degradeModeEnabled,
      poAlertSentAt: now,
    };

    const row = await this.store.upsertMonthlySpendCounter(this.userId, request);
    this.cache = rowToState(row);
  }
}

export function shouldDegrade(estimatedSpendUsd: number): boolean {
  return estimatedSpendUsd > MONTHLY_SPEND_CEILING_USD;
}

export function shouldSuppressPoAlert(
  currentPoAlertSentAt: string | null,
  currentMonthUtc: string
): boolean {
  if (!currentPoAlertSentAt) {
    return false;
  }
  const alertMonth = currentPoAlertSentAt.substring(0, 7);
  return alertMonth === currentMonthUtc;
}

export const DEGRADE_EVENT_NAME = KPI_EVENT_NAMES.degrade_mode_enabled;
export const BUDGET_BLOCKED_EVENT_NAME = KPI_EVENT_NAMES.budget_blocked;
export const PO_ALERT_EVENT_NAME = KPI_EVENT_NAMES.po_alert_sent;
