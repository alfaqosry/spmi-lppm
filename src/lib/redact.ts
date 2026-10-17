/**
 * Penyamaran data pribadi / rahasia untuk log (UU 27/2022 PDP, OWASP ASVS V7).
 *
 * Aturan: log konsol dan log di database TIDAK boleh memuat email utuh,
 * nomor telepon, token, kata sandi, atau secret. Gunakan fungsi di sini setiap
 * kali menulis log yang memuat input pengguna.
 */

/** a***@domain.ac.id — pertahankan huruf pertama + domain. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const v = String(email).trim();
  const at = v.lastIndexOf("@");
  if (at <= 0) return v.length <= 1 ? "*" : `${v[0]}***`;
  return `${v[0]}***@${v.slice(at + 1)}`;
}

/** 0812****5678 — pertahankan 4 digit awal & akhir. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const d = String(phone).replace(/\s+/g, "");
  if (d.length <= 6) return "***";
  return `${d.slice(0, 4)}****${d.slice(-4)}`;
}

/** abcd…(n) — tampilkan 4 karakter awal saja. */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  const t = String(token);
  return t.length <= 8 ? "****" : `${t.slice(0, 4)}…(${t.length})`;
}

const EMAIL_RE =
  /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE_RE = /(?<![\w])(\+?62|0)8\d{7,12}(?![\w])/g;
const BEARER_RE = /(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const KV_SECRET_RE =
  /((?:password|passwd|kata_?sandi|secret|client_secret|token|access_token|refresh_token|code|authorization)["']?\s*[:=]\s*["']?)[^"'&\s,}]+/gi;

/** Samarkan pola data pribadi/rahasia di dalam teks bebas. */
export function redactText(input: string): string {
  return input
    .replace(JWT_RE, "[jwt]")
    .replace(BEARER_RE, "$1[token]")
    .replace(KV_SECRET_RE, "$1[redacted]")
    .replace(EMAIL_RE, "$1***@$2")
    .replace(PHONE_RE, (m) => maskPhone(m));
}

/**
 * Ringkas error untuk log server tanpa membawa data pribadi.
 * Hanya nama, kode (mis. kode Prisma P2002), dan pesan yang sudah disamarkan.
 * Stack trace hanya dicetak di luar produksi.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) {
    const code = (e as { code?: unknown }).code;
    const msg = redactText(String(e.message || "")).slice(0, 500);
    const head = `${e.name}${code ? ` [${String(code)}]` : ""}: ${msg}`;
    if (process.env.NODE_ENV !== "production" && e.stack) {
      return `${head}\n${redactText(e.stack.split("\n").slice(1, 6).join("\n"))}`;
    }
    return head;
  }
  return redactText(String(e)).slice(0, 500);
}

/** console.error yang otomatis menyamarkan seluruh argumen. */
export function logError(tag: string, ...args: unknown[]): void {
  console.error(
    tag,
    ...args.map((a) =>
      typeof a === "string" ? redactText(a) : describeError(a)
    )
  );
}

/** console.warn yang otomatis menyamarkan seluruh argumen. */
export function logWarn(tag: string, ...args: unknown[]): void {
  console.warn(
    tag,
    ...args.map((a) =>
      typeof a === "string" ? redactText(a) : describeError(a)
    )
  );
}
