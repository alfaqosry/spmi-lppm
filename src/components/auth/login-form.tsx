"use client";

import { useActionState } from "react";
import { AlertCircle, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { loginAction, type AuthState } from "@/lib/actions/auth";
import { Field, SubmitButton } from "@/components/ui/form";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  konfigurasi: "Login SSO belum dikonfigurasi. Silakan hubungi Admin LPM.",
  ditolak:
    "Permintaan masuk dibatalkan atau ditolak di halaman SSO. Silakan coba lagi.",
  state:
    "Sesi masuk SSO kedaluwarsa atau tidak valid. Silakan ulangi proses masuk.",
  gagal: "Masuk melalui SSO gagal. Silakan coba beberapa saat lagi.",
  nonaktif: "Akun Anda dinonaktifkan. Hubungi LPM untuk mengaktifkan kembali.",
  pemeliharaan: "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.",
  batas:
    "Terlalu banyak percobaan masuk. Tunggu beberapa menit, lalu coba lagi.",
};

export default function LoginForm({
  ssoConfigured,
  ssoHost,
  ssoError,
}: {
  ssoConfigured: boolean;
  ssoHost: string;
  ssoError?: string;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    loginAction,
    undefined
  );

  const ssoMessage = ssoError
    ? (SSO_ERROR_MESSAGES[ssoError] ?? "Login SSO gagal. Silakan coba lagi.")
    : null;
  const message = state?.error ?? ssoMessage;

  return (
    <div className="space-y-5">
      {/* SSO sebagai cara utama (akun institusi). */}
      {/* Route handler API (bukan halaman) — navigasi dokumen penuh wajib memakai <a>. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /api/sso/redirect adalah route handler OAuth */}
      <a
        href="/api/sso/redirect"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Masuk dengan SSO Universitas Pahlawan
      </a>
      <p className="-mt-3 text-center text-[11px] text-slate-500">
        {ssoConfigured ? (
          <>
            Terhubung ke <span className="text-slate-400">{ssoHost}</span>
          </>
        ) : (
          "Login SSO belum tersedia. Hubungi Admin LPM atau gunakan akun LPM di bawah."
        )}
      </p>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-700/60" />
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          atau
        </span>
        <span className="h-px flex-1 bg-slate-700/60" />
      </div>

      <form
        action={formAction}
        className="space-y-4"
        aria-label="Masuk dengan email"
      >
        <div aria-live="assertive" className="empty:hidden">
          {message && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{message}</span>
            </div>
          )}
        </div>

        <Field label="Email">
          <span className="relative block">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              placeholder="nama@universitaspahlawan.ac.id"
              className="input-base pl-9"
              required
            />
          </span>
        </Field>

        <Field label="Kata Sandi">
          <span className="relative block">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="input-base pl-9"
              required
            />
          </span>
        </Field>

        <div className="pt-1 [&>button]:w-full">
          <SubmitButton
            label="Masuk"
            pendingLabel="Memproses…"
            icon={<KeyRound className="h-4 w-4" />}
          />
        </div>
      </form>
    </div>
  );
}
