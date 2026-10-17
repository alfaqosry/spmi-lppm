/**
 * Konstanta identitas situs & dokumen hukum (dipakai metadata, robots,
 * sitemap, footer, dan halaman kebijakan). Bukan rahasia — aman di klien.
 */

/** Domain produksi kanonis (fallback bila `site.baseUrl` belum diatur). */
export const DEFAULT_SITE_URL = "https://spmi.universitaspahlawan.ac.id";

/** Akhiran judul halaman: "%s · SPMI Universitas Pahlawan". */
export const SITE_TITLE_SUFFIX = "SPMI Universitas Pahlawan";

export const INSTITUTION = "Universitas Pahlawan Tuanku Tambusai";
export const INSTITUTION_ADDRESS =
  "Bangkinang, Kabupaten Kampar, Provinsi Riau, Indonesia";
export const CONTROLLER_UNIT = "Lembaga Penjaminan Mutu (LPM)";
export const CONTACT_EMAIL = "lpm@universitaspahlawan.ac.id";

/** Versi dokumen Kebijakan Privasi & Syarat dan Ketentuan. */
export const LEGAL_VERSION = "1.0";
export const LEGAL_DATE = "17 Oktober 2026";
export const LEGAL_DATE_ISO = "2026-10-17";

/**
 * Rute publik yang boleh diakses tanpa login dan boleh diindeks.
 * (Dipakai sitemap.ts & robots.ts.)
 */
export const PUBLIC_PATHS = [
  "/login",
  "/kebijakan-privasi",
  "/syarat-ketentuan",
] as const;

/** Prefiks rute dasbor (wajib login) — tidak diindeks mesin pencari. */
export const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/siklus",
  "/unit",
  "/role-penempatan",
  "/penetapan",
  "/evaluasi",
  "/monev",
  "/audit",
  "/analitik",
  "/pengaturan",
  "/profil",
  "/no-access",
  "/uploads/",
] as const;
