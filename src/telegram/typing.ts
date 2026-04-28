export const TYPING_RENEWAL_INTERVAL_MS = 4000;

export interface TypingCancelHandle {
  cancel: () => void;
}

export function startTypingRenewal(
  sendChatAction: (chatId: number, action: string) => Promise<void>,
  chatId: number
): TypingCancelHandle {
  let cancelled = false;
  let currentTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const sendOnce = async (): Promise<void> => {
    if (cancelled) return;
    try {
      await sendChatAction(chatId, "typing");
    } catch {
      // best-effort; Telegram typing actions are non-critical
    }
  };

  const scheduleNext = (): void => {
    if (cancelled) return;
    if (currentTimeoutId !== null) {
      clearTimeout(currentTimeoutId);
    }
    currentTimeoutId = setTimeout(() => {
      if (cancelled) return;
      void sendOnce().finally(scheduleNext);
    }, TYPING_RENEWAL_INTERVAL_MS);
  };

  void sendOnce();
  scheduleNext();

  return {
    cancel: () => {
      cancelled = true;
      if (currentTimeoutId !== null) {
        clearTimeout(currentTimeoutId);
      }
      currentTimeoutId = null;
    },
  };
}
