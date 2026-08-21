import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

// gemini-3.5-flash-lite: fastest, most budget-friendly multimodal model
// in the (stable, non-preview) lineup — a good fit for a low-volume
// personal bot on the free tier. gemini-2.5-flash-lite was retired for
// new API keys (404 "no longer available to new users").
// Bump this string if you want a different Gemini model; check
// ai.google.dev/gemini-api/docs/models and the free-tier limits in AI
// Studio (ai.google.dev/gemini-api/docs/rate-limits — Google doesn't
// publish static numbers, they're per-project and viewable there) before
// switching to something pricier.
const MODEL = "gemini-3.5-flash-lite";

// Lazy singleton — constructing this at module load would read
// env.GEMINI_API_KEY as soon as anything imports this file (including
// Next.js's build-time route collection, which imports every route module
// without invoking it), throwing in any environment without real secrets
// present. Deferring to first actual call avoids that.
let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

const LogSchema = z.object({
  type: z.enum(["income", "expense", "asset_buy", "asset_sell", "transfer"]),
  // The literal amount token as it appeared in the message, e.g. "25rb" or
  // "1.850.000" — used by lib/amount.ts as a deterministic cross-check
  // against amount_normalized. For a compound expression (quantity ×
  // unit price) that has no single token, pass the closest short literal
  // and let the plausibility-bound fallback in checkAmount() apply.
  amount_raw: z.string(),
  // The FULL transaction amount in IDR, already resolved (quantity ×
  // unit price if applicable). This is what actually gets written.
  amount_normalized: z.number(),
  account_slug: z
    .string()
    .nullable()
    .describe(
      "The account money moves FROM (for transfer, expense, asset_buy) or INTO (for income, asset_sell). Must exactly match one of the account names listed in the system prompt, or null if not mentioned/unclear.",
    ),
  counter_account_slug: z
    .string()
    .nullable()
    .describe(
      "Only for type=transfer — the destination account money moves INTO. Must exactly match one of the account names listed in the system prompt. Null if the destination isn't one of the user's own tracked accounts (in which case this should not be classified as transfer — see system prompt) or wasn't stated.",
    ),
  fee_amount: z
    .number()
    .nullable()
    .describe(
      "Only for type=transfer — a separate transfer/admin fee mentioned alongside the transfer, already resolved to IDR (apply the same shorthand rules as amount_normalized). Null if no fee was mentioned.",
    ),
  category_slug: z
    .string()
    .nullable()
    .describe("Must exactly match one of the category slugs listed in the system prompt, or null if unclear."),
  asset_symbol: z
    .string()
    .nullable()
    .describe("Only for asset_buy/asset_sell. Must exactly match one of the asset symbols listed in the system prompt."),
  quantity: z
    .number()
    .nullable()
    .describe("Only for asset_buy/asset_sell — units of the asset (grams, shares, coins)."),
  note: z.string().nullable(),
  occurred_on: z
    .string()
    .nullable()
    .describe("ISO date YYYY-MM-DD only if the message explicitly names a past date (e.g. 'kemarin', 'tgl 10'). Null means today."),
});

const EditPatchSchema = z.object({
  amount_raw: z.string().nullable(),
  amount_normalized: z.number().nullable(),
  category_slug: z.string().nullable(),
  account_slug: z.string().nullable(),
  note: z.string().nullable(),
});

const ParseResultSchema = z.object({
  intent: z.enum(["log", "undo", "edit", "query", "unknown"]),
  confidence: z.enum(["high", "low"]),
  log: LogSchema.nullable(),
  edit_patch: EditPatchSchema.nullable(),
  // Set when intent is "unknown" or confidence is "low" — a short
  // clarifying question to send back instead of guessing.
  clarification_needed: z.string().nullable(),
});

export type ParseResult = z.infer<typeof ParseResultSchema>;

/**
 * JSON Schema for Gemini's `responseSchema`, hand-written to match the Zod
 * schemas above field-for-field. Unlike the Anthropic SDK's
 * `zodOutputFormat` helper, `@google/genai` has no built-in Zod→JSON-Schema
 * converter, so this is maintained by hand — if you add/change a field
 * above, mirror it here too. Nullable fields use the `type: [X, "null"]`
 * array-union form, which is Gemini's documented nullable syntax (see
 * ai.google.dev/gemini-api/docs/structured-output), applied consistently
 * to nullable objects (`log`, `edit_patch`) as well as nullable primitives.
 *
 * The response is still validated against the Zod schema at runtime below
 * (`ParseResultSchema.safeParse`) rather than trusted blindly — structured
 * output support varies in how strictly it's enforced across providers and
 * schema shapes, and Zod is what gives callers a typed `ParseResult`
 * instead of `any` regardless.
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["log", "undo", "edit", "query", "unknown"] },
    confidence: { type: "string", enum: ["high", "low"] },
    log: {
      type: ["object", "null"],
      properties: {
        type: { type: "string", enum: ["income", "expense", "asset_buy", "asset_sell", "transfer"] },
        amount_raw: { type: "string" },
        amount_normalized: { type: "number" },
        account_slug: { type: ["string", "null"] },
        counter_account_slug: { type: ["string", "null"] },
        fee_amount: { type: ["number", "null"] },
        category_slug: { type: ["string", "null"] },
        asset_symbol: { type: ["string", "null"] },
        quantity: { type: ["number", "null"] },
        note: { type: ["string", "null"] },
        occurred_on: { type: ["string", "null"] },
      },
      required: [
        "type",
        "amount_raw",
        "amount_normalized",
        "account_slug",
        "counter_account_slug",
        "fee_amount",
        "category_slug",
        "asset_symbol",
        "quantity",
        "note",
        "occurred_on",
      ],
    },
    edit_patch: {
      type: ["object", "null"],
      properties: {
        amount_raw: { type: ["string", "null"] },
        amount_normalized: { type: ["number", "null"] },
        category_slug: { type: ["string", "null"] },
        account_slug: { type: ["string", "null"] },
        note: { type: ["string", "null"] },
      },
      required: ["amount_raw", "amount_normalized", "category_slug", "account_slug", "note"],
    },
    clarification_needed: { type: ["string", "null"] },
  },
  required: ["intent", "confidence", "log", "edit_patch", "clarification_needed"],
};

const SYSTEM_PROMPT_TEMPLATE = `You parse short Telegram messages (Indonesian and/or English) into structured personal-finance transactions for a single user in Indonesia (WIB, UTC+7).

# Intents
- "log": the message reports a new income, expense, asset purchase, or asset sale.
- "undo": the message asks to remove the most recently logged transaction (e.g. "undo", "hapus", "batal").
- "edit": the message is a correction to a specific earlier transaction (you will be told which one via a quoted message — extract only what should change, leave the rest null in edit_patch).
- "query": the message asks a question about their finances (e.g. "berapa net worth aku") rather than logging or correcting anything. Not yet actionable — just classify it.
- "unknown": anything that isn't clearly one of the above, or where you're not confident enough to act.

Set confidence "low" whenever you're guessing at amount, account, or category — the app will ask the user to clarify rather than silently inserting a wrong value. Never invent an account, category, or asset that isn't in the lists below; if the message doesn't clearly name one, return null for that field rather than picking the closest match.

# Accounts (use the exact name in account_slug/counter_account_slug)
{{ACCOUNTS}}
Match a casual abbreviation, contraction, or nickname for one of the accounts above WITH confidence "high", the same as if it were spelled out in full — e.g. "bsya" or "bca sy" both mean "BCA Syariah", "gopay"/"go pay" both mean "GoPay". This is a single user's own short list of accounts, not an open-ended lookup, so a shorthand that plausibly points at exactly one of them is not a guess. Only use null / lower confidence when nothing in the list is a reasonable match, or more than one account fits equally well.

# Categories (use the exact slug)
{{CATEGORIES}}

# Assets (use the exact symbol) — only relevant for asset_buy/asset_sell
{{ASSETS}}
asset_buy/asset_sell apply ONLY to the specific instruments listed above (stocks, crypto, gold, bonds, mutual funds), matched to an exact symbol. Buying or selling anything else — electronics, gadgets, vehicles, furniture, any other personal belonging — is never asset_buy/asset_sell, even though "sold" or "beli" sounds the same: selling a personal item for cash is "income" (account_slug = where the money lands, category_slug = "other_income" unless something else fits better), and buying one is "expense" (account_slug = where the money leaves from, closest-fitting category).

# Indonesian number shorthand
"rb"/"ribu"/"k" = thousands. "jt"/"juta" = millions. "45rb" = 45000. "1,5jt" = 1500000.
A dot in a plain number is a THOUSANDS separator, not a decimal point: "45.000" = 45000, "1.850.000" = 1850000 — never divide by 1000 when you see a dot.
For asset_buy/asset_sell given as "quantity @ unit price" (e.g. "5 gram emas @1.850.000/gram" or "beli 5 gram emas harga 1.850.000/gram"), compute amount_normalized = quantity × unit price yourself and put the unit price literal in amount_raw.

# Transfers between the user's own accounts
Use type "transfer" ONLY when both the source and destination are accounts from the Accounts list above. account_slug is the source (money leaves here), counter_account_slug is the destination (money arrives here) — figure out which is which from context regardless of word order: "200rb dari BSyariah ke GoPay", "pindahin 200rb BSyariah ke GoPay", and "200rb ke GoPay dari BSyariah" all mean the same thing (source=BSyariah, destination=GoPay). If the message mentions moving money OUT to something that is NOT one of the user's own tracked accounts (a person, a merchant, a bill, anything not in the Accounts list), that is an "expense" from the source account instead — do not invent a transfer with a null or guessed counter_account_slug.
A transfer fee/admin charge mentioned in the same message (e.g. "kena biaya 2500", "fee 2rb", "admin 3.000") goes in fee_amount, resolved to IDR with the same shorthand rules as amount_normalized — not added into amount_normalized itself. Leave fee_amount null if no fee is mentioned. fee_amount and counter_account_slug only ever apply to type "transfer"; leave both null for every other type.

# Dates
occurred_on is null unless the message explicitly names a different day than today (e.g. "kemarin" = yesterday, "tgl 10" = the 10th of the current month). The current date is given in the user message, not here.`;

let cachedSystemPrompt: string | null = null;

/** Builds the system prompt from live account/category/asset lists.
 * Cached in-process for the life of the serverless instance — these
 * lists change rarely, so there's no reason to hit Supabase on every
 * message. (Gemini has no simple inline prompt-caching equivalent to
 * Claude's `cache_control` breakpoints — context caching there is a
 * separate, heavier mechanism meant for large/shared contexts — but at
 * this app's message volume it wouldn't have paid for itself either
 * way, so nothing is lost by not chasing that.) */
async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  const db = supabase();
  const [{ data: accounts }, { data: categories }, { data: assets }] =
    await Promise.all([
      db
        .from("accounts")
        .select("name")
        .neq("kind", "equity") // bookkeeping-only, never a valid parse target
        .is("archived_at", null)
        .order("name"),
      db
        .from("categories")
        .select("slug, kind")
        .is("archived_at", null)
        .order("slug"),
      db
        .from("assets")
        .select("symbol, display_name, unit")
        .eq("is_active", true)
        .order("symbol"),
    ]);

  const accountsList = (accounts ?? []).map((a) => `- ${a.name}`).join("\n");
  const categoriesList = (categories ?? [])
    .map((c) => `- ${c.slug} (${c.kind})`)
    .join("\n");
  const assetsList = (assets ?? [])
    .map((a) => `- ${a.symbol}: ${a.display_name} (${a.unit})`)
    .join("\n");

  cachedSystemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{ACCOUNTS}}", accountsList)
    .replace("{{CATEGORIES}}", categoriesList)
    .replace("{{ASSETS}}", assetsList);

  return cachedSystemPrompt;
}

export interface ParseContext {
  /** Today's date in WIB, YYYY-MM-DD — passed in the user turn, not the
   * system prompt, so the system prompt stays identical across days
   * regardless of caching. */
  todayWib: string;
  /** Set when the inbound message quote-replied one of our confirmations —
   * gives the model the context to produce a targeted edit_patch. */
  quotedText?: string;
}

export async function parseMessage(
  body: string,
  ctx: ParseContext,
): Promise<ParseResult | null> {
  const systemPrompt = await buildSystemPrompt();

  const userLines = [`Today's date (WIB): ${ctx.todayWib}`];
  if (ctx.quotedText) {
    userLines.push(`This message is a reply to our earlier confirmation: "${ctx.quotedText}"`);
  }
  userLines.push(`Message: ${body}`);

  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: userLines.join("\n"),
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  if (!response.text) return null;

  // Parse and validate defensively — structured-output enforcement varies
  // across providers/schema shapes, so a malformed or non-JSON response
  // should surface as "couldn't understand that message" (null, handled
  // by the caller's clarification-reply path) rather than as a thrown
  // error that reads to the user as a full processing failure.
  try {
    const parsedJson = JSON.parse(response.text);
    const result = ParseResultSchema.safeParse(parsedJson);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
