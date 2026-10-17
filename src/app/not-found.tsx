import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Home, LogIn } from "lucide-react";
import { LegalFooter } from "@/components/legal/legal-footer";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan",
  description:
    "Halaman yang Anda cari tidak tersedia di Sistem Informasi SPMI.",
  robots: { index: false, follow: true },
};

/** 404 — juga menangani seluruh URL yang tidak cocok. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <main
        id="konten-utama"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 focus:outline-none"
      >
        <div className="card w-full max-w-lg p-6 text-center sm:p-8">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10 text-indigo-300"
          >
            <Compass className="h-7 w-7" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
            Galat 404
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">
            Halaman tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Alamat yang Anda buka mungkin salah ketik, sudah dipindahkan, atau
            tidak lagi tersedia. Periksa kembali URL atau kembali ke halaman
            utama.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/30 transition hover:from-indigo-600 hover:to-violet-600"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Ke Dashboard
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-600/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-500/10"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Halaman Masuk
            </Link>
          </div>
        </div>
      </main>
      <LegalFooter className="px-4 pb-6" />
    </div>
  );
}
