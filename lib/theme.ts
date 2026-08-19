// Shared between app/layout.tsx (inline pre-paint script) and
// components/nav/ThemeToggle.tsx (post-hydration toggle), so the two
// can never disagree on the storage key or the resolution rule.
export const THEME_STORAGE_KEY = "pt-theme";
export type ThemeChoice = "light" | "dark" | "system";

/** Runs synchronously in <head>, before first paint, so there is no
 * flash of the wrong theme. Must stay dependency-free (no imports) —
 * it's injected as a raw string, not executed as a module. */
export const THEME_INIT_SCRIPT = `(function(){try{
  var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark",d);
}catch(e){}})();`;

export function resolveIsDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.classList.toggle("dark", resolveIsDark(choice));
}

export function readStoredTheme(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  return v === "dark" || v === "light" ? v : "system";
}

// Minimal pub/sub so ThemeToggle can read this via useSyncExternalStore
// instead of "read localStorage in an effect, then setState" — the
// latter is a cascading-render antipattern the react-hooks lint rule
// flags, and useSyncExternalStore is the primitive React actually
// provides for "component state derived from an external store",
// which is exactly what localStorage is here. It's also what lets the
// server snapshot ("system") and the client's first real read
// reconcile without a hydration-mismatch warning.
type ThemeListener = () => void;
const listeners = new Set<ThemeListener>();

export function subscribeTheme(cb: ThemeListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function storeTheme(choice: ThemeChoice) {
  localStorage.setItem(THEME_STORAGE_KEY, choice);
  listeners.forEach((l) => l());
}
