// Applies to every page in this group (/, /portfolio, /transactions, and
// the transaction edit page) — replaces the per-file `export const
// dynamic = "force-dynamic"` that used to live in app/page.tsx and
// app/transactions/[id]/edit/page.tsx. All of them read live,
// per-request Supabase data behind proxy.ts's auth gate and must never
// be statically generated or cached across users/requests.
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { AppShell } from "@/components/nav/AppShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
