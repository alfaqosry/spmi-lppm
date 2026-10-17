"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  FileText,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { ROLE_LABEL, initials } from "@/lib/format";
import { logoutAction } from "@/lib/actions/auth";

/**
 * Menu akun (pola disclosure: tombol aria-expanded + panel tautan biasa).
 * Esc / klik di luar menutup panel dan fokus kembali ke tombol.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  // Menu terikat pada path saat dibuka: otomatis tertutup saat berpindah halaman.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenAt((prev) => {
      const next = typeof v === "function" ? v(prev === pathname) : v;
      return next ? pathname : null;
    });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Tutup saat klik di luar, fokus keluar, atau tekan Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenAt(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenAt(null);
        buttonRef.current?.focus();
      }
    }
    function onFocus(e: FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpenAt(null);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  const itemCls =
    "flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-500/10 hover:text-slate-100";

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Menu akun ${user.name}`}
        className="flex min-h-10 items-center gap-2 rounded-full border border-indigo-400/20 bg-slate-500/10 py-1 pl-1 pr-2 text-left transition hover:bg-slate-500/20"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-on-accent shadow-lg shadow-indigo-900/30"
        >
          {initials(user.name)}
        </span>
        <span
          aria-hidden="true"
          className="hidden min-w-0 leading-tight sm:block"
        >
          <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-100">
            {user.name}
          </span>
          <span className="block max-w-[9rem] truncate text-xs text-slate-400">
            {ROLE_LABEL[user.role]}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="surface-modal absolute right-0 z-50 mt-2 w-[min(15rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-indigo-400/20 shadow-2xl shadow-black/40"
          >
            <div className="flex items-center gap-3 border-b border-slate-500/15 px-4 py-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-on-accent"
              >
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-400">{user.email}</p>
              </div>
            </div>

            <ul className="p-1.5">
              <li>
                <Link
                  href="/profil"
                  onClick={() => setOpen(false)}
                  className={itemCls}
                >
                  <UserRound
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  Profil Saya
                </Link>
              </li>
              <li>
                <Link
                  href="/kebijakan-privasi"
                  onClick={() => setOpen(false)}
                  className={itemCls}
                >
                  <ShieldCheck
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  Kebijakan Privasi
                </Link>
              </li>
              <li>
                <Link
                  href="/syarat-ketentuan"
                  onClick={() => setOpen(false)}
                  className={itemCls}
                >
                  <FileText
                    className="h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  Syarat &amp; Ketentuan
                </Link>
              </li>
            </ul>

            <div className="border-t border-slate-500/15 p-1.5">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
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
