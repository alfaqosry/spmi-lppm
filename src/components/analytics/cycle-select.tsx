"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cycleHref } from "@/components/analytics/cycle-href";

/**
 * Pemilih siklus pada halaman Analitik (HE-07 / TC-ANL-08).
 *
 * Sebelumnya dropdown hanya diterapkan setelah tombol "Tampilkan" diklik,
 * sehingga tombol "Unduh Laporan PDF" (yang memakai siklus yang sedang
 * ditampilkan) dapat mengekspor siklus berbeda dari yang terlihat dipilih.
 * Kini perubahan pilihan langsung memuat ulang halaman untuk siklus tersebut,
 * sehingga data di layar, dropdown, dan ekspor PDF selalu konsisten.
 * Perilaku ini diumumkan lewat teks petunjuk (WCAG 3.2.2 On Input). Tanpa
 * JavaScript, formulir GET + tombol "Tampilkan" tetap berfungsi.
 */
export function CycleSelect({
  cycles,
  selectedId,
  children,
}: {
  cycles: { id: number; name: string; isActive: boolean }[];
  selectedId: number;
  /**
   * Aksi yang bergantung pada siklus terpilih (mis. tombol ekspor PDF).
   * Dinonaktifkan (inert) selama halaman memuat siklus baru agar tidak
   * mengekspor siklus lama.
   */
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const hintId = useId();
  // Nilai terkontrol yang mengikuti siklus yang ditampilkan (mis. setelah
  // tombol Kembali) tanpa me-remount <select> sehingga fokus tidak hilang.
  const [value, setValue] = useState(selectedId);
  const [shownId, setShownId] = useState(selectedId);
  if (shownId !== selectedId) {
    setShownId(selectedId);
    setValue(selectedId);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        role="search"
        aria-label="Pilih siklus"
        aria-busy={pending || undefined}
      >
        <label htmlFor="cycleId" className="sr-only">
          Siklus audit
        </label>
        <select
          id="cycleId"
          name="cycleId"
          value={value}
          aria-describedby={hintId}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!next) return;
            setValue(next);
            if (next === selectedId) return;
            start(() => {
              router.push(cycleHref(pathname, next), { scroll: false });
            });
          }}
          className="input-base max-w-[220px]"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.isActive ? "(aktif)" : ""}
            </option>
          ))}
        </select>
        <span id={hintId} className="sr-only">
          Halaman langsung menampilkan siklus yang dipilih.
        </span>
        {pending && (
          <span
            role="status"
            className="flex items-center gap-1.5 text-xs text-slate-400"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Memuat…
          </span>
        )}
        <noscript>
          <button
            type="submit"
            className="min-h-10 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
          >
            Tampilkan
          </button>
        </noscript>
      </form>
      {children && (
        <div
          inert={pending}
          aria-busy={pending || undefined}
          className={pending ? "opacity-60" : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
