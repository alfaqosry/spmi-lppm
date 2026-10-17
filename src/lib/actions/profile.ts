"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  revokeUserSessions,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { requireUser } from "@/lib/guards";
import { toActionError } from "@/lib/errors";
import { validatePassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/ratelimit";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";

export type ProfileActionState = { ok?: boolean; error?: string } | undefined;

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    const session = await requireUser();
    // Cegah tebak kata sandi lama via form ini.
    enforceRateLimit(`pwchange:${session.id}`, 5, 60_000);

    const current = String(formData.get("currentPassword") ?? "");
    const next = String(formData.get("newPassword") ?? "");
    const confirm = String(formData.get("confirmPassword") ?? "");

    if (!current || !next || !confirm) {
      return { error: "Semua kolom kata sandi wajib diisi." };
    }
    const policyErr = validatePassword(next, { email: session.email });
    if (policyErr) return { error: policyErr };
    if (next !== confirm) {
      return { error: "Konfirmasi kata sandi tidak cocok." };
    }
    if (next === current) {
      return {
        error: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, password: true },
    });
    if (!user) {
      return { error: "Akun tidak ditemukan." };
    }

    // Akun yang hanya terhubung lewat SSO belum punya kata sandi lokal.
    if (!user.password) {
      return {
        error:
          "Akun ini terhubung melalui SSO dan belum memiliki kata sandi lokal. Kelola kata sandi melalui penyedia SSO.",
      };
    }

    const valid = await verifyPassword(current, user.password);
    if (!valid) {
      return { error: "Kata sandi saat ini salah." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(next) },
    });
    // Cabut seluruh sesi lain, lalu terbitkan sesi baru untuk perangkat ini.
    const sv = await revokeUserSessions(user.id);
    await setSessionCookie({ id: user.id, sessionVersion: sv });
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "auth.password_change",
      entity: "user",
      entityId: user.id,
      detail: "Mengganti kata sandi (seluruh sesi lain dicabut)",
      ip: await getClientIp(),
    });

    revalidatePath("/profil");
    return { ok: true };
  } catch (e) {
    return {
      error: toActionError(e, "Gagal mengubah kata sandi."),
    };
  }
}
