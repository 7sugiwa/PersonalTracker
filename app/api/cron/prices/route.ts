import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runDailyPriceUpdate } from "@/lib/networth";

// Vercel Cron invokes this via GET and automatically sends
// `Authorization: Bearer $CRON_SECRET` — without this check the route
// would be a public endpoint anyone could hammer (and on Hobby, trigger
// unwanted price-source traffic / LLM-adjacent cost, if this route
// ever grows to call an LLM). See vercel.json for the schedule.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runDailyPriceUpdate();
    // 200 even when some assets failed — a partial run is a normal,
    // logged outcome (see lib/networth.ts), not an error worth Vercel
    // retrying or alerting on by itself. The staleness banner on the
    // dashboard is what surfaces a scraper that's been dead for days.
    return NextResponse.json(result);
  } catch (err) {
    console.error("price cron failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
