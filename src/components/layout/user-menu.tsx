"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABEL, initials } from "@/lib/format";
import { logoutAction } from "@/lib/actions/auth";

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Tutup dropdown saat berpindah halaman.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        className="flex items-center gap-2 rounded-full border border-indigo-400/20 bg-slate-500/10 py-1 pl-1 pr-2 text-left transition hover:bg-slate-500/20"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-on-accent shadow-lg shadow-indigo-900/30">
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-100">
            {user.name}
          </span>
          <span className="block max-w-[9rem] truncate text-[10px] text-slate-400">
            {ROLE_LABEL[user.role]}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="surface-modal absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-indigo-400/20 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center gap-3 border-b border-slate-500/15 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-on-accent">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="p-1.5">
              <Link
                href="/profil"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-500/10 hover:text-slate-100"
              >
                <UserRound className="h-4 w-4 text-slate-400" />
                Profil Saya
              </Link>
            </div>

            <div className="border-t border-slate-500/15 p-1.5">
              <form action={logoutAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
