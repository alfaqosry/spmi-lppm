/**
 * Helper murni untuk tombol ekspor PDF (HE-06): nama berkas dari
 * `Content-Disposition` dan pesan galat ramah pengguna per status HTTP.
 */

/** Ambil nama berkas dari header `Content-Disposition` (RFC 6266). */
export function filenameFromDisposition(
  header: string | null | undefined,
  fallback = "laporan.pdf"
): string {
  if (!header) return fallback;
  // filename*=UTF-8''nama%20berkas.pdf (prioritas)
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      const name = decodeURIComponent(star[2].trim().replace(/^"|"$/g, ""));
      if (name) return sanitizeFilename(name, fallback);
    } catch {
      // abaikan, coba bentuk biasa
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  if (plain) {
    const name = (plain[2] ?? plain[1]).trim();
    if (name) return sanitizeFilename(name, fallback);
  }
  return fallback;
}

function sanitizeFilename(name: string, fallback: string): string {
  // Buang komponen path & karakter yang tidak valid di Windows.
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim();
  return clean || fallback;
}

/** Ubah nilai `Retry-After` (detik atau tanggal HTTP) menjadi detik. */
export function retryAfterSeconds(
  header: string | null | undefined,
  now: number = Date.now()
): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** Pesan galat berbahasa Indonesia beserta saran tindakan. */
export function exportErrorMessage(
  status: number,
  retryAfter: number | null = null
): string {
  switch (status) {
    case 401:
      return "Sesi Anda telah berakhir. Silakan login ulang, lalu unduh kembali laporan.";
    case 403:
      return "Anda tidak berhak mengunduh laporan ini. Hubungi LPM bila Anda merasa ini keliru.";
    case 404:
      return "Laporan tidak ditemukan. Siklus atau unit mungkin telah dihapus — muat ulang halaman.";
    case 429:
      return retryAfter && retryAfter > 0
        ? `Terlalu sering mengunduh laporan. Coba lagi dalam ${retryAfter} detik.`
        : "Terlalu sering mengunduh laporan. Coba lagi sebentar lagi.";
    case 503:
      return "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti.";
    default:
      return "Laporan gagal disiapkan. Silakan coba lagi; bila masalah berlanjut, hubungi LPM.";
  }
}

/** URL endpoint ekspor laporan. */
export function exportUrl(cycleId: number, unitId?: number | null): string {
  const params = new URLSearchParams({ cycleId: String(cycleId) });
  if (unitId) params.set("unitId", String(unitId));
  return `/api/export?${params.toString()}`;
}
