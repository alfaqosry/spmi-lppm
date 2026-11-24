"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLpmAdmin } from "@/lib/guards";
import { AppError, runAction } from "@/lib/errors";
import { idField, oneOf, requireId } from "@/lib/validate";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { revokeUserSessions } from "@/lib/auth";

export type ActionState = { ok?: boolean; error?: string } | undefined;

function revalidateAuditors() {
  revalidatePath("/auditor");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
}

/**
 * Mengangkat akun terdaftar menjadi Auditor dan menetapkan unit asal (homebase) jika ada.
 */
export async function appointAuditor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const userId = requireId(formData.get("userId"), "Pengguna");
    const homebaseUnitId = idField(formData, "homebaseUnitId");

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        unitId: true,
        isActive: true,
      },
    });

    if (!target) throw new AppError("Akun tidak ditemukan.");
    if (target.role === "superadmin") {
      throw new AppError("Akun Superadmin tidak dapat diubah menjadi Auditor.");
    }

    if (homebaseUnitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: homebaseUnitId },
      });
      if (!unit) throw new AppError("Unit asal tidak ditemukan.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          role: "auditor",
          unitId: homebaseUnitId ?? target.unitId,
          isUnitHead: false,
        },
      });

      // Jika ada unit asal baru, sinkronkan keanggotaan unit
      if (homebaseUnitId) {
        await tx.unitMembership.upsert({
          where: { userId_unitId: { userId, unitId: homebaseUnitId } },
          create: { userId, unitId: homebaseUnitId, role: "member" },
          update: { role: "member" },
        });
      }
    });

    await revokeUserSessions(userId);

    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "auditor.appoint",
      entity: "user",
      entityId: userId,
      detail: `Mengangkat ${target.name} sebagai Auditor`,
      ip: await getClientIp(),
    });

    revalidateAuditors();
    return { ok: true };
  });
}

/**
 * Mencabut status peran auditor dari suatu akun (dikembalikan ke 'pengunjung' atau peran lain).
 */
export async function revokeAuditor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const userId = requireId(formData.get("userId"), "Pengguna");

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });

    if (!target) throw new AppError("Akun tidak ditemukan.");
    if (target.role !== "auditor") {
      throw new AppError("Akun ini bukan akun Auditor.");
    }

    await prisma.$transaction(async (tx) => {
      // Hapus penugasan audit yang masih aktif
      await tx.unitAuditor.deleteMany({
        where: { userId },
      });

      // Kembalikan peran ke pengunjung
      await tx.user.update({
        where: { id: userId },
        data: {
          role: "pengunjung",
          isUnitHead: false,
        },
      });
    });

    await revokeUserSessions(userId);

    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "auditor.revoke",
      entity: "user",
      entityId: userId,
      detail: `Mencabut peran auditor dari ${target.name}`,
      ip: await getClientIp(),
    });

    revalidateAuditors();
    return { ok: true };
  });
}

/**
 * Menugaskan auditor ke unit kerja tertentu pada suatu siklus audit.
 *
 * Aturan bisnis:
 * 1. Setiap unit memiliki tepat 2 orang auditor:
 *    - role "lead" (Auditor 1 / Ketua Tim)
 *    - role "member" (Auditor 2 / Anggota Tim)
 * 2. Auditor 1 dan Auditor 2 tidak boleh orang yang sama pada unit yang sama.
 * 3. ATURAN INDEPENDENSI: Auditor TIDAK boleh berasal dari unit yang diaudit (mencegah konflik kepentingan).
 */
export async function assignUnitAuditor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const cycleId = requireId(formData.get("cycleId"), "Siklus Audit");
    const unitId = requireId(formData.get("unitId"), "Unit Audit");
    const userId = requireId(formData.get("userId"), "Auditor");
    const role = oneOf(
      formData.get("role")?.toString(),
      ["lead", "member"],
      "Peran Auditor tidak valid (wajib lead atau member)."
    );

    const [cycle, unit, user] = await Promise.all([
      prisma.auditCycle.findUnique({
        where: { id: cycleId },
        select: { id: true, name: true },
      }),
      prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          unitId: true,
          unit: { select: { id: true, name: true } },
          memberships: {
            select: { unitId: true, unit: { select: { name: true } } },
          },
        },
      }),
    ]);

    if (!cycle) throw new AppError("Siklus audit tidak ditemukan.");
    if (!unit) throw new AppError("Unit audit tidak ditemukan.");
    if (!user) throw new AppError("Akun auditor tidak ditemukan.");
    if (!user.isActive) throw new AppError("Akun auditor berstatus nonaktif.");
    if (user.role !== "auditor") {
      throw new AppError(
        "Hanya akun dengan peran Auditor yang dapat ditugaskan."
      );
    }

    // 1. VALIDASI KONFLIK KEPENTINGAN (INDEPENDENSI AUDITOR)
    // Auditor tidak boleh berasal dari pihak / unit yang diaudit
    const isFromSameUnit =
      user.unitId === unitId ||
      user.memberships.some((m) => m.unitId === unitId);

    if (isFromSameUnit) {
      throw new AppError(
        `Konflik Kepentingan: ${user.name} tidak boleh ditugaskan mengaudit unit "${unit.name}" karena terdaftar sebagai personil/anggota di unit tersebut.`
      );
    }

    // 2. VALIDASI DUPLIKASI SLOT (Auditor 1 & 2 tidak boleh orang yang sama)
    const otherRole = role === "lead" ? "member" : "lead";
    const existingOther = await prisma.unitAuditor.findUnique({
      where: {
        cycleId_unitId_role: { cycleId, unitId, role: otherRole },
      },
      include: { user: { select: { name: true } } },
    });

    if (existingOther && existingOther.userId === userId) {
      const otherLabel =
        otherRole === "lead"
          ? "Auditor 1 (Ketua Tim)"
          : "Auditor 2 (Anggota Tim)";
      throw new AppError(
        `${user.name} sudah ditugaskan sebagai ${otherLabel} pada unit ini. Setiap unit harus diaudit oleh 2 orang auditor yang berbeda.`
      );
    }

    // 3. UPSERT PENUGASAN (Maksimal 2 slot per unit: lead & member)
    const assignment = await prisma.unitAuditor.upsert({
      where: {
        cycleId_unitId_role: { cycleId, unitId, role },
      },
      create: {
        cycleId,
        unitId,
        userId,
        role,
        assignedBy: admin.id,
      },
      update: {
        userId,
        assignedBy: admin.id,
        assignedAt: new Date(),
      },
    });

    const roleName =
      role === "lead" ? "Auditor 1 (Ketua Tim)" : "Auditor 2 (Anggota Tim)";

    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "auditor.assign",
      entity: "unit_auditor",
      entityId: assignment.id,
      detail: `Menugaskan ${user.name} sebagai ${roleName} untuk unit "${unit.name}" pada siklus "${cycle.name}"`,
      ip: await getClientIp(),
    });

    revalidateAuditors();
    return { ok: true };
  });
}

/**
 * Menghapus penugasan auditor pada suatu slot unit.
 */
export async function removeUnitAuditor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const assignmentId = idField(formData, "assignmentId");
    const cycleId = idField(formData, "cycleId");
    const unitId = idField(formData, "unitId");
    const role = formData.get("role")?.toString();

    let target;
    if (assignmentId) {
      target = await prisma.unitAuditor.findUnique({
        where: { id: assignmentId },
        include: {
          user: { select: { name: true } },
          unit: { select: { name: true } },
          cycle: { select: { name: true } },
        },
      });
    } else if (cycleId && unitId && (role === "lead" || role === "member")) {
      target = await prisma.unitAuditor.findUnique({
        where: {
          cycleId_unitId_role: { cycleId, unitId, role },
        },
        include: {
          user: { select: { name: true } },
          unit: { select: { name: true } },
          cycle: { select: { name: true } },
        },
      });
    }

    if (!target) throw new AppError("Penugasan auditor tidak ditemukan.");

    await prisma.unitAuditor.delete({
      where: { id: target.id },
    });

    const roleName =
      target.role === "lead"
        ? "Auditor 1 (Ketua Tim)"
        : "Auditor 2 (Anggota Tim)";

    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "auditor.remove_assignment",
      entity: "unit_auditor",
      entityId: target.id,
      detail: `Membatalkan penugasan ${target.user.name} sebagai ${roleName} pada unit "${target.unit.name}"`,
      ip: await getClientIp(),
    });

    revalidateAuditors();
    return { ok: true };
  });
}

/**
 * Mengambil data komprehensif untuk halaman Manajemen Auditor.
 */
export async function getAuditorManagementData(requestedCycleId?: number) {
  const [cycles, units, auditorUsers, candidateUsers] = await Promise.all([
    prisma.auditCycle.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.unit.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "auditor" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        unitId: true,
        unit: { select: { id: true, name: true } },
        memberships: {
          select: { unitId: true, unit: { select: { name: true } } },
        },
        auditorAssignments: {
          select: {
            id: true,
            cycleId: true,
            unitId: true,
            role: true,
            unit: { select: { id: true, name: true } },
            cycle: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: { notIn: ["superadmin", "auditor"] },
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unitId: true,
        unit: { select: { id: true, name: true } },
      },
    }),
  ]);

  const activeCycle =
    (requestedCycleId ? cycles.find((c) => c.id === requestedCycleId) : null) ??
    cycles.find((c) => c.isActive) ??
    cycles[0] ??
    null;

  const currentCycleId = activeCycle?.id ?? null;

  // Ambil penugasan pada siklus terpilih
  const assignments = currentCycleId
    ? await prisma.unitAuditor.findMany({
        where: { cycleId: currentCycleId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              unitId: true,
              unit: { select: { id: true, name: true } },
            },
          },
          assigner: {
            select: { id: true, name: true },
          },
        },
      })
    : [];

  // Peta penugasan per unit: { [unitId]: { lead?: assignment, member?: assignment } }
  const assignmentMap: Record<
    number,
    {
      lead?: (typeof assignments)[0];
      member?: (typeof assignments)[0];
    }
  > = {};

  for (const asg of assignments) {
    if (!assignmentMap[asg.unitId]) {
      assignmentMap[asg.unitId] = {};
    }
    if (asg.role === "lead") {
      assignmentMap[asg.unitId].lead = asg;
    } else if (asg.role === "member") {
      assignmentMap[asg.unitId].member = asg;
    }
  }

  // Siapkan daftar auditor dengan metadata konflik & jumlah tugas di siklus ini
  const auditorList = auditorUsers.map((u) => {
    // Kumpulkan seluruh unit asal pengguna (unit utama + keanggotaan)
    const originUnitIds = new Set<number>();
    if (u.unitId) originUnitIds.add(u.unitId);
    for (const m of u.memberships) {
      originUnitIds.add(m.unitId);
    }

    const currentCycleTasks = u.auditorAssignments.filter(
      (a) => a.cycleId === currentCycleId
    );

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      homebaseUnitId: u.unitId,
      homebaseUnitName: u.unit?.name ?? null,
      originUnitIds: Array.from(originUnitIds),
      activeTasksCount: currentCycleTasks.length,
      currentCycleTasks: currentCycleTasks.map((t) => ({
        unitId: t.unitId,
        unitName: t.unit.name,
        role: t.role as "lead" | "member",
      })),
    };
  });

  return {
    cycles,
    currentCycle: activeCycle,
    units,
    assignmentMap,
    auditors: auditorList,
    candidates: candidateUsers,
  };
}
