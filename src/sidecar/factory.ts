import type { C1Deps, TelegramHandlers } from "../telegram/types.js";
import type { NormalizedTelegramUpdate } from "../telegram/types.js";
import type { RussianReplyEnvelope } from "../shared/types.js";
import type { MetricsRegistry } from "../observability/metricsEndpoint.js";

export function createHandlerStub(
  replyText: string
): (update: NormalizedTelegramUpdate) => Promise<RussianReplyEnvelope> {
  return async (update: NormalizedTelegramUpdate): Promise<RussianReplyEnvelope> => ({
    chatId: update.telegramChatId,
    text: replyText,
    typingRenewalRequired: false,
  });
}

export function createStubHandlers(): TelegramHandlers {
  return {
    start: createHandlerStub(
      "Привет! Это КБЖУ-тренер. Расскажите о себе для расчёта норм."
    ),
    forgetMe: createHandlerStub(
      "Все ваши данные удалены. Чтобы начать заново, отправьте /start."
    ),
    textMeal: createHandlerStub(
      "Приблизительно: 450 ккал, Б:30г, Ж:10г, У:60г. Подтвердить запись?"
    ),
    voiceMeal: createHandlerStub(
      "Расшифровано: курица с рисом. ~450 ккал. Подтвердить?"
    ),
    photoMeal: createHandlerStub(
      "На фото: курица с рисом. ~450 ккал. Подтвердить?"
    ),
    history: createHandlerStub(
      "Сегодня: 1500 ккал из 2000 ккал. Б: 80г, Ж: 50г, У: 180г."
    ),
    callback: createHandlerStub("Запись подтверждена! Продолжайте в том же духе."),
    summaryDelivery: createHandlerStub(
      "Итоги за сегодня: 1800 ккал из 2000 ккал. Отклонение: -200 ккал."
    ),
  };
}

function createNullMetricsRegistry(): MetricsRegistry {
  return {
    increment: () => {},
    set: () => {},
    observe: () => {},
    getSamples: () => [],
    render: () => "",
  };
}

export function createSidecarDeps(pilotUserIds: string[]): C1Deps {
  return {
    handlers: createStubHandlers(),
    sendMessage: async () => {},
    sendChatAction: async () => {},
    logger: {
      info: (msg) => console.log(`[sidecar:info] ${msg}`),
      warn: (msg) => console.warn(`[sidecar:warn] ${msg}`),
      error: (msg) => console.error(`[sidecar:error] ${msg}`),
      critical: (msg) => console.error(`[sidecar:critical] ${msg}`),
    },
    pilotUserIds,
    metricsRegistry: createNullMetricsRegistry(),
  };
}