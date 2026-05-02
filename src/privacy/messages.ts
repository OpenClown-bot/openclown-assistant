import type { DeleteConfirmationAnswer } from "./types.js";

export const FORGET_ME_COMMAND = "/forget_me";

export const DELETION_INTENT_PHRASES_RU: readonly string[] = [
  "удали мои данные",
  "удалить мои данные",
  "забудь меня",
  "удали мой профиль",
  "удалить профиль",
];

export const DELETE_CONFIRMATION_MESSAGE_RU =
  "Удалить все твои данные без восстановления? Ответь \"да\" или \"нет\".";

export const DELETE_CANCELLED_MESSAGE_RU = "Отменила удаление. Данные не изменены.";

export const DELETE_COMPLETED_MESSAGE_RU =
  "Готово: все твои данные удалены. Если захочешь начать заново, отправь /start.";

export const DELETE_FRESH_START_MESSAGE_RU =
  "У меня уже нет твоих сохранённых данных. Можно начать заново командой /start.";

export function parseRussianDeletionConfirmation(text: string | undefined): DeleteConfirmationAnswer {
  const normalized = text?.trim().toLocaleLowerCase("ru-RU") ?? "";
  if (["да", "д", "yes", "y"].includes(normalized)) {
    return "yes";
  }
  if (["нет", "не", "н", "no", "n"].includes(normalized)) {
    return "no";
  }
  return "unknown";
}

export function isRussianDeletionIntent(text: string | undefined): boolean {
  const normalized = text?.trim().toLocaleLowerCase("ru-RU") ?? "";
  return normalized.startsWith(FORGET_ME_COMMAND) || DELETION_INTENT_PHRASES_RU.some((phrase) => normalized.includes(phrase));
}
