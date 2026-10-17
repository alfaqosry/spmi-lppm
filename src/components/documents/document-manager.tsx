"use client";

import { useActionState, useState } from "react";
import {
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Trash2,
  Upload,
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
  createDocument,
  deleteDocument,
  type ActionState,
} from "@/lib/actions/documents";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/format";

type DocRow = {
  id: number;
  title: string;
  cycleName: string;
  filePath: string | null;
  link: string | null;
  uploaderName: string;
  createdAt: string;
};

export function DocumentManager({
  type,
  canManage,
  cycles,
  documents,
}: {
  type: "penetapan" | "evaluasi";
  canManage: boolean;
  cycles: { id: number; name: string }[];
  documents: DocRow[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 hover:from-indigo-600 hover:to-violet-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Unggah Dokumen
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`Belum ada dokumen ${type}`}
          description={
            canManage
              ? "Unggah dokumen pertama untuk dibagikan kepada unit yang diaudit."
              : "LPM belum mempublikasikan dokumen pada kategori ini."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((d) => (
            <div key={d.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300"
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-sm font-semibold break-words text-white">
                    {d.title}
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {d.cycleName}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {d.filePath && (
                  <Badge className="border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
                    PDF
                  </Badge>
                )}
                {d.link && (
                  <Badge className="border-sky-400/25 bg-sky-500/10 text-sky-300">
                    Tautan
                  </Badge>
                )}
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                {d.uploaderName} • {formatDateTime(d.createdAt)}
              </p>

              <div className="mt-4 flex flex-1 items-end gap-2">
                {d.filePath && (
                  <a
                    href={d.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                    Lihat File
                    <span className="sr-only">
                      {" "}
                      {d.title} (membuka tab baru)
                    </span>
                  </a>
                )}
                {d.link && (
                  <a
                    href={d.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                    Buka Tautan
                    <span className="sr-only">
                      {" "}
                      {d.title} (membuka tab baru)
                    </span>
                  </a>
                )}
                {canManage && (
                  <ConfirmAction
                    action={() => deleteDocument(d.id)}
                    title="Hapus dokumen?"
                    message={
                      <>
                        Dokumen{" "}
                        <strong className="text-slate-200">“{d.title}”</strong>{" "}
                        akan dihapus permanen dan tidak lagi dapat diakses unit.
                        Tindakan ini tidak dapat dibatalkan.
                      </>
                    }
                    triggerLabel={`Hapus dokumen ${d.title}`}
                    trigger={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <Modal
          open={creating}
          onClose={() => setCreating(false)}
          title="Unggah Dokumen"
        >
          <DocForm
            type={type}
            cycles={cycles}
            onDone={() => setCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function DocForm({
  type,
  cycles,
  onDone,
}: {
  type: "penetapan" | "evaluasi";
  cycles: { id: number; name: string }[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createDocument,
    undefined
  );
  useCloseOnSuccess(state, onDone);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <ActionFeedback state={state} />

      <Field label="Siklus Audit">
        <select name="cycleId" className="input-base" required>
          <option value="">Pilih siklus…</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Judul Dokumen">
        <input
          name="title"
          placeholder="SK Penetapan Standar Mutu 2025"
          className="input-base"
          required
        />
      </Field>

      <Field
        label="Unggah File"
        hint="Format PDF, maksimal 10 MB. Isi berkas atau tautan."
      >
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-400/30 bg-indigo-500/5 px-3 py-3">
          <Upload
            className="h-4 w-4 shrink-0 text-indigo-300"
            aria-hidden="true"
          />
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-200"
          />
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-slate-700/60" />
        <span className="text-[11px] uppercase tracking-wide text-slate-500">
          atau
        </span>
        <span className="h-px flex-1 bg-slate-700/60" />
      </div>

      <Field
        label="Tautan / Link Dokumen"
        hint="Opsional bila berkas sudah diunggah. Diawali https://"
      >
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            name="link"
            type="url"
            inputMode="url"
            placeholder="https://drive.google.com/…"
            className="input-base pl-9"
          />
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className={BTN_SECONDARY}>
          Batal
        </button>
        <SubmitButton
          label="Unggah"
          pendingLabel="Mengunggah…"
          icon={<Upload className="h-4 w-4" />}
        />
      </div>
    </form>
  );
}
