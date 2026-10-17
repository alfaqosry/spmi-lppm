"use client";

import { useActionState, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  ActionFeedback,
  Field,
  SubmitButton,
  useCloseOnSuccess,
  BTN_SECONDARY,
} from "@/components/ui/form";
import {
  createUnit,
  updateUnit,
  deleteUnit,
  type ActionState,
} from "@/lib/actions/units";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/confirm-dialog";

export const UNIT_CATEGORIES = [
  "Program Studi",
  "Wakil Rektor",
  "Pusat",
  "Perpustakaan",
  "Biro",
  "Lembaga",
  "Unit Lainnya",
];

export type UnitRow = {
  id: number;
  name: string;
  category: string;
  description: string;
  userCount: number;
};

export function UnitManager({ units }: { units: UnitRow[] }) {
  return <UnitTab units={units} />;
}

export function UnitTab({ units }: { units: UnitRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UnitRow | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 hover:from-indigo-600 hover:to-violet-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Unit Baru
        </button>
      </div>

      {units.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Belum ada unit audit"
          description="Tambahkan unit seperti Program Studi, Biro, atau Pusat untuk memulai."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => (
            <div key={u.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-white">
                    {u.name}
                  </h2>
                  <Badge className="mt-1.5 border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
                    {u.category}
                  </Badge>
                </div>
                <div
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300"
                >
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              {u.description && (
                <p className="mt-3 line-clamp-2 text-xs text-slate-400">
                  {u.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {u.userCount} akun
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(u)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/25 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                    aria-label={`Ubah unit ${u.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <ConfirmAction
                    action={() => deleteUnit(u.id)}
                    title="Hapus unit audit?"
                    message={
                      <>
                        Unit{" "}
                        <strong className="text-slate-200">“{u.name}”</strong>{" "}
                        beserta penempatan akunnya akan dihapus permanen.
                        Tindakan ini tidak dapat dibatalkan.
                      </>
                    }
                    triggerLabel={`Hapus unit ${u.name}`}
                    trigger={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Unit Audit Baru"
      >
        <UnitForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Ubah Unit Audit"
      >
        {editing && <UnitForm unit={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

export function UnitForm({
  unit,
  onDone,
}: {
  unit?: UnitRow;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    unit ? updateUnit : createUnit,
    undefined
  );
  useCloseOnSuccess(state, onDone);

  return (
    <form action={formAction} className="space-y-4">
      {unit && <input type="hidden" name="id" value={unit.id} />}
      <ActionFeedback state={state} />
      <Field label="Nama Unit">
        <input
          name="name"
          defaultValue={unit?.name}
          placeholder="Program Studi Teknik Informatika"
          className="input-base"
          required
        />
      </Field>
      <Field label="Kategori">
        <select
          name="category"
          defaultValue={unit?.category}
          className="input-base"
          required
        >
          <option value="">Pilih kategori…</option>
          {UNIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Deskripsi (opsional)">
        <textarea
          name="description"
          defaultValue={unit?.description}
          rows={3}
          className="input-base resize-none"
          placeholder="Keterangan singkat unit…"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className={BTN_SECONDARY}>
          Batal
        </button>
        <SubmitButton label={unit ? "Perbarui" : "Simpan"} />
      </div>
    </form>
  );
}
