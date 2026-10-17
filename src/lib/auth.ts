import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { needsConsent } from "@/lib/privacy";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_BASE = process.env.AUTH_COOKIE_NAME || "lpm_session";

/**
 * Nama cookie sesi.
 * Di produksi memakai prefix `__Host-` yang memaksa browser hanya menerima
 * cookie bila diset dengan Secure, path=/, dan tanpa Domain — mencegah
 * cookie-injection dari subdomain (cookie tossing) dan downgrade ke HTTP.
 */
export const COOKIE_NAME = IS_PROD ? `__Host-${COOKIE_BASE}` : COOKIE_BASE;

const JWT_ISSUER = "spmi";
const JWT_AUDIENCE = "spmi-web";

/** Biaya bcrypt (ASVS 2.4.4: >= 10). */
const BCRYPT_COST = 10;

/**
 * Secret untuk menandatangani sesi JWT.
 * KEAMANAN: di produksi WAJIB diisi. Tidak ada fallback diam-diam karena
 * fallback yang diketahui publik memungkinkan pemalsuan token (bypass auth).
 */
function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET wajib diatur (minimal 32 karakter) pada lingkungan produksi."
    );
  }
  console.warn(
    "[security] AUTH_SECRET tidak diset / terlalu pendek — memakai nilai dev. " +
      "JANGAN gunakan ini di produksi."
  );
  return "lpm-spmi-dev-secret-change-me-please-set-AUTH_SECRET";
}

let secretBytes: Uint8Array | null = null;
function secret(): Uint8Array {
  // Lazy agar `next build` (NODE_ENV=production) tidak gagal saat env runtime
  // belum tersedia; tetap fail-closed saat token benar-benar ditandatangani.
  if (!secretBytes) secretBytes = new TextEncoder().encode(resolveAuthSecret());
  return secretBytes;
}

/** Keanggotaan pengguna pada sebuah unit (untuk mendukung rangkap jabatan). */
export type UnitMembershipInfo = {
  unitId: number;
  unitName: string;
  role: "head" | "member";
};

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role:
    | "superadmin"
    | "lpm_admin"
    | "lpm_member"
    | "auditee_head"
    | "auditee_member"
    | "pengunjung";
  unitId: number | null;
  unitName: string | null;
  isUnitHead: boolean;
  /** Menandai pengguna sebagai Ketua LPM (penandatangan laporan). */
  isLpmHead: boolean;
  /** Seluruh unit tempat pengguna ditempatkan (bisa lebih dari satu). */
  memberships: UnitMembershipInfo[];
  /**
   * true bila pengguna belum menyetujui kebijakan privasi versi terbaru
   * (CONSENT_VERSION). UI wajib menampilkan persetujuan & memanggil
   * `recordConsent()` (src/lib/actions/privacy.ts).
   */
  consentRequired: boolean;
};

/**
 * Isi token sesi — SENGAJA minimal (tanpa nama/email/peran) agar cookie
 * tidak membawa data pribadi; data pengguna selalu dibaca ulang dari DB.
 */
export type SessionPayload = {
  id: number;
  sv: number;
  iat?: number;
  exp?: number;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Hash tiruan untuk menyamakan waktu respons saat akun tidak ada (anti enumerasi). */
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(plain: string, hash: string | null) {
  if (!hash) {
    dummyHash ??= bcrypt.hash("spmi-dummy-password-0", BCRYPT_COST);
    await bcrypt.compare(plain, await dummyHash).catch(() => false);
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

async function sessionDays(): Promise<number> {
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const n = Math.floor(Number(settings["security.sessionDays"]) || 7);
  return Math.min(30, Math.max(1, n));
}

export async function createSessionToken(
  userId: number,
  sessionVersion: number
) {
  const days = await sessionDays();
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

/**
 * Terbitkan cookie sesi BARU (dipanggil setelah login sukses / ganti kata sandi).
 * Token selalu dibuat ulang — mencegah session fixation.
 */
export async function setSessionCookie(user: {
  id: number;
  sessionVersion: number;
}) {
  const days = await sessionDays();
  const token = await createSessionToken(user.id, user.sessionVersion);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // __Host- mewajibkan Secure; di produksi selalu true.
    secure: IS_PROD,
    path: "/",
    maxAge: 60 * 60 * 24 * days,
  });
}

/** Hapus cookie sesi (termasuk nama lama tanpa prefix & cookie SSO lama). */
export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(COOKIE_BASE);
  // Cookie peninggalan paket SSO versi lama (menyimpan token SSO tanpa enkripsi).
  store.delete("sso_session");
  store.delete("sso_access_token");
}

/**
 * Cabut SEMUA sesi aktif seorang pengguna (logout, ganti kata sandi, ubah
 * peran/status, nonaktif). Murah: satu UPDATE; pemeriksaan versi dilakukan
 * pada query user yang memang sudah dijalankan `getCurrentUser()`.
 */
export async function revokeUserSessions(userId: number): Promise<number> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return u.sessionVersion;
}

/** Baca & verifikasi token sesi dari cookie (tanpa akses DB). */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token || token.length > 4096) return null;
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const id = Number(payload.sub);
    const sv = Number(payload.sv);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(sv)) return null;
    return { id, sv, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

/**
 * Ambil data user terbaru dari database (memastikan unit & role selalu sinkron).
 * Sesi ditolak bila akun dihapus, nonaktif, atau versi sesinya sudah dicabut.
 * Di-memoize per request (layout + page + action memakai satu query).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      unit: true,
      memberships: { include: { unit: { select: { name: true } } } },
    },
  });
  if (!user || !user.isActive) return null;
  if (user.sessionVersion !== session.sv) return null;

  const memberships: UnitMembershipInfo[] = user.memberships
    .map((m) => ({
      unitId: m.unitId,
      unitName: m.unit?.name ?? "",
      role: m.role === "head" ? ("head" as const) : ("member" as const),
    }))
    .sort((a, b) => a.unitName.localeCompare(b.unitName));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    unitId: user.unitId,
    unitName: user.unit?.name ?? null,
    isUnitHead: user.isUnitHead,
    isLpmHead: user.isLpmHead,
    memberships,
    consentRequired: needsConsent(user),
  };
});

/** Peran LPM (admin, superadmin, maupun anggota) — boleh mengelola & memverifikasi audit. */
export function isLpm(role: SessionUser["role"]) {
  return role === "lpm_admin" || role === "lpm_member" || role === "superadmin";
}

/** Admin (Admin LPM atau Superadmin) — boleh kelola akun, unit, dan siklus. */
export function isLpmAdmin(role: SessionUser["role"]) {
  return role === "lpm_admin" || role === "superadmin";
}

/** Superadmin — akses seluruh fitur admin + menu Pengaturan sistem. */
export function isSuperadmin(role: SessionUser["role"]) {
  return role === "superadmin";
}

/** Apakah peran termasuk tim LPM (dipakai untuk gating halaman laporan). */
export function canViewReports(role: SessionUser["role"]) {
  return isLpm(role);
}

/** Pengunjung/tamu — belum diberi akses fitur apa pun. */
export function isPengunjung(role: SessionUser["role"]) {
  return role === "pengunjung";
}

/** Apakah peran memiliki akses ke aplikasi (selain pengunjung). */
export function hasAccess(role: SessionUser["role"]) {
  return role !== "pengunjung";
}

/** Daftar id unit tempat pengguna ditempatkan (dari keanggotaan, fallback unit utama). */
export function unitIdsOf(user: SessionUser): number[] {
  const ids = user.memberships.map((m) => m.unitId);
  if (user.unitId && !ids.includes(user.unitId)) ids.push(user.unitId);
  return ids;
}

/** Apakah pengguna (auditee) merupakan kepala unit pada unit tertentu. */
export function isHeadOfUnit(user: SessionUser, unitId: number): boolean {
  return user.memberships.some((m) => m.unitId === unitId && m.role === "head");
}
