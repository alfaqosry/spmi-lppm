"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { toActionError } from "@/lib/errors";

export type ProfileActionState = { ok?: boolean; error?: string } | undefined;

export async function changePasswordAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return { error: "Sesi tidak ditemukan. Silakan masuk kembali." };
    }

    const current = String(formData.get("currentPassword") || "");
    const next = String(formData.get("newPassword") || "");
    const confirm = String(formData.get("confirmPassword") || "");

    if (!current || !next || !confirm) {
      return { error: "Semua kolom kata sandi wajib diisi." };
    }
    if (next.length < 8) {
      return { error: "Kata sandi baru minimal 8 karakter." };
    }
    if (next !== confirm) {
      return { error: "Konfirmasi kata sandi tidak cocok." };
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
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

    revalidatePath("/profil");
    return { ok: true };
  } catch (e) {
    return {
      error: toActionError(e, "Gagal mengubah kata sandi."),
    };
  }
}
