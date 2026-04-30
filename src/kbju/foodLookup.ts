import type { FoodLookupResult, EstimatorItemResult } from "./types.js";
import {
  OFF_API_BASE_URL,
  USDA_API_BASE_URL,
  LOOKUP_TIMEOUT_MS,
  OFF_LOOKUP_RATE_LIMIT_PER_MINUTE,
  USDA_LOOKUP_RATE_LIMIT_PER_HOUR,
} from "./types.js";
import type { KBJUValues, MealItemSource } from "../shared/types.js";

export interface FoodLookupClient {
  lookupFood(queryText: string): Promise<FoodLookupResult | null>;
  readonly sourceName: Extract<MealItemSource, "open_food_facts" | "usda_fdc">;
}

export interface FoodLookupCache {
  get(queryHash: string): Promise<FoodLookupResult | null>;
  set(queryHash: string, result: FoodLookupResult): Promise<void>;
}

export function hashQuery(queryText: string): string {
  let hash = 0;
  const normalized = queryText.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return `qh_${Math.abs(hash).toString(36)}`;
}

export class OpenFoodFactsClient implements FoodLookupClient {
  public readonly sourceName = "open_food_facts" as const;
  private callTimestamps: number[] = [];
  private rateLimitQueue: Promise<void> = Promise.resolve();

  public async lookupFood(queryText: string): Promise<FoodLookupResult | null> {
    const allowed = await this.tryAcquireSlot(60_000, OFF_LOOKUP_RATE_LIMIT_PER_MINUTE);
    if (!allowed) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      const url = `${OFF_API_BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(queryText)}&page_size=1&json=1`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "KBJU-Coach-Bot/0.1" },
      });

      clearTimeout(timer);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        products?: Array<{
          product_name?: string;
          code?: string;
          nutriments?: {
            ["energy-kcal_100g"]?: number;
            ["proteins_100g"]?: number;
            ["fat_100g"]?: number;
            ["carbohydrates_100g"]?: number;
          };
        }>;
      };

      const product = data.products?.[0];
      if (!product?.nutriments) {
        return null;
      }

      const nutriments = product.nutriments;
      const per100g: KBJUValues = {
        caloriesKcal: nutriments["energy-kcal_100g"] ?? 0,
        proteinG: nutriments["proteins_100g"] ?? 0,
        fatG: nutriments["fat_100g"] ?? 0,
        carbsG: nutriments["carbohydrates_100g"] ?? 0,
      };

      if (per100g.caloriesKcal <= 0) {
        return null;
      }

      return {
        itemNameRu: queryText,
        portionGrams: 100,
        per100gKbju: per100g,
        source: "open_food_facts",
        sourceRef: product.code ?? "",
        confidence01: 0.7,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private tryAcquireSlot(windowMs: number, limit: number): Promise<boolean> {
    const task = () => {
      const now = Date.now();
      const windowStart = now - windowMs;
      this.callTimestamps = this.callTimestamps.filter((ts) => ts > windowStart);
      if (this.callTimestamps.length >= limit) {
        return false;
      }
      this.callTimestamps.push(now);
      return true;
    };

    return new Promise<boolean>((resolve) => {
      this.rateLimitQueue = this.rateLimitQueue.then(() => resolve(task()));
    });
  }
}

export class UsdaFoodDataClient implements FoodLookupClient {
  public readonly sourceName = "usda_fdc" as const;
  private readonly apiKey: string;
  private callTimestamps: number[] = [];
  private rateLimitQueue: Promise<void> = Promise.resolve();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async lookupFood(queryText: string): Promise<FoodLookupResult | null> {
    const allowed = await this.tryAcquireSlot(3_600_000, USDA_LOOKUP_RATE_LIMIT_PER_HOUR);
    if (!allowed) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      const searchUrl = `${USDA_API_BASE_URL}/foods/search?query=${encodeURIComponent(queryText)}&dataType=Foundation,SR Legacy&pageSize=1&api_key=${this.apiKey}`;

      const response = await fetch(searchUrl, {
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        foods?: Array<{
          fdcId?: number;
          description?: string;
          foodNutrients?: Array<{
            nutrientId?: number;
            amount?: number;
          }>;
        }>;
      };

      const food = data.foods?.[0];
      if (!food?.foodNutrients) {
        return null;
      }

      const nutrientMap = new Map<number, number>();
      for (const n of food.foodNutrients) {
        if (n.nutrientId !== undefined && n.amount !== undefined) {
          nutrientMap.set(n.nutrientId, n.amount);
        }
      }

      const per100g: KBJUValues = {
        caloriesKcal: nutrientMap.get(1008) ?? 0,
        proteinG: nutrientMap.get(1003) ?? 0,
        fatG: nutrientMap.get(1004) ?? 0,
        carbsG: nutrientMap.get(1005) ?? 0,
      };

      if (per100g.caloriesKcal <= 0) {
        return null;
      }

      return {
        itemNameRu: queryText,
        portionGrams: 100,
        per100gKbju: per100g,
        source: "usda_fdc",
        sourceRef: String(food.fdcId ?? ""),
        confidence01: 0.7,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private tryAcquireSlot(windowMs: number, limit: number): Promise<boolean> {
    const task = () => {
      const now = Date.now();
      const windowStart = now - windowMs;
      this.callTimestamps = this.callTimestamps.filter((ts) => ts > windowStart);
      if (this.callTimestamps.length >= limit) {
        return false;
      }
      this.callTimestamps.push(now);
      return true;
    };

    return new Promise<boolean>((resolve) => {
      this.rateLimitQueue = this.rateLimitQueue.then(() => resolve(task()));
    });
  }
}

export function scalePer100gToPortion(
  per100g: KBJUValues,
  portionGrams: number
): KBJUValues {
  const factor = portionGrams / 100;
  return {
    caloriesKcal: Math.round(per100g.caloriesKcal * factor),
    proteinG: Math.round(per100g.proteinG * factor * 10) / 10,
    fatG: Math.round(per100g.fatG * factor * 10) / 10,
    carbsG: Math.round(per100g.carbsG * factor * 10) / 10,
  };
}

export function lookupResultToEstimatorItem(
  lookup: FoodLookupResult,
  portionGramsOverride?: number
): EstimatorItemResult {
  const portionGrams = portionGramsOverride ?? lookup.portionGrams;
  const scaled = scalePer100gToPortion(lookup.per100gKbju, portionGrams);

  return {
    itemNameRu: lookup.itemNameRu,
    portionTextRu: `${portionGrams}г`,
    portionGrams,
    caloriesKcal: scaled.caloriesKcal,
    proteinG: scaled.proteinG,
    fatG: scaled.fatG,
    carbsG: scaled.carbsG,
    source: lookup.source,
    sourceRef: lookup.sourceRef,
    confidence01: lookup.confidence01,
  };
}

export class CachedFoodLookupClient {
  private readonly clients: FoodLookupClient[];
  private readonly cache: FoodLookupCache | null;

  constructor(clients: FoodLookupClient[], cache?: FoodLookupCache) {
    this.clients = clients;
    this.cache = cache ?? null;
  }

  public async lookupFood(queryText: string): Promise<FoodLookupResult | null> {
    const qh = hashQuery(queryText);

    if (this.cache) {
      const cached = await this.cache.get(qh);
      if (cached) {
        return cached;
      }
    }

    for (const client of this.clients) {
      const result = await client.lookupFood(queryText);
      if (result) {
        if (this.cache) {
          await this.cache.set(qh, result);
        }
        return result;
      }
    }

    return null;
  }

  public getClientSources(): Array<FoodLookupClient["sourceName"]> {
    return this.clients.map((c) => c.sourceName);
  }
}
