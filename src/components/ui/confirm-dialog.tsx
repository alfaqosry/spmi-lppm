"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui/form";

type ActionResult = { ok?: boolean; error?: string } | void | undefined | null;

/**
 * Tombol pemicu + dialog konfirmasi untuk tindakan destruktif/berisiko
 * (Nielsen #5 pencegahan kesalahan). Menggantikan `window.confirm()` dengan
 * dialog yang konsisten, dapat diakses (role="alertdialog"), menampilkan
 * status proses, dan menampilkan galat dari server di dalam dialog.
 */
export function ConfirmAction({
  action,
  title,
  message,
  confirmLabel = "Hapus",
  tone = "danger",
  trigger,
  triggerLabel,
  triggerClassName,
  onDone,
}: {
  /** Aksi server/klien yang dijalankan setelah pengguna mengonfirmasi. */
  action: () => Promise<ActionResult> | ActionResult;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  /** Isi tombol pemicu (ikon / teks). */
  trigger: ReactNode;
  /** Label aksesibel tombol pemicu (wajib untuk tombol ikon). */
  triggerLabel?: string;
  triggerClassName?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(null);
  };

  const run = () => {
    setError(null);
    start(async () => {
      try {
        const res = await action();
        if (res && typeof res === "object" && res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        onDone?.();
      } catch {
        setError(
          "Tindakan gagal diproses. Periksa koneksi Anda, lalu coba lagi."
        );
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="dialog"
        className={triggerClassName}
      >
        {trigger}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={title}
        role="alertdialog"
        size="sm"
        icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
        description={message}
        // Fokus awal pada "Batal" agar Enter tidak langsung menghapus.
        initialFocus={cancelRef}
      >
        <div aria-live="assertive" className="empty:hidden">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={close}
            disabled={pending}
            className={BTN_SECONDARY}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            aria-busy={pending || undefined}
            className={tone === "danger" ? BTN_DANGER : BTN_PRIMARY}
          >
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {pending ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}
