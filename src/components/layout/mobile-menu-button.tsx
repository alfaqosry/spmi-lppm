"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "@/components/layout/mobile-menu";

/** Tombol burger di ujung kanan Topbar (hanya tampil di mobile). */
export function MobileMenuButton() {
  const { open, setOpen } = useMobileMenu();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Buka menu navigasi"
      aria-expanded={open}
      aria-haspopup="dialog"
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-400/20 bg-slate-500/10 text-slate-200 transition hover:bg-slate-500/20 lg:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
