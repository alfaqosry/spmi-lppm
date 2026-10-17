/**
 * Zona waktu aplikasi. Seluruh tanggal ditampilkan / diekspor dalam WIB
 * (Asia/Jakarta, UTC+07:00, tanpa DST) terlepas dari zona waktu server.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * ISO 8601 dengan offset WIB, mis. "2026-10-17T14:05:09.123+07:00".
 * Dipakai untuk seluruh timestamp pada respons JSON API.
 */
export function toIsoJakarta(
  value: Date | string | null | undefined
): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() + JAKARTA_OFFSET_MS);
  return shifted.toISOString().replace("Z", "+07:00");
}

/** Tanggal saja (YYYY-MM-DD) untuk kolom bertipe DATE. */
export function toIsoDate(
  value: Date | string | null | undefined
): string | null {
  const iso = toIsoJakarta(value);
  return iso ? iso.slice(0, 10) : null;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  lpm_admin: "Admin LPM",
  lpm_member: "Anggota LPM",
  auditee_head: "Kepala Unit",
  auditee_member: "Anggota Unit",
  pengunjung: "Pengunjung (Tamu)",
};

export const STATUS_LABEL: Record<string, string> = {
  belum_mulai: "Belum Mulai",
  mengisi: "Sedang Mengisi",
  selesai: "Selesai",
  pending: "Menunggu Verifikasi",
  verified: "Terverifikasi",
  revision: "Perlu Revisi",
};

export const STATUS_STYLE: Record<string, string> = {
  belum_mulai: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  mengisi: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  selesai: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  verified: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  revision: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}
