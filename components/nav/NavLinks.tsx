"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OverviewIcon, PortfolioIcon, LedgerIcon } from "./icons";
import { cx } from "@/components/ui/cx";

const LINKS = [
  { href: "/", label: "Overview", Icon: OverviewIcon },
  { href: "/portfolio", label: "Portfolio", Icon: PortfolioIcon },
  { href: "/transactions", label: "Transactions", Icon: LedgerIcon },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Shared link set, rendered differently by AppShell for the desktop
 * sidebar vs. the mobile bottom nav via the `variant` prop. */
export function NavLinks({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    return (
      <>
        {LINKS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-ink" : "text-ink-muted",
              )}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-surface-2 text-ink"
                : "text-ink-secondary hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
