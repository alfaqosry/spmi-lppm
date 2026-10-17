"use client";

import { useId, useRef, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BTN_DANGER, BTN_SECONDARY } from "@/components/ui/form";
import { deleteCycle } from "@/lib/actions/cycles";
import {
  cycleDeleteImpact,
  matchesConfirmation,
  type CycleImpactCounts,
} from "@/components/cycles/cycle-impact";

/**
 * Hapus siklus dengan ringkasan dampak & konfirmasi ketik nama (HE-04).
 * Penghapusan siklus berantai ke seluruh data siklus (01 §6), sehingga
 * tombol Hapus baru aktif setelah nama siklus diketik persis.
 */
export function DeleteCycleButton({
  cycle,
  onDone,
}: {
  cycle: { id: number; name: string; isActive: boolean } & CycleImpactCounts;
  onDone?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();

  const impact = cycleDeleteImpact(cycle);
  const confirmed = matchesConfirmation(typed, cycle.name);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };

  const run = () => {
    if (!confirmed || pending) return;
    setError(null);
    start(async () => {
      try {
        await deleteCycle(cycle.id);
        setOpen(false);
        setTyped("");
        onDone?.(
          `Siklus “${cycle.name}” beserta seluruh datanya telah dihapus.`
        );
      } catch {
        setError("Siklus gagal dihapus. Periksa koneksi Anda, lalu coba lagi.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Hapus
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Hapus siklus audit?"
        role="alertdialog"
        size="sm"
        icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
        description={
          <>
            Siklus <strong className="text-slate-200">“{cycle.name}”</strong>{" "}
            beserta <strong className="text-slate-200">seluruh data</strong> di
            dalamnya akan dihapus permanen untuk{" "}
            <strong className="text-slate-200">semua unit</strong>. Tindakan ini
            tidak dapat dibatalkan.
          </>
        }
        initialFocus={inputRef}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2.5 text-xs text-slate-300">
            <p className="font-semibold text-rose-200">
              Data yang ikut terhapus:
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {impact.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {cycle.isActive && (
              <p className="mt-2 font-medium text-amber-200">
                Siklus ini sedang aktif — auditee akan kehilangan akses
                pengisian. Pertimbangkan menonaktifkannya saja agar data tetap
                tersimpan sebagai arsip.
              </p>
            )}
          </div>

          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-medium text-slate-300"
          >
            Ketik <strong className="text-white">{cycle.name}</strong> untuk
            mengonfirmasi
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={hintId}
            aria-invalid={typed.length > 0 && !confirmed ? true : undefined}
            className="input-base"
            disabled={pending}
          />
          <p id={hintId} className="mt-1 text-[11px] text-slate-400">
            Tombol Hapus aktif setelah nama siklus diketik persis.
          </p>

          <div aria-live="assertive" className="empty:hidden">
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
              >
                {error}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className={BTN_SECONDARY}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!confirmed || pending}
              aria-busy={pending || undefined}
              className={BTN_DANGER}
            >
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {pending ? "Menghapus…" : "Hapus Permanen"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
