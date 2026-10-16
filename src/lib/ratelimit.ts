/**
 * Pembatas laju sederhana (in-memory) untuk mencegah brute force.
 *
 * Catatan: penyimpanan in-memory hanya efektif pada satu instance. Untuk
 * deployment multi-instance, ganti dengan Redis/DB. Namun tetap memberi
 * perlindungan dasar pada deployment saat ini.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Bersihkan bucket kedaluwarsa secara berkala (lazy, saat dipanggil). */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
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
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}

/** Reset hitungan (mis. setelah login sukses). */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}
