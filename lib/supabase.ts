import "server-only";

// Service-role client, guarded against accidental client-bundle import.
// This app never sends a Supabase key to the browser — the dashboard
// reads data exclusively in server components, and every API route runs
// server-side. The `server-only` import above makes any accidental
// client-component import of this file fail at build time rather than
// leaking the key.
//
// Standalone scripts (run via plain Node/tsx, outside Next.js's bundler)
// can't use this file — `server-only` throws unconditionally there. They
// import lib/supabase-client.ts directly instead; see that file's comment.
export { supabase } from "@/lib/supabase-client";
