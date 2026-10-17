"use client"; // Error boundary wajib Client Component.

import { ErrorView } from "@/components/layout/error-view";

/**
 * Galat pada halaman dasbor. Dirender di dalam layout dasbor sehingga
 * sidebar & topbar tetap tersedia untuk navigasi (pemulihan cepat).
 */
export default function DashboardError({
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
    <ErrorView
      error={error}
      onRetry={() => (retry ?? reset)()}
      homeHref="/dashboard"
    />
  );
}
