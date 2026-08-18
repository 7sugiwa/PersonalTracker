import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";
import { env } from "@/lib/env";

// The actual client construction, deliberately WITHOUT `import "server-only"`.
// That guard throws unconditionally outside Next.js's bundler (it relies on
// webpack/Turbopack module-resolution swapping to work at all) — so a file
// carrying it can never be imported by a plain Node/tsx script like
// scripts/seed.ts. This module is that escape hatch for scripts; every
// consumer inside the Next.js app should import lib/supabase.ts instead
// (the guarded wrapper), not this file directly.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function supabase() {
  if (!client) {
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}
