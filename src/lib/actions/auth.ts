"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  getSession,
  revokeUserSessions,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, resetRateLimit, LIMITS_RL } from "@/lib/ratelimit";
import { getSettings, isOn } from "@/lib/settings";
import { recordLogin, recordActivity } from "@/lib/logs";
import { getClientIp, getUserAgent } from "@/lib/net";
import { logError } from "@/lib/redact";

export type AuthState = { error?: string } | undefined;

/** Batas standar institusi: 5 percobaan per 1 menit per email+IP. */
const STD_LOGIN_LIMIT = 5;
const STD_LOGIN_WINDOW_MS = 60_000;

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
    return { error: "Email dan kata sandi wajib diisi." };
  }
  const email = emailRaw.trim().toLowerCase().slice(0, 190);
  const password = passwordRaw.slice(0, 256);

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  const ip = await getClientIp();
  const ua = await getUserAgent();

  let destination = "/dashboard";
  try {
    const settings = await getSettings();
    const maxAttempts = Math.min(
      STD_LOGIN_LIMIT,
      Math.max(
        1,
        Number(settings["security.loginMaxAttempts"]) || STD_LOGIN_LIMIT
      )
    );
    const windowMs = Math.max(
      STD_LOGIN_WINDOW_MS,
      (Number(settings["security.loginWindowMinutes"]) || 1) * 60_000
    );

    // Anti brute force: (1) per email+IP sesuai standar, (2) batas kasar per IP
    // untuk password spraying lintas akun.
    const keyEmailIp = `login:${email}|${ip}`;
    const rlEmail = rateLimit(keyEmailIp, maxAttempts, windowMs);
    const rlIp = rateLimit(
      `login-ip:${ip}`,
      LIMITS_RL.loginPerIp.limit,
      LIMITS_RL.loginPerIp.windowMs
    );
    if (!rlEmail.ok || !rlIp.ok) {
      await recordLogin({
        email,
        success: false,
        ip,
        userAgent: ua,
        message: "Dibatasi (rate limit)",
      });
      const wait =
        Math.max(rlEmail.retryAfter ?? 0, rlIp.retryAfter ?? 0) || 60;
      return {
        error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${wait} detik.`,
      };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        password: true,
        sessionVersion: true,
      },
    });

    // Pesan seragam untuk mencegah enumerasi akun.
    const invalidMsg = "Email atau kata sandi salah.";

    // verifyPassword tetap dijalankan walau akun tidak ada (waktu respons seragam).
    const valid = await verifyPassword(password, user?.password ?? null);

    if (!user || !user.isActive || !valid) {
      await recordLogin({
        email,
        userId: user?.id ?? null,
        success: false,
        ip,
        userAgent: ua,
        message: !user
          ? "Akun tidak ditemukan"
          : !user.isActive
            ? "Akun nonaktif"
            : "Kata sandi salah",
      });
      return { error: invalidMsg };
    }

    // Mode pemeliharaan: hanya superadmin yang boleh masuk.
    if (isOn(settings["maintenance.enabled"]) && user.role !== "superadmin") {
      await recordLogin({
        email,
        userId: user.id,
        success: false,
        ip,
        userAgent: ua,
        message: "Ditolak: mode pemeliharaan",
      });
      return {
        error:
          settings["maintenance.message"] ||
          "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.",
      };
    }

    resetRateLimit(keyEmailIp);
    destination = user.role === "pengunjung" ? "/no-access" : "/dashboard";
    // Token sesi BARU setiap login (anti session fixation).
    await setSessionCookie({
      id: user.id,
      sessionVersion: user.sessionVersion,
    });
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
  } catch (e) {
    logError("[login] gagal:", e);
    return { error: "Terjadi kesalahan. Silakan coba lagi." };
  }
  redirect(destination);
}

/**
 * Keluar: cabut seluruh sesi akun ini (naikkan sessionVersion) lalu hapus
 * cookie. Token lama yang mungkin tersalin tidak lagi berlaku.
 */
export async function logoutAction() {
  try {
    const session = await getSession();
    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, name: true, sessionVersion: true },
      });
      // Hanya cabut bila token ini memang masih sah (hindari logout paksa via token basi).
      if (user && user.sessionVersion === session.sv) {
        await revokeUserSessions(user.id);
        await recordActivity({
          userId: user.id,
          userName: user.name,
          action: "auth.logout",
          entity: "user",
          entityId: user.id,
          ip: await getClientIp(),
        });
      }
    }
  } catch (e) {
    logError("[logout] gagal mencabut sesi:", e);
  }
  await clearSessionCookie();
  redirect("/login");
}
