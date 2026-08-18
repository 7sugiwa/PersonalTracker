import type { PriceAdapter } from "@/lib/prices/types";

// Free, keyless, community-run scraper of Indonesian gold retailers —
// see docs/plan.md. `source_ref` on the asset row is the source name at
// this API (e.g. "logammulia" for Antam's own retail site); verified live
// against the API on 2026-08-17:
//   GET /api/prices/{source_ref} ->
//   { success: true, data: [{ source, material, materialType, weight,
//     weightUnit, sellPrice, buybackPrice, currency, recordedDate, ... }] }
// `data` has one row per weight denomination (0.5gr, 1gr, 2gr, ...) — we
// use the 1-gram row as the canonical per-gram reference price, since
// larger bars often carry a slightly better (lower) per-gram rate and
// mixing denominations would make the price series inconsistent day to
// day depending on which bar sizes the source happens to list.
//
// Uses sellPrice (what you'd pay to acquire more), not buybackPrice
// (what you'd receive selling) — this source's feed returns buybackPrice
// as null, and sellPrice is the more conservative/available figure for
// mark-to-market valuation anyway.

interface LogamMuliaRow {
  weight: number;
  weightUnit: string;
  sellPrice: number | null;
  buybackPrice: number | null;
  currency: string;
}

interface LogamMuliaResponse {
  success: boolean;
  data: LogamMuliaRow[];
}

export const logamMuliaAdapter: PriceAdapter = async (asset) => {
  const res = await fetch(
    `https://logam-mulia-api.iamutaki.workers.dev/api/prices/${asset.source_ref}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as LogamMuliaResponse;
  if (!json.success || !Array.isArray(json.data)) return null;

  const oneGram = json.data.find(
    (row) => row.weight === 1 && row.weightUnit === "gr" && row.sellPrice != null,
  );
  if (!oneGram || oneGram.sellPrice == null) return null;

  return { price: oneGram.sellPrice, currency: oneGram.currency };
};
