import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

// --- Mock dependensi runtime (cookie store, DB, pengaturan) ---------------
const h = vi.hoisted(() => {
  const jar = new Map<string, string>();
  return {
    jar,
    store: {
      get: (name: string) =>
        jar.has(name) ? { name, value: jar.get(name)! } : undefined,
      set: vi.fn((name: string, value: string, _opts?: { maxAge?: number }) => {
        jar.set(name, value);
      }),
      delete: vi.fn((name: string) => {
        jar.delete(name);
      }),
    },
    findUnique: vi.fn(),
    update: vi.fn(),
    settings: { "security.sessionDays": "7" } as Record<string, string>,
  };
});

vi.mock("next/headers", () => ({ cookies: async () => h.store }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: h.findUnique, update: h.update } },
}));
vi.mock("@/lib/settings", () => ({ getSettings: async () => h.settings }));

const SECRET = "unit-test-secret-unit-test-secret-0123456789";

async function loadAuth() {
  vi.resetModules();
  return import("@/lib/auth");
}

/** Baris user dari DB (bentuk sesuai include di getCurrentUser). */
function dbUser(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Budi",
    email: "budi@up.ac.id",
    role: "auditee_member",
    unitId: 10,
    unit: { name: "Prodi Informatika" },
    isUnitHead: false,
    isLpmHead: false,
    isActive: true,
    sessionVersion: 3,
    consentedAt: new Date(),
    consentVersion: "lama",
    memberships: [
      { unitId: 20, role: "head", unit: { name: "Biro Umum" } },
      { unitId: 10, role: "x", unit: { name: "Akademik" } },
    ],
    ...over,
  };
}

const sessionUser = (over: Partial<SessionUser> = {}): SessionUser => ({
  id: 1,
  name: "Budi",
  email: "budi@up.ac.id",
  role: "auditee_member",
  unitId: 10,
  unitName: "Prodi Informatika",
  isUnitHead: false,
  isLpmHead: false,
  memberships: [{ unitId: 20, unitName: "Biro Umum", role: "head" }],
  consentRequired: false,
  ...over,
});

beforeEach(() => {
  h.jar.clear();
  h.findUnique.mockReset();
  h.update.mockReset();
  h.settings["security.sessionDays"] = "7";
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("predikat peran", () => {
  it("isLpm / isLpmAdmin / isSuperadmin / canViewReports / isPengunjung / hasAccess", async () => {
    const a = await loadAuth();
    const roles: SessionUser["role"][] = [
      "superadmin",
      "lpm_admin",
      "lpm_member",
      "auditee_head",
      "auditee_member",
      "pengunjung",
    ];
    expect(
      roles.map((r) => [
        r,
        a.isLpm(r),
        a.isLpmAdmin(r),
        a.isSuperadmin(r),
        a.canViewReports(r),
        a.isPengunjung(r),
        a.hasAccess(r),
      ])
    ).toEqual([
      ["superadmin", true, true, true, true, false, true],
      ["lpm_admin", true, true, false, true, false, true],
      ["lpm_member", true, false, false, true, false, true],
      ["auditee_head", false, false, false, false, false, true],
      ["auditee_member", false, false, false, false, false, true],
      ["pengunjung", false, false, false, false, true, false],
    ]);
  });
});

describe("unitIdsOf & isHeadOfUnit", () => {
  it("menggabungkan keanggotaan + unit utama tanpa duplikasi", async () => {
    const a = await loadAuth();
    expect(a.unitIdsOf(sessionUser())).toEqual([20, 10]);
    expect(
      a.unitIdsOf(
        sessionUser({
          memberships: [{ unitId: 10, unitName: "x", role: "member" }],
        })
      )
    ).toEqual([10]);
    expect(a.unitIdsOf(sessionUser({ unitId: null, memberships: [] }))).toEqual(
      []
    );
  });

  it("kepala unit hanya dari keanggotaan berperan head", async () => {
    const a = await loadAuth();
    expect(a.isHeadOfUnit(sessionUser(), 20)).toBe(true);
    expect(a.isHeadOfUnit(sessionUser(), 10)).toBe(false);
  });
});

describe("hash & verifikasi kata sandi", () => {
  it("bcrypt (cost >= 10) dapat diverifikasi, salah ditolak", async () => {
    const a = await loadAuth();
    const hash = await a.hashPassword("rahasia123");
    expect(hash).toMatch(/^\$2[aby]\$1\d\$/);
    expect(hash).not.toContain("rahasia123");
    await expect(a.verifyPassword("rahasia123", hash)).resolves.toBe(true);
    await expect(a.verifyPassword("salah", hash)).resolves.toBe(false);
  });

  it("hash kosong / rusak -> false (tanpa melempar)", async () => {
    const a = await loadAuth();
    await expect(a.verifyPassword("rahasia123", null)).resolves.toBe(false);
    await expect(a.verifyPassword("rahasia123", "bukan-hash")).resolves.toBe(
      false
    );
  });
});

describe("token sesi (JWT)", () => {
  it("cookie httpOnly, sameSite=lax, path=/; payload minimal (tanpa data pribadi)", async () => {
    const a = await loadAuth();
    await a.setSessionCookie({ id: 1, sessionVersion: 3 });
    expect(h.store.set).toHaveBeenCalledWith(
      a.COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    );
    const token = h.jar.get(a.COOKIE_NAME)!;
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    expect(payload).toMatchObject({ sub: "1", sv: 3 });
    expect(JSON.stringify(payload)).not.toMatch(/budi|email|role/i);

    const s = await a.getSession();
    expect(s).toMatchObject({ id: 1, sv: 3 });
  });

  it("masa berlaku sesi dibatasi 1–30 hari", async () => {
    const a = await loadAuth();
    h.settings["security.sessionDays"] = "999";
    await a.setSessionCookie({ id: 1, sessionVersion: 0 });
    expect(h.store.set.mock.calls.at(-1)![2]!.maxAge).toBe(60 * 60 * 24 * 30);
    h.settings["security.sessionDays"] = "0";
    await a.setSessionCookie({ id: 1, sessionVersion: 0 });
    expect(h.store.set.mock.calls.at(-1)![2]!.maxAge).toBe(60 * 60 * 24 * 7);
    h.settings["security.sessionDays"] = "-5";
    await a.setSessionCookie({ id: 1, sessionVersion: 0 });
    expect(h.store.set.mock.calls.at(-1)![2]!.maxAge).toBe(60 * 60 * 24 * 1);
  });

  it("token dimanipulasi / secret lain / alg=none ditolak", async () => {
    const a = await loadAuth();
    const token = await a.createSessionToken(1, 0);
    const [hd, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "2", sv: 0 })).toString(
      "base64url"
    );
    h.jar.set(a.COOKIE_NAME, `${hd}.${forged}.${sig}`);
    await expect(a.getSession()).resolves.toBeNull();

    const none = Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url"
    );
    h.jar.set(a.COOKIE_NAME, `${none}.${forged}.`);
    await expect(a.getSession()).resolves.toBeNull();

    const otherKey = new TextEncoder().encode("x".repeat(40));
    const other = await new SignJWT({ sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setIssuer("spmi")
      .setAudience("spmi-web")
      .setExpirationTime("1d")
      .sign(otherKey);
    h.jar.set(a.COOKIE_NAME, other);
    await expect(a.getSession()).resolves.toBeNull();
  });

  it("issuer/audience salah, kedaluwarsa, atau sub tidak valid ditolak", async () => {
    const a = await loadAuth();
    const key = new TextEncoder().encode(SECRET);
    const build = (
      opts: { iss?: string; aud?: string; sub?: string; exp?: string } = {}
    ) =>
      new SignJWT({ sv: 0 })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(opts.sub ?? "1")
        .setIssuer(opts.iss ?? "spmi")
        .setAudience(opts.aud ?? "spmi-web")
        .setIssuedAt()
        .setExpirationTime(opts.exp ?? "1d")
        .sign(key);

    h.jar.set(a.COOKIE_NAME, await build());
    await expect(a.getSession()).resolves.toMatchObject({ id: 1 });

    for (const bad of [
      { iss: "lain" },
      { aud: "lain" },
      { sub: "abc" },
      { sub: "-1" },
      { exp: "-1s" },
    ]) {
      h.jar.set(a.COOKIE_NAME, await build(bad));
      await expect(a.getSession(), JSON.stringify(bad)).resolves.toBeNull();
    }
  });

  it("token terlalu panjang ditolak tanpa diverifikasi", async () => {
    const a = await loadAuth();
    h.jar.set(a.COOKIE_NAME, "a".repeat(5000));
    await expect(a.getSession()).resolves.toBeNull();
  });

  it("clearSessionCookie menghapus cookie sesi & cookie SSO lama", async () => {
    const a = await loadAuth();
    await a.setSessionCookie({ id: 1, sessionVersion: 0 });
    await a.clearSessionCookie();
    const deleted = h.store.delete.mock.calls.map((c) => c[0]);
    expect(deleted).toEqual(
      expect.arrayContaining([a.COOKIE_NAME, "sso_session", "sso_access_token"])
    );
    await expect(a.getSession()).resolves.toBeNull();
  });
});

describe("getCurrentUser", () => {
  it("membangun SessionUser dari DB (peran dari DB, keanggotaan terurut)", async () => {
    const a = await loadAuth();
    await a.setSessionCookie({ id: 1, sessionVersion: 3 });
    h.findUnique.mockResolvedValueOnce(dbUser());
    const u = await a.getCurrentUser();
    expect(u).toMatchObject({
      id: 1,
      role: "auditee_member",
      unitName: "Prodi Informatika",
      consentRequired: true,
      memberships: [
        { unitId: 10, unitName: "Akademik", role: "member" },
        { unitId: 20, unitName: "Biro Umum", role: "head" },
      ],
    });
  });

  it("null bila user tidak ada / nonaktif / versi sesi dicabut", async () => {
    const a = await loadAuth();
    await a.setSessionCookie({ id: 1, sessionVersion: 3 });
    h.findUnique.mockResolvedValueOnce(null);
    await expect(a.getCurrentUser()).resolves.toBeNull();

    const b = await loadAuth();
    h.findUnique.mockResolvedValueOnce(dbUser({ isActive: false }));
    await expect(b.getCurrentUser()).resolves.toBeNull();

    const c = await loadAuth();
    h.findUnique.mockResolvedValueOnce(dbUser({ sessionVersion: 4 }));
    await expect(c.getCurrentUser()).resolves.toBeNull();
  });

  it("tanpa cookie tidak menyentuh DB", async () => {
    const a = await loadAuth();
    await expect(a.getCurrentUser()).resolves.toBeNull();
    expect(h.findUnique).not.toHaveBeenCalled();
  });
});

describe("revokeUserSessions", () => {
  it("menaikkan sessionVersion", async () => {
    const a = await loadAuth();
    h.update.mockResolvedValueOnce({ sessionVersion: 8 });
    await expect(a.revokeUserSessions(1)).resolves.toBe(8);
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { sessionVersion: { increment: 1 } },
      })
    );
  });
});

describe("konfigurasi produksi", () => {
  it("cookie memakai prefix __Host- di produksi", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const a = await loadAuth();
    expect(a.COOKIE_NAME.startsWith("__Host-")).toBe(true);
  });

  it("produksi tanpa AUTH_SECRET >= 32 karakter gagal saat menandatangani (fail-closed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "terlalu-pendek");
    const a = await loadAuth();
    await expect(a.createSessionToken(1, 0)).rejects.toThrow(/AUTH_SECRET/);
  });

  it("produksi tanpa secret: sesi apa pun ditolak", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    const a = await loadAuth();
    h.jar.set(a.COOKIE_NAME, "x.y.z");
    await expect(a.getSession()).resolves.toBeNull();
  });
});
