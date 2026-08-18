// One-time setup: tells Telegram where to POST incoming messages, and
// hands it the secret it should echo back on every delivery (verified in
// lib/telegram.ts). There's no GET challenge-response handshake like
// Meta's — this single API call is the entire "webhook verification" step.
//
// Run after each deploy whose URL changed (first deploy, or moving to a
// custom domain):
//
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//     npx tsx scripts/setup-telegram-webhook.ts https://your-app.vercel.app
//
// Safe to re-run — setWebhook overwrites the previous registration.

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.argv[2];

if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment first.");
  process.exit(1);
}
if (!baseUrl) {
  console.error("Usage: npx tsx scripts/setup-telegram-webhook.ts https://your-app.vercel.app");
  process.exit(1);
}

async function main() {
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      // Only text-carrying updates matter to this app (see
      // lib/telegram.ts extractMessages) — narrowing here just cuts
      // noise on Telegram's side, it's not a security boundary.
      allowed_updates: ["message"],
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("setWebhook failed:", data);
    process.exit(1);
  }

  console.log(`Webhook registered: ${webhookUrl}`);

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
  console.log("Current webhook info:", info.result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
