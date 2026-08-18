import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Liveness check: confirms env vars are present AND Supabase is reachable
// with the current schema (counts a row in `categories`, which only
// exists after migrations + seed have run). Not authenticated — don't put
// anything sensitive in the response.
export async function GET() {
  try {
    const { count, error } = await supabase()
      .from("categories")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      categories: count ?? 0,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
