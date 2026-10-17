"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import type { ActionState } from "@/lib/actions/cycles";

/* ------------------------------------------------------------------------ */
/*  Tombol                                                                  */
/* ------------------------------------------------------------------------ */

/** Kelas tombol standar agar konsisten di seluruh aplikasi. */
export const BTN_PRIMARY =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/30 transition hover:from-indigo-600 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_SECONDARY =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-600/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_DANGER =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-rose-900/30 transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60";

export function SubmitButton({
  label = "Simpan",
  pendingLabel = "Menyimpan…",
  icon,
  disabled,
}: {
  label?: string;
  pendingLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={BTN_PRIMARY}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="inline-flex">
          {icon ?? <Save className="h-4 w-4" />}
        </span>
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/*  Umpan balik aksi (live region)                                          */
/* ------------------------------------------------------------------------ */

/**
 * Pesan hasil aksi server. Wadah aria-live selalu dirender agar pembaca
 * layar mengumumkan perubahan (WCAG 4.1.3 Status Messages).
 */
export function ActionFeedback({
  state,
  successMessage = "Berhasil disimpan.",
}: {
  state: ActionState;
  successMessage?: string;
}) {
  return (
    <div aria-live="polite" aria-atomic="true" className="empty:hidden">
      {state?.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>{state.error}</span>
        </div>
      ) : state?.ok ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
        >
          <CheckCircle2
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>{successMessage}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*  Validasi inline berbahasa Indonesia                                     */
/* ------------------------------------------------------------------------ */

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Terjemahkan ValidityState bawaan browser ke pesan Indonesia yang jelas. */
export function validationMessage(el: Control): string {
  const v = el.validity;
  const type = (el as HTMLInputElement).type;
  if (v.valueMissing) {
    if (type === "file") return "Pilih berkas terlebih dahulu.";
    if (type === "checkbox") return "Centang kotak ini untuk melanjutkan.";
    if (type === "radio") return "Pilih salah satu opsi.";
    if (el instanceof HTMLSelectElement) return "Pilih salah satu opsi.";
    return "Kolom ini wajib diisi.";
  }
  if (v.typeMismatch) {
    if (type === "email")
      return "Masukkan alamat email yang valid, mis. nama@universitaspahlawan.ac.id.";
    if (type === "url") return "Masukkan URL yang valid, diawali https://.";
    return "Format isian tidak sesuai.";
  }
  if (v.tooShort) {
    const input = el as HTMLInputElement;
    return `Minimal ${input.minLength} karakter (saat ini ${input.value.length}).`;
  }
  if (v.tooLong) {
    const input = el as HTMLInputElement;
    return `Maksimal ${input.maxLength} karakter.`;
  }
  if (v.rangeUnderflow) return `Nilai minimal ${(el as HTMLInputElement).min}.`;
  if (v.rangeOverflow) return `Nilai maksimal ${(el as HTMLInputElement).max}.`;
  if (v.stepMismatch) return "Nilai tidak sesuai kelipatan yang diizinkan.";
  if (v.badInput)
    return type === "number"
      ? "Masukkan angka yang valid."
      : "Isian tidak valid.";
  if (v.patternMismatch) return el.title || "Format isian tidak sesuai.";
  if (v.customError) return el.validationMessage;
  return "Isian tidak valid.";
}

function findControl(root: HTMLElement | null): Control | null {
  return (
    root?.querySelector<Control>(
      "input:not([type='hidden']), select, textarea"
    ) ?? null
  );
}

/**
 * Label + kontrol + petunjuk + pesan galat inline.
 * - Label terhubung ke kontrol (elemen <label> membungkus kontrol).
 * - Petunjuk & galat dihubungkan via aria-describedby.
 * - Validasi HTML (required, type=email, minLength, …) ditampilkan sebagai
 *   pesan Indonesia di bawah kolom, bukan gelembung bawaan browser.
 * - `error` dari server (opsional) ditampilkan dengan cara yang sama.
 */
export function Field({
  label,
  children,
  hint,
  error,
  labelHidden = false,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  labelHidden?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const ref = useRef<HTMLLabelElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [required, setRequired] = useState(false);
  const shown = error ?? clientError;

  // Hubungkan petunjuk/galat ke kontrol & tandai status tidak valid.
  useEffect(() => {
    const el = findControl(ref.current);
    if (!el) return;
    setRequired(el.required);
    const ids = [hint ? hintId : null, shown ? errId : null].filter(Boolean);
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
    else el.removeAttribute("aria-describedby");
    if (shown) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  }, [shown, hint, hintId, errId]);

  return (
    <label
      ref={ref}
      className="block space-y-1.5"
      onInvalidCapture={(e) => {
        const el = e.target as EventTarget as Control;
        // Ganti gelembung bawaan browser dengan pesan inline.
        e.preventDefault();
        setClientError(validationMessage(el));
        const form = el.form;
        if (form && form.querySelector(":invalid") === el) el.focus();
      }}
      onInputCapture={(e) => {
        const el = e.target as EventTarget as Control;
        if (clientError && el.validity?.valid) setClientError(null);
      }}
      onChangeCapture={(e) => {
        const el = e.target as EventTarget as Control;
        if (clientError && el.validity?.valid) setClientError(null);
      }}
    >
      <span
        className={
          labelHidden ? "sr-only" : "block text-xs font-medium text-slate-300"
        }
      >
        {label}
        {required && !labelHidden && (
          <span className="ml-0.5 text-rose-300" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span id={hintId} className="block text-[11px] text-slate-500">
          {hint}
        </span>
      )}
      <span id={errId} aria-live="polite" className="block empty:hidden">
        {shown ? (
          <span className="flex items-start gap-1 text-[11px] font-medium text-rose-300">
            <AlertCircle
              className="mt-px h-3 w-3 shrink-0"
              aria-hidden="true"
            />
            {shown}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Hook pembantu: tutup modal otomatis setelah aksi sukses (sekali per hasil). */
export function useCloseOnSuccess(state: ActionState, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!state?.ok) return;
    // Beri jeda singkat agar pesan sukses sempat terbaca/diumumkan.
    const t = setTimeout(() => closeRef.current(), 700);
    return () => clearTimeout(t);
  }, [state]);
}

export type { ActionState };
export { useActionState };
