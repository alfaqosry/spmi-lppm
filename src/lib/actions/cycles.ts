"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLpmAdmin } from "@/lib/guards";
import { AppError, runAction, toActionError } from "@/lib/errors";
import { checkboxField } from "@/lib/checkbox";
import { LIMITS, dateField, requireId, str } from "@/lib/validate";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { cleanupUnreferencedUploads } from "@/lib/upload";

export type ActionState = { ok?: boolean; error?: string } | undefined;

function revalidateCycles() {
  revalidatePath("/siklus");
  revalidatePath("/dashboard");
  revalidatePath("/audit");
  revalidatePath("/analitik");
}

/** Baca & validasi field siklus dari form (whitelist eksplisit). */
function readCycleForm(formData: FormData) {
  const name = str(formData, "name", {
    max: LIMITS.cycleName,
    required: true,
    label: "Nama siklus",
  });
  const startDate = dateField(formData, "startDate", "Tanggal mulai");
  const endDate = dateField(formData, "endDate", "Tanggal selesai");
  if (endDate < startDate) {
    throw new AppError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }
  const isActive = checkboxField(formData, "isActive");
  return { name, startDate, endDate, isActive };
}

export async function createCycle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireLpmAdmin();
    const data = readCycleForm(formData);

    const created = await prisma.$transaction(async (tx) => {
      if (data.isActive) {
        await tx.auditCycle.updateMany({ data: { isActive: false } });
      }
      return tx.auditCycle.create({ data });
    });

    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "cycle.create",
      entity: "cycle",
      entityId: created.id,
      ip: await getClientIp(),
    });
    revalidateCycles();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan siklus.") };
  }
}

export async function updateCycle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireLpmAdmin();
    const id = requireId(formData.get("id"), "Siklus");
    const data = readCycleForm(formData);

    await prisma.$transaction(async (tx) => {
      if (data.isActive) {
        await tx.auditCycle.updateMany({
          where: { id: { not: id } },
          data: { isActive: false },
        });
      }
      await tx.auditCycle.update({ where: { id }, data });
    });

    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "cycle.update",
      entity: "cycle",
      entityId: id,
      ip: await getClientIp(),
    });
    revalidateCycles();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui siklus.") };
  }
}

export async function setActiveCycle(id: number): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const cycleId = requireId(id, "Siklus");
    await prisma.$transaction([
      prisma.auditCycle.updateMany({ data: { isActive: false } }),
      prisma.auditCycle.update({
        where: { id: cycleId },
        data: { isActive: true },
      }),
    ]);
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "cycle.activate",
      entity: "cycle",
      entityId: cycleId,
      ip: await getClientIp(),
    });
    revalidateCycles();
  }, "Gagal mengaktifkan siklus.");
}

/**
 * Nonaktifkan siklus secara manual oleh admin.
 * Setelah dinonaktifkan, auditee tidak dapat lagi mengisi jawaban audit.
 */
export async function deactivateCycle(id: number): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const cycleId = requireId(id, "Siklus");
    await prisma.auditCycle.update({
      where: { id: cycleId },
      data: { isActive: false },
    });
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "cycle.deactivate",
      entity: "cycle",
      entityId: cycleId,
      ip: await getClientIp(),
    });
    revalidateCycles();
  }, "Gagal menonaktifkan siklus.");
}

export async function deleteCycle(id: number): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireLpmAdmin();
    const cycleId = requireId(id, "Siklus");
    // Siklus aktif sedang dipakai auditee: wajib dinonaktifkan dulu (HE-04, ISO 9241-110 toleransi kesalahan).
    const target = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      select: { isActive: true },
    });
    if (target?.isActive) {
      throw new AppError(
        "Siklus aktif tidak dapat dihapus. Nonaktifkan siklus terlebih dahulu."
      );
    }
    // Kumpulkan berkas yang ikut terhapus (cascade) sebelum baris dihapus.
    const [resp, docs] = await Promise.all([
      prisma.auditResponse.findMany({
        where: { cycleId, evidenceFile: { not: null } },
        select: { evidenceFile: true },
      }),
      prisma.document.findMany({
        where: { cycleId, filePath: { not: null } },
        select: { filePath: true },
      }),
    ]);
    await prisma.auditCycle.delete({ where: { id: cycleId } });
    await cleanupUnreferencedUploads([
      ...resp.map((r) => r.evidenceFile),
      ...docs.map((d) => d.filePath),
    ]);
    await recordActivity({
      userId: admin.id,
      userName: admin.name,
      action: "cycle.delete",
      entity: "cycle",
      entityId: cycleId,
      ip: await getClientIp(),
    });
    revalidateCycles();
  }, "Gagal menghapus siklus.");
}
