import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OpenFoodFactsClient,
  UsdaFoodDataClient,
  CachedFoodLookupClient,
  hashQuery,
  scalePer100gToPortion,
  lookupResultToEstimatorItem,
  type FoodLookupCache,
  type FoodLookupClient,
} from "../../src/kbju/foodLookup.js";
import type { FoodLookupResult } from "../../src/kbju/types.js";
import { OFF_LOOKUP_RATE_LIMIT_PER_MINUTE, USDA_LOOKUP_RATE_LIMIT_PER_HOUR } from "../../src/kbju/types.js";
import type { KBJUValues, MealItemSource } from "../../src/shared/types.js";

function makeOffResult(overrides?: Partial<FoodLookupResult>): FoodLookupResult {
  return {
    itemNameRu: "гречка",
    portionGrams: 100,
    per100gKbju: { caloriesKcal: 110, proteinG: 4.2, fatG: 1.1, carbsG: 21.3 },
    source: "open_food_facts",
    sourceRef: "123456",
    confidence01: 0.7,
    ...overrides,
  };
}

describe("hashQuery", () => {
  it("returns consistent hash for same input", () => {
    expect(hashQuery("гречка")).toBe(hashQuery("гречка"));
  });

  it("is case-insensitive", () => {
    expect(hashQuery("Гречка")).toBe(hashQuery("гречка"));
  });

  it("trims whitespace", () => {
    expect(hashQuery("  гречка  ")).toBe(hashQuery("гречка"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashQuery("гречка")).not.toBe(hashQuery("рис"));
  });
});

describe("scalePer100gToPortion", () => {
  it("scales 100g values to 200g portion", () => {
    const per100g: KBJUValues = { caloriesKcal: 100, proteinG: 5, fatG: 2, carbsG: 15 };
    const result = scalePer100gToPortion(per100g, 200);
    expect(result.caloriesKcal).toBe(200);
    expect(result.proteinG).toBe(10);
    expect(result.fatG).toBe(4);
    expect(result.carbsG).toBe(30);
  });

  it("returns same values for 100g portion", () => {
    const per100g: KBJUValues = { caloriesKcal: 100, proteinG: 5, fatG: 2, carbsG: 15 };
    const result = scalePer100gToPortion(per100g, 100);
    expect(result.caloriesKcal).toBe(100);
  });

  it("handles 50g portion", () => {
    const per100g: KBJUValues = { caloriesKcal: 200, proteinG: 10, fatG: 5, carbsG: 25 };
    const result = scalePer100gToPortion(per100g, 50);
    expect(result.caloriesKcal).toBe(100);
    expect(result.proteinG).toBe(5);
    expect(result.fatG).toBe(2.5);
    expect(result.carbsG).toBe(12.5);
  });
});

describe("lookupResultToEstimatorItem", () => {
  it("converts lookup result to estimator item with default portion", () => {
    const lookup = makeOffResult();
    const item = lookupResultToEstimatorItem(lookup);
    expect(item.itemNameRu).toBe("гречка");
    expect(item.portionGrams).toBe(100);
    expect(item.source).toBe("open_food_facts");
    expect(item.sourceRef).toBe("123456");
    expect(item.confidence01).toBe(0.7);
  });

  it("scales to override portion", () => {
    const lookup = makeOffResult();
    const item = lookupResultToEstimatorItem(lookup, 200);
    expect(item.portionGrams).toBe(200);
    expect(item.caloriesKcal).toBe(220);
  });
});

describe("CachedFoodLookupClient", () => {
  let mockCache: FoodLookupCache;
  let cacheGetSpy: ReturnType<typeof vi.fn>;
  let cacheSetSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cacheGetSpy = vi.fn().mockResolvedValue(null);
    cacheSetSpy = vi.fn().mockResolvedValue(undefined);
    mockCache = {
      get: cacheGetSpy,
      set: cacheSetSpy,
    };
  });

  it("checks cache before external lookup", async () => {
    const cachedResult = makeOffResult();
    cacheGetSpy.mockResolvedValue(cachedResult);

    const mockClient: FoodLookupClient = {
      sourceName: "open_food_facts",
      lookupFood: vi.fn().mockResolvedValue(null),
    };

    const cached = new CachedFoodLookupClient([mockClient], mockCache);
    const result = await cached.lookupFood("гречка");

    expect(cacheGetSpy).toHaveBeenCalledOnce();
    expect(mockClient.lookupFood).not.toHaveBeenCalled();
    expect(result).toEqual(cachedResult);
  });

  it("calls external lookup on cache miss and caches result", async () => {
    const lookupResult = makeOffResult();
    const mockClient: FoodLookupClient = {
      sourceName: "open_food_facts",
      lookupFood: vi.fn().mockResolvedValue(lookupResult),
    };

    const cached = new CachedFoodLookupClient([mockClient], mockCache);
    const result = await cached.lookupFood("гречка");

    expect(cacheGetSpy).toHaveBeenCalledOnce();
    expect(mockClient.lookupFood).toHaveBeenCalledOnce();
    expect(cacheSetSpy).toHaveBeenCalledOnce();
    expect(result).toEqual(lookupResult);
  });

  it("tries clients in order: OFF then USDA", async () => {
    const offClient: FoodLookupClient = {
      sourceName: "open_food_facts",
      lookupFood: vi.fn().mockResolvedValue(null),
    };
    const usdaClient: FoodLookupClient = {
      sourceName: "usda_fdc",
      lookupFood: vi.fn().mockResolvedValue(makeOffResult({ source: "usda_fdc", sourceRef: "789" })),
    };

    const cached = new CachedFoodLookupClient([offClient, usdaClient], mockCache);
    const result = await cached.lookupFood("гречка");

    expect(offClient.lookupFood).toHaveBeenCalledOnce();
    expect(usdaClient.lookupFood).toHaveBeenCalledOnce();
    expect(result?.source).toBe("usda_fdc");
  });

  it("returns null when all clients fail", async () => {
    const offClient: FoodLookupClient = {
      sourceName: "open_food_facts",
      lookupFood: vi.fn().mockResolvedValue(null),
    };
    const usdaClient: FoodLookupClient = {
      sourceName: "usda_fdc",
      lookupFood: vi.fn().mockResolvedValue(null),
    };

    const cached = new CachedFoodLookupClient([offClient, usdaClient], mockCache);
    const result = await cached.lookupFood("гречка");

    expect(result).toBeNull();
    expect(cacheSetSpy).not.toHaveBeenCalled();
  });

  it("returns client sources in order", () => {
    const offClient: FoodLookupClient = {
      sourceName: "open_food_facts",
      lookupFood: vi.fn().mockResolvedValue(null),
    };
    const usdaClient: FoodLookupClient = {
      sourceName: "usda_fdc",
      lookupFood: vi.fn().mockResolvedValue(null),
    };

    const cached = new CachedFoodLookupClient([offClient, usdaClient]);
    expect(cached.getClientSources()).toEqual(["open_food_facts", "usda_fdc"]);
  });

  it("works without a cache (no cache provided)", async () => {
    const lookupResult = makeOffResult();
    const mockClient: FoodLookupClient = {
      sourceName: "open_food_facts",
      lookupFood: vi.fn().mockResolvedValue(lookupResult),
    };

    const cached = new CachedFoodLookupClient([mockClient]);
    const result = await cached.lookupFood("гречка");

    expect(mockClient.lookupFood).toHaveBeenCalledOnce();
    expect(result).toEqual(lookupResult);
  });
});

describe("OpenFoodFactsClient rate-limit concurrency", () => {
  it("never exceeds rate limit under parallel calls", async () => {
    const originalFetch = globalThis.fetch;
    let externalCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      externalCallCount++;
      return {
        ok: true,
        json: async () => ({
          products: [{
            code: "123",
            nutriments: {
              "energy-kcal_100g": 100,
              "proteins_100g": 5,
              "fat_100g": 2,
              "carbohydrates_100g": 15,
            },
          }],
        }),
      };
    });

    try {
      const client = new OpenFoodFactsClient();
      const parallelCount = OFF_LOOKUP_RATE_LIMIT_PER_MINUTE + 10;
      const results = await Promise.all(
        Array.from({ length: parallelCount }, (_, i) => client.lookupFood(`food-${i}`))
      );
      const allowedCount = results.filter((r) => r !== null).length;
      expect(allowedCount).toBeLessThanOrEqual(OFF_LOOKUP_RATE_LIMIT_PER_MINUTE);
      expect(externalCallCount).toBeLessThanOrEqual(OFF_LOOKUP_RATE_LIMIT_PER_MINUTE);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects calls that exceed the per-minute cap", async () => {
    const originalFetch = globalThis.fetch;
    let externalCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      externalCallCount++;
      return {
        ok: true,
        json: async () => ({
          products: [{
            code: "123",
            nutriments: {
              "energy-kcal_100g": 100,
              "proteins_100g": 5,
              "fat_100g": 2,
              "carbohydrates_100g": 15,
            },
          }],
        }),
      };
    });

    try {
      const client = new OpenFoodFactsClient();
      const parallelCount = OFF_LOOKUP_RATE_LIMIT_PER_MINUTE + 20;
      const results = await Promise.all(
        Array.from({ length: parallelCount }, (_, i) => client.lookupFood(`food-${i}`))
      );
      const rejectedCount = results.filter((r) => r === null).length;
      expect(rejectedCount).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("UsdaFoodDataClient rate-limit concurrency", () => {
  it("never exceeds rate limit under parallel calls", async () => {
    const originalFetch = globalThis.fetch;
    let externalCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      externalCallCount++;
      return {
        ok: true,
        json: async () => ({
          foods: [{
            fdcId: 123,
            foodNutrients: [
              { nutrientId: 1008, amount: 100 },
              { nutrientId: 1003, amount: 5 },
              { nutrientId: 1004, amount: 2 },
              { nutrientId: 1005, amount: 15 },
            ],
          }],
        }),
      };
    });

    try {
      const client = new UsdaFoodDataClient("test-api-key");
      const parallelCount = USDA_LOOKUP_RATE_LIMIT_PER_HOUR + 10;
      const results = await Promise.all(
        Array.from({ length: parallelCount }, (_, i) => client.lookupFood(`food-${i}`))
      );
      const allowedCount = results.filter((r) => r !== null).length;
      expect(allowedCount).toBeLessThanOrEqual(USDA_LOOKUP_RATE_LIMIT_PER_HOUR);
      expect(externalCallCount).toBeLessThanOrEqual(USDA_LOOKUP_RATE_LIMIT_PER_HOUR);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
