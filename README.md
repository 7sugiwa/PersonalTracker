# PersonalTracker

Telegram expense & net worth tracker. Text a message to log income/expenses,
track asset holdings (gold, stocks, crypto) with auto-updating prices, and view
everything on a dashboard.

Full design: [`docs/plan.md`](./docs/plan.md) — architecture, data model, and
build order.

## ⚠️ This repository is public

It's public so the project can run on Vercel's free Hobby tier. That has two
consequences for anyone working in this codebase:

1. **No secrets ever get committed.** All real credentials live in Vercel's
   and Supabase's dashboards, never in git. See `.env.example` for the full
   list of variables — copy it to `.env.local` (gitignored) for local dev.
2. **No personal financial data ever gets committed.** Opening account
   balances and holdings are seeded from a gitignored `*.local.json` file.
   Only fake-data example files are committed.

Before pushing, if you're ever unsure whether something sensitive made it
into git history:

```bash
git log -p | grep -iE 'AIza|eyJ|whsec'
```

(`AIza` catches Gemini/Google API keys. Telegram bot tokens don't have a distinctive grep-able prefix — `<digits>:<random string>` — so this can't catch one directly; double-check `.env.local` was never `git add`ed instead.)

If a real secret does leak, **rotate it immediately** — that closes the hole.
Scrubbing git history is secondary and doesn't help once a public repo has
been cloned or indexed.

Vercel **preview deployments are public URLs on the Hobby plan** — every
branch push gets a live, guessable-if-shared link, and Vercel's own
password-protection is a paid feature. The dashboard's own login screen
(see the plan) is the actual gate, and it must be configured for the
Preview environment too, not just Production.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values, never commit this file
npm run dev
```

## Connecting the Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram, `/newbot`, and copy the token it gives you into `TELEGRAM_BOT_TOKEN`.
2. Message [@userinfobot](https://t.me/userinfobot) to get your own numeric Telegram user id, and put it in `ALLOWED_TG_USER_IDS`.
3. Generate a `TELEGRAM_WEBHOOK_SECRET` (`openssl rand -hex 32`) and set it in both `.env.local` and Vercel (Production **and** Preview).
4. After deploying, register the webhook once:
   ```bash
   npm run telegram:setup-webhook -- https://your-app.vercel.app
   ```
   Re-run this any time the deployed URL changes.
