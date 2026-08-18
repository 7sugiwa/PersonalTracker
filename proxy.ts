import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

// This is the ONLY gate on the dashboard. There is no Vercel-level
// deployment protection here — this repo is public, which means every
// preview deployment on Hobby gets a live, guessable-if-shared URL (see
// docs/plan.md § Public repository), and password-protecting deployments
// is a paid Vercel feature. The matcher below therefore has to cover
// every route including the root, on every environment, or a preview
// deploy quietly ships with an open dashboard.
export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = token ? await verifySessionToken(token) : false;

  if (!authed) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything EXCEPT: Next internals, the login page + its API route,
    // and the three routes that authenticate themselves a different way
    // (Telegram webhook secret header, cron bearer token, health check has
    // nothing sensitive in it).
    "/((?!_next/static|_next/image|favicon\\.ico|login|api/login|api/telegram/webhook|api/cron/prices|api/health).*)",
  ],
};
