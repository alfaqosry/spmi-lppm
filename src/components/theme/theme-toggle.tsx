"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  // Cookie agar server dapat merender <html> dengan kelas yang tepat (anti-FOUC).
  document.cookie = `theme=${theme};path=/;max-age=31536000;samesite=lax`;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* abaikan (mode privat) */
  }
}

/** Berlangganan perubahan kelas `dark` pada <html> (sumber kebenaran tema). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
// Saat SSR/hidrasi: anggap terang agar markup stabil; diperbarui setelah hidrasi.
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return (
    <button
      type="button"
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      aria-label="Tema gelap"
      aria-pressed={isDark}
      title={isDark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
      <span aria-hidden="true" className="hidden sm:inline">
        {isDark ? "Terang" : "Gelap"}
      </span>
    </button>
  );
}
