"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppError, toActionError } from "@/lib/errors";

async function requireLpm() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "lpm_admin" && user.role !== "superadmin")) {
    throw new AppError("Akses ditolak. Hanya Admin LPM.");
  }
  return user;
}

export type ActionState = { ok?: boolean; error?: string } | undefined;

export async function createCycle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const name = String(formData.get("name") || "").trim();
    const startDate = String(formData.get("startDate") || "");
    const endDate = String(formData.get("endDate") || "");
    const isActive = formData.get("isActive") === "on";

    if (!name || !startDate || !endDate) {
      return { error: "Nama, tanggal mulai, dan tanggal selesai wajib diisi." };
    }
    if (new Date(endDate) < new Date(startDate)) {
      return { error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
    }

    await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.auditCycle.updateMany({ data: { isActive: false } });
      }
      await tx.auditCycle.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive,
        },
      });
    });

    revalidatePath("/siklus");
    revalidatePath("/dashboard");
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
    await requireLpm();
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") || "").trim();
    const startDate = String(formData.get("startDate") || "");
    const endDate = String(formData.get("endDate") || "");
    const isActive = formData.get("isActive") === "on";

    if (!id || !name || !startDate || !endDate) {
      return { error: "Data siklus tidak lengkap." };
    }

    await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.auditCycle.updateMany({
          where: { id: { not: id } },
          data: { isActive: false },
        });
      }
      await tx.auditCycle.update({
        where: { id },
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive,
        },
      });
    });

    revalidatePath("/siklus");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui siklus.") };
  }
}

export async function setActiveCycle(id: number) {
  await requireLpm();
  await prisma.$transaction([
    prisma.auditCycle.updateMany({ data: { isActive: false } }),
    prisma.auditCycle.update({ where: { id }, data: { isActive: true } }),
  ]);
  revalidatePath("/siklus");
  revalidatePath("/dashboard");
  revalidatePath("/audit");
  revalidatePath("/analitik");
}

/**
 * Nonaktifkan siklus secara manual oleh admin.
 * Setelah dinonaktifkan, auditee tidak dapat lagi mengisi jawaban audit.
 */
export async function deactivateCycle(id: number) {
  await requireLpm();
  await prisma.auditCycle.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/siklus");
  revalidatePath("/dashboard");
  revalidatePath("/audit");
  revalidatePath("/analitik");
}

export async function deleteCycle(id: number) {
  await requireLpm();
  await prisma.auditCycle.delete({ where: { id } });
  revalidatePath("/siklus");
  revalidatePath("/dashboard");
}
