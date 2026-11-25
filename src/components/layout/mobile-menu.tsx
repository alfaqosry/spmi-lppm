"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MobileMenuContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
  desktopOpen: boolean;
  setDesktopOpen: (value: boolean) => void;
  toggleDesktop: () => void;
};

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

/**
 * Menyediakan status drawer menu mobile agar dapat dibuka dari Topbar
 * (tombol burger) dan dirender oleh Sidebar, meski keduanya komponen terpisah.
 * Juga menyimpan status sidebar desktop (bisa disembunyikan) — default tampil.
 */
export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const toggleDesktop = useCallback(() => setDesktopOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      desktopOpen,
      setDesktopOpen,
      toggleDesktop,
    }),
    [open, toggle, desktopOpen, toggleDesktop]
  );

  return (
    <MobileMenuContext.Provider value={value}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) {
    throw new Error("useMobileMenu harus dipakai di dalam MobileMenuProvider.");
  }
  return ctx;
}
