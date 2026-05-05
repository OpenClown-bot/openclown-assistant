export interface PluginApi {
  on(event: string, handler: (...args: unknown[]) => unknown): void;
  registerCommand(name: string, handler: (...args: unknown[]) => unknown): void;
}

export interface InboundClaimEvent {
  telegramUserId: number;
  chatId: number;
  messageId: number;
  text?: string;
  voice?: InboundClaimVoice;
  photo?: InboundClaimPhoto;
}

export interface InboundClaimVoice {
  fileId: string;
  durationSeconds: number;
  mimeType: string;
}

export interface InboundClaimPhoto {
  fileId: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

export interface InboundClaimResult {
  handled: boolean;
  reply?: InboundClaimReply;
}

export interface InboundClaimReply {
  text: string;
}

export interface KbjuMessageToolArgs {
  telegram_id: number;
  text?: string;
  source?: string;
  message_id?: number;
  chat_id?: number;
}

export interface KbjuCronToolArgs {
  trigger: string;
  timezone?: string;
}

export interface KbjuCallbackToolArgs {
  callback_data: string;
  telegram_id: number;
  message_id?: number;
}