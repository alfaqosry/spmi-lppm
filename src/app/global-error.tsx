"use client"; // Error boundary wajib Client Component.

import "./globals.css";

/**
 * Fallback terakhir bila root layout gagal dirender. Menggantikan seluruh
 * dokumen sehingga wajib mendefinisikan <html> & <body> sendiri. Metadata
 * tidak didukung di sini — gunakan elemen <title> React.
 * Tidak memakai skrip inline (patuh CSP berbasis nonce/hash).
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  /** Next.js 16.2+: ambil ulang & render ulang. */
  retry?: () => void;
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        <title>Terjadi Kesalahan · SPMI Universitas Pahlawan</title>
        <main
          id="konten-utama"
          className="flex min-h-screen items-center justify-center px-4 py-10"
        >
          <div
            role="alert"
            className="card w-full max-w-lg p-6 text-center sm:p-8"
          >
            <h1 className="text-xl font-semibold text-white">
              Sistem sedang mengalami gangguan
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Maaf, halaman tidak dapat ditampilkan. Silakan coba lagi beberapa
              saat lagi. Data yang sudah tersimpan tidak hilang.
            </p>
            {error.digest && (
              <p className="mt-3 text-[11px] text-slate-500">
                Kode referensi:{" "}
                <code className="font-mono">{error.digest}</code>
              </p>
            )}
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => (retry ?? reset)()}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent"
              >
                Coba lagi
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-600/50 px-4 py-2 text-sm font-medium text-slate-300"
              >
                Ke beranda
              </a>
            </div>
            <p className="mt-5 text-[11px] text-slate-500">
              Hubungi LPM:{" "}
              <a
                href="mailto:lpm@universitaspahlawan.ac.id"
                className="underline"
              >
                lpm@universitaspahlawan.ac.id
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
