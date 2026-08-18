// Typed, fail-fast environment access. Importing this module throws
// immediately with a clear message if a required variable is missing,
// rather than letting `undefined` leak into a Supabase client or a
// Telegram API call and fail somewhere confusing downstream.
//
// Real values are never read from this repo — see .env.example and
// docs/plan.md § Public repository.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill it in (or set it in the Vercel dashboard for Production AND Preview).`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  // Telegram Bot API
  get TELEGRAM_BOT_TOKEN() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  // Chosen by you, handed to Telegram once via setWebhook's secret_token
  // param (scripts/setup-telegram-webhook.ts) — see lib/telegram.ts.
  get TELEGRAM_WEBHOOK_SECRET() {
    return required("TELEGRAM_WEBHOOK_SECRET");
  },
  get ALLOWED_TG_USER_IDS(): number[] {
    return required("ALLOWED_TG_USER_IDS")
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isFinite(n));
  },

  // Supabase
  get SUPABASE_URL() {
    return required("SUPABASE_URL");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },

  // Gemini
  get GEMINI_API_KEY() {
    return required("GEMINI_API_KEY");
  },

  // Price sources
  get ALPHAVANTAGE_API_KEY() {
    return optional("ALPHAVANTAGE_API_KEY");
  },

  // App secrets
  get CRON_SECRET() {
    return required("CRON_SECRET");
  },
  get DASHBOARD_PASSWORD() {
    return required("DASHBOARD_PASSWORD");
  },
  get SESSION_SECRET() {
    return required("SESSION_SECRET");
  },
};
