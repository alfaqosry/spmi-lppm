"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { CONTACT_EMAIL } from "@/components/legal/site";

/**
 * Tampilan galat yang ramah (Nielsen #9: bantu pengguna mengenali,
 * mendiagnosis, dan pulih dari kesalahan). Dipakai oleh error.tsx.
 */
export function ErrorView({
  error,
  onRetry,
  homeHref = "/",
  compact = false,
}: {
  error: Error & { digest?: string };
  onRetry: () => void;
  homeHref?: string;
  compact?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Pindahkan fokus ke judul agar pembaca layar langsung mengumumkan galat.
    headingRef.current?.focus();
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className={`card mx-auto w-full max-w-lg p-6 text-center sm:p-8 ${compact ? "" : "mt-6"}`}
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-300"
      >
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-white focus:outline-none"
      >
        Terjadi kesalahan saat memuat halaman
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Maaf, permintaan Anda tidak dapat diproses. Ini bisa terjadi karena
        gangguan koneksi atau server sedang sibuk. Data yang sudah tersimpan
        tidak hilang.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-slate-500">
          Kode referensi:{" "}
          <code className="font-mono text-slate-400">{error.digest}</code>
        </p>
      )}
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/30 transition hover:from-indigo-600 hover:to-violet-600"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Coba lagi
        </button>
        <Link
          href={homeHref}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-600/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-500/10"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Ke beranda
        </Link>
      </div>
      <p className="mt-5 text-xs text-slate-500">
        Masalah berlanjut? Hubungi LPM di{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Laporan Galat SPMI")}${
            error.digest
              ? `&body=${encodeURIComponent(`Kode referensi: ${error.digest}`)}`
              : ""
          }`}
          className="text-indigo-300 underline underline-offset-2"
        >
          {CONTACT_EMAIL}
        </a>
        {error.digest ? " dan sertakan kode referensi di atas." : "."}
      </p>
    </div>
  );
}
