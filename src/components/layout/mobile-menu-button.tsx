"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "@/components/layout/mobile-menu";

/** Tombol burger di ujung kanan Topbar (hanya tampil di mobile). */
export function MobileMenuButton() {
  const { setOpen } = useMobileMenu();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Buka menu"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/20 bg-slate-500/10 text-slate-200 transition hover:bg-slate-500/20 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
