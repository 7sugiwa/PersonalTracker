"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

/** Soft-deletes a transaction and, if it moved an asset, rebuilds
 * holdings from the remaining history — same rule as the Telegram `undo`
 * flow (lib/process-message.ts): holdings is a derived table, never
 * hand-edited, always rebuilt in full so an undo can never leave it in a
 * state incremental math couldn't reach. */
export async function deleteTransactionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const db = supabase();
  const { data: tx } = await db
    .from("transactions")
    .select("type")
    .eq("id", id)
    .single();

  const { error } = await db
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`delete failed: ${error.message}`);

  if (tx && (tx.type === "asset_buy" || tx.type === "asset_sell")) {
    const { error: rpcErr } = await db.rpc("recompute_holdings");
    if (rpcErr) console.error("recompute_holdings failed after dashboard delete", rpcErr);
  }

  revalidatePath("/");
}

export async function updateTransactionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const amountRaw = formData.get("amount");
  const noteRaw = formData.get("note");
  if (!id || amountRaw === null) return;

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }

  const db = supabase();
  const { data: tx } = await db
    .from("transactions")
    .select("type, quantity")
    .eq("id", id)
    .single();

  const update: { amount: number; note: string | null; unit_price?: number } = {
    amount,
    note: noteRaw ? String(noteRaw) : null,
  };
  if (tx && (tx.type === "asset_buy" || tx.type === "asset_sell") && tx.quantity) {
    update.unit_price = amount / Number(tx.quantity);
  }

  const { error } = await db.from("transactions").update(update).eq("id", id);
  if (error) throw new Error(`update failed: ${error.message}`);

  if (tx && (tx.type === "asset_buy" || tx.type === "asset_sell")) {
    const { error: rpcErr } = await db.rpc("recompute_holdings");
    if (rpcErr) console.error("recompute_holdings failed after dashboard edit", rpcErr);
  }

  revalidatePath("/");
  redirect("/");
}
