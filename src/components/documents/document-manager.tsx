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
} from "@/components/ui/form";
import {
  createDocument,
  deleteDocument,
  type ActionState,
} from "@/lib/actions/documents";
import { Badge, EmptyState } from "@/components/ui/primitives";
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
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-violet-400"
          >
            <Plus className="h-4 w-4" /> Unggah Dokumen
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-semibold text-white">
                    {d.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">{d.cycleName}</p>
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
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
                  >
                    <FileText className="h-3.5 w-3.5" /> Lihat File
                  </a>
                )}
                {d.link && (
                  <a
                    href={d.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Buka Tautan
                  </a>
                )}
                {canManage && (
                  <form
                    action={deleteDocument.bind(null, d.id)}
                    onSubmit={(e) => {
                      if (!confirm(`Hapus dokumen “${d.title}”?`)) e.preventDefault();
                    }}
                  >
                    <button
                      className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                      aria-label="Hapus dokumen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <Modal open={creating} onClose={() => setCreating(false)} title="Unggah Dokumen">
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

      <Field label="Unggah File (PDF, maks 10MB)">
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-400/30 bg-indigo-500/5 px-3 py-3">
          <Upload className="h-4 w-4 text-indigo-300" />
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-200"
          />
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-700/60" />
        <span className="text-[11px] uppercase tracking-wide text-slate-500">
          atau
        </span>
        <span className="h-px flex-1 bg-slate-700/60" />
      </div>

      <Field label="Tautan / Link Dokumen">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            name="link"
            placeholder="https://drive.google.com/…"
            className="input-base pl-9"
          />
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-slate-600/50 px-4 py-2 text-sm text-slate-300 hover:bg-slate-500/10"
        >
          Batal
        </button>
        <SubmitButton label="Unggah" icon={<Upload className="h-4 w-4" />} />
      </div>
    </form>
  );
}
