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

  if (log.type === "transfer") {
    await handleTransfer(db, msg, log, account);
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
      parse_model: "gemini-3.5-flash-lite",
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

/** A transfer moves money between two of the user's OWN tracked
 * accounts — net-neutral on total net worth (compute_net_worth
 * excludes transfers from the cash formula entirely, see
 * 0005_networth_function.sql). The parser only ever emits type
 * "transfer" when the destination matched a known account (see the
 * system prompt); anything moving money to an untracked recipient
 * comes through as a plain "expense" instead. */
async function handleTransfer(
  db: Db,
  msg: InboundTelegramMessage,
  log: NonNullable<Awaited<ReturnType<typeof parseMessage>>>["log"],
  source: { id: string; name: string },
) {
  if (!log) return; // narrowed by caller; guard keeps TS happy

  const destination = await resolveExactAccount(db, log.counter_account_slug);
  if (!destination) {
    await reply(
      db,
      msg,
      `Transfer ke akun mana? (${(await listAccountNames(db)).join(", ")})`,
      "failed",
      `counter_account not resolved: ${log.counter_account_slug}`,
    );
    return;
  }

  if (destination.id === source.id) {
    await reply(
      db,
      msg,
      "Akun asal dan tujuan sama — itu bukan transfer.",
      "failed",
      "transfer source and destination are the same account",
    );
    return;
  }

  const todayWib = wibDateString();
  const occurredOn = log.occurred_on ?? todayWib;
  const occurredAt =
    occurredOn === todayWib
      ? new Date().toISOString()
      : new Date(`${occurredOn}T00:00:00+07:00`).toISOString();

  const { data: transferTx, error: transferErr } = await db
    .from("transactions")
    .insert({
      type: "transfer",
      amount: log.amount_normalized,
      currency: "IDR",
      account_id: source.id,
      counter_account_id: destination.id,
      note: log.note,
      occurred_at: occurredAt,
      occurred_on: occurredOn,
      raw_message: msg.body,
      source_chat_id: msg.chatId,
      source_message_id: msg.messageId,
      parse_model: "gemini-3.5-flash-lite",
    })
    .select("id")
    .single();

  if (transferErr || !transferTx) {
    await reply(db, msg, "Gagal nyimpen transfer. Coba lagi.", "failed", transferErr?.message);
    return;
  }

  // A mentioned fee is real money leaving net worth (unlike the
  // transfer itself), so it's its own "expense" row against the
  // source account, tagged to the existing "fees" category — not a
  // new column on the transfer. Sharing source_chat_id/
  // source_message_id with the transfer row is what makes /undo below
  // remove both together instead of orphaning one.
  let feeNote = "";
  if (log.fee_amount && log.fee_amount > 0) {
    const { data: feesCategory } = await db
      .from("categories")
      .select("id")
      .eq("slug", "fees")
      .maybeSingle();

    const { error: feeErr } = await db.from("transactions").insert({
      type: "expense",
      amount: log.fee_amount,
      currency: "IDR",
      account_id: source.id,
      category_id: feesCategory?.id ?? null,
      note: `Fee transfer ke ${destination.name}`,
      occurred_at: occurredAt,
      occurred_on: occurredOn,
      raw_message: msg.body,
      source_chat_id: msg.chatId,
      source_message_id: msg.messageId,
      parse_model: "gemini-3.5-flash-lite",
    });

    if (feeErr) {
      console.error("failed to insert transfer fee", feeErr);
    } else {
      feeNote = ` (+ fee ${idr.format(log.fee_amount)})`;
    }
  }

  const confirmation = `✅ Transfer ${idr.format(log.amount_normalized)} · ${source.name} → ${destination.name}${feeNote}`;
  await reply(db, msg, confirmation, "inserted", undefined, transferTx.id);
}

async function handleUndo(db: Db, msg: InboundTelegramMessage) {
  const { data: last } = await db
    .from("transactions")
    .select("id, type, amount, asset_id, source_chat_id, source_message_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) {
    await reply(db, msg, "Nggak ada transaksi buat di-undo.", "parsed");
    return;
  }

  // A transfer-with-fee inserts two rows from one message (same
  // source_chat_id/source_message_id) — undo needs to remove both, or
  // the fee (inserted second, so it's "last") would get undone on its
  // own and orphan the transfer it belongs to. Falls back to deleting
  // only the single row when source_message_id is null (e.g. rows
  // inserted by a seed script, not the bot).
  let toDelete: Array<{ id: string; type: string; amount: string }> = [last];
  if (last.source_chat_id != null && last.source_message_id != null) {
    const { data: group } = await db
      .from("transactions")
      .select("id, type, amount")
      .is("deleted_at", null)
      .eq("source_chat_id", last.source_chat_id)
      .eq("source_message_id", last.source_message_id);
    if (group && group.length > 0) toDelete = group;
  }

  const { error } = await db
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .in(
      "id",
      toDelete.map((t) => t.id),
    );

  if (error) {
    await reply(db, msg, "Gagal undo. Coba lagi.", "failed", error.message);
    return;
  }

  if (toDelete.some((t) => t.type === "asset_buy" || t.type === "asset_sell")) {
    const { error: rpcErr } = await db.rpc("recompute_holdings");
    if (rpcErr) console.error("recompute_holdings failed after undo", rpcErr);
  }

  const total = toDelete.reduce((sum, t) => sum + Number(t.amount), 0);
  const suffix = toDelete.length > 1 ? ` (${toDelete.length} transaksi)` : "";
  await reply(db, msg, `↩️ Dibatalkan: ${idr.format(total)}${suffix}`, "inserted");
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

/** Like resolveAccount, but no default-account fallback — used for a
 * transfer's destination, where guessing an account the user never
 * named would silently move money somewhere they didn't say. Null
 * slug or no match both mean "ask the user", not "assume". */
async function resolveExactAccount(db: Db, slug: string | null) {
  if (!slug) return null;
  const { data } = await db
    .from("accounts")
    .select("id, name")
    .eq("name", slug)
    .neq("kind", "equity")
    .is("archived_at", null)
    .maybeSingle();
  return data;
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
