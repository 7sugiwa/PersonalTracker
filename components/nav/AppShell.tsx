import type { ReactNode } from "react";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

/** ≥lg: fixed 240px left sidebar. <lg: sticky top bar + fixed bottom
 * tab bar. Both render the same NavLinks with a different `variant` so
 * active-state logic lives in exactly one place. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-page"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-4 py-5">
          <span className="text-base font-semibold text-ink">PersonalTracker</span>
        </div>
        <div className="flex-1 px-3">
          <NavLinks variant="sidebar" />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3">
          <ThemeToggle />
          <form action="/api/logout" method="POST">
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <span className="text-base font-semibold text-ink">PersonalTracker</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action="/api/logout" method="POST">
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>

      <main id="main" className="pb-20 lg:pb-0 lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLinks variant="bottom" />
      </nav>
    </div>
  );
}
