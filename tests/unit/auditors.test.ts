import { beforeEach, describe, expect, it, vi } from "vitest";

type MockUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  unitId: number | null;
  unit?: { id: number; name: string } | null;
  memberships: { unitId: number; unit: { name: string } }[];
};

type MockUnitAuditor = {
  id: number;
  cycleId: number;
  unitId: number;
  userId: number;
  role: "lead" | "member";
  user?: { name: string };
  unit?: { name: string };
  cycle?: { name: string };
};

const h = vi.hoisted(() => ({
  actor: { id: 1, name: "Admin LPM", role: "lpm_admin" },
  users: [] as MockUser[],
  units: [
    { id: 10, name: "Program Studi Teknik Informatika" },
    { id: 20, name: "Program Studi Sistem Informasi" },
  ],
  cycles: [{ id: 1, name: "Siklus AMI 2026/2027", isActive: true }],
  assignments: [] as MockUnitAuditor[],
  revoked: [] as number[],
  activityLogs: [] as any[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/net", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/guards", () => ({
  requireLpmAdmin: async () => h.actor,
}));
vi.mock("@/lib/logs", () => ({
  recordActivity: async (log: any) => {
    h.activityLogs.push(log);
  },
}));
vi.mock("@/lib/auth", () => ({
  revokeUserSessions: async (userId: number) => {
    h.revoked.push(userId);
  },
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: async (fn: any) => fn(prisma),
    user: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        const u = h.users.find((x) => x.id === where.id);
        if (!u) return null;
        return {
          ...u,
          unit: u.unitId
            ? (h.units.find((unit) => unit.id === u.unitId) ?? null)
            : null,
          memberships: u.memberships,
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        const u = h.users.find((x) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      },
    },
    unit: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        return h.units.find((u) => u.id === where.id) ?? null;
      },
    },
    auditCycle: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        return h.cycles.find((c) => c.id === where.id) ?? null;
      },
    },
    unitMembership: {
      upsert: async ({ create }: any) => {
        return create;
      },
    },
    unitAuditor: {
      findUnique: async ({ where }: any) => {
        if (where.id) {
          const item = h.assignments.find((a) => a.id === where.id);
          if (!item) return null;
          return {
            ...item,
            user: {
              name: h.users.find((u) => u.id === item.userId)?.name ?? "",
            },
            unit: {
              name: h.units.find((u) => u.id === item.unitId)?.name ?? "",
            },
            cycle: {
              name: h.cycles.find((c) => c.id === item.cycleId)?.name ?? "",
            },
          };
        }
        if (where.cycleId_unitId_role) {
          const { cycleId, unitId, role } = where.cycleId_unitId_role;
          const item = h.assignments.find(
            (a) =>
              a.cycleId === cycleId && a.unitId === unitId && a.role === role
          );
          if (!item) return null;
          return {
            ...item,
            user: {
              name: h.users.find((u) => u.id === item.userId)?.name ?? "",
            },
          };
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        const { cycleId, unitId, role } = where.cycleId_unitId_role;
        const existing = h.assignments.find(
          (a) => a.cycleId === cycleId && a.unitId === unitId && a.role === role
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const newItem: MockUnitAuditor = {
          id: h.assignments.length + 1,
          cycleId,
          unitId,
          userId: create.userId,
          role,
        };
        h.assignments.push(newItem);
        return newItem;
      },
      delete: async ({ where }: any) => {
        const idx = h.assignments.findIndex((a) => a.id === where.id);
        if (idx !== -1) {
          return h.assignments.splice(idx, 1)[0];
        }
        return null;
      },
      deleteMany: async ({ where }: any) => {
        h.assignments = h.assignments.filter((a) => a.userId !== where.userId);
        return { count: 1 };
      },
    },
  };
  return { prisma };
});

import {
  appointAuditor,
  assignUnitAuditor,
  removeUnitAuditor,
  revokeAuditor,
} from "@/lib/actions/auditors";

describe("Manajemen Auditor & Validasi Independensi SPMI", () => {
  beforeEach(() => {
    h.users = [
      {
        id: 2,
        name: "Dr. Budi Santoso",
        email: "budi@univ.ac.id",
        role: "auditor",
        isActive: true,
        unitId: 10, // Berasal dari Prodi TI (Unit 10)
        memberships: [
          { unitId: 10, unit: { name: "Program Studi Teknik Informatika" } },
        ],
      },
      {
        id: 3,
        name: "Dr. Siti Aminah",
        email: "siti@univ.ac.id",
        role: "auditor",
        isActive: true,
        unitId: 20, // Berasal dari Prodi SI (Unit 20)
        memberships: [
          { unitId: 20, unit: { name: "Program Studi Sistem Informasi" } },
        ],
      },
      {
        id: 4,
        name: "Dosen Biasa",
        email: "dosen@univ.ac.id",
        role: "pengunjung",
        isActive: true,
        unitId: null,
        memberships: [],
      },
      {
        id: 5,
        name: "Super Admin",
        email: "sa@univ.ac.id",
        role: "superadmin",
        isActive: true,
        unitId: null,
        memberships: [],
      },
    ];
    h.assignments = [];
    h.revoked = [];
    h.activityLogs = [];
  });

  describe("appointAuditor & revokeAuditor", () => {
    it("berhasil mengangkat akun menjadi auditor dan mencabut sesinya", async () => {
      const form = new FormData();
      form.append("userId", "4");
      form.append("homebaseUnitId", "10");

      const res = await appointAuditor(undefined, form);
      expect(res).toEqual({ ok: true });
      expect(h.users.find((u) => u.id === 4)?.role).toBe("auditor");
      expect(h.users.find((u) => u.id === 4)?.unitId).toBe(10);
      expect(h.revoked).toContain(4);
    });

    it("menolak mengangkat superadmin menjadi auditor", async () => {
      const form = new FormData();
      form.append("userId", "5");

      const res = await appointAuditor(undefined, form);
      expect(res?.error).toMatch(/superadmin/i);
    });

    it("mencabut status auditor dan menghapus penugasan aktif", async () => {
      h.assignments.push({
        id: 1,
        cycleId: 1,
        unitId: 20,
        userId: 2,
        role: "lead",
      });

      const form = new FormData();
      form.append("userId", "2");

      const res = await revokeAuditor(undefined, form);
      expect(res).toEqual({ ok: true });
      expect(h.users.find((u) => u.id === 2)?.role).toBe("pengunjung");
      expect(h.assignments.filter((a) => a.userId === 2)).toHaveLength(0);
      expect(h.revoked).toContain(2);
    });
  });

  describe("assignUnitAuditor & Validasi Aturan Independensi", () => {
    it("MENOLAK jika Auditor berasal dari unit yang diaudit (Konflik Kepentingan via unitId)", async () => {
      // Dr. Budi Santoso berasal dari Prodi TI (Unit 10).
      // Mencoba menugaskan Budi untuk mengaudit Prodi TI (Unit 10) -> HARUS DITOLAK!
      const form = new FormData();
      form.append("cycleId", "1");
      form.append("unitId", "10");
      form.append("userId", "2");
      form.append("role", "lead");

      const res = await assignUnitAuditor(undefined, form);
      expect(res?.error).toBeDefined();
      expect(res?.error).toMatch(/Konflik Kepentingan/i);
      expect(res?.error).toMatch(/tidak boleh ditugaskan mengaudit/i);
      expect(h.assignments).toHaveLength(0);
    });

    it("MENOLAK jika Auditor memiliki keanggotaan di unit yang diaudit (Konflik Kepentingan via memberships)", async () => {
      // Budi unitId=null tapi memberships ada di Unit 10
      h.users[0].unitId = null;
      h.users[0].memberships = [
        { unitId: 10, unit: { name: "Program Studi Teknik Informatika" } },
      ];

      const form = new FormData();
      form.append("cycleId", "1");
      form.append("unitId", "10");
      form.append("userId", "2");
      form.append("role", "member");

      const res = await assignUnitAuditor(undefined, form);
      expect(res?.error).toMatch(/Konflik Kepentingan/i);
      expect(h.assignments).toHaveLength(0);
    });

    it("MENERIMA penugasan jika Auditor berasal dari unit yang BERBEDA (Independen)", async () => {
      // Dr. Budi (dari Unit 10) mengaudit Unit 20 (Prodi SI) -> DIPERBOLEHKAN!
      const form = new FormData();
      form.append("cycleId", "1");
      form.append("unitId", "20");
      form.append("userId", "2");
      form.append("role", "lead");

      const res = await assignUnitAuditor(undefined, form);
      expect(res).toEqual({ ok: true });
      expect(h.assignments).toHaveLength(1);
      expect(h.assignments[0]).toMatchObject({
        cycleId: 1,
        unitId: 20,
        userId: 2,
        role: "lead",
      });
    });

    it("MENOLAK jika orang yang sama ditugaskan ke kedua slot pada unit yang sama (Auditor 1 & Auditor 2)", async () => {
      // Dr. Budi sudah ditugaskan sebagai Auditor 1 (lead) di Unit 20
      h.assignments.push({
        id: 1,
        cycleId: 1,
        unitId: 20,
        userId: 2,
        role: "lead",
      });

      // Coba menugaskan Dr. Budi LAGI sebagai Auditor 2 (member) di Unit 20
      const form = new FormData();
      form.append("cycleId", "1");
      form.append("unitId", "20");
      form.append("userId", "2");
      form.append("role", "member");

      const res = await assignUnitAuditor(undefined, form);
      expect(res?.error).toBeDefined();
      expect(res?.error).toMatch(/sudah ditugaskan/i);
      expect(res?.error).toMatch(/2 orang auditor yang berbeda/i);
    });

    it("BERHASIL menugaskan 2 orang auditor berbeda ke slot Auditor 1 dan Auditor 2", async () => {
      // Slot 1: Dr. Budi (asal Unit 10) -> mengaudit Unit 20 (Lead)
      const form1 = new FormData();
      form1.append("cycleId", "1");
      form1.append("unitId", "20");
      form1.append("userId", "2");
      form1.append("role", "lead");

      const res1 = await assignUnitAuditor(undefined, form1);
      expect(res1).toEqual({ ok: true });

      // Tambah auditor ke-3: Dr. Charlie dari luar / unit lain
      h.users.push({
        id: 6,
        name: "Dr. Charlie",
        email: "charlie@univ.ac.id",
        role: "auditor",
        isActive: true,
        unitId: null,
        memberships: [],
      });

      // Slot 2: Dr. Charlie -> mengaudit Unit 20 (Member)
      const form2 = new FormData();
      form2.append("cycleId", "1");
      form2.append("unitId", "20");
      form2.append("userId", "6");
      form2.append("role", "member");

      const res2 = await assignUnitAuditor(undefined, form2);
      expect(res2).toEqual({ ok: true });

      expect(h.assignments).toHaveLength(2);
      const lead = h.assignments.find((a) => a.role === "lead");
      const member = h.assignments.find((a) => a.role === "member");
      expect(lead?.userId).toBe(2);
      expect(member?.userId).toBe(6);
    });

    it("MENOLAK jika pengguna bukan akun dengan peran auditor", async () => {
      // User 4 adalah 'pengunjung'
      const form = new FormData();
      form.append("cycleId", "1");
      form.append("unitId", "20");
      form.append("userId", "4");
      form.append("role", "lead");

      const res = await assignUnitAuditor(undefined, form);
      expect(res?.error).toMatch(/peran Auditor/i);
    });
  });

  describe("removeUnitAuditor", () => {
    it("berhasil membatalkan penugasan auditor", async () => {
      h.assignments.push({
        id: 99,
        cycleId: 1,
        unitId: 20,
        userId: 2,
        role: "lead",
      });

      const form = new FormData();
      form.append("assignmentId", "99");

      const res = await removeUnitAuditor(undefined, form);
      expect(res).toEqual({ ok: true });
      expect(h.assignments).toHaveLength(0);
    });
  });
});
