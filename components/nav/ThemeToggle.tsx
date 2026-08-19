"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ThemeChoice } from "@/lib/theme";
import { applyTheme, readStoredTheme, storeTheme, subscribeTheme } from "@/lib/theme";
import { SunIcon, MoonIcon, MonitorIcon } from "./icons";
import { cx } from "@/components/ui/cx";

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof SunIcon }> = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

function getServerSnapshot(): ThemeChoice {
  return "system";
}

/** Three-state, not a binary switch — "system" needs to be expressible
 * as its own choice, not just an initial default you can only leave by
 * picking light or dark. */
export function ThemeToggle() {
  // Derives `choice` from localStorage via React's external-store
  // primitive rather than "read in an effect, then setState": that
  // pattern causes a cascading extra render and is exactly what
  // useSyncExternalStore replaces. It also solves the SSR mismatch on
  // its own — getServerSnapshot returns "system" for the server/first-
  // paint render (matching lib/theme.ts's inline <head> script default
  // assumption), and React reconciles against the real client value
  // right after hydration with no manual effect.
  const choice = useSyncExternalStore(subscribeTheme, readStoredTheme, getServerSnapshot);

  // DOM-mutation effect (not a setState call), so it's the legitimate
  // kind of effect: applies the class whenever `choice` changes. Also
  // covers React Strict Mode's dev double-render/remount, which resets
  // <html> attributes to only what JSX manages and would otherwise
  // wipe the inline script's class — this effect just re-applies it.
  useEffect(() => {
    applyTheme(choice);
  }, [choice]);

  // Follow the OS live while in "system" mode.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    storeTheme(next); // writes localStorage and notifies the store's subscribers
    applyTheme(next); // apply immediately — don't wait a tick for the store round trip
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-inset p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          title={label}
          onClick={() => select(value)}
          className={cx(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            choice === value
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-muted hover:text-ink-secondary",
          )}
        >
          <Icon width={15} height={15} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
