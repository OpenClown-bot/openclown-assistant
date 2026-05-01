import { describe, it, expect } from "vitest";
import { buildDraftMessage } from "../../src/meals/messages.js";
import type { MealDraftView } from "../../src/meals/types.js";
import { buildManualDraftItems } from "../../src/meals/manualEntry.js";
import type { ManualKBJUEntry } from "../../src/meals/types.js";

function makeView(overrides: Partial<MealDraftView> = {}): MealDraftView {
  return {
    draftId: "draft-001",
    source: "text",
    status: "awaiting_confirmation",
    version: 1,
    items: [],
    totalKBJU: { caloriesKcal: 300, proteinG: 10, fatG: 12, carbsG: 30 },
    confidence01: null,
    lowConfidenceLabelShown: false,
    normalizedInputText: null,
    ...overrides,
  };
}

describe("buildDraftMessage", () => {
  it("escapes unsafe characters in itemNameRu and portionTextRu", () => {
    const view = makeView({
      items: [
        {
          itemNameRu: "Бургер & картошка <по краю>",
          portionTextRu: "200г >минимум",
          caloriesKcal: 300,
          proteinG: 10,
          fatG: 12,
          carbsG: 30,
          source: "llm_fallback",
          sourceRef: undefined,
          confidence01: undefined,
        },
      ],
    });

    const rendered = buildDraftMessage(view);

    expect(rendered).toContain("&amp;");
    expect(rendered).toContain("&lt;");
    expect(rendered).toContain("&gt;");
    expect(rendered).not.toContain(" & ");
    expect(rendered).not.toContain("<по краю>");
  });

  it("leaves manual-entry hardcoded strings unchanged", () => {
    const entry: ManualKBJUEntry = {
      caloriesKcal: 450,
      proteinG: 30,
      fatG: 15,
      carbsG: 50,
    };
    const rawItems = buildManualDraftItems(entry);
    const items = rawItems.map((i) => ({
      ...i,
      portionGrams: i.portionGrams ?? undefined,
      sourceRef: i.sourceRef ?? undefined,
      confidence01: i.confidence01 ?? undefined,
    }));
    const view = makeView({
      source: "manual",
      items,
      totalKBJU: { caloriesKcal: 450, proteinG: 30, fatG: 15, carbsG: 50 },
    });

    const rendered = buildDraftMessage(view);

    expect(rendered).toContain("Ручной ввод");
    expect(rendered).toContain("весь приём");
  });
});
