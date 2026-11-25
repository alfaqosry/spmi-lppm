"use client";

import type { ReactNode } from "react";
import { useMobileMenu } from "@/components/layout/mobile-menu";

/**
 * Kolom konten di sebelah sidebar. Padding kiri mengikuti status sidebar
 * desktop: 268px saat tampil, 0 saat disembunyikan.
 */
export function ContentColumn({ children }: { children: ReactNode }) {
  const { desktopOpen } = useMobileMenu();

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ${
        desktopOpen ? "lg:pl-[268px]" : "lg:pl-0"
      }`}
    >
      {children}
    </div>
  );
}
