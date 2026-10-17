"use client";

import { KeyRound } from "lucide-react";
import {
  ActionFeedback,
  Field,
  SubmitButton,
  useActionState,
} from "@/components/ui/form";
import { changePasswordAction } from "@/lib/actions/profile";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from "@/lib/password";

export function ChangePasswordForm({ ssoOnly }: { ssoOnly: boolean }) {
  const [state, action] = useActionState(changePasswordAction, undefined);

  if (ssoOnly) {
    return (
      <div
        role="note"
        className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-200"
      >
        Akun ini terhubung melalui SSO Universitas Pahlawan. Kata sandi dikelola
        pada halaman SSO, sehingga tidak dapat diubah dari sini.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field label="Kata sandi saat ini">
        <input
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          className="input-base"
          placeholder="••••••••"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kata sandi baru" hint={PASSWORD_POLICY_HINT}>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="input-base"
            placeholder="••••••••"
          />
        </Field>
        <Field label="Konfirmasi kata sandi baru">
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="input-base"
            placeholder="••••••••"
          />
        </Field>
      </div>

      <ActionFeedback state={state} />

      <div className="flex justify-end">
        <SubmitButton
          label="Ubah Kata Sandi"
          icon={<KeyRound className="h-4 w-4" />}
        />
      </div>
    </form>
  );
}
