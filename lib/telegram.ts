import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { env } from "@/lib/env";

const API_BASE = "https://api.telegram.org";

/**
 * Telegram webhook auth is a plain shared secret, not a computed HMAC
 * digest: you choose a secret string yourself, hand it to Telegram once
 * via `setWebhook`'s `secret_token` param (see
 * scripts/setup-telegram-webhook.ts), and Telegram echoes it back
 * unchanged on the `X-Telegram-Bot-Api-Secret-Token` header of every
 * webhook POST after that — so verification is a plain compare, not a
 * computed digest. Still worth doing via hashed constant-time compare
 * rather than `===`, for the same reason as the dashboard password check
 * in app/api/login/route.ts: a naive compare leaks the secret's length
 * and prefix via timing.
 */
export function verifyWebhookSecret(headerValue: string | null): boolean {
  if (!headerValue) return false;
  const expected = createHash("sha256").update(env.TELEGRAM_WEBHOOK_SECRET).digest();
  const provided = createHash("sha256").update(headerValue).digest();
  return timingSafeEqual(expected, provided);
}

export interface InboundTelegramMessage {
  chatId: number;
  messageId: number;
  fromId: number;
  body: string;
  /** message_id of the message this one quote-replied to (our earlier
   * confirmation, in the edit flow) — same chat_id is assumed since this
   * app only ever operates in one-on-one chats. */
  quotedMessageId: number | null;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number };
  chat: { id: number };
  text?: string;
  reply_to_message?: { message_id: number };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/** Telegram delivers ONE message per webhook POST (unlike Meta's
 * batched `entry[].changes[].value.messages[]`), so there's no list to
 * flatten — but this still returns an array (0 or 1 items) so the
 * webhook route's per-message loop doesn't need two code paths. Ignores
 * non-text updates (edited_message, photos, stickers, etc.) — this app
 * is text-only. */
export function extractMessages(update: TelegramUpdate): InboundTelegramMessage[] {
  const msg = update.message;
  if (!msg || !msg.text || !msg.from) return [];

  return [
    {
      chatId: msg.chat.id,
      messageId: msg.message_id,
      fromId: msg.from.id,
      body: msg.text,
      quotedMessageId: msg.reply_to_message?.message_id ?? null,
    },
  ];
}

export function isAllowedSender(fromId: number): boolean {
  return env.ALLOWED_TG_USER_IDS.includes(fromId);
}

/**
 * Sends a plain text message and returns Telegram's message_id for it —
 * callers store this in message_log.reply_message_id so a later
 * quote-reply can be matched back to the transaction it confirmed.
 */
export async function sendTelegramText(chatId: number, text: string): Promise<number> {
  const res = await fetch(`${API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram send failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
  if (!data.ok || !data.result) {
    throw new Error(`Telegram send returned ok:false: ${JSON.stringify(data)}`);
  }
  return data.result.message_id;
}
