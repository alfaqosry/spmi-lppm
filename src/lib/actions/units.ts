"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { AppError, toActionError } from "@/lib/errors";
import type { Role } from "@prisma/client";

async function requireLpm() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "lpm_admin" && user.role !== "superadmin")) {
    throw new AppError("Akses ditolak. Hanya Admin LPM.");
  }
  return user;
}

export type ActionState = { ok?: boolean; error?: string } | undefined;

/* ------------------------------- UNIT ---------------------------------- */

export async function createUnit(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!name || !category) return { error: "Nama dan kategori unit wajib diisi." };

    await prisma.unit.create({
      data: { name, category, description: description || null },
    });
    revalidatePath("/unit");
    revalidatePath("/audit");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan unit.") };
  }
}

export async function updateUnit(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!id || !name || !category) return { error: "Data unit tidak lengkap." };

    await prisma.unit.update({
      where: { id },
      data: { name, category, description: description || null },
    });
    revalidatePath("/unit");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui unit.") };
  }
}

export async function deleteUnit(id: number) {
  await requireLpm();
  await prisma.unit.delete({ where: { id } });
  revalidatePath("/unit");
  revalidatePath("/dashboard");
}

/* ------------------------------- AKUN ---------------------------------- */

/** Role yang tidak terikat pada unit apa pun (unitId selalu null). */
const NO_UNIT_ROLES: Role[] = ["superadmin", "lpm_admin", "lpm_member", "pengunjung"];

/** Cek apakah sudah ada Kepala Unit lain pada unit yang sama. */
async function assertHeadAvailable(unitId: number | null, excludeUserId?: number) {
  if (!unitId) return null;
  const existing = await prisma.unitMembership.findFirst({
    where: {
      unitId,
      role: "head",
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    include: { user: { select: { name: true } } },
  });
  if (existing) {
    return `Unit tersebut sudah memiliki Kepala Unit (${existing.user.name}). Satu unit hanya boleh punya satu Kepala Unit.`;
  }
  return null;
}

/**
 * Sinkronkan peran global, unit utama, dan status kepala unit pengguna
 * berdasarkan seluruh keanggotaannya. Akun LPM (admin/anggota) tidak diubah.
 * Bila keanggotaan habis, akun otomatis dikembalikan menjadi Pengunjung.
 */
async function syncUserAccess(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return;
  if (user.role === "superadmin" || user.role === "lpm_admin" || user.role === "lpm_member") return;

  const memberships = await prisma.unitMembership.findMany({
    where: { userId },
    orderBy: { id: "asc" },
  });

  if (memberships.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "pengunjung", unitId: null, isUnitHead: false },
    });
    return;
  }

  const head = memberships.find((m) => m.role === "head");
  const primary = head ?? memberships[0];
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: head ? "auditee_head" : "auditee_member",
      unitId: primary.unitId,
      isUnitHead: Boolean(head),
    },
  });
}

export async function createAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || "auditee_member") as Role;
    const unitIdRaw = formData.get("unitId");
    const unitId = unitIdRaw ? Number(unitIdRaw) : null;

    if (!name || !email || !password) {
      return { error: "Nama, email, dan kata sandi wajib diisi." };
    }
    if (password.length < 8) {
      return { error: "Kata sandi minimal 8 karakter." };
    }
    if (!NO_UNIT_ROLES.includes(role) && !unitId) {
      return { error: "Akun auditee wajib ditautkan ke sebuah unit." };
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return { error: "Email sudah terdaftar." };

    const finalUnitId = NO_UNIT_ROLES.includes(role) ? null : unitId;
    if (role === "auditee_head") {
      const headErr = await assertHeadAvailable(finalUnitId);
      if (headErr) return { error: headErr };
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role,
        unitId: finalUnitId,
        isUnitHead: role === "auditee_head",
      },
    });

    // Tempatkan akun auditee pada unit yang dipilih (keanggotaan per unit).
    if (!NO_UNIT_ROLES.includes(role) && finalUnitId) {
      await prisma.unitMembership.create({
        data: {
          userId: user.id,
          unitId: finalUnitId,
          role: role === "auditee_head" ? "head" : "member",
        },
      });
    }
    revalidatePath("/unit");
    revalidatePath("/role-penempatan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan akun.") };
  }
}

export async function updateAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") || "").trim();
    const password = String(formData.get("password") || "");
    const role = String(formData.get("role") || "auditee_member") as Role;
    const unitIdRaw = formData.get("unitId");
    const unitId = unitIdRaw ? Number(unitIdRaw) : null;
    const isActive = formData.get("isActive") !== "off";

    if (!id || !name) return { error: "Data akun tidak lengkap." };
    if (!NO_UNIT_ROLES.includes(role) && !unitId) {
      return { error: "Akun auditee wajib ditautkan ke sebuah unit." };
    }

    const finalUnitId = NO_UNIT_ROLES.includes(role) ? null : unitId;
    if (role === "auditee_head") {
      const headErr = await assertHeadAvailable(finalUnitId, id);
      if (headErr) return { error: headErr };
    }

    const data: Record<string, unknown> = {
      name,
      role,
      unitId: finalUnitId,
      isUnitHead: role === "auditee_head",
      isActive,
    };
    if (password) {
      if (password.length < 8) return { error: "Kata sandi minimal 8 karakter." };
      data.password = await hashPassword(password);
    }

    await prisma.user.update({ where: { id }, data });

    // Sinkronkan keanggotaan unit utama dengan peran yang dipilih.
    if (NO_UNIT_ROLES.includes(role)) {
      await prisma.unitMembership.deleteMany({ where: { userId: id } });
    } else if (finalUnitId) {
      const memRole = role === "auditee_head" ? "head" : "member";
      await prisma.unitMembership.upsert({
        where: { userId_unitId: { userId: id, unitId: finalUnitId } },
        create: { userId: id, unitId: finalUnitId, role: memRole },
        update: { role: memRole },
      });
    }

    revalidatePath("/unit");
    revalidatePath("/role-penempatan");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui akun.") };
  }
}

/**
 * Tempatkan akun yang sudah terdaftar ke sebuah unit (rangkap jabatan didukung:
 * satu akun boleh berada di banyak unit). role: "head" | "member".
 */
export async function assignMember(
  unitId: number,
  userId: number,
  role: "head" | "member"
): Promise<ActionState> {
  try {
    await requireLpm();
    if (!unitId || !userId) return { error: "Data penempatan tidak lengkap." };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) return { error: "Akun tidak ditemukan." };
    if (
      user.role === "superadmin" ||
      user.role === "lpm_admin" ||
      user.role === "lpm_member"
    ) {
      return { error: "Akun LPM tidak dapat ditempatkan pada unit audit." };
    }

    if (role === "head") {
      const headErr = await assertHeadAvailable(unitId, userId);
      if (headErr) return { error: headErr };
    }

    await prisma.unitMembership.upsert({
      where: { userId_unitId: { userId, unitId } },
      create: { userId, unitId, role },
      update: { role },
    });
    await syncUserAccess(userId);

    revalidatePath("/unit");
    revalidatePath("/role-penempatan");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menempatkan akun.") };
  }
}

/** Hapus penempatan akun dari sebuah unit. Bila keanggotaan habis → jadi Pengunjung. */
export async function removeMember(
  unitId: number,
  userId: number
): Promise<ActionState> {
  try {
    await requireLpm();
    await prisma.unitMembership.deleteMany({ where: { userId, unitId } });
    await syncUserAccess(userId);
    revalidatePath("/unit");
    revalidatePath("/role-penempatan");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: toActionError(e, "Gagal menghapus penempatan."),
    };
  }
}

export async function deleteAccount(id: number) {
  const me = await requireLpm();
  if (me.id === id) throw new AppError("Tidak dapat menghapus akun sendiri.");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/unit");
  revalidatePath("/role-penempatan");
}

/* --------------------------- KETUA LPM -------------------------------- */

/**
 * Tunjuk seorang Admin LPM sebagai Ketua LPM — satu-satunya akun yang
 * menandatangani dokumen laporan. Hanya satu Ketua LPM aktif dalam satu waktu;
 * akun lain otomatis dicabut. Hanya Admin LPM yang boleh melakukan ini.
 */
export async function setLpmHead(userId: number): Promise<ActionState> {
  try {
    await requireLpm();
    if (!userId) return { error: "Akun tidak valid." };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true, name: true },
    });
    if (!target) return { error: "Akun tidak ditemukan." };
    if (target.role !== "lpm_admin" && target.role !== "superadmin") {
      return { error: "Hanya akun dengan peran Admin LPM yang dapat menjadi Ketua LPM." };
    }
    if (!target.isActive) {
      return { error: "Akun nonaktif tidak dapat ditunjuk sebagai Ketua LPM." };
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { isLpmHead: true, id: { not: userId } },
        data: { isLpmHead: false },
      }),
      prisma.user.update({ where: { id: userId }, data: { isLpmHead: true } }),
    ]);

    revalidatePath("/role-penempatan");
    revalidatePath("/laporan");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menunjuk Ketua LPM.") };
  }
}

/** Cabut status Ketua LPM dari sebuah akun. */
export async function unsetLpmHead(userId: number): Promise<ActionState> {
  try {
    await requireLpm();
    if (!userId) return { error: "Akun tidak valid." };
    await prisma.user.update({ where: { id: userId }, data: { isLpmHead: false } });
    revalidatePath("/role-penempatan");
    revalidatePath("/laporan");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal mencabut status Ketua LPM.") };
  }
}
