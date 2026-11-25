"use client";

import { Menu, PanelLeftClose } from "lucide-react";
import { useMobileMenu } from "@/components/layout/mobile-menu";

/**
 * Tombol burger untuk menampilkan/menyembunyikan sidebar desktop.
 * Hanya tampil di layar besar (lg ke atas).
 */
export function DesktopMenuButton() {
  const { desktopOpen, setDesktopOpen } = useMobileMenu();

  return (
    <button
      type="button"
      onClick={() => setDesktopOpen(!desktopOpen)}
      aria-label={
        desktopOpen ? "Sembunyikan menu navigasi" : "Tampilkan menu navigasi"
      }
      aria-expanded={desktopOpen}
      aria-controls="navigasi-desktop"
      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-400/20 bg-slate-500/10 text-slate-200 transition hover:bg-slate-500/20 lg:flex"
    >
      {desktopOpen ? (
        <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Menu className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
