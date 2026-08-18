import "server-only";
import { supabase } from "@/lib/supabase";
import { sendTelegramText, type InboundTelegramMessage } from "@/lib/telegram";
import { parseMessage } from "@/lib/parse";
import { checkAmount } from "@/lib/amount";
import { wibDateString } from "@/lib/wib";
import type { Database } from "@/lib/db-types";

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

const GENERIC_CLARIFICATION =
  "Maaf, aku nggak yakin maksudnya apa. Coba format seperti: \"kopi 25rb gopay\" atau \"gaji 15jt bca\".";

type Db = ReturnType<typeof supabase>;

/**
 * The full pipeline for one inbound Telegram message: parse → route by
 * intent → write → reply. Called from the webhook route via `waitUntil`,
 * after the webhook has already returned 200 to Telegram — so errors here
 * are logged, not surfaced as an HTTP failure (that would just make
 * Telegram retry a message we've already accepted into message_log).
 */
export async function processMessage(msg: InboundTelegramMessage): Promise<void> {
  const db = supabase();

  try {
    const quoted = msg.quotedMessageId
      ? await resolveQuotedTransaction(db, msg.chatId, msg.quotedMessageId)
      : null;

    const parsed = await parseMessage(msg.body, {
      todayWib: wibDateString(),
      quotedText: quoted?.summary,
    });

    if (!parsed) {
      await reply(db, msg, GENERIC_CLARIFICATION, "failed", "no structured output from model");
      return;
    }

    if (parsed.intent === "undo") {
      await handleUndo(db, msg);
      return;
    }

    if (parsed.intent === "edit") {
      await handleEdit(db, msg, parsed, quoted);
      return;
    }

    if (parsed.intent === "query") {
      await reply(
        db,
        msg,
        "Fitur tanya-jawab belum tersedia — cek dashboard untuk sekarang.",
        "parsed",
      );
      return;
    }

    if (parsed.intent !== "log" || parsed.confidence === "low" || !parsed.log) {
      await reply(
        db,
        msg,
        parsed.clarification_needed || GENERIC_CLARIFICATION,
        "failed",
        `low confidence or unclear intent: ${parsed.intent}`,
      );
      return;
    }

    await handleLog(db, msg, parsed.log);
  } catch (err) {
    console.error(`processMessage error for ${msg.chatId}:${msg.messageId}`, err);
    await db
      .from("message_log")
      .update({ status: "failed", error: err instanceof Error ? err.message : String(err) })
      .eq("chat_id", msg.chatId)
      .eq("message_id", msg.messageId);
    // Best-effort — if the reply itself fails, there's nothing more to do
    // from a background job with no caller to report back to.
    await sendTelegramText(
      msg.chatId,
      "Ada error waktu proses pesan ini. Coba lagi atau cek dashboard.",
    ).catch(() => {});
  }
}

async function handleLog(
  db: Db,
  msg: InboundTelegramMessage,
  log: NonNullable<Awaited<ReturnType<typeof parseMessage>>>["log"],
) {
  if (!log) return; // narrowed by caller; guard keeps TS happy

  const amountCheck = checkAmount(log.amount_raw, log.amount_normalized);
  if (!amountCheck.ok) {
    await reply(
      db,
      msg,
      `Jumlahnya kelihatannya nggak pas ("${log.amount_raw}"). Bisa tulis ulang, misal "25rb" atau "45.000"?`,
      "failed",
      amountCheck.reason,
    );
    return;
  }

  const account = await resolveAccount(db, log.account_slug);
  if (!account) {
    await reply(
      db,
      msg,
      `Dari akun mana? (${(await listAccountNames(db)).join(", ")})`,
      "failed",
      `account not resolved: ${log.account_slug}`,
    );
    return;
  }

  const isAssetTx = log.type === "asset_buy" || log.type === "asset_sell";
  let assetId: string | null = null;
  let assetDisplay = "";

  if (isAssetTx) {
    if (!log.asset_symbol || !log.quantity) {
      await reply(
        db,
        msg,
        "Aset atau jumlahnya nggak jelas — sebutkan simbol aset dan kuantitasnya, misal \"5 gram\".",
        "failed",
        "asset_buy/sell missing asset_symbol or quantity",
      );
      return;
    }
    const { data: asset } = await db
      .from("assets")
      .select("id, symbol, display_name")
      .eq("symbol", log.asset_symbol)
      .eq("is_active", true)
      .maybeSingle();
    if (!asset) {
      await reply(
        db,
        msg,
        `Aset "${log.asset_symbol}" nggak dikenal.`,
        "failed",
        `unknown asset symbol: ${log.asset_symbol}`,
      );
      return;
    }
    assetId = asset.id;
    assetDisplay = asset.symbol;
  }

  let categoryId: string | null = null;
  let categoryLabel = "";
  if (log.category_slug) {
    const { data: category } = await db
      .from("categories")
      .select("id, slug")
      .eq("slug", log.category_slug)
      .maybeSingle();
    if (category) {
      categoryId = category.id;
      categoryLabel = category.slug;
    }
  }

  const todayWib = wibDateString();
  const occurredOn = log.occurred_on ?? todayWib;
  // Use the actual current instant when the message is about today (the
  // common case), so occurred_at carries real time-of-day; for an
  // explicitly backdated message we only know the date, so anchor it to
  // WIB midnight rather than implying a time that was never stated.
  const occurredAt =
    occurredOn === todayWib
      ? new Date().toISOString()
      : new Date(`${occurredOn}T00:00:00+07:00`).toISOString();

  const { data: tx, error: txErr } = await db
    .from("transactions")
    .insert({
      type: log.type,
      amount: log.amount_normalized,
      currency: "IDR",
      account_id: account.id,
      category_id: categoryId,
      asset_id: assetId,
      quantity: isAssetTx ? log.quantity : null,
      unit_price: isAssetTx && log.quantity ? log.amount_normalized / log.quantity : null,
      note: log.note,
      occurred_at: occurredAt,
      occurred_on: occurredOn,
      raw_message: msg.body,
      source_chat_id: msg.chatId,
      source_message_id: msg.messageId,
      parse_model: "gemini-2.5-flash-lite",
    })
    .select("id")
    .single();

  if (txErr || !tx) {
    await reply(db, msg, "Gagal nyimpen transaksi. Coba lagi.", "failed", txErr?.message);
    return;
  }

  if (isAssetTx) {
    const { error: rpcErr } = await db.rpc("recompute_holdings");
    if (rpcErr) console.error("recompute_holdings failed after asset tx", rpcErr);
  }

  const parts = [
    log.type === "income" ? "Income" : log.type === "expense" ? "Expense" : log.type === "asset_buy" ? "Buy" : "Sell",
    idr.format(log.amount_normalized),
  ];
  if (categoryLabel) parts.push(categoryLabel);
  if (isAssetTx) parts.push(`${log.quantity} ${assetDisplay}`);
  if (log.note) parts.push(log.note);
  parts.push(account.name + (log.account_slug ? "" : " (default)"));

  const confirmation = `✅ ${parts.join(" · ")}`;
  await reply(db, msg, confirmation, "inserted", undefined, tx.id);
}

async function handleUndo(db: Db, msg: InboundTelegramMessage) {
  const { data: last } = await db
    .from("transactions")
    .select("id, type, amount, asset_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) {
    await reply(db, msg, "Nggak ada transaksi buat di-undo.", "parsed");
    return;
  }

  const { error } = await db
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", last.id);

  if (error) {
    await reply(db, msg, "Gagal undo. Coba lagi.", "failed", error.message);
    return;
  }

  if (last.type === "asset_buy" || last.type === "asset_sell") {
    const { error: rpcErr } = await db.rpc("recompute_holdings");
    if (rpcErr) console.error("recompute_holdings failed after undo", rpcErr);
  }

  await reply(db, msg, `↩️ Dibatalkan: ${idr.format(Number(last.amount))}`, "inserted");
}

async function handleEdit(
  db: Db,
  msg: InboundTelegramMessage,
  parsed: Awaited<ReturnType<typeof parseMessage>>,
  quoted: { transactionId: string; summary: string } | null,
) {
  if (!quoted || !parsed?.edit_patch) {
    await reply(
      db,
      msg,
      "Buat edit, reply (quote) pesan konfirmasi transaksi yang mau diubah.",
      "failed",
      "edit intent without a resolvable quoted transaction",
    );
    return;
  }

  const patch = parsed.edit_patch;
  const update: Partial<Database["public"]["Tables"]["transactions"]["Update"]> = {};

  if (patch.amount_normalized !== null) {
    const check = patch.amount_raw
      ? checkAmount(patch.amount_raw, patch.amount_normalized)
      : { ok: true };
    if (!check.ok) {
      await reply(db, msg, `Jumlah barunya nggak jelas ("${patch.amount_raw}").`, "failed", check.reason);
      return;
    }
    update.amount = patch.amount_normalized;
  }
  if (patch.category_slug !== null) {
    const { data: category } = await db
      .from("categories")
      .select("id")
      .eq("slug", patch.category_slug)
      .maybeSingle();
    if (category) update.category_id = category.id;
  }
  if (patch.account_slug !== null) {
    const account = await resolveAccount(db, patch.account_slug);
    if (account) update.account_id = account.id;
  }
  if (patch.note !== null) update.note = patch.note;

  if (Object.keys(update).length === 0) {
    await reply(db, msg, "Nggak ada yang berubah — apa yang mau diedit?", "failed", "empty edit_patch");
    return;
  }

  const { data: original } = await db
    .from("transactions")
    .select("type, asset_id, quantity")
    .eq("id", quoted.transactionId)
    .single();

  // Keep unit_price consistent if the amount of an asset transaction changed.
  if (
    original &&
    (original.type === "asset_buy" || original.type === "asset_sell") &&
    update.amount &&
    original.quantity
  ) {
    update.unit_price = Number(update.amount) / Number(original.quantity);
  }

  const { error } = await db
    .from("transactions")
    .update(update)
    .eq("id", quoted.transactionId);

  if (error) {
    await reply(db, msg, "Gagal update transaksi.", "failed", error.message);
    return;
  }

  if (original && (original.type === "asset_buy" || original.type === "asset_sell")) {
    const { error: rpcErr } = await db.rpc("recompute_holdings");
    if (rpcErr) console.error("recompute_holdings failed after edit", rpcErr);
  }

  await reply(db, msg, "✏️ Transaksi diupdate.", "inserted", undefined, quoted.transactionId);
}

/** Looks up the transaction a quote-reply refers to. `reply_to_message.message_id`
 * on the inbound message is the id of OUR earlier confirmation reply,
 * which we stored as message_log.reply_message_id when we sent it —
 * scoped by chat_id since message_id is only unique within a chat. */
async function resolveQuotedTransaction(
  db: Db,
  chatId: number,
  quotedMessageId: number,
): Promise<{ transactionId: string; summary: string } | null> {
  const { data: original } = await db
    .from("message_log")
    .select("transaction_id")
    .eq("chat_id", chatId)
    .eq("reply_message_id", quotedMessageId)
    .maybeSingle();

  if (!original?.transaction_id) return null;

  const { data: tx } = await db
    .from("transactions")
    .select("type, amount, note")
    .eq("id", original.transaction_id)
    .maybeSingle();

  if (!tx) return null;

  return {
    transactionId: original.transaction_id,
    summary: `${tx.type} ${idr.format(Number(tx.amount))}${tx.note ? " · " + tx.note : ""}`,
  };
}

async function resolveAccount(db: Db, slug: string | null) {
  if (slug) {
    const { data } = await db
      .from("accounts")
      .select("id, name")
      .eq("name", slug)
      .neq("kind", "equity")
      .is("archived_at", null)
      .maybeSingle();
    if (data) return data;
  }
  const { data: fallback } = await db
    .from("accounts")
    .select("id, name")
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();
  return fallback;
}

async function listAccountNames(db: Db): Promise<string[]> {
  const { data } = await db
    .from("accounts")
    .select("name")
    .neq("kind", "equity")
    .is("archived_at", null)
    .order("name");
  return (data ?? []).map((a) => a.name);
}

/** Sends a Telegram reply, stores its message id so a future quote-reply
 * can be matched back to this transaction, and updates message_log. */
async function reply(
  db: Db,
  msg: InboundTelegramMessage,
  text: string,
  status: Database["public"]["Tables"]["message_log"]["Row"]["status"],
  error?: string,
  transactionId?: string,
) {
  let replyId: number | null = null;
  try {
    replyId = await sendTelegramText(msg.chatId, text);
  } catch (err) {
    console.error(`failed to send Telegram reply for ${msg.chatId}:${msg.messageId}`, err);
  }

  await db
    .from("message_log")
    .update({
      status,
      error: error ?? null,
      reply_message_id: replyId,
      transaction_id: transactionId ?? null,
    })
    .eq("chat_id", msg.chatId)
    .eq("message_id", msg.messageId);
}
