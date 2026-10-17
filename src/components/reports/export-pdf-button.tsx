"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import {
  exportErrorMessage,
  exportUrl,
  filenameFromDisposition,
  retryAfterSeconds,
} from "@/components/reports/export-pdf";

type ExportError = { message: string; status: number };

/**
 * Tombol unduh laporan PDF (HE-06). Mengambil PDF via `fetch` agar pengguna
 * mendapat status "Menyiapkan PDF…" dan pesan galat yang dapat ditindaklanjuti
 * (alih-alih JSON mentah pada halaman kosong).
 */
export function ExportPdfButton({
  cycleId,
  unitId,
  children,
  ariaLabel,
  className,
  busyLabel = "Menyiapkan PDF…",
  fallbackFilename = "Laporan_Audit_SPMI.pdf",
  align = "start",
  iconClassName = "h-3.5 w-3.5",
}: {
  cycleId: number;
  unitId?: number | null;
  /** Isi tombol (ikon unduh ditambahkan otomatis). */
  children: ReactNode;
  /** Label aksesibel (mis. "Unduh laporan PDF Prodi Informatika"). */
  ariaLabel?: string;
  className?: string;
  busyLabel?: string;
  fallbackFilename?: string;
  /** Perataan pesan galat terhadap tombol. */
  align?: "start" | "end";
  iconClassName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ExportError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(exportUrl(cycleId, unitId), {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/pdf" },
      });
      const type = res.headers.get("Content-Type") ?? "";
      if (!res.ok || !type.includes("application/pdf")) {
        // Pengalihan ke halaman login (sesi habis) juga dianggap 401.
        const status = res.ok
          ? res.redirected && new URL(res.url).pathname.startsWith("/login")
            ? 401
            : 500
          : res.status;
        setError({
          status,
          message: exportErrorMessage(
            status,
            retryAfterSeconds(res.headers.get("Retry-After"))
          ),
        });
        return;
      }
      const blob = await res.blob();
      const filename = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        fallbackFilename
      );
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      if (controller.signal.aborted) return;
      setError({
        status: 0,
        message:
          "Laporan gagal diunduh. Periksa koneksi internet Anda, lalu coba lagi.",
      });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <span
      className={`inline-flex max-w-full flex-col gap-1 ${
        align === "end" ? "items-end text-right" : "items-start"
      }`}
    >
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label={busy ? busyLabel : ariaLabel}
        className={`${className ?? ""} disabled:cursor-wait disabled:opacity-70`}
      >
        {busy ? (
          <Loader2
            className={`${iconClassName} animate-spin`}
            aria-hidden="true"
          />
        ) : (
          <Download className={iconClassName} aria-hidden="true" />
        )}
        {busy ? busyLabel : children}
      </button>
      <span aria-live="polite" className="empty:hidden">
        {error && (
          <span
            role="alert"
            className="block max-w-xs rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-left text-xs font-normal text-rose-200"
          >
            {error.message}
            {error.status === 401 && (
              <>
                {" "}
                <Link
                  href="/login"
                  className="font-semibold text-rose-100 underline"
                >
                  Login ulang
                </Link>
              </>
            )}
          </span>
        )}
      </span>
    </span>
  );
}
