"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { loginAction, type AuthState } from "@/lib/actions/auth";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  state: "Sesi SSO tidak valid (state tidak cocok). Silakan coba lagi.",
  konfigurasi: "Konfigurasi SSO belum lengkap. Hubungi Admin LPM.",
  token: "Gagal menukar kode otorisasi dengan SSO. Silakan coba lagi.",
  identitas: "SSO tidak mengembalikan identitas pengguna.",
  nonaktif: "Akun Anda tidak aktif. Hubungi Admin LPM.",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Memproses…
        </>
      ) : (
        "Masuk"
      )}
    </button>
  );
}

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
    ? SSO_ERROR_MESSAGES[ssoError] ?? "Login SSO gagal. Silakan coba lagi."
    : null;

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        {(state?.error || ssoMessage) && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state?.error ?? ssoMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-slate-300">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@universitas.ac.id"
              className="input-base pl-9"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-slate-300">
            Kata Sandi
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="input-base pl-9"
              required
            />
          </div>
        </div>

        <SubmitButton />
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-700/60" />
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          atau
        </span>
        <span className="h-px flex-1 bg-slate-700/60" />
      </div>

      <a
        href="/api/sso/redirect"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
      >
        <ShieldCheck className="h-4 w-4" />
        Login via SSO UP
      </a>

      <p className="text-center text-[11px] text-slate-500">
        {ssoConfigured ? (
          <>
            Terhubung ke <span className="text-slate-400">{ssoHost}</span>
          </>
        ) : (
          <>
            SSO belum dikonfigurasi — isi{" "}
            <code className="rounded bg-slate-500/10 px-1 py-0.5 text-slate-400">
              SSO_CLIENT_ID
            </code>{" "}
            &amp;{" "}
            <code className="rounded bg-slate-500/10 px-1 py-0.5 text-slate-400">
              SSO_CLIENT_SECRET
            </code>{" "}
            pada <code className="text-slate-400">.env</code>.
          </>
        )}
      </p>

    </div>
  );
}
