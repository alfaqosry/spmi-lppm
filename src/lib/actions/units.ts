"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  isSuperadmin,
  revokeUserSessions,
  type SessionUser,
} from "@/lib/auth";
import { requireLpmAdmin } from "@/lib/guards";
import { AppError, runAction, toActionError } from "@/lib/errors";
import { checkboxField } from "@/lib/checkbox";
import {
  LIMITS,
  emailField,
  idField,
  oneOf,
  requireId,
  str,
} from "@/lib/validate";
import { validatePassword } from "@/lib/password";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { maskEmail } from "@/lib/redact";
import { cleanupUnreferencedUploads } from "@/lib/upload";
import type { Role } from "@prisma/client";

export type ActionState = { ok?: boolean; error?: string } | undefined;

const ALL_ROLES = [
  "superadmin",
  "lpm_admin",
  "lpm_member",
  "auditee_head",
  "auditee_member",
  "pengunjung",
] as const satisfies readonly Role[];

/** Role yang tidak terikat pada unit apa pun (unitId selalu null). */
const NO_UNIT_ROLES: Role[] = [
  "superadmin",
  "lpm_admin",
  "lpm_member",
  "pengunjung",
];

async function audit(
  actor: { id: number; name: string },
  action: string,
  entity: string,
  entityId: number | string,
  detail?: string
) {
  await recordActivity({
    userId: actor.id,
    userName: actor.name,
    action,
    entity,
    entityId,
    detail: detail ?? null,
    ip: await getClientIp(),
  });
}

/**
 * Aturan hak istimewa (anti eskalasi):
 *  - hanya Superadmin yang boleh memberi peran `superadmin`;
 *  - hanya Superadmin yang boleh mengubah/menghapus akun Superadmin.
 */
function assertCanAssignRole(actor: SessionUser, role: Role) {
  if (role === "superadmin" && !isSuperadmin(actor.role)) {
    throw new AppError(
      "Hanya Superadmin yang dapat memberikan peran Superadmin."
    );
  }
}

async function loadTargetForChange(actor: SessionUser, userId: number) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, email: true },
  });
  if (!target) throw new AppError("Akun tidak ditemukan.");
  if (target.role === "superadmin" && !isSuperadmin(actor.role)) {
    throw new AppError("Akun Superadmin hanya dapat dikelola oleh Superadmin.");
  }
  return target;
}

/* ------------------------------- UNIT ---------------------------------- */

function readUnitForm(formData: FormData) {
  return {
    name: str(formData, "name", {
      max: LIMITS.unitName,
      required: true,
      label: "Nama unit",
    }),
    category: str(formData, "category", {
      max: LIMITS.category,
      required: true,
      label: "Kategori unit",
    }),
    description:
      str(formData, "description", {
        max: LIMITS.description,
        multiline: true,
        label: "Deskripsi",
      }) || null,
  };
}

export async function createUnit(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const actor = await requireLpmAdmin();
    const data = readUnitForm(formData);
    const unit = await prisma.unit.create({ data });
    await audit(actor, "unit.create", "unit", unit.id);
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
    const actor = await requireLpmAdmin();
    const id = requireId(formData.get("id"), "Unit");
    const data = readUnitForm(formData);
    const current = await prisma.unit.findUnique({
      where: { id },
      select: { category: true },
    });
    if (!current) throw new AppError("Unit tidak ditemukan.");
    if (current.category !== data.category) {
      // Aturan cakupan (AB-28): butir khusus unit ini yang berada di bawah standar
      // berkategori lama akan melanggar "butir ⊆ standar" bila kategori unit berubah.
      const conflicts = await prisma.auditQuestion.count({
        where: {
          scopeType: "unit",
          scopeUnitId: id,
          standard: { scopeType: "category", scopeCategory: current.category },
        },
      });
      if (conflicts > 0) {
        throw new AppError(
          `Kategori unit tidak dapat diubah: ${conflicts} butir khusus unit ini berada di bawah standar kategori "${current.category}". Pindahkan butir tersebut ke standar umum/khusus unit terlebih dahulu.`
        );
      }
    }
    await prisma.unit.update({ where: { id }, data });
    await audit(actor, "unit.update", "unit", id);
    revalidatePath("/unit");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui unit.") };
  }
}

export async function deleteUnit(id: number): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireLpmAdmin();
    const unitId = requireId(id, "Unit");
    // Standar/butir khusus unit ini akan menjadi yatim (FK SET NULL) bila unit
    // dihapus → tolak agar instrumen tidak hilang/tersembunyi diam-diam.
    const [scopedStandards, scopedQuestions] = await Promise.all([
      prisma.auditStandard.count({ where: { scopeUnitId: unitId } }),
      prisma.auditQuestion.count({ where: { scopeUnitId: unitId } }),
    ]);
    if (scopedStandards + scopedQuestions > 0) {
      throw new AppError(
        `Unit tidak dapat dihapus: masih ada ${scopedStandards} standar dan ${scopedQuestions} butir khusus unit ini. Hapus atau pindahkan instrumen tersebut terlebih dahulu.`
      );
    }
    // Anggota unit kehilangan akses ke unit ini → cabut sesinya.
    const members = await prisma.unitMembership.findMany({
      where: { unitId },
      select: { userId: true },
    });
    const evidence = await prisma.auditResponse.findMany({
      where: { unitId, evidenceFile: { not: null } },
      select: { evidenceFile: true },
    });
    await prisma.unit.delete({ where: { id: unitId } });
    for (const m of members) await syncUserAccess(m.userId);
    await cleanupUnreferencedUploads(evidence.map((r) => r.evidenceFile));
    await audit(actor, "unit.delete", "unit", unitId);
    revalidatePath("/unit");
    revalidatePath("/dashboard");
  }, "Gagal menghapus unit.");
}

/* ------------------------------- AKUN ---------------------------------- */

/** Cek apakah sudah ada Kepala Unit lain pada unit yang sama. */
async function assertHeadAvailable(
  unitId: number | null,
  excludeUserId?: number
) {
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

async function assertUnitExists(unitId: number) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true },
  });
  if (!unit) throw new AppError("Unit tidak ditemukan.");
}

/**
 * Sinkronkan peran global, unit utama, dan status kepala unit pengguna
 * berdasarkan seluruh keanggotaannya. Akun LPM (admin/anggota) tidak diubah.
 * Bila keanggotaan habis, akun otomatis dikembalikan menjadi Pengunjung.
 * Bila peran berubah, seluruh sesi pengguna dicabut.
 */
async function syncUserAccess(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return;
  if (
    user.role === "superadmin" ||
    user.role === "lpm_admin" ||
    user.role === "lpm_member"
  )
    return;

  const memberships = await prisma.unitMembership.findMany({
    where: { userId },
    orderBy: { id: "asc" },
  });

  let nextRole: Role;
  if (memberships.length === 0) {
    nextRole = "pengunjung";
    await prisma.user.update({
      where: { id: userId },
      data: { role: nextRole, unitId: null, isUnitHead: false },
    });
  } else {
    const head = memberships.find((m) => m.role === "head");
    const primary = head ?? memberships[0];
    nextRole = head ? "auditee_head" : "auditee_member";
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        unitId: primary.unitId,
        isUnitHead: Boolean(head),
      },
    });
  }
  if (nextRole !== user.role) await revokeUserSessions(userId);
}

export async function createAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const actor = await requireLpmAdmin();
    const name = str(formData, "name", {
      max: LIMITS.name,
      required: true,
      label: "Nama",
    });
    const email = emailField(formData, "email");
    const password = String(formData.get("password") ?? "");
    const role = oneOf(
      formData.get("role") || "auditee_member",
      ALL_ROLES,
      "Peran tidak valid."
    );
    const unitId = idField(formData, "unitId");

    assertCanAssignRole(actor, role);
    const pwErr = validatePassword(password, { email });
    if (pwErr) return { error: pwErr };
    if (!NO_UNIT_ROLES.includes(role) && !unitId) {
      return { error: "Akun auditee wajib ditautkan ke sebuah unit." };
    }

    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) return { error: "Email sudah terdaftar." };

    const finalUnitId = NO_UNIT_ROLES.includes(role) ? null : unitId;
    if (finalUnitId) await assertUnitExists(finalUnitId);
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
    await audit(
      actor,
      "account.create",
      "user",
      user.id,
      `Membuat akun ${maskEmail(email)} (${role})`
    );
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
    const actor = await requireLpmAdmin();
    const id = requireId(formData.get("id"), "Akun");
    const name = str(formData, "name", {
      max: LIMITS.name,
      required: true,
      label: "Nama",
    });
    const password = String(formData.get("password") ?? "");
    const role = oneOf(
      formData.get("role") || "auditee_member",
      ALL_ROLES,
      "Peran tidak valid."
    );
    const unitId = idField(formData, "unitId");
    // Checkbox tak dicentang tidak dikirim browser → harus dibaca sebagai false.
    const isActive = checkboxField(formData, "isActive");

    const target = await loadTargetForChange(actor, id);
    assertCanAssignRole(actor, role);
    if (actor.id === id && (role !== target.role || !isActive)) {
      return {
        error: "Tidak dapat mengubah peran atau menonaktifkan akun sendiri.",
      };
    }
    if (!NO_UNIT_ROLES.includes(role) && !unitId) {
      return { error: "Akun auditee wajib ditautkan ke sebuah unit." };
    }

    const finalUnitId = NO_UNIT_ROLES.includes(role) ? null : unitId;
    if (finalUnitId) await assertUnitExists(finalUnitId);
    if (role === "auditee_head") {
      const headErr = await assertHeadAvailable(finalUnitId, id);
      if (headErr) return { error: headErr };
    }

    // Whitelist field eksplisit (tanpa mass-assignment).
    const data: {
      name: string;
      role: Role;
      unitId: number | null;
      isUnitHead: boolean;
      isActive: boolean;
      password?: string;
    } = {
      name,
      role,
      unitId: finalUnitId,
      isUnitHead: role === "auditee_head",
      isActive,
    };
    if (password) {
      const pwErr = validatePassword(password, { email: target.email });
      if (pwErr) return { error: pwErr };
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

    // Cabut sesi bila peran/status/kata sandi berubah.
    const changed: string[] = [];
    if (role !== target.role) changed.push(`peran ${target.role}→${role}`);
    if (isActive !== target.isActive)
      changed.push(isActive ? "diaktifkan" : "dinonaktifkan");
    if (data.password) changed.push("kata sandi direset");
    if (changed.length && actor.id !== id) await revokeUserSessions(id);

    await audit(
      actor,
      "account.update",
      "user",
      id,
      changed.length ? `Perubahan: ${changed.join(", ")}` : undefined
    );
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
    const actor = await requireLpmAdmin();
    const uId = requireId(unitId, "Unit");
    const tId = requireId(userId, "Akun");
    const memRole = oneOf(
      role,
      ["head", "member"] as const,
      "Peran penempatan tidak valid."
    );

    const user = await prisma.user.findUnique({
      where: { id: tId },
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
    await assertUnitExists(uId);

    if (memRole === "head") {
      const headErr = await assertHeadAvailable(uId, tId);
      if (headErr) return { error: headErr };
    }

    await prisma.unitMembership.upsert({
      where: { userId_unitId: { userId: tId, unitId: uId } },
      create: { userId: tId, unitId: uId, role: memRole },
      update: { role: memRole },
    });
    await syncUserAccess(tId);
    await audit(
      actor,
      "membership.assign",
      "user",
      tId,
      `Unit ${uId} sebagai ${memRole}`
    );

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
    const actor = await requireLpmAdmin();
    const uId = requireId(unitId, "Unit");
    const tId = requireId(userId, "Akun");
    await prisma.unitMembership.deleteMany({
      where: { userId: tId, unitId: uId },
    });
    await syncUserAccess(tId);
    await audit(actor, "membership.remove", "user", tId, `Unit ${uId}`);
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

export async function deleteAccount(id: number): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireLpmAdmin();
    const targetId = requireId(id, "Akun");
    if (actor.id === targetId)
      throw new AppError("Tidak dapat menghapus akun sendiri.");
    const target = await loadTargetForChange(actor, targetId);
    if (target.role === "superadmin") {
      const remaining = await prisma.user.count({
        where: { role: "superadmin", isActive: true, id: { not: targetId } },
      });
      if (remaining === 0)
        throw new AppError("Tidak dapat menghapus Superadmin terakhir.");
    }
    // Baris user dihapus → getCurrentUser() menolak token apa pun milik akun ini.
    await prisma.user.delete({ where: { id: targetId } });
    await audit(
      actor,
      "account.delete",
      "user",
      targetId,
      `Menghapus akun ${maskEmail(target.email)}`
    );
    revalidatePath("/unit");
    revalidatePath("/role-penempatan");
  }, "Gagal menghapus akun.");
}

/* --------------------------- KETUA LPM -------------------------------- */

/**
 * Tunjuk seorang Admin LPM sebagai Ketua LPM — satu-satunya akun yang
 * menandatangani dokumen laporan. Hanya satu Ketua LPM aktif dalam satu waktu;
 * akun lain otomatis dicabut. Hanya Admin LPM yang boleh melakukan ini.
 */
export async function setLpmHead(userId: number): Promise<ActionState> {
  try {
    const actor = await requireLpmAdmin();
    const tId = requireId(userId, "Akun");

    const target = await prisma.user.findUnique({
      where: { id: tId },
      select: { id: true, role: true, isActive: true, name: true },
    });
    if (!target) return { error: "Akun tidak ditemukan." };
    if (target.role !== "lpm_admin" && target.role !== "superadmin") {
      return {
        error:
          "Hanya akun dengan peran Admin LPM yang dapat menjadi Ketua LPM.",
      };
    }
    if (!target.isActive) {
      return { error: "Akun nonaktif tidak dapat ditunjuk sebagai Ketua LPM." };
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { isLpmHead: true, id: { not: tId } },
        data: { isLpmHead: false },
      }),
      prisma.user.update({ where: { id: tId }, data: { isLpmHead: true } }),
    ]);
    await audit(actor, "lpm_head.set", "user", tId);

    revalidatePath("/role-penempatan");
    revalidatePath("/analitik");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menunjuk Ketua LPM.") };
  }
}

/** Cabut status Ketua LPM dari sebuah akun. */
export async function unsetLpmHead(userId: number): Promise<ActionState> {
  try {
    const actor = await requireLpmAdmin();
    const tId = requireId(userId, "Akun");
    await prisma.user.update({
      where: { id: tId },
      data: { isLpmHead: false },
    });
    await audit(actor, "lpm_head.unset", "user", tId);
    revalidatePath("/role-penempatan");
    revalidatePath("/analitik");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal mencabut status Ketua LPM.") };
  }
}
