import { cache } from "react";
import { prisma } from "@/lib/prisma";

/* =====================================================================
   Pengaturan aplikasi (AppSetting)
   ---------------------------------------------------------------------
   Semua konfigurasi sistem disimpan sebagai pasangan key-value di database.
   Nilai di database MENIMPA nilai default. Untuk kredensial SSO, bila nilai
   di DB kosong, sistem jatuh ke environment variable (.env) agar tetap
   kompatibel dengan deployment lama.
   ===================================================================== */

/** Daftar key pengaturan beserta nilai default. */
export const SETTING_DEFAULTS = {
  // --- Identitas & SEO ---
  "site.name": "Sistem Informasi SPMI",
  "site.shortName": "SPMI",
  "site.description":
    "Sistem Informasi SPMI untuk pengelolaan audit mutu internal unit universitas.",
  "site.organization": "Universitas Pahlawan — Lembaga Penjaminan Mutu",
  "site.logo": "",
  "site.favicon": "",
  "site.keywords":
    "SPMI, audit mutu internal, penjaminan mutu, universitas pahlawan, LPM",
  "site.author": "Lembaga Penjaminan Mutu — Universitas Pahlawan",
  "site.baseUrl": "",
  "site.robots": "index", // index | noindex
  "site.ogImage": "",
  "site.googleVerification": "",

  // --- Log & Pemantauan ---
  "log.login.enabled": "true",
  "log.activity.enabled": "true",
  "log.loginRetentionDays": "90",

  // --- Integrasi SSO ---
  "sso.enabled": "true",
  "sso.url": "",
  "sso.clientId": "",
  "sso.clientSecret": "",
  "sso.redirectUri": "",
  "sso.scope": "",
  "sso.prompt": "",
  "sso.adminEmails": "",

  // --- Keamanan ---
  "security.sessionDays": "7",
  "security.loginMaxAttempts": "8",
  "security.loginWindowMinutes": "5",

  // --- Pemeliharaan ---
  "maintenance.enabled": "false",
  "maintenance.message":
    "Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Key yang nilainya bersifat rahasia (disamarkan di UI). */
export const SECRET_KEYS: SettingKey[] = ["sso.clientSecret"];

/** Key yang boleh dibaca/ditulis dari UI Pengaturan. */
export const EDITABLE_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/** Nilai default seluruh pengaturan. */
export type AppSettings = Record<SettingKey, string>;

function defaultsObject(): AppSettings {
  return { ...SETTING_DEFAULTS } as AppSettings;
}

/** Nilai dari environment sebagai fallback untuk SSO (deployment lama). */
function envFallback(key: SettingKey): string {
  switch (key) {
    case "sso.url":
      return process.env.SSO_URL || "";
    case "sso.clientId":
      return process.env.SSO_CLIENT_ID || "";
    case "sso.clientSecret":
      return process.env.SSO_CLIENT_SECRET || "";
    case "sso.redirectUri":
      return process.env.SSO_REDIRECT_URI || "";
    case "sso.scope":
      return process.env.SSO_SCOPE || "";
    case "sso.prompt":
      return process.env.SSO_PROMPT || "";
    case "sso.adminEmails":
      return process.env.SSO_ADMIN_EMAILS || "";
    default:
      return "";
  }
}

/**
 * Ambil seluruh pengaturan (memoized per-request).
 * Nilai dari DB menimpa default; untuk key SSO yang kosong di DB, gunakan env.
 */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const result = defaultsObject();
  try {
    const rows = await prisma.appSetting.findMany();
    for (const row of rows) {
      if ((EDITABLE_KEYS as string[]).includes(row.key) && row.value != null) {
        result[row.key as SettingKey] = row.value;
      }
    }
  } catch (e) {
    console.error("[settings] gagal memuat pengaturan:", e);
  }
  // Fallback env untuk SSO bila belum diatur di DB.
  for (const key of [
    "sso.url",
    "sso.clientId",
    "sso.clientSecret",
    "sso.redirectUri",
    "sso.scope",
    "sso.prompt",
    "sso.adminEmails",
  ] as SettingKey[]) {
    if (!result[key]) {
      const env = envFallback(key);
      if (env) result[key] = env;
    }
  }
  return result;
});

/** Ambil satu nilai pengaturan. */
export async function getSetting(key: SettingKey): Promise<string> {
  const all = await getSettings();
  return all[key];
}

/** Ambil beberapa nilai boolean. */
export function isOn(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "on";
}

/** Versi publik (tanpa nilai rahasia) untuk dikirim ke komponen klien. */
export type PublicSettings = Record<SettingKey, { value: string; isSecret: boolean }>;

/**
 * Bentuk data pengaturan untuk UI: key rahasia HANYA ditandai terisi/tidak,
 * nilai aslinya tidak pernah dikirim ke klien.
 */
export async function getSettingsForAdmin(): Promise<PublicSettings> {
  const all = await getSettings();
  const out = {} as PublicSettings;
  for (const key of EDITABLE_KEYS) {
    const secret = SECRET_KEYS.includes(key);
    out[key] = {
      value: secret ? (all[key] ? "••••••••" : "") : all[key],
      isSecret: secret,
    };
  }
  return out;
}

/**
 * Simpan sekumpulan pengaturan. Hanya key yang dikenal yang disimpan.
 * Untuk key rahasia, nilai kosong ATAU placeholder mask ("••••") tidak
 * menimpa nilai lama (agar tidak menghapus secret yang sudah tersimpan).
 */
export async function saveSettings(
  entries: Partial<Record<SettingKey, string>>,
  updatedBy?: number
): Promise<void> {
  const ops = [];
  for (const [key, raw] of Object.entries(entries)) {
    if (!(EDITABLE_KEYS as string[]).includes(key)) continue;
    const k = key as SettingKey;
    const isSecret = SECRET_KEYS.includes(k);
    if (isSecret && (raw == null || raw.trim() === "" || raw.includes("•"))) {
      continue; // jangan hapus secret yang sudah ada
    }
    const value = raw ?? "";
    ops.push(
      prisma.appSetting.upsert({
        where: { key: k },
        create: { key: k, value, isSecret, updatedBy: updatedBy ?? null },
        update: { value, isSecret, updatedBy: updatedBy ?? null },
      })
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}

/** Nama sistem yang aman dipakai di metadata. */
export async function getSiteName(): Promise<string> {
  const s = await getSettings();
  return s["site.name"] || SETTING_DEFAULTS["site.name"];
}
