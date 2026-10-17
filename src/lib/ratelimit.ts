import { AppError } from "@/lib/errors";

/**
 * Pembatas laju (fixed window, in-memory) untuk endpoint sensitif:
 * login, callback SSO, ekspor laporan, unggahan berkas, ekspor data pribadi.
 *
 * KETERBATASAN (didokumentasikan, diterima untuk deployment saat ini):
 * penyimpanan in-memory hanya berlaku pada SATU proses Node. Produksi
 * menjalankan satu instance PM2 (fork, instances: 1) sehingga efektif.
 * Bila kelak di-scale ke beberapa instance/cluster, ganti penyimpanan bucket
 * dengan Redis/DB agar batas berlaku global. Hitungan juga ter-reset saat
 * proses restart (deploy).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Batas keras jumlah bucket (mencegah kehabisan memori oleh kunci acak). */
const MAX_BUCKETS = 50_000;

/** Bersihkan bucket kedaluwarsa secara berkala (lazy, saat dipanggil). */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  if (buckets.size >= MAX_BUCKETS) {
    // Darurat: buang bucket tertua (urutan sisip Map).
    let drop = buckets.size - MAX_BUCKETS + 1000;
    for (const k of buckets.keys()) {
      if (drop-- <= 0) break;
      buckets.delete(k);
    }
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Sisa waktu tunggu (detik) bila dibatasi. */
  retryAfter?: number;
};

/**
 * Cek & tambah hitungan untuk `key`.
 * @param limit  jumlah maksimum percobaan dalam jendela waktu
 * @param windowMs panjang jendela waktu (ms)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

/** Reset hitungan (mis. setelah login sukses). */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/** Pesan seragam saat dibatasi. */
export function rateLimitMessage(retryAfter?: number): string {
  return `Terlalu banyak permintaan. Coba lagi dalam ${retryAfter ?? 60} detik.`;
}

/** Versi untuk server action: lempar AppError bila melebihi batas. */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number
): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new AppError(rateLimitMessage(r.retryAfter));
}

/** Preset batas laju per jenis endpoint. */
export const LIMITS_RL = {
  /** Unggahan berkas per pengguna. */
  upload: { limit: 30, windowMs: 60_000 },
  /** Ekspor laporan PDF per pengguna. */
  export: { limit: 10, windowMs: 60_000 },
  /** Callback/redirect SSO per IP. */
  sso: { limit: 20, windowMs: 60_000 },
  /** Ekspor data pribadi per pengguna. */
  meExport: { limit: 5, windowMs: 60_000 },
  /** Unduhan berkas per pengguna (anti scraping). */
  files: { limit: 120, windowMs: 60_000 },
  /** Batas kasar login per IP (anti password spraying lintas akun). */
  loginPerIp: { limit: 30, windowMs: 60_000 },
} as const;
