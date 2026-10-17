/**
 * Penentuan alamat IP klien di balik rantai proxy tepercaya.
 *
 * Topologi produksi:  Klien -> Cloudflare -> IIS ARR -> next start (127.0.0.1:3002)
 *
 * - IIS ARR MENAMBAHKAN alamat peer yang terhubung kepadanya ke ujung
 *   `X-Forwarded-For`. Jadi hop TERAKHIR XFF adalah alamat yang dilihat IIS
 *   (seharusnya edge Cloudflare). Semua nilai XFF sebelum itu dapat dipalsukan
 *   klien sehingga TIDAK dipercaya.
 * - `CF-Connecting-IP` hanya dipercaya bila hop terakhir tersebut berada pada
 *   rentang IP Cloudflare (permintaan benar-benar datang lewat Cloudflare).
 *   Bila seseorang menembak IIS langsung (melewati Cloudflare), header
 *   `CF-Connecting-IP` palsu diabaikan dan IP hop terakhir yang dipakai.
 *
 * Konfigurasi (env):
 *   TRUST_PROXY           "cloudflare" (default) | "xff" | "none"
 *                         - cloudflare: aturan di atas
 *                         - xff: pakai hop terakhir XFF saja (tanpa Cloudflare)
 *                         - none: abaikan header proxy (akses langsung)
 *   TRUSTED_PROXY_CIDRS   daftar CIDR tambahan (pisahkan koma) yang dianggap
 *                         proxy tepercaya selain Cloudflare (mis. IP IIS bila
 *                         ada hop proxy internal lain).
 */

/** Rentang IP Cloudflare (https://www.cloudflare.com/ips/), diperbarui 2026. */
const CLOUDFLARE_CIDRS = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

type Cidr = { v6: boolean; bits: bigint; mask: bigint };

function parseIPv4(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = BigInt(0);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = (n << BigInt(8)) + BigInt(v);
  }
  return n;
}

function parseIPv6(ip: string): bigint | null {
  // IPv4-mapped (::ffff:1.2.3.4) ditangani oleh normalizeIp.
  if (ip.includes(".")) return null;
  const dbl = ip.split("::");
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(":") : [];
  const tail = dbl.length === 2 && dbl[1] ? dbl[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (dbl.length === 1 && head.length !== 8) return null;
  if (missing < 0) return null;
  const groups = [
    ...head,
    ...Array(dbl.length === 2 ? missing : 0).fill("0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  let n = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << BigInt(16)) + BigInt(parseInt(g, 16));
  }
  return n;
}

function parseCidr(cidr: string): Cidr | null {
  const [ip, lenRaw] = cidr.trim().split("/");
  const v6 = ip.includes(":");
  const total = v6 ? 128 : 32;
  const len = lenRaw === undefined ? total : Number(lenRaw);
  if (!Number.isInteger(len) || len < 0 || len > total) return null;
  const bits = v6 ? parseIPv6(ip) : parseIPv4(ip);
  if (bits == null) return null;
  const all = (BigInt(1) << BigInt(total)) - BigInt(1);
  const mask =
    len === 0 ? BigInt(0) : (all >> BigInt(total - len)) << BigInt(total - len);
  return { v6, bits: bits & mask, mask };
}

let trustedCache: Cidr[] | null = null;
function trustedCidrs(): Cidr[] {
  if (trustedCache) return trustedCache;
  const extra = (process.env.TRUSTED_PROXY_CIDRS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  trustedCache = [...CLOUDFLARE_CIDRS, ...extra]
    .map(parseCidr)
    .filter((c): c is Cidr => c !== null);
  return trustedCache;
}

/**
 * Normalisasi teks IP: buang port (`1.2.3.4:5678`, `[::1]:80`), kurung siku,
 * zona IPv6, dan bentuk IPv4-mapped (`::ffff:1.2.3.4`).
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (!ip) return null;
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    ip = end > 0 ? ip.slice(1, end) : ip.slice(1);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  const pct = ip.indexOf("%");
  if (pct > 0) ip = ip.slice(0, pct);
  const mapped = /^::ffff:(\d{1,3}(\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (parseIPv4(ip) == null && parseIPv6(ip) == null) return null;
  return ip.toLowerCase();
}

/** Apakah IP berada pada salah satu rentang proxy tepercaya. */
export function isTrustedProxy(ip: string | null): boolean {
  if (!ip) return false;
  const v6 = ip.includes(":");
  const n = v6 ? parseIPv6(ip) : parseIPv4(ip);
  if (n == null) return false;
  return trustedCidrs().some((c) => c.v6 === v6 && (n & c.mask) === c.bits);
}

type HeaderLike = { get(name: string): string | null };

/**
 * Ambil IP klien dari header permintaan sesuai model kepercayaan proxy.
 * Satu-satunya sumber IP untuk pembatas laju, log login, dan log aktivitas.
 */
export function clientIpFromHeaders(h: HeaderLike): string {
  const mode = (process.env.TRUST_PROXY || "cloudflare").toLowerCase();
  if (mode === "none") return "unknown";

  const xff = (h.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lastHop =
    normalizeIp(xff[xff.length - 1]) ?? normalizeIp(h.get("x-real-ip"));

  if (mode === "cloudflare" && lastHop && isTrustedProxy(lastHop)) {
    const cf = normalizeIp(h.get("cf-connecting-ip"));
    if (cf) return cf;
    // Lewat proxy tepercaya tanpa CF-Connecting-IP: ambil hop sebelum proxy.
    for (let i = xff.length - 2; i >= 0; i--) {
      const ip = normalizeIp(xff[i]);
      if (ip && !isTrustedProxy(ip)) return ip;
    }
  }
  return lastHop ?? "unknown";
}

/** Versi untuk server action / server component (membaca `headers()`). */
export async function getClientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  return clientIpFromHeaders(await headers());
}

/** User-Agent (dipotong) untuk log. */
export async function getUserAgent(): Promise<string | null> {
  const { headers } = await import("next/headers");
  const ua = (await headers()).get("user-agent");
  return ua ? ua.slice(0, 400) : null;
}

/**
 * URL dasar aplikasi yang TEPERCAYA untuk membangun URL absolut (redirect,
 * tautan). Tidak pernah memakai header Host/X-Forwarded-Host permintaan.
 * Urutan: env APP_URL -> pengaturan site.baseUrl -> origin Redirect URI SSO
 * -> http://localhost:3002 (hanya non-produksi).
 */
export async function appBaseUrl(): Promise<string> {
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings();
  const candidates = [
    process.env.APP_URL,
    s["site.baseUrl"],
    s["sso.redirectUri"],
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c);
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
    } catch {
      /* kandidat berikutnya */
    }
  }
  return "http://localhost:3002";
}
