import { escapeHtml } from "../shared/escapeHtml.js";
import type { HistoryPage, ConfirmedMealView } from "./types.js";

export const MSG_HISTORY_HEADER = "📋 История приёмов пищи:";
export const MSG_HISTORY_EMPTY = "История пуста.";
export const MSG_HISTORY_PAGE_INFO = (page: number, totalPages: number) =>
  `Страница ${page} из ${totalPages}`;
export const MSG_HISTORY_ITEM_LINE = (
  date: string,
  kcal: number,
  p: number,
  f: number,
  c: number
) => `• ${date} — ${kcal} ккал, Б:${p} Ж:${f} У:${c}`;
export const MSG_HISTORY_ITEM_DELETED = "(удалено)";
export const MSG_MEAL_NOT_FOUND = "Приём пищи не найден.";
export const MSG_MEAL_EDITED = "Приём пищи изменён.";
export const MSG_MEAL_DELETED = "Приём пищи удалён.";
export const MSG_MEAL_DETAIL_HEADER = "Приём пищи:";
export const MSG_MEAL_DETAIL_ITEM = (
  name: string,
  portion: string,
  kcal: number,
  p: number,
  f: number,
  c: number
) => `  • ${name}, ${portion} — ${kcal} ккал, Б:${p} Ж:${f} У:${c}`;
export const MSG_MEAL_DETAIL_TOTAL = (kcal: number, p: number, f: number, c: number) =>
  `Итого: ${kcal} ккал, Б:${p} Ж:${f} У:${c}`;

export function buildHistoryPageMessage(page: HistoryPage, pageNumber: number, totalPages: number): string {
  if (page.meals.length === 0) {
    return MSG_HISTORY_EMPTY;
  }

  const lines: string[] = [MSG_HISTORY_HEADER];

  for (const meal of page.meals) {
    const dateLabel = meal.mealLocalDate;
    const deletedLabel = meal.deletedAt ? ` ${MSG_HISTORY_ITEM_DELETED}` : "";
    const itemSummaries = meal.items
      .map((item) =>
        MSG_MEAL_DETAIL_ITEM(
          escapeHtml(item.itemNameRu),
          escapeHtml(item.portionTextRu),
          item.caloriesKcal,
          item.proteinG,
          item.fatG,
          item.carbsG
        )
      )
      .join("\n");
    lines.push(
      MSG_HISTORY_ITEM_LINE(dateLabel, meal.totalKBJU.caloriesKcal, meal.totalKBJU.proteinG, meal.totalKBJU.fatG, meal.totalKBJU.carbsG) +
        deletedLabel
    );
    if (itemSummaries) {
      lines.push(itemSummaries);
    }
  }

  lines.push(MSG_HISTORY_PAGE_INFO(pageNumber, totalPages));
  return lines.join("\n");
}

export function buildMealDetailMessage(meal: ConfirmedMealView): string {
  const lines: string[] = [MSG_MEAL_DETAIL_HEADER];

  for (const item of meal.items) {
    lines.push(
      MSG_MEAL_DETAIL_ITEM(
        escapeHtml(item.itemNameRu),
        escapeHtml(item.portionTextRu),
        item.caloriesKcal,
        item.proteinG,
        item.fatG,
        item.carbsG
      )
    );
  }

  lines.push(
    MSG_MEAL_DETAIL_TOTAL(
      meal.totalKBJU.caloriesKcal,
      meal.totalKBJU.proteinG,
      meal.totalKBJU.fatG,
      meal.totalKBJU.carbsG
    )
  );

  return lines.join("\n");
}

export function buildNotFoundMessage(): string {
  return MSG_MEAL_NOT_FOUND;
}

export function buildEditedMessage(): string {
  return MSG_MEAL_EDITED;
}

export function buildDeletedMessage(): string {
  return MSG_MEAL_DELETED;
}
