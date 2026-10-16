"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import type { ActionState } from "@/lib/actions/cycles";

export function SubmitButton({
  label = "Simpan",
  icon,
}: {
  label?: string;
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        icon ?? <Save className="h-4 w-4" />
      )}
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

export function ActionFeedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{state.error}</span>
      </div>
    );
  }
  if (state.ok) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Berhasil disimpan.</span>
      </div>
    );
  }
  return null;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

/** Hook pembantu: tutup modal otomatis setelah aksi sukses. */
export function useCloseOnSuccess(state: ActionState, onClose: () => void) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (state?.ok && !seen) {
      setSeen(true);
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [state, seen, onClose]);
}

export type { ActionState };
export { useActionState };
