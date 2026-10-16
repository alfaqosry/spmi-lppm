"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  COOKIE_NAME,
  buildSessionUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, resetRateLimit } from "@/lib/ratelimit";
import { getSettings } from "@/lib/settings";
import { recordLogin, recordActivity } from "@/lib/logs";

export type AuthState = { error?: string } | undefined;

/** Ambil alamat IP klien (best-effort) untuk pembatas laju. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  const settings = await getSettings();
  const maxAttempts = Math.max(1, Number(settings["security.loginMaxAttempts"]) || 8);
  const windowMinutes = Math.max(
    1,
    Number(settings["security.loginWindowMinutes"]) || 5
  );

  const ip = await clientIp();
  const h = await headers();
  const ua = h.get("user-agent") ?? null;

  // Anti brute force: batasi percobaan per IP.
  const rl = rateLimit(`login:${ip}`, maxAttempts, windowMinutes * 60 * 1000);
  if (!rl.ok) {
    await recordLogin({
      email,
      success: false,
      ip,
      userAgent: ua,
      message: "Dibatasi (rate limit)",
    });
    return {
      error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      unit: true,
      memberships: { include: { unit: { select: { name: true } } } },
    },
  });

  // Pesan seragam untuk mencegah enumerasi akun.
  const invalidMsg = "Email atau kata sandi salah.";

  if (!user || !user.isActive) {
    await recordLogin({
      email,
      userId: user?.id ?? null,
      success: false,
      ip,
      userAgent: ua,
      message: !user ? "Akun tidak ditemukan" : "Akun nonaktif",
    });
    return { error: invalidMsg };
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    await recordLogin({
      email,
      userId: user.id,
      success: false,
      ip,
      userAgent: ua,
      message: "Kata sandi salah",
    });
    return { error: invalidMsg };
  }

  resetRateLimit(`login:${ip}`);
  const session = buildSessionUser(user);
  await setSessionCookie(session);
  await recordLogin({
    email,
    userId: user.id,
    success: true,
    ip,
    userAgent: ua,
    message: "Login berhasil",
  });
  await recordActivity({
    userId: user.id,
    userName: user.name,
    action: "auth.login",
    entity: "user",
    entityId: user.id,
    ip,
  });
  redirect(user.role === "pengunjung" ? "/no-access" : "/dashboard");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  // Hapus juga nama cookie lama (tanpa prefix __Host-) agar tidak tersisa.
  store.delete(process.env.AUTH_COOKIE_NAME || "lpm_session");
  // Hapus juga cookie sesi SSO UP agar keluar dari kedua sesi.
  store.delete("sso_session");
  store.delete("sso_access_token");
  redirect("/login");
}
