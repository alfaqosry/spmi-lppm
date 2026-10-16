import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_BASE = process.env.AUTH_COOKIE_NAME || "lpm_session";

/**
 * Nama cookie sesi.
 * Di produksi memakai prefix `__Host-` yang memaksa browser hanya menerima
 * cookie bila diset dengan Secure, path=/, dan tanpa Domain — mencegah
 * cookie-injection dari subdomain (cookie tossing) dan downgrade ke HTTP.
 */
export const COOKIE_NAME = IS_PROD ? `__Host-${COOKIE_BASE}` : COOKIE_BASE;

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

const SECRET = new TextEncoder().encode(resolveAuthSecret());

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
};

export type SessionPayload = SessionUser & { iat?: number; exp?: number };

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(user: SessionUser) {
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const days = Math.max(1, Number(settings["security.sessionDays"]) || 7);
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(SECRET);
}

export async function setSessionCookie(user: SessionUser) {
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const days = Math.max(1, Number(settings["security.sessionDays"]) || 7);
  const token = await createSessionToken(user);
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

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id as number,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as SessionUser["role"],
      unitId: (payload.unitId as number | null) ?? null,
      unitName: (payload.unitName as string | null) ?? null,
      isUnitHead: Boolean(payload.isUnitHead),
      isLpmHead: Boolean(payload.isLpmHead),
      memberships: Array.isArray(payload.memberships)
        ? (payload.memberships as UnitMembershipInfo[])
        : [],
    };
  } catch {
    return null;
  }
}

/** Ambil data user terbaru dari database (memastikan unit & role selalu sinkron). */
export async function getCurrentUser(): Promise<SessionUser | null> {
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
  };
}

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

/** Bentuk data user Prisma (dengan relasi) yang dibutuhkan untuk membangun sesi. */
export type SessionSourceUser = {
  id: number;
  name: string;
  email: string;
  role: SessionUser["role"];
  unitId: number | null;
  isUnitHead: boolean;
  isLpmHead?: boolean;
  unit?: { name: string } | null;
  memberships?: {
    unitId: number;
    role: string;
    unit?: { name: string } | null;
  }[];
};

/** Bangun objek sesi lengkap (termasuk daftar keanggotaan unit) dari data user. */
export function buildSessionUser(user: SessionSourceUser): SessionUser {
  const memberships: UnitMembershipInfo[] = (user.memberships ?? [])
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
    isLpmHead: Boolean(user.isLpmHead),
    memberships,
  };
}
