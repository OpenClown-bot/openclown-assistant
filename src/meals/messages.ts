import type { MealDraftView, MealOrchestratorSource } from "./types.js";
import { escapeHtml } from "../shared/escapeHtml.js";
import type { KBJUValues, RussianReplyEnvelope, TelegramInlineKeyboardMarkup, TelegramInlineKeyboardButton } from "../shared/types.js";

export const MSG_DRAFT_HEADER = "Черновик приёма пищи:";
export const MSG_DRAFT_ITEM_LINE = (name: string, portion: string, kcal: number, p: number, f: number, c: number) =>
  `• ${name}, ${portion} — ${kcal} ккал, Б:${p} Ж:${f} У:${c}`;
export const MSG_DRAFT_TOTAL_LINE = (kcal: number, p: number, f: number, c: number) =>
  `Итого: ${kcal} ккал, Б:${p} Ж:${f} У:${c}`;
export const MSG_LOW_CONFIDENCE_LABEL = "⚠️ низкая уверенность";
export const MSG_CONFIRM_BUTTON = "✅ Подтвердить";
export const MSG_EDIT_BUTTON = "✏️ Исправить";
export const MSG_MANUAL_BUTTON = "📝 Ввести вручную";
export const MSG_DRAFT_CONFIRMED = "Приём пищи сохранён!";
export const MSG_STALE_DRAFT_REJECTED = "Черновик устарел. Исправленную версию нужно подтвердить заново.";
export const MSG_ALREADY_CONFIRMED = "Приём пищи уже сохранён.";
export const MSG_KBJU_FAILURE_FALLBACK = "Не удалось рассчитать КБЖУ. Введи значения вручную:";
export const MSG_MANUAL_ENTRY_PROMPT = "Введи КБЖУ в формате: ккал белки жиры углеводы\nПример: 450 30 15 50";
export const MSG_MANUAL_ENTRY_INVALID = "Неверный формат. Введи четыре числа: ккал белки жиры углеводы\nПример: 450 30 15 50";
export const MSG_PHOTO_DRAFT_PREFIX = "📸 Оценка по фото:";
export const MSG_TEXT_DRAFT_PREFIX = "📝 Оценка КБЖУ:";
export const MSG_VOICE_DRAFT_PREFIX = "🎤 Оценка КБЖУ (голос):";
export const MSG_MANUAL_DRAFT_PREFIX = "📝 Ручной ввод:";

export function buildDraftMessage(view: MealDraftView): string {
  const lines: string[] = [];

  const prefix = getSourcePrefix(view.source);
  lines.push(prefix);

  if (view.lowConfidenceLabelShown) {
    lines.push(MSG_LOW_CONFIDENCE_LABEL);
  }

  lines.push(MSG_DRAFT_HEADER);

  for (const item of view.items) {
    lines.push(
      MSG_DRAFT_ITEM_LINE(
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
    MSG_DRAFT_TOTAL_LINE(
      view.totalKBJU.caloriesKcal,
      view.totalKBJU.proteinG,
      view.totalKBJU.fatG,
      view.totalKBJU.carbsG
    )
  );

  return lines.join("\n");
}

function getSourcePrefix(source: MealOrchestratorSource | string): string {
  switch (source) {
    case "photo":
      return MSG_PHOTO_DRAFT_PREFIX;
    case "voice":
      return MSG_VOICE_DRAFT_PREFIX;
    case "manual":
      return MSG_MANUAL_DRAFT_PREFIX;
    default:
      return MSG_TEXT_DRAFT_PREFIX;
  }
}

export function buildDraftReplyEnvelope(
  chatId: number,
  view: MealDraftView
): RussianReplyEnvelope {
  const text = buildDraftMessage(view);
  const callbackData = `confirm_draft:${view.draftId}:${view.version}`;
  const editCallbackData = `edit_draft:${view.draftId}:${view.version}`;
  const manualCallbackData = `manual_entry:${view.draftId}`;

  const inlineKeyboard: TelegramInlineKeyboardMarkup = {
    inlineKeyboard: [
      [
        {
          text: MSG_CONFIRM_BUTTON,
          callbackData,
        },
        {
          text: MSG_EDIT_BUTTON,
          callbackData: editCallbackData,
        },
      ],
      [
        {
          text: MSG_MANUAL_BUTTON,
          callbackData: manualCallbackData,
        },
      ],
    ],
  };

  return {
    chatId,
    text,
    parseMode: "HTML",
    replyMarkup: inlineKeyboard,
    typingRenewalRequired: false,
  };
}

export function buildKbjuFailureEnvelope(chatId: number): RussianReplyEnvelope {
  return {
    chatId,
    text: MSG_KBJU_FAILURE_FALLBACK + "\n" + MSG_MANUAL_ENTRY_PROMPT,
    typingRenewalRequired: false,
  };
}

export function buildManualEntryPromptEnvelope(chatId: number): RussianReplyEnvelope {
  return {
    chatId,
    text: MSG_MANUAL_ENTRY_PROMPT,
    typingRenewalRequired: false,
  };
}

export function buildManualEntryInvalidEnvelope(chatId: number): RussianReplyEnvelope {
  return {
    chatId,
    text: MSG_MANUAL_ENTRY_INVALID,
    typingRenewalRequired: false,
  };
}

export function buildConfirmedEnvelope(chatId: number): RussianReplyEnvelope {
  return {
    chatId,
    text: MSG_DRAFT_CONFIRMED,
    typingRenewalRequired: false,
  };
}

export function buildStaleDraftRejectedEnvelope(chatId: number): RussianReplyEnvelope {
  return {
    chatId,
    text: MSG_STALE_DRAFT_REJECTED,
    typingRenewalRequired: false,
  };
}

export function buildAlreadyConfirmedEnvelope(chatId: number): RussianReplyEnvelope {
  return {
    chatId,
    text: MSG_ALREADY_CONFIRMED,
    typingRenewalRequired: false,
  };
}
