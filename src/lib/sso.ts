/**
 * Konfigurasi & kebijakan integrasi SSO UP (Universitas Pahlawan).
 *
 * Kredensial dapat diatur lewat menu Pengaturan (disimpan di database) dan
 * akan MENIMPA nilai environment. Bila belum diatur di DB, nilai dari
 * environment (.env) tetap dipakai agar kompatibel dengan deployment lama:
 *   SSO_URL, SSO_CLIENT_ID, SSO_CLIENT_SECRET, SSO_REDIRECT_URI, SSO_SCOPE, SSO_PROMPT
 */

import { getSettings, isOn } from "@/lib/settings";
import { logWarn, maskEmail } from "@/lib/redact";

export const SSO_DEFAULT_URL = "https://sso-v2.universitaspahlawan.ac.id";

export type SsoRuntimeConfig = {
  enabled: boolean;
  url: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  prompt: string;
  adminEmails: string[];
};

/** Ambil konfigurasi SSO efektif (DB menimpa env) untuk dipakai runtime. */
export async function getSsoRuntimeConfig(): Promise<SsoRuntimeConfig> {
  const s = await getSettings();
  const url = (s["sso.url"] || SSO_DEFAULT_URL).replace(/\/+$/, "");
  // Redirect URI HANYA dari pengaturan/env (tidak pernah dari header Host
  // permintaan) — mencegah host-header injection pada alur OAuth.
  const redirectUri =
    s["sso.redirectUri"] ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "http://localhost:3002/api/sso/callback");
  return {
    enabled: isOn(s["sso.enabled"]),
    url,
    clientId: s["sso.clientId"] || "",
    clientSecret: s["sso.clientSecret"] || "",
    redirectUri,
    scope: s["sso.scope"] || "*",
    prompt: s["sso.prompt"] || "",
    adminEmails: (s["sso.adminEmails"] || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  };
}

/** Apakah SSO aktif & terkonfigurasi (client id, secret, redirect URI tersedia). */
export async function isSsoConfigured(): Promise<boolean> {
  const cfg = await getSsoRuntimeConfig();
  return (
    cfg.enabled && Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri)
  );
}

/** URL SSO efektif (untuk ditampilkan). */
export async function getSsoUrl(): Promise<string> {
  const cfg = await getSsoRuntimeConfig();
  return cfg.url;
}

export type SsoIdentity = {
  username: string;
  email: string;
  name: string;
  sub: string;
  role: string;
};

/**
 * Tentukan peran lokal berdasarkan identitas SSO.
 *
 * KEAMANAN: JANGAN mempercayai klaim `role` dari SSO begitu saja — nilai itu
 * dapat dikendalikan pihak yang menyamar/mengubah respons. Sumber kebenaran
 * satu-satunya adalah daftar email admin eksplisit (`SSO_ADMIN_EMAILS`).
 *
 * Bila integrasi memang memerlukan pemetaan berbasis `role` SSO, aktifkan
 * secara eksplisit via env `SSO_TRUST_ROLE=true` (default: mati).
 *
 * Aturan:
 *  - email terdaftar pada SSO_ADMIN_EMAILS -> lpm_admin
 *  - SSO_TRUST_ROLE=true & role SSO admin/lpm -> lpm_admin (opsional, tidak aman)
 *  - selain itu -> pengunjung (tamu tanpa akses)
 */
export function resolveLocalRole(
  identity: SsoIdentity,
  adminEmails: string[]
): "lpm_admin" | "pengunjung" {
  const email = (identity.email || "").toLowerCase();
  if (email && adminEmails.includes(email)) {
    return "lpm_admin";
  }

  const ssoRole = (identity.role || "").toLowerCase();
  const claimsAdmin =
    ssoRole === "admin" || ssoRole === "lpm" || ssoRole === "lpm_admin";

  if (claimsAdmin) {
    if (process.env.SSO_TRUST_ROLE === "true") {
      return "lpm_admin";
    }
    // Klaim admin tanpa whitelist email -> tolak & catat untuk deteksi dini.
    logWarn(
      "[security]",
      `Identitas SSO "${maskEmail(identity.email) || "(tanpa email)"}" ` +
        `mengklaim role admin tetapi tidak ada di daftar email admin SSO — ` +
        `diberi peran pengunjung. Setel SSO_TRUST_ROLE=true bila memang diinginkan.`
    );
  }

  return "pengunjung";
}
