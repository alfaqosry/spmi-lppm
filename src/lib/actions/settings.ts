"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/guards";
import { AppError, toActionError, isSafeHttpUrl } from "@/lib/errors";
import {
  saveSettings,
  getSettings,
  SETTING_DEFAULTS,
  type SettingKey,
} from "@/lib/settings";
import { saveUpload } from "@/lib/upload";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { maskEmail } from "@/lib/redact";
import { LIMITS, emailField, str } from "@/lib/validate";
import { validatePassword } from "@/lib/password";
import { enforceRateLimit, LIMITS_RL } from "@/lib/ratelimit";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const IS_PROD = process.env.NODE_ENV === "production";

/** Key teks yang boleh diubah lewat form pengaturan umum + batas panjangnya. */
const TEXT_KEYS: Partial<Record<SettingKey, number>> = {
  "site.name": 160,
  "site.shortName": 40,
  "site.description": LIMITS.settingText,
  "site.organization": 200,
  "site.keywords": LIMITS.settingText,
  "site.author": 200,
  "site.baseUrl": LIMITS.url,
  "site.robots": 10,
  "site.googleVerification": 200,
  "sso.url": LIMITS.url,
  "sso.clientId": 200,
  "sso.clientSecret": 500,
  "sso.redirectUri": LIMITS.url,
  "sso.scope": 200,
  "sso.prompt": 40,
  "sso.adminEmails": LIMITS.settingText,
  "security.sessionDays": 4,
  "security.loginMaxAttempts": 4,
  "security.loginWindowMinutes": 4,
  "log.loginRetentionDays": 5,
  "log.activityRetentionDays": 5,
  "maintenance.message": LIMITS.settingText,
};

const BOOL_KEYS: SettingKey[] = [
  "log.login.enabled",
  "log.activity.enabled",
  "sso.enabled",
  "maintenance.enabled",
];

/** Rentang angka yang sah per key. */
const NUMBER_RANGES: Partial<Record<SettingKey, [number, number]>> = {
  "security.sessionDays": [1, 30],
  "security.loginMaxAttempts": [1, 5],
  "security.loginWindowMinutes": [1, 60],
  "log.loginRetentionDays": [0, 3650],
  "log.activityRetentionDays": [0, 3650],
};

const BRANDING_KEYS: Record<string, SettingKey> = {
  logo: "site.logo",
  favicon: "site.favicon",
  ogImage: "site.ogImage",
};

async function audit(
  admin: { id: number; name: string },
  action: string,
  entity: string,
  detail: string
) {
  await recordActivity({
    userId: admin.id,
    userName: admin.name,
    action,
    entity,
    detail,
    ip: await getClientIp(),
  });
}

/** URL publik: http(s); di produksi wajib https. */
function checkUrl(key: SettingKey, v: string | undefined) {
  if (!v) return;
  if (!isSafeHttpUrl(v)) {
    throw new AppError(`Nilai untuk ${key} bukan URL yang valid (http/https).`);
  }
  if (IS_PROD && !v.startsWith("https://")) {
    throw new AppError(
      `Nilai untuk ${key} wajib memakai https:// di produksi.`
    );
  }
}

/**
 * Simpan pengaturan umum (teks + toggle). Hanya key yang diizinkan.
 * Validasi: URL harus http/https (https di produksi), angka dalam rentang,
 * enum robots, daftar email admin SSO, panjang dibatasi.
 */
export async function saveGeneralSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const entries: Partial<Record<SettingKey, string>> = {};

    for (const [key, max] of Object.entries(TEXT_KEYS) as [
      SettingKey,
      number,
    ][]) {
      if (formData.has(key)) {
        entries[key] = str(formData, key, {
          max,
          multiline:
            key === "maintenance.message" || key === "site.description",
          label: key,
        });
      }
    }
    // Hanya ubah toggle boolean yang memang dikelola oleh form ini.
    // (Checkbox yang tidak dicentang tidak dikirim, sehingga kita perlu
    // penanda eksplisit agar menyimpan satu tab tidak mematikan tab lain.)
    const managedBools = String(formData.get("__bool_keys") || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean) as SettingKey[];
    for (const key of managedBools) {
      if (BOOL_KEYS.includes(key)) {
        entries[key] = formData.get(key) === "on" ? "true" : "false";
      }
    }

    // Validasi URL.
    for (const urlKey of [
      "site.baseUrl",
      "sso.url",
      "sso.redirectUri",
    ] as SettingKey[]) {
      checkUrl(urlKey, entries[urlKey]);
    }
    const redirect = entries["sso.redirectUri"];
    if (redirect && !new URL(redirect).pathname.endsWith("/api/sso/callback")) {
      return { error: "Redirect URI SSO harus berakhiran /api/sso/callback." };
    }

    // Validasi angka (bilangan bulat dalam rentang).
    for (const [numKey, [min, max]] of Object.entries(NUMBER_RANGES) as [
      SettingKey,
      [number, number],
    ][]) {
      const v = entries[numKey];
      if (v == null || v === "") continue;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        return { error: `Nilai ${numKey} harus bilangan bulat ${min}–${max}.` };
      }
    }

    if (
      entries["site.robots"] != null &&
      !["index", "noindex"].includes(entries["site.robots"])
    ) {
      return { error: "Nilai robots tidak valid." };
    }

    const adminEmails = entries["sso.adminEmails"];
    if (adminEmails) {
      const list = adminEmails
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (list.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))) {
        return {
          error: "Daftar email admin SSO berisi email yang tidak valid.",
        };
      }
      entries["sso.adminEmails"] = list.join(",");
    }

    if (entries["site.name"] === "") {
      entries["site.name"] = SETTING_DEFAULTS["site.name"];
    }

    await saveSettings(entries, admin.id);
    // Jangan catat nilai — cukup daftar key yang diubah (secret tidak pernah dilog).
    await audit(
      admin,
      "settings.update",
      "settings",
      `Memperbarui pengaturan: ${Object.keys(entries).join(", ")}`.slice(0, 480)
    );

    revalidatePath("/pengaturan");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan pengaturan.") };
  }
}

/**
 * Unggah logo/favicon/og-image. Menyimpan file ke folder branding lalu
 * menyimpan path-nya ke pengaturan terkait.
 */
export async function uploadBranding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const kind = String(formData.get("kind") || "");
    const file = formData.get("file");

    const key = Object.hasOwn(BRANDING_KEYS, kind)
      ? BRANDING_KEYS[kind]
      : undefined;
    if (!key) return { error: "Jenis aset tidak dikenal." };
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Pilih berkas terlebih dahulu." };
    }
    enforceRateLimit(
      `upload:${admin.id}`,
      LIMITS_RL.upload.limit,
      LIMITS_RL.upload.windowMs
    );

    const res = await saveUpload(file, "branding");
    if (!res.ok) return { error: res.error };

    await saveSettings({ [key]: res.path }, admin.id);
    await audit(admin, "settings.branding", "settings", `Unggah ${kind}`);

    revalidatePath("/pengaturan");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal mengunggah berkas.") };
  }
}

/** Hapus (reset) salah satu aset branding. */
export async function clearBranding(kind: string): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const k = String(kind ?? "");
    const key = Object.hasOwn(BRANDING_KEYS, k) ? BRANDING_KEYS[k] : undefined;
    if (!key) return { error: "Jenis aset tidak dikenal." };
    await saveSettings({ [key]: "" }, admin.id);
    await audit(admin, "settings.branding_clear", "settings", `Hapus ${k}`);
    revalidatePath("/pengaturan");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menghapus aset.") };
  }
}

/** Uji koneksi SSO: cek apakah URL SSO dapat dijangkau. */
export async function testSsoConnection(): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    enforceRateLimit(`sso-test:${admin.id}`, 5, 60_000);
    const { getSsoRuntimeConfig } = await import("@/lib/sso");
    const cfg = await getSsoRuntimeConfig();
    if (!cfg.clientId || !cfg.clientSecret) {
      return { error: "Client ID & Secret belum diisi." };
    }
    if (
      !isSafeHttpUrl(cfg.url) ||
      (IS_PROD && !cfg.url.startsWith("https://"))
    ) {
      return { error: "URL SSO tidak valid." };
    }
    try {
      const res = await fetch(cfg.url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (res.status >= 200 && res.status < 500) {
        return { ok: true };
      }
      return { error: `Server SSO merespons status ${res.status}.` };
    } catch {
      return { error: "Tidak dapat menjangkau server SSO." };
    }
  } catch (e) {
    return { error: toActionError(e, "Gagal menguji koneksi SSO.") };
  }
}

/** Bersihkan log login lama (sesuai masa simpan) secara manual. */
export async function purgeLoginLogs(): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const s = await getSettings();
    const days = Math.floor(Number(s["log.loginRetentionDays"]) || 0);
    if (days <= 0) {
      return {
        error:
          "Masa simpan log login tidak dibatasi (0). Tidak ada yang dihapus.",
      };
    }
    const { count } = await prisma.loginLog.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } },
    });
    await audit(
      admin,
      "logs.purge",
      "login_logs",
      `Menghapus ${count} log login (> ${days} hari)`
    );
    revalidatePath("/pengaturan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membersihkan log.") };
  }
}

/** Hapus seluruh riwayat aktivitas (superadmin). Jejak penghapusan tetap dicatat. */
export async function clearActivityLogs(): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const { count } = await prisma.activityLog.deleteMany({});
    await audit(
      admin,
      "logs.clear_activity",
      "activity_logs",
      `Menghapus seluruh log aktivitas (${count} baris)`
    );
    revalidatePath("/pengaturan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membersihkan log aktivitas.") };
  }
}

/** Hapus seluruh riwayat login (superadmin). */
export async function clearLoginLogs(): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const { count } = await prisma.loginLog.deleteMany({});
    await audit(
      admin,
      "logs.clear_login",
      "login_logs",
      `Menghapus seluruh log login (${count} baris)`
    );
    revalidatePath("/pengaturan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membersihkan log login.") };
  }
}

/** Buat akun Superadmin baru (hanya oleh Superadmin). */
export async function createSuperadmin(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const name = str(formData, "name", {
      max: LIMITS.name,
      required: true,
      label: "Nama",
    });
    const email = emailField(formData, "email");
    const password = String(formData.get("password") ?? "");

    const pwErr = validatePassword(password, { email });
    if (pwErr) return { error: pwErr };
    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) return { error: "Email sudah terdaftar." };

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role: "superadmin",
        isActive: true,
      },
    });
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "superadmin.create",
      entity: "user",
      entityId: created.id,
      detail: `Membuat superadmin ${maskEmail(email)}`,
      ip: await getClientIp(),
    });
    revalidatePath("/pengaturan");
    revalidatePath("/role-penempatan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membuat superadmin.") };
  }
}
