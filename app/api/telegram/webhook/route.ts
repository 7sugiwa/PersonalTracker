import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabase } from "@/lib/supabase";
import {
  verifyWebhookSecret,
  extractMessages,
  isAllowedSender,
} from "@/lib/telegram";
import { processMessage } from "@/lib/process-message";

// Unlike Meta, Telegram has no GET challenge-response handshake — the
// webhook is registered once via a direct call to setWebhook (see
// scripts/setup-telegram-webhook.ts), and auth on every subsequent POST
// is the X-Telegram-Bot-Api-Secret-Token header set up in that same call.
// So there's no GET handler here at all.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secret)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    // Shouldn't happen from a source that passed secret verification, but
    // a 4xx/5xx here makes Telegram retry a payload that will never parse.
    return new NextResponse("OK", { status: 200 });
  }

  const messages = extractMessages(payload as Parameters<typeof extractMessages>[0]);
  const db = supabase();

  for (const msg of messages) {
    if (!isAllowedSender(msg.fromId)) {
      // The secret token proves Telegram sent this; it doesn't prove the
      // sender is you (anyone can message a public bot). Log it for
      // visibility but never act on it.
      await db.from("message_log").upsert(
        {
          chat_id: msg.chatId,
          message_id: msg.messageId,
          from_user_id: msg.fromId,
          body: msg.body,
          status: "ignored",
          error: "sender not in ALLOWED_TG_USER_IDS",
        },
        { onConflict: "chat_id,message_id", ignoreDuplicates: true },
      );
      continue;
    }

    // Idempotency: (chat_id, message_id) is the composite primary key.
    // `ignoreDuplicates` means a conflicting row is NOT re-inserted and
    // is NOT returned by `.select()` — an empty result here means this is
    // a Telegram retry of a message we've already logged, so skip
    // processing (but still 200).
    const { data: inserted, error } = await db
      .from("message_log")
      .upsert(
        {
          chat_id: msg.chatId,
          message_id: msg.messageId,
          from_user_id: msg.fromId,
          body: msg.body,
          status: "received",
        },
        { onConflict: "chat_id,message_id", ignoreDuplicates: true },
      )
      .select("chat_id");

    if (error) {
      console.error("message_log insert failed", error);
      continue; // don't let one bad row break the batch or the 200
    }
    if (!inserted || inserted.length === 0) {
      continue; // duplicate delivery — already logged, already processed
    }

    // Return 200 fast; do the real work (Gemini parse, insert, reply)
    // after the response is sent. waitUntil keeps the serverless function
    // alive for this background work.
    waitUntil(
      processMessage(msg).catch((err) => {
        console.error(`processMessage failed for ${msg.chatId}:${msg.messageId}`, err);
      }),
    );
  }

  return new NextResponse("OK", { status: 200 });
}
