"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isSuperadmin } from "@/lib/auth";
import { AppError, toActionError, isSafeHttpUrl } from "@/lib/errors";
import {
  saveSettings,
  getSettingsForAdmin,
  SETTING_DEFAULTS,
  SECRET_KEYS,
  type SettingKey,
} from "@/lib/settings";
import { saveUpload } from "@/lib/upload";
import { recordActivity } from "@/lib/logs";

export type ActionState = { ok?: boolean; error?: string } | undefined;

/** Hanya Superadmin yang boleh mengakses pengaturan sistem. */
async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || !isSuperadmin(user.role)) {
    throw new AppError("Akses ditolak. Hanya Superadmin.");
  }
  return user;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

const TEXT_KEYS: SettingKey[] = [
  "site.name",
  "site.shortName",
  "site.description",
  "site.organization",
  "site.keywords",
  "site.author",
  "site.baseUrl",
  "site.robots",
  "site.googleVerification",
  "sso.url",
  "sso.clientId",
  "sso.clientSecret",
  "sso.redirectUri",
  "sso.scope",
  "sso.prompt",
  "sso.adminEmails",
  "security.sessionDays",
  "security.loginMaxAttempts",
  "security.loginWindowMinutes",
  "log.loginRetentionDays",
  "maintenance.message",
];

const BOOL_KEYS: SettingKey[] = [
  "log.login.enabled",
  "log.activity.enabled",
  "sso.enabled",
  "maintenance.enabled",
];

/**
 * Simpan pengaturan umum (teks + toggle). Hanya key yang diizinkan.
 * Validasi ringan: URL harus http/https, angka harus non-negatif.
 */
export async function saveGeneralSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireSuperadmin();
    const entries: Partial<Record<SettingKey, string>> = {};

    for (const key of TEXT_KEYS) {
      if (formData.has(key)) {
        entries[key] = String(formData.get(key) ?? "").trim();
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
      "site.ogImage",
      "sso.url",
      "sso.redirectUri",
    ] as SettingKey[]) {
      const v = entries[urlKey];
      if (v && !isSafeHttpUrl(v)) {
        return { error: `Nilai untuk ${urlKey} bukan URL yang valid (http/https).` };
      }
    }

    // Validasi angka.
    for (const numKey of [
      "security.sessionDays",
      "security.loginMaxAttempts",
      "security.loginWindowMinutes",
      "log.loginRetentionDays",
    ] as SettingKey[]) {
      const v = entries[numKey];
      if (v != null && v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0)) {
        return { error: "Nilai angka tidak boleh negatif / tidak valid." };
      }
    }

    if (entries["site.name"] === "") {
      entries["site.name"] = SETTING_DEFAULTS["site.name"];
    }

    await saveSettings(entries, admin.id);
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "settings.update",
      entity: "settings",
      detail: "Memperbarui pengaturan umum sistem",
      ip: await clientIp(),
    });

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

    const map: Record<string, SettingKey> = {
      logo: "site.logo",
      favicon: "site.favicon",
      ogImage: "site.ogImage",
    };
    const key = map[kind];
    if (!key) return { error: "Jenis aset tidak dikenal." };
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Pilih berkas terlebih dahulu." };
    }

    const res = await saveUpload(file, "branding");
    if (!res.ok) return { error: res.error };

    await saveSettings({ [key]: res.path }, admin.id);
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "settings.branding",
      entity: "settings",
      detail: `Unggah ${kind}`,
      ip: await clientIp(),
    });

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
    const map: Record<string, SettingKey> = {
      logo: "site.logo",
      favicon: "site.favicon",
      ogImage: "site.ogImage",
    };
    const key = map[kind];
    if (!key) return { error: "Jenis aset tidak dikenal." };
    await saveSettings({ [key]: "" }, admin.id);
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
    await requireSuperadmin();
    const { getSsoRuntimeConfig } = await import("@/lib/sso");
    const cfg = await getSsoRuntimeConfig();
    if (!cfg.clientId || !cfg.clientSecret) {
      return { error: "Client ID & Secret belum diisi." };
    }
    if (!isSafeHttpUrl(cfg.url)) {
      return { error: "URL SSO tidak valid." };
    }
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(cfg.url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(t);
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
    const all = await getSettingsForAdmin();
    const days = Number(all["log.loginRetentionDays"]?.value) || 0;
    const where =
      days > 0
        ? { createdAt: { lt: new Date(Date.now() - days * 86400000) } }
        : {};
    const { count } = await prisma.loginLog.deleteMany({ where });
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "logs.purge",
      entity: "login_logs",
      detail: `Menghapus ${count} log login`,
      ip: await clientIp(),
    });
    revalidatePath("/pengaturan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membersihkan log.") };
  }
}

/** Hapus seluruh riwayat aktivitas (superadmin). */
export async function clearActivityLogs(): Promise<ActionState> {
  try {
    await requireSuperadmin();
    await prisma.activityLog.deleteMany({});
    revalidatePath("/pengaturan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membersihkan log aktivitas.") };
  }
}

/** Hapus seluruh riwayat login (superadmin). */
export async function clearLoginLogs(): Promise<ActionState> {
  try {
    await requireSuperadmin();
    await prisma.loginLog.deleteMany({});
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
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    if (!name || !email || !password) {
      return { error: "Nama, email, dan kata sandi wajib diisi." };
    }
    if (password.length < 8) {
      return { error: "Kata sandi minimal 8 karakter." };
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return { error: "Email sudah terdaftar." };

    const { hashPassword } = await import("@/lib/auth");
    await prisma.user.create({
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
      detail: `Membuat superadmin ${email}`,
      ip: await clientIp(),
    });
    revalidatePath("/pengaturan");
    revalidatePath("/role-penempatan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal membuat superadmin.") };
  }
}

export { SECRET_KEYS };
