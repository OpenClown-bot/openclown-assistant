export interface BridgeRequest {
  telegram_id: number;
  chat_id: number;
  source: "text" | "voice" | "photo" | "callback" | "cron";
  text?: string;
  message_id?: number;
  callback_data?: string;
  trigger_type?: string;
}