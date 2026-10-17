import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth";

const h = vi.hoisted(() => ({
  user: null as SessionUser | null,
  settings: {
    "maintenance.enabled": "false",
    "maintenance.message": "",
  } as Record<string, string>,
}));

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: async () => h.user };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/settings", () => ({
  getSettings: async () => h.settings,
  isOn: (v: string | undefined) => v === "true" || v === "1" || v === "on",
}));

import { AppError } from "@/lib/errors";
import {
  canReadUnit,
  requireAccess,
  requireLpm,
  requireLpmAdmin,
  requireSuperadmin,
  requireUnitMember,
  requireUser,
} from "@/lib/guards";

const as = (role: SessionUser["role"], over: Partial<SessionUser> = {}) =>
  ({
    id: 1,
    name: "U",
    email: "u@up.ac.id",
    role,
    unitId: 10,
    unitName: "Unit 10",
    isUnitHead: false,
    isLpmHead: false,
    memberships: [{ unitId: 20, unitName: "Unit 20", role: "member" }],
    consentRequired: false,
    ...over,
  }) satisfies SessionUser;

beforeEach(() => {
  h.user = null;
  h.settings["maintenance.enabled"] = "false";
  h.settings["maintenance.message"] = "";
});

describe("requireUser", () => {
  it("menolak tanpa sesi", async () => {
    await expect(requireUser()).rejects.toThrow(/Sesi tidak valid/);
  });

  it("mode pemeliharaan memblokir selain superadmin", async () => {
    h.settings["maintenance.enabled"] = "true";
    h.settings["maintenance.message"] = "Sedang perawatan";
    h.user = as("lpm_admin");
    await expect(requireUser()).rejects.toThrow("Sedang perawatan");
    await expect(
      requireUser({ allowDuringMaintenance: true })
    ).resolves.toMatchObject({ role: "lpm_admin" });
    h.user = as("superadmin");
    await expect(requireUser()).resolves.toMatchObject({ role: "superadmin" });
  });

  it("pesan pemeliharaan default bila kosong", async () => {
    h.settings["maintenance.enabled"] = "true";
    h.user = as("auditee_member");
    await expect(requireUser()).rejects.toThrow(/pemeliharaan/);
  });
});

describe("matriks otorisasi peran", () => {
  const roles: SessionUser["role"][] = [
    "superadmin",
    "lpm_admin",
    "lpm_member",
    "auditee_head",
    "auditee_member",
    "pengunjung",
  ];

  async function allowed(fn: () => Promise<unknown>) {
    try {
      await fn();
      return true;
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      return false;
    }
  }

  it("requireAccess / requireLpm / requireLpmAdmin / requireSuperadmin", async () => {
    const table: Record<string, boolean[]> = {};
    for (const r of roles) {
      h.user = as(r);
      table[r] = [
        await allowed(requireAccess),
        await allowed(requireLpm),
        await allowed(requireLpmAdmin),
        await allowed(requireSuperadmin),
      ];
    }
    expect(table).toEqual({
      superadmin: [true, true, true, true],
      lpm_admin: [true, true, true, false],
      lpm_member: [true, true, false, false],
      auditee_head: [true, false, false, false],
      auditee_member: [true, false, false, false],
      pengunjung: [false, false, false, false],
    });
  });
});

describe("requireUnitMember", () => {
  it("hanya auditee yang ditempatkan pada unit tersebut", async () => {
    h.user = as("auditee_member");
    await expect(requireUnitMember(10)).resolves.toBeTruthy(); // unit utama
    await expect(requireUnitMember(20)).resolves.toBeTruthy(); // keanggotaan
    await expect(requireUnitMember(99)).rejects.toThrow(/tidak memiliki akses/);
  });

  it("akun LPM / pengunjung tidak boleh mengisi data unit", async () => {
    h.user = as("lpm_admin");
    await expect(requireUnitMember(10)).rejects.toThrow(/Hanya akun unit/);
    h.user = as("pengunjung");
    await expect(requireUnitMember(10)).rejects.toThrow(AppError);
  });
});

describe("canReadUnit", () => {
  it("LPM membaca semua; auditee hanya unitnya; pengunjung tidak", () => {
    expect(canReadUnit(as("lpm_member"), 999)).toBe(true);
    expect(canReadUnit(as("auditee_head"), 20)).toBe(true);
    expect(canReadUnit(as("auditee_head"), 999)).toBe(false);
    expect(canReadUnit(as("pengunjung"), 10)).toBe(false);
  });
});
