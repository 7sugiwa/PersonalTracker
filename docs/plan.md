# Telegram expense & net worth tracker — implementation plan

> **Update:** this plan was originally written and mostly built for WhatsApp Cloud API. Mid-build, Meta developer account setup turned out to be a real blocker, so the messaging layer was swapped to the Telegram Bot API — everything else (Supabase schema, LLM parsing, price cron, dashboard) is unaffected, since the messaging integration was isolated to one file (`lib/telegram.ts`, formerly `lib/whatsapp.ts`) plus the webhook route. This document has been updated in place to describe the Telegram version; where it still says "WhatsApp" below, that's a stale reference worth fixing on sight, not a second system.
>
> **Second update:** the parsing LLM was also swapped, from Claude (Anthropic) to Gemini (Google), for its free tier — see § LLM parsing. Same isolation story: contained to `lib/parse.ts` plus the `GEMINI_API_KEY` env var, nothing else moved.

## Context

You want to log income and expenses by texting a bot, track asset holdings whose prices update automatically, and see everything on a Vercel-hosted dashboard backed by Supabase. `/Users/farhanrafi/Documents/GitHub/PersonalTracker` is empty — this is greenfield, no existing code to reuse.

Your original architecture is sound. This plan keeps it and fixes four things that would have caused real problems, plus folds in the decisions you made:

1. **The net worth formula double-counts.** `cash_balance = Σincome − Σexpense` leaves cash untouched when you buy gold, while holdings go up — so buying an asset inflates net worth. Asset purchases must debit cash.
2. **No FX source.** You hold USD-denominated assets (VOO/SPY) and want net worth in IDR. There was no USD/IDR rate anywhere in the plan.
3. **The webhook will double-log.** Both WhatsApp and Telegram retry a webhook that doesn't return 200 fast. An LLM call plus a Supabase insert plus a reply can exceed that, so retries create duplicate transactions.
4. **IDX stocks have no good free API.** Alpha Vantage covers US equities well and IDX poorly. This needs a swappable adapter, not a single provider.

**Decisions you made:** all four asset classes (Antam gold, US stocks/ETFs, IDX stocks, crypto) · multiple named cash accounts · terse confirmation reply · server-side-only dashboard with a password cookie · text messages only · fixed category list · seed opening balances and holdings · `UNDO` keyword plus quote-reply edits.

---

## Verified external facts

| Thing | Status |
|---|---|
| Gold — `logam-mulia-api.iamutaki.workers.dev` | Live on Cloudflare Workers, free, no API key. Antam/UBS/Pegadaian + 20 sources. Updates ~08:30 WIB business days. |
| FX — Frankfurter (`api.frankfurter.dev`) | ECB reference rates, no key, no rate limits. IDR included. USD→IDR via cross rate. |
| US stocks — Alpha Vantage free tier | 25 requests/day, 5/min. Enough for a handful of daily symbols. |
| IDX stocks | No clean free keyless API. Yahoo Finance chart endpoint (`BBCA.JK`) is the pragmatic choice — unofficial and fragile. |
| Crypto — CoinGecko free | Quotes directly in IDR, no key at low volume. |
| Vercel Hobby cron | Up to 100 crons/project, but **once per day each**, fired anywhere within the specified hour. |
| Telegram Bot API tokens | Minted once via @BotFather, never expire. No Meta-style System User dance, no business verification. |
| Telegram pricing | Free, unconditionally — there is no per-message billing and no free-window cliff like WhatsApp's. |

Sources: [logam-mulia-api](https://github.com/iamutaki/logam-mulia-api) · [Frankfurter](https://frankfurter.dev/) · [Alpha Vantage limits](https://www.macroption.com/alpha-vantage-api-limits/) · [Vercel cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [Telegram Bot API](https://core.telegram.org/bots/api)

**Why Telegram instead of WhatsApp:** the plan originally targeted WhatsApp Cloud API, but Meta's developer/business account setup was a real blocker in practice. Telegram has no equivalent friction — a bot token comes from messaging @BotFather for 30 seconds — at the cost of using an app you may open less often than WhatsApp day-to-day. For a single-user personal tool that trade favors Telegram; it wouldn't necessarily for a multi-user product where WhatsApp's install base matters.

---

## Data flows

### 1. Message → transaction (real-time)

```
You (Telegram)
  → Telegram Bot API
  → POST /api/telegram/webhook
      ├─ verify X-Telegram-Bot-Api-Secret-Token header (plain compare, not HMAC)
      ├─ check sender is in ALLOWED_TG_USER_IDS
      ├─ INSERT into message_log ON CONFLICT (chat_id, message_id) DO NOTHING
      │     └─ 0 rows affected → this is a Telegram retry → return 200, stop
      ├─ return 200 IMMEDIATELY
      └─ waitUntil(process):
            → Gemini (structured output) → parsed intent
            → route: log | undo | edit | query
            → Supabase insert/soft-delete/update
            → recompute holdings
            → send terse Telegram reply, store its message id
```

### 2. Daily prices (Vercel Cron, 02:00 UTC = 09:00 WIB)

```
GET /api/cron/prices  (Bearer CRON_SECRET)
  → for each active asset, dispatch to its price adapter
      logam_mulia → gold      yahoo → US + IDX equities
      coingecko   → crypto    manual → skip
  → frankfurter → USD/IDR rate
  → upsert price_snapshots (asset_id, snapshot_on)
  → upsert fx_rates (base, quote, snapshot_on)
  → recompute + upsert net_worth_snapshots for today (WIB)
```

09:00 WIB captures fresh gold (posted 08:30 WIB), yesterday's IDX close, and yesterday's US close. Vercel fires anywhere in the 02:00–02:59 UTC hour, which is fine.

### 3. Dashboard

```
Browser → Next.js server component → Supabase (service role key) → Recharts
```

No Supabase key ever reaches the browser.

---

## Data model

Migrations live in `supabase/migrations/`. Money as `numeric(20,4)`, quantities as `numeric(28,10)`.

### `accounts`
`id` uuid pk · `name` text unique · `kind` enum(`bank`,`ewallet`,`cash`,`broker`) · `currency` text default `IDR` · `opening_balance` numeric default 0 · `opening_balance_on` date · `is_default` bool · `archived_at`

### `categories`
`id` uuid pk · `slug` text unique · `label` text · `kind` enum(`expense`,`income`) · `sort` int · `archived_at`

Seed ~12: food, groceries, transport, bills, rent, health, shopping, entertainment, education, fees, gifts, uncategorized. Plus income: salary, freelance, investment_income, other_income.

### `assets`
`id` uuid pk · `symbol` text unique · `asset_class` enum(`gold`,`us_equity`,`idx_equity`,`crypto`) · `display_name` · `unit` text (gram/share/coin) · `quote_currency` text · `price_source` text (adapter key) · `source_ref` text (the ticker at that source) · `is_active` bool

Examples: `(GOLD_ANTAM, gold, gram, IDR, logam_mulia, antam)` · `(VOO, us_equity, share, USD, yahoo, VOO)` · `(BBCA, idx_equity, share, IDR, yahoo, BBCA.JK)` · `(BTC, crypto, coin, IDR, coingecko, bitcoin)`

### `transactions`
`id` uuid pk · `type` enum(`income`,`expense`,`asset_buy`,`asset_sell`,`transfer`) · `amount` numeric — **always positive** · `currency` · `account_id` fk → accounts (the cash side) · `counter_account_id` fk nullable (transfers) · `category_id` fk nullable · `asset_id` fk nullable · `quantity` numeric nullable · `unit_price` numeric nullable · `note` · `occurred_at` timestamptz · `occurred_on` date · `raw_message` text · `source_chat_id`/`source_message_id` bigint nullable (composite fk → message_log) · `parse_model` text · `deleted_at` timestamptz · `created_at`

> `occurred_on` must be computed in application code as the WIB calendar date. It cannot be a Postgres generated column — `timezone(text, timestamptz)` is `STABLE`, not `IMMUTABLE`, so Postgres rejects it.

### `price_snapshots`
`id` · `asset_id` fk · `price` · `currency` · `source` · `snapshot_on` date · `fetched_at` · **unique (asset_id, snapshot_on)**

### `fx_rates`
`id` · `base` · `quote` · `rate` · `snapshot_on` date · **unique (base, quote, snapshot_on)**

### `holdings`
`id` · `asset_id` fk unique · `quantity` · `avg_cost_idr` · `total_cost_idr` · `updated_at`

Derived, never hand-edited. A `recompute_holdings()` SQL function rebuilds every row from non-deleted `asset_buy`/`asset_sell` rows using weighted average cost. This is what makes UNDO and edits correct — incremental mutation would corrupt state the moment you undo a buy.

### `net_worth_snapshots`
`id` · `snapshot_on` date unique · `cash_balance` · `holdings_value` · `net_worth` · `breakdown` jsonb (per-asset-class values, for the allocation chart)

### `message_log`
`(chat_id, message_id)` bigint composite pk · `from_user_id` bigint · `body` · `received_at` · `status` enum(`received`,`parsed`,`inserted`,`failed`,`ignored`) · `error` · `reply_message_id` bigint nullable · `transaction_id` fk nullable

A message's identity in Telegram's own model is the pair `(chat_id, message_id)` — `message_id` alone is only unique within a chat, not globally. `reply_message_id` is what makes quote-reply editing work: when you quote a bot confirmation, Telegram's `message.reply_to_message.message_id` gives that reply's id, which maps back to the transaction. (For a private one-on-one chat with the bot — the only kind this app uses — `chat_id` and the sender's own Telegram user id are numerically identical.)

### The corrected cash formula

```
cash_balance = Σ accounts.opening_balance
             + Σ income
             − Σ expense
             − Σ (asset_buy.amount)
             + Σ (asset_sell.amount)
```

Transfers net to zero across accounts. Holdings value:

```
holdings_value_idr = Σ over holdings:
    quantity
  × (latest price_snapshot for asset_id with snapshot_on ≤ today)
  × (USD→IDR rate if asset.quote_currency = 'USD' else 1)
```

Use `SELECT DISTINCT ON (asset_id) ... ORDER BY asset_id, snapshot_on DESC` — **latest available**, not today's. Weekends, holidays, and failed cron runs otherwise zero out your net worth.

---

## Correctness and security details

**Webhook secret verification.** Telegram doesn't HMAC-sign the body the way Meta did — instead you choose a secret string yourself, hand it to Telegram once via `setWebhook`'s `secret_token` param (`scripts/setup-telegram-webhook.ts`), and Telegram echoes it back unchanged on the `X-Telegram-Bot-Api-Secret-Token` header of every delivery after that. Verification is a constant-time compare against the header, not a computed digest over the raw body.

**Sender allowlist.** Check `message.from.id` against `ALLOWED_TG_USER_IDS`. The secret header proves Telegram sent this; it doesn't prove *you* sent the message — the bot's username is public, and anyone can start a chat with it.

**No GET handshake needed.** Unlike Meta's `hub.challenge` dance, there's no verification handshake at all — registering the webhook URL via `setWebhook` (once, out of band) *is* the entire setup step.

**Fast 200 + idempotency.** Insert into `message_log` with `ON CONFLICT (chat_id, message_id) DO NOTHING`, return 200, then do the real work in `waitUntil()` from `@vercel/functions`. The composite primary key on `(chat_id, message_id)` — Telegram's own identity model for a message — is the actual duplicate defense; the fast return just makes retries rare.

**Number normalization.** Indonesian formats: `45rb`, `45k`, `45.000`, `1,5jt`, `2juta`, `250ribu`. Note `45.000` is forty-five thousand, not 45.0 — a naive `parseFloat` silently loses three orders of magnitude. Have the model return both a normalized integer *and* the raw token, then run a deterministic normalizer in TypeScript over the raw token. If the two disagree, reply asking for confirmation instead of guessing.

**Cron auth.** `/api/cron/prices` checks `Authorization: Bearer ${CRON_SECRET}`. Vercel sends this automatically; without the check the route is a public endpoint anyone can hammer.

**Dashboard auth.** Middleware checks an httpOnly, signed cookie set by `/api/login` against `DASHBOARD_PASSWORD`. All data access happens in server components using `SUPABASE_SERVICE_ROLE_KEY`. Still enable RLS on every table with no permissive policies — the service role bypasses RLS, so this costs nothing and closes the hole if an anon key ever leaks.

**Supabase free tier** pauses projects after ~7 days of inactivity. The daily cron keeps it alive.

---

## Public repository

The repo will be public (to get Vercel Hobby for free). Nothing in this design requires secrets in the codebase, but three things need explicit care:

**1. No secrets in git, ever.** `.gitignore` must cover `.env`, `.env.local`, `.env*.local`, and `.mcp.json`. Commit a `.env.example` listing variable *names* with placeholder values only. Every real value lives in the Vercel dashboard (Project → Settings → Environment Variables) and the Supabase dashboard. This includes `SUPABASE_URL` — not strictly a secret, but there's no reason to publish which project is yours.

**2. Your opening balances are personal financial data.** `scripts/seed-opening.ts` (build step 8) sets real account balances and real holdings. **Commit the script, never the numbers.** Read them from a gitignored `seed-opening.local.json`, and commit a `seed-opening.example.json` with fake figures. Same rule for any database dump or CSV export you make while debugging — add `*.dump`, `*.sql.gz`, and an `exports/` directory to `.gitignore` up front rather than after you've accidentally committed one.

What *is* safe to commit: all migrations (schema only), the category seed, and the asset definitions (`VOO`, `GOLD_ANTAM` — these say what you track, not how much).

**3. `ALLOWED_WA_NUMBERS` is your phone number.** Env var only. Never a default in code, never in a test fixture, never in a comment.

**Vercel preview deployments are public URLs on Hobby.** Every branch push gets a live, guessable-if-shared URL, and password-protecting deployments is a paid feature. This is exactly why the dashboard auth is app-level: the middleware password check runs on preview deploys too. Two consequences — make sure the middleware matcher covers every route including the root, and set `DASHBOARD_PASSWORD` for the Preview environment as well as Production, or previews will run with an undefined password.

**Before the first push,** run `git log -p | grep -iE 'sk-ant|eyJ|EAAG|whsec'` on any history you've already created. Secrets committed and then deleted still live in git history and are what automated scanners find. If one does slip through: rotate the key first, then worry about scrubbing history — rotation is what actually closes the hole.

---

## Price adapters

`lib/prices/` with one interface, four implementations, dispatched on `assets.price_source`:

```ts
type PriceAdapter = (asset: Asset) => Promise<{ price: number; currency: string } | null>
```

| Adapter | Source | Notes |
|---|---|---|
| `logam_mulia` | `logam-mulia-api.iamutaki.workers.dev/api/prices/{source}` | Free, keyless. It's a scraper — treat failure as normal, not exceptional. |
| `yahoo` | Yahoo Finance chart endpoint, `.JK` suffix for IDX | Covers US **and** IDX from one adapter. Unofficial and can break. |
| `coingecko` | `/simple/price?ids=...&vs_currencies=idr` | Returns IDR directly, no FX conversion needed. |
| `manual` | none | Skip. For Pluang-style synthetic products with no public NAV. |

Alpha Vantage is worth keeping as a **fallback** for US symbols if Yahoo breaks (25/day is plenty for that role) — but Yahoo as primary avoids the daily cap entirely and covers IDX, which Alpha Vantage does not.

Every adapter returns `null` rather than throwing, so one broken source doesn't abort the whole cron run. Log the failure and carry on with the last known price.

**Staleness detection:** if an active asset's newest snapshot is more than 5 days old, surface a banner on the dashboard. A silently-dead scraper that leaves net worth frozen is worse than a visible error.

---

## LLM parsing

`lib/parse.ts`, one call per message, using the `@google/genai` SDK (Gemini API). Originally built against Claude Opus 5 via the Anthropic SDK; swapped to Gemini because it has a genuinely free tier (no billing account required) and this bot is used infrequently enough that the free tier comfortably covers it.

- **Model:** `gemini-2.5-flash-lite` — Google's own docs describe it as the fastest, most budget-friendly stable (non-preview) model. Check current free-tier limits in [AI Studio](https://aistudio.google.com/rate-limit) before relying on it for higher volume; Google doesn't publish static numbers, they're per-project.
- **Structured output:** `config: { responseMimeType: "application/json", responseSchema }`. `@google/genai` has no built-in Zod→JSON-Schema converter (unlike the Anthropic SDK's `zodOutputFormat`), so the JSON Schema is hand-written in `lib/parse.ts` to mirror the Zod schema field-for-field — if one changes, update the other. The response is still validated through the Zod schema at runtime (`safeParse`) rather than trusted blindly, since structured-output enforcement varies across providers.
- **No prompt caching.** Gemini's context-caching mechanism is a separate, heavier API meant for large/shared contexts, not a simple inline breakpoint like Claude's `cache_control` — and at this app's message volume it wouldn't pay for itself either way, so it's skipped entirely.

Schema returns `intent` ∈ `log | undo | edit | query | unknown`, plus for `log`: `type`, `amount_raw`, `amount_normalized`, `currency`, `account_slug`, `category_slug`, `asset_symbol`, `quantity`, `note`, `occurred_at`.

On `intent: "unknown"` or low confidence, reply asking for clarification instead of inserting a garbage row.

**Reply format:** `✅ Expense 25.000 · food · kopi · BCA` — short enough to stay cheap after October, informative enough to catch a misparse immediately.

---

## Build order

Each step is independently verifiable. Don't move on until the check passes.

**0. Repo hygiene, before the first commit.** `.gitignore` (`.env*`, `*.dump`, `exports/`, `*.local.json`), `.env.example` with names only, README noting the repo is public and secrets live in Vercel.
→ *Verify:* `git status` shows no `.env` file as untracked-but-present-and-tempting; `git check-ignore -v .env.local` confirms the rule matches.

**1. Supabase schema + seeds.** All nine tables, `recompute_holdings()`, RLS enabled with no policies, seed categories and your accounts/assets.
→ *Verify:* run the seed script; `select * from accounts` and `select recompute_holdings()` both succeed.

**2. Next.js scaffold + env wiring.** App Router, TypeScript, Supabase server client, typed DB via `supabase gen types`.
→ *Verify:* `npm run build` clean, `/api/health` returns a live Supabase row count.

**3. Webhook skeleton.** POST with secret-header check, allowlist, `message_log` insert, fast 200. No LLM call yet — store the raw text.
→ *Verify:* deploy, run `npm run telegram:setup-webhook` against the deployed URL, message the bot, confirm a `message_log` row. Then replay the same update payload and confirm no duplicate (`ON CONFLICT (chat_id, message_id) DO NOTHING`).

**4. LLM parsing + insert.** Structured extraction, normalizer cross-check, insert into `transactions`, call `recompute_holdings()`.
→ *Verify:* text `kopi 25rb gopay`, `gaji 15jt bca`, `beli emas 5 gram 1.850.000/gram`. Check amounts, accounts, categories, and that the gold buy debited cash *and* raised holdings.

**5. Confirmation reply + UNDO + edit.** Send the terse reply, store its message id, handle `undo`/`hapus`, handle quote-reply edits via `context.id`.
→ *Verify:* log something, reply `undo`, confirm `deleted_at` is set and holdings recomputed. Quote a confirmation, say `should be 50rb`, confirm the amount changed.

**6. Price cron.** All four adapters, Frankfurter FX, `vercel.json` with `0 2 * * *`, net worth computation with latest-available-price lookup.
→ *Verify:* hit the route manually with the bearer token. Confirm `price_snapshots` rows for every active asset, an `fx_rates` row, and one `net_worth_snapshots` row. Run it twice — the upserts must not duplicate. Deactivate one asset's source to confirm partial failure doesn't abort the run.

**7. Dashboard.** Login route + middleware, then: net worth over time (line), spend by category (bar), income vs expense (line), asset allocation (donut), account balances (table), recent transactions with edit/delete, staleness banner.
→ *Verify:* log in, confirm charts render from real data, confirm no Supabase key appears in the page source or network tab.

**8. Seed opening state.** One-off script setting each account's opening balance and your current gold grams / share counts / crypto with cost basis. Real figures go in a gitignored `seed-opening.local.json`; the committed example file holds fake numbers.
→ *Verify:* net worth on the dashboard matches your own arithmetic, **and** `git status` shows the local JSON as ignored.

---

## Files

Reflects what's actually in the repo, not just the original plan:

```
.gitignore                    .env*, *.dump, exports/, *.local.json
.env.example                  variable names, placeholder values
supabase/migrations/          0001_schema.sql … 0005_networth_function.sql
scripts/seed.ts               categories, accounts, assets
scripts/seed-opening.ts       step 8 — reads seed-opening.local.json (gitignored)
scripts/seed-opening.example.json
scripts/setup-telegram-webhook.ts   one-time setWebhook registration
app/api/telegram/webhook/route.ts
app/api/cron/prices/route.ts
app/api/login/route.ts, app/api/logout/route.ts
proxy.ts                      (Next.js 16 renamed "middleware" to "proxy" — same file, same purpose)
lib/env.ts                    typed, fail-fast env var access
lib/supabase.ts                server client, service role only
lib/db-types.ts               hand-written Database type (regenerate via `supabase gen types` once live)
lib/session.ts                signed session cookie (jose)
lib/telegram.ts               secret verify, extract update, send message
lib/parse.ts                  Gemini structured extraction
lib/amount.ts                 Indonesian number normalizer
lib/wib.ts                    WIB calendar-date helper
lib/format.ts                 shared IDR formatters
lib/prices/{index,types,logam-mulia,yahoo,coingecko,fx}.ts
lib/networth.ts               price cron orchestration + staleness check
lib/dashboard-data.ts         server-side dashboard queries
lib/process-message.ts        parse → route by intent → write → reply
app/page.tsx                  dashboard (server component)
app/login/page.tsx, app/transactions/[id]/edit/page.tsx
app/actions.ts                server actions: delete/update transaction
components/{AccountsTable,RecentTransactions,StalenessBanner}.tsx
components/charts/{NetWorthChart,SpendByCategoryChart,IncomeExpenseChart,AllocationChart}.tsx
vercel.json                   cron definition
```

---

## Environment variables

```
TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ALLOWED_TG_USER_IDS
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
ALPHAVANTAGE_API_KEY        (optional fallback)
CRON_SECRET, DASHBOARD_PASSWORD, SESSION_SECRET
```

---

## Risks worth tracking

- **The two scrapers will break.** The gold API and Yahoo endpoint are community/unofficial. The staleness banner and per-adapter failure isolation exist for when, not if.
- **Public repo + public preview URLs.** The app-level password is the only gate on preview deploys, so the proxy matcher and the Preview-environment `DASHBOARD_PASSWORD` are load-bearing, not nice-to-haves.
- **If the deployed URL ever changes** (custom domain, new Vercel project), the Telegram webhook registration must be re-run (`npm run telegram:setup-webhook`) — unlike WhatsApp there's no dashboard toggle for this, it's a live API call that silently keeps pointing at the old URL otherwise.
- **One cron run per day on Hobby.** A failed run means a missing day. The upserts are idempotent and the net worth calc uses latest-available prices, so a gap degrades gracefully — but keep the manual re-run route.
