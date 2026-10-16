"use client";

import { useEffect, useState } from "react";
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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Sinkronkan status dari DOM (sumber kebenaran yang di-set server / script anti-FOUC).
  useEffect(() => {
    setMounted(true);
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
      title={isDark ? "Tema terang" : "Tema gelap"}
      className="flex items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
    >
      {/* Ikon stabil antara SSR & klien; baru ditukar setelah mounted. */}
      {mounted && isDark ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {mounted && isDark ? "Terang" : "Gelap"}
      </span>
    </button>
  );
}
