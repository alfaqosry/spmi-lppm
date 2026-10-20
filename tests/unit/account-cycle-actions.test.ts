import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Uji regresi server action akun & siklus (temuan E2E 20 Okt 2026):
 * - TC-ROL-12: checkbox "Akun aktif" yang tidak dicentang harus menonaktifkan
 *   akun dan mencabut sesinya.
 * - TC-ROL-11 / TC-SIK-07: galat bisnis dari aksi yang dipanggil lewat
 *   ConfirmAction/dialog dikembalikan sebagai `{ error }` (bukan dilempar),
 *   karena Next.js menyamarkan pesan error yang dilempar di produksi.
 */

type User = {
  id: number;
  role: string;
  isActive: boolean;
  email: string;
  name: string;
};

const h = vi.hoisted(() => ({
  actor: { id: 1, name: "Admin", role: "lpm_admin" },
  users: [] as User[],
  cycles: [] as { id: number; isActive: boolean }[],
  revoked: [] as number[],
  updates: [] as { id: number; data: Record<string, unknown> }[],
  failCycleUpdate: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/net", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/upload", () => ({ cleanupUnreferencedUploads: vi.fn() }));
vi.mock("@/lib/logs", () => ({ recordActivity: vi.fn() }));
vi.mock("@/lib/guards", () => ({ requireLpmAdmin: async () => h.actor }));
vi.mock("@/lib/auth", () => ({
  hashPassword: async (p: string) => `hash:${p}`,
  isSuperadmin: (r: string) => r === "superadmin",
  revokeUserSessions: async (id: number) => {
    h.revoked.push(id);
  },
}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: {
      // Salinan, seperti Prisma (bukan referensi ke baris yang diubah).
      findUnique: async ({ where }: { where: { id: number } }) => {
        const u = h.users.find((x) => x.id === where.id);
        return u ? { ...u } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        h.updates.push({ id: where.id, data });
        const u = h.users.find((x) => x.id === where.id)!;
        Object.assign(u, data);
        return u;
      },
      count: async () => 0,
      delete: vi.fn(),
    },
    unitMembership: { deleteMany: vi.fn(), upsert: vi.fn() },
    auditCycle: {
      findUnique: async ({ where }: { where: { id: number } }) =>
        h.cycles.find((c) => c.id === where.id) ?? null,
      update: async () => {
        if (h.failCycleUpdate)
          throw new Error("Unknown column 'audit_cycles.secret' in 'where'");
        return {};
      },
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    auditResponse: { findMany: async () => [] },
    document: { findMany: async () => [] },
    $transaction: async (ops: unknown) =>
      typeof ops === "function" ? ops(prisma) : Promise.all(ops as unknown[]),
  };
  return { prisma };
});

const { updateAccount, deleteAccount } = await import("@/lib/actions/units");
const { deleteCycle, deactivateCycle, setActiveCycle } =
  await import("@/lib/actions/cycles");

function accountForm(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.actor = { id: 1, name: "Admin", role: "lpm_admin" };
  h.users = [
    { id: 1, role: "lpm_admin", isActive: true, email: "a@x.id", name: "A" },
    { id: 2, role: "lpm_member", isActive: true, email: "b@x.id", name: "B" },
  ];
  h.cycles = [
    { id: 10, isActive: true },
    { id: 11, isActive: false },
  ];
  h.revoked = [];
  h.updates = [];
  h.failCycleUpdate = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateAccount — status aktif (TC-ROL-12)", () => {
  it("checkbox tidak dicentang (field tidak dikirim) → akun dinonaktifkan & sesi dicabut", async () => {
    const res = await updateAccount(
      undefined,
      accountForm({ id: "2", name: "B", role: "lpm_member" })
    );
    expect(res).toEqual({ ok: true });
    expect(h.updates.at(-1)?.data.isActive).toBe(false);
    expect(h.revoked).toEqual([2]);
  });

  it("checkbox dicentang → akun tetap aktif, sesi tidak dicabut", async () => {
    const res = await updateAccount(
      undefined,
      accountForm({ id: "2", name: "B", role: "lpm_member", isActive: "on" })
    );
    expect(res).toEqual({ ok: true });
    expect(h.updates.at(-1)?.data.isActive).toBe(true);
    expect(h.revoked).toEqual([]);
  });

  it("mengaktifkan kembali akun nonaktif", async () => {
    h.users[1].isActive = false;
    await updateAccount(
      undefined,
      accountForm({ id: "2", name: "B", role: "lpm_member", isActive: "on" })
    );
    expect(h.users[1].isActive).toBe(true);
  });

  it("menolak menonaktifkan akun sendiri", async () => {
    const res = await updateAccount(
      undefined,
      accountForm({ id: "1", name: "A", role: "lpm_admin" })
    );
    expect(res?.error).toMatch(/menonaktifkan akun sendiri/);
    expect(h.updates).toEqual([]);
  });

  it("non-superadmin tidak dapat menonaktifkan akun Superadmin", async () => {
    h.users[1].role = "superadmin";
    const res = await updateAccount(
      undefined,
      accountForm({ id: "2", name: "B", role: "superadmin" })
    );
    expect(res?.error).toMatch(/Superadmin/);
    expect(h.updates).toEqual([]);
  });
});

describe("galat bisnis dikembalikan sebagai { error } (TC-ROL-11 / TC-SIK-07)", () => {
  it("deleteAccount akun sendiri → pesan asli, tidak dilempar", async () => {
    await expect(deleteAccount(1)).resolves.toEqual({
      error: "Tidak dapat menghapus akun sendiri.",
    });
  });

  it("deleteAccount sukses → { ok: true }", async () => {
    await expect(deleteAccount(2)).resolves.toEqual({ ok: true });
  });

  it("deleteCycle siklus aktif → pesan asli", async () => {
    const res = await deleteCycle(10);
    expect(res?.error).toBe(
      "Siklus aktif tidak dapat dihapus. Nonaktifkan siklus terlebih dahulu."
    );
  });

  it("deleteCycle siklus nonaktif → { ok: true }", async () => {
    await expect(deleteCycle(11)).resolves.toEqual({ ok: true });
  });

  it("ID tidak valid → pesan validasi, bukan exception", async () => {
    const res = await setActiveCycle(-1);
    expect(res?.error).toBeTruthy();
  });

  it("error tak terduga → pesan generik tanpa detail internal", async () => {
    h.failCycleUpdate = true;
    const res = await deactivateCycle(10);
    expect(res?.error).toBe("Gagal menonaktifkan siklus.");
    expect(res?.error).not.toMatch(/column|secret/);
  });
});
