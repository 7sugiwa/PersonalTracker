/**
 * Deterministic normalizer for Indonesian money shorthand. Exists as a
 * cross-check against the model's own `amount_normalized` — it usually
 * gets this right, but "the model was pretty sure" is not the same
 * guarantee as "a regex verified it", and a wrong amount silently written
 * to a ledger is exactly the kind of error you want a second, boring,
 * deterministic check for.
 *
 * Indonesian convention (the opposite of English): `.` is a THOUSANDS
 * separator, `,` is a DECIMAL separator. So "45.000" is forty-five
 * thousand, not 45.0 — a naive `parseFloat("45.000")` silently loses
 * three orders of magnitude. This is the one bug this file exists to
 * prevent.
 *
 * Handles: "45rb", "45k", "45.000", "1,5jt", "2juta", "250ribu",
 * "1.850.000", and plain "25000".
 *
 * Returns null when the string doesn't look like a single self-contained
 * amount token (e.g. it's a compound expression like "5 gram @1.850.000",
 * which lib/parse.ts asks the model to resolve into amount_normalized
 * directly instead) — callers should treat null as "cross-check
 * unavailable", not "amount is zero".
 */
export function normalizeIndonesianAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^rp\.?\s*/, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  const match = cleaned.match(
    /^(\d[\d.,]*)(rb|ribu|jt|juta|k)?$/,
  );
  if (!match) return null;

  const [, numericPart, suffix] = match;

  const multiplier =
    suffix === "rb" || suffix === "ribu" || suffix === "k"
      ? 1_000
      : suffix === "jt" || suffix === "juta"
        ? 1_000_000
        : 1;

  let value: number;
  if (numericPart.includes(",")) {
    // Comma present → Indonesian decimal separator. Dots (if any) are
    // thousands separators and get stripped first.
    const withoutThousandsSeps = numericPart.replace(/\./g, "");
    const withDecimalPoint = withoutThousandsSeps.replace(",", ".");
    value = Number.parseFloat(withDecimalPoint);
  } else {
    // No comma → any dots are thousands separators, not decimals. This is
    // the branch that makes "45.000" resolve to 45000, not 45.
    const withoutThousandsSeps = numericPart.replace(/\./g, "");
    value = Number.parseFloat(withoutThousandsSeps);
  }

  if (!Number.isFinite(value) || value < 0) return null;
  return value * multiplier;
}

/** Sanity bound for a single transaction amount, in IDR. Guards the case
 * where the normalizer can't cross-check (compound expression) and
 * the model's own number is used directly — catches it returning
 * something like 25 (dropped a suffix) or 25_000_000_000 (hallucinated
 * zeros) without a human needing to spot it in a confirmation text. */
const PLAUSIBLE_MIN_IDR = 100;
const PLAUSIBLE_MAX_IDR = 5_000_000_000; // 5 billion IDR — generous for a personal tracker

export interface AmountCheck {
  ok: boolean;
  reason?: string;
}

export function checkAmount(
  amountRaw: string,
  claudeNormalized: number,
): AmountCheck {
  const deterministic = normalizeIndonesianAmount(amountRaw);

  if (deterministic !== null) {
    // Allow a tiny tolerance for floating point noise, not for logic
    // errors — a real disagreement (wrong order of magnitude, wrong
    // suffix) should fail this check, not squeak through on a fudge factor.
    const diff = Math.abs(deterministic - claudeNormalized);
    const tolerance = Math.max(1, deterministic * 0.001);
    if (diff > tolerance) {
      return {
        ok: false,
        reason: `raw "${amountRaw}" normalizes to ${deterministic}, but the model said ${claudeNormalized}`,
      };
    }
    return { ok: true };
  }

  // Couldn't parse the raw token deterministically (likely a compound
  // expression the model resolved itself, e.g. "5 gram @1.850.000/gram").
  // Fall back to a plausibility bound instead of a hard match.
  if (claudeNormalized < PLAUSIBLE_MIN_IDR || claudeNormalized > PLAUSIBLE_MAX_IDR) {
    return {
      ok: false,
      reason: `amount ${claudeNormalized} is outside the plausible range and couldn't be cross-checked from raw text "${amountRaw}"`,
    };
  }
  return { ok: true };
}
