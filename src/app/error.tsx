"use client"; // Error boundary wajib Client Component.

import { ErrorView } from "@/components/layout/error-view";

/** Galat tak terduga di luar area dasbor (login, halaman publik). */
export default function Error({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  /** Next.js 16.2+: ambil ulang & render ulang segmen. */
  retry?: () => void;
  reset: () => void;
}) {
  return (
    <main
      id="konten-utama"
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <ErrorView
        error={error}
        onRetry={() => (retry ?? reset)()}
        homeHref="/"
        compact
      />
    </main>
  );
}
