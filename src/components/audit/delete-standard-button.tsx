"use client";

import { useId, useRef, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BTN_DANGER, BTN_SECONDARY } from "@/components/ui/form";
import type { StandardDeleteImpact } from "@/components/audit/audit-helpers";

type ActionResult = { ok?: boolean; error?: string } | void | undefined | null;

/**
 * HE-03: konfirmasi hapus standar yang menyebutkan dampak nyata.
 * Standar berlaku per SIKLUS — menghapusnya dari tab mana pun menghapus
 * butir & jawaban di SEMUA kategori/unit. Bila standar memiliki butir,
 * pengguna wajib mengetik nama standar sebagai konfirmasi eksplisit.
 */
export function DeleteStandardButton({
  standardName,
  cycleName,
  impact,
  action,
}: {
  standardName: string;
  cycleName: string;
  impact: StandardDeleteImpact;
  action: () => Promise<ActionResult> | ActionResult;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const hintId = useId();

  const requireTyping = impact.questionCount > 0;
  const matches =
    !requireTyping ||
    typed.trim().toLocaleLowerCase("id") ===
      standardName.trim().toLocaleLowerCase("id");

  const close = () => {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };

  const run = () => {
    if (!matches) return;
    setError(null);
    start(async () => {
      try {
        const res = await action();
        if (res && typeof res === "object" && res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        setTyped("");
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
        aria-label={`Hapus standar ${standardName}`}
        title={`Hapus standar ${standardName}`}
        aria-haspopup="dialog"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-rose-300"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Hapus standar dari seluruh siklus?"
        role="alertdialog"
        size="sm"
        icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
        description={
          <>
            Standar <strong className="text-slate-200">“{standardName}”</strong>{" "}
            berlaku untuk seluruh siklus{" "}
            <strong className="text-slate-200">{cycleName}</strong>, bukan hanya
            tab yang sedang dibuka.
          </>
        }
        initialFocus={cancelRef}
      >
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-100">
          {impact.questionCount === 0 ? (
            <p>Standar ini belum memiliki butir pertanyaan maupun jawaban.</p>
          ) : (
            <>
              <p className="mb-1.5 font-semibold">
                Yang akan dihapus permanen:
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <strong>{impact.questionCount}</strong> butir pertanyaan di{" "}
                  <strong>{impact.scopes.length}</strong> cakupan (
                  {impact.scopes.join(", ")})
                </li>
                <li>
                  <strong>{impact.responseCount}</strong> jawaban dari{" "}
                  <strong>{impact.unitCount}</strong> unit
                  {impact.evidenceCount > 0 && (
                    <>
                      , termasuk <strong>{impact.evidenceCount}</strong> berkas
                      bukti
                    </>
                  )}
                </li>
              </ul>
              <p className="mt-1.5">Tindakan ini tidak dapat dibatalkan.</p>
            </>
          )}
        </div>

        {requireTyping && (
          <div className="mb-4">
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-xs font-medium text-slate-300"
            >
              Ketik nama standar untuk mengonfirmasi
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  run();
                }
              }}
              aria-describedby={hintId}
              autoComplete="off"
              spellCheck={false}
              className="input-base"
              disabled={pending}
            />
            <p id={hintId} className="mt-1 text-xs text-slate-500">
              Ketik persis:{" "}
              <span className="text-slate-300">{standardName}</span>
            </p>
          </div>
        )}

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
            disabled={pending || !matches}
            aria-busy={pending || undefined}
            className={BTN_DANGER}
          >
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {pending ? "Menghapus…" : "Hapus permanen"}
          </button>
        </div>
      </Modal>
    </>
  );
}
