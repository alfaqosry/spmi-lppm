"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarRange,
  CircleDot,
  Clock,
  Pencil,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  ActionFeedback,
  Field,
  SubmitButton,
  useCloseOnSuccess,
  BTN_SECONDARY,
} from "@/components/ui/form";
import {
  createCycle,
  updateCycle,
  setActiveCycle,
  deactivateCycle,
  type ActionState,
} from "@/lib/actions/cycles";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { formatDate } from "@/lib/format";
import { DeleteCycleButton } from "@/components/cycles/delete-cycle-dialog";
import type { CycleImpactCounts } from "@/components/cycles/cycle-impact";

type CycleRow = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  open: boolean;
  /** Batas waktu (endDate) telah lewat. */
  expired: boolean;
} & CycleImpactCounts;

export function CycleManager({ cycles }: { cycles: CycleRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CycleRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeCycle = cycles.find((c) => c.isActive) ?? null;

  return (
    <div>
      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
            {notice}
          </p>
        )}
      </div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 transition hover:from-indigo-600 hover:to-violet-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Siklus Baru
        </button>
      </div>

      {cycles.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Belum ada siklus audit"
          description="Buat siklus pertama, misalnya “Siklus 2025/2026”, untuk memulai proses audit."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cycles.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card relative p-5"
            >
              {c.isActive && (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 to-indigo-400"
                />
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">{c.name}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(c.startDate)} — {formatDate(c.endDate)}
                  </p>
                </div>
                {c.isActive ? (
                  c.open ? (
                    <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                      <CircleDot className="mr-1 h-3 w-3" /> Aktif
                    </Badge>
                  ) : (
                    <Badge className="border-amber-400/30 bg-amber-500/10 text-amber-300">
                      <Clock className="mr-1 h-3 w-3" /> Lewat Batas
                    </Badge>
                  )
                ) : (
                  <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-400">
                    Arsip
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>{c.questions} pertanyaan</span>
                <span>{c.documents} dokumen</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {c.open
                    ? "Pengisian dibuka"
                    : c.isActive
                      ? "Pengisian ditutup (batas waktu)"
                      : "Pengisian ditutup"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!c.isActive && (
                  <ConfirmAction
                    action={() => setActiveCycle(c.id)}
                    title="Aktifkan siklus?"
                    tone="primary"
                    confirmLabel="Aktifkan"
                    onDone={() =>
                      setNotice(
                        activeCycle
                          ? `Siklus “${c.name}” sekarang aktif. Siklus “${activeCycle.name}” telah dinonaktifkan.`
                          : `Siklus “${c.name}” sekarang aktif.`
                      )
                    }
                    message={
                      <ActivateMessage cycle={c} activeCycle={activeCycle} />
                    }
                    trigger={
                      <>
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                        Aktifkan
                      </>
                    }
                    triggerClassName="flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                  />
                )}
                {c.isActive && (
                  <ConfirmAction
                    action={() => deactivateCycle(c.id)}
                    title="Nonaktifkan siklus?"
                    confirmLabel="Nonaktifkan"
                    onDone={() =>
                      setNotice(`Siklus “${c.name}” telah dinonaktifkan.`)
                    }
                    message={
                      <>
                        Setelah siklus{" "}
                        <strong className="text-slate-200">“{c.name}”</strong>{" "}
                        dinonaktifkan, auditee tidak dapat lagi mengisi jawaban
                        audit. Anda dapat mengaktifkannya kembali kapan saja.
                      </>
                    }
                    trigger={
                      <>
                        <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                        Nonaktifkan
                      </>
                    }
                    triggerClassName="flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Ubah
                </button>
                {/* Dipisah dari "Ubah" agar tidak salah klik (HE-04). */}
                <div className="ml-auto">
                  <DeleteCycleButton cycle={c} onDone={setNotice} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Siklus Audit Baru"
      >
        <CycleForm onDone={() => setCreating(false)} />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Ubah Siklus Audit"
      >
        {editing && (
          <CycleForm cycle={editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}

/** Penjelasan dampak mengaktifkan siklus (HE-11). */
function ActivateMessage({
  cycle,
  activeCycle,
}: {
  cycle: CycleRow;
  activeCycle: CycleRow | null;
}) {
  return (
    <>
      Siklus <strong className="text-slate-200">“{cycle.name}”</strong> akan
      menjadi siklus aktif dan auditee akan mengisi jawaban audit pada siklus
      ini.
      {activeCycle ? (
        <>
          {" "}
          Siklus{" "}
          <strong className="text-slate-200">“{activeCycle.name}”</strong> yang
          saat ini aktif akan <strong>dinonaktifkan</strong>, sehingga auditee
          tidak dapat lagi mengisi jawaban pada siklus tersebut.
        </>
      ) : null}
      {cycle.expired && (
        <span className="mt-1.5 block text-amber-200">
          Perhatian: batas waktu siklus ini ({formatDate(cycle.endDate)}) sudah
          lewat. Pengisian tetap tertutup sampai batas waktunya diubah melalui
          tombol Ubah.
        </span>
      )}
    </>
  );
}

function CycleForm({
  cycle,
  onDone,
}: {
  cycle?: CycleRow;
  onDone: () => void;
}) {
  const action = cycle ? updateCycle : createCycle;
  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    undefined
  );
  useCloseOnSuccess(state, onDone);

  return (
    <form action={formAction} className="space-y-4">
      {cycle && <input type="hidden" name="id" value={cycle.id} />}
      <ActionFeedback state={state} />
      <Field label="Nama Siklus">
        <input
          name="name"
          defaultValue={cycle?.name}
          placeholder="Siklus 2025/2026"
          className="input-base"
          required
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tanggal Mulai">
          <input
            type="date"
            name="startDate"
            defaultValue={cycle?.startDate}
            className="input-base"
            required
          />
        </Field>
        <Field label="Batas Waktu (Selesai)">
          <input
            type="date"
            name="endDate"
            defaultValue={cycle?.endDate}
            className="input-base"
            required
          />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 px-3 py-2.5">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={cycle?.isActive}
          className="h-4 w-4 accent-indigo-500"
        />
        <span className="text-xs text-slate-300">
          Jadikan siklus ini sebagai{" "}
          <strong className="text-white">siklus aktif</strong> (menonaktifkan
          siklus lain)
        </span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className={BTN_SECONDARY}>
          Batal
        </button>
        <SubmitButton label={cycle ? "Perbarui" : "Simpan"} />
      </div>
    </form>
  );
}
