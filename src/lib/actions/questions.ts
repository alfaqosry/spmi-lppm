"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AppError, toActionError } from "@/lib/errors";

async function requireLpm() {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== "lpm_admin" &&
      user.role !== "lpm_member" &&
      user.role !== "superadmin")
  ) {
    throw new AppError("Akses ditolak. Hanya pengguna LPM.");
  }
  return user;
}

export type ActionState = { ok?: boolean; error?: string } | undefined;

function revalidateAll() {
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  revalidatePath("/analitik");
  revalidatePath("/siklus");
}

/* =====================================================================
   STANDAR (induk/pengelompok butir pertanyaan)
   ===================================================================== */

export async function createStandard(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const cycleId = Number(formData.get("cycleId"));
    const name = String(formData.get("name") || "").trim();
    if (!cycleId || !name) {
      return { error: "Siklus dan nama standar wajib diisi." };
    }

    const existing = await prisma.auditStandard.findFirst({
      where: { cycleId, name },
    });
    if (existing) {
      return { error: "Standar dengan nama tersebut sudah ada pada siklus ini." };
    }

    const last = await prisma.auditStandard.findFirst({
      where: { cycleId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    await prisma.auditStandard.create({
      data: { cycleId, name, order: (last?.order ?? 0) + 1 },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan standar.") };
  }
}

export async function updateStandard(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const id = Number(formData.get("id"));
    const name = String(formData.get("name") || "").trim();
    if (!id || !name) return { error: "Data standar tidak lengkap." };

    await prisma.auditStandard.update({ where: { id }, data: { name } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui standar.") };
  }
}

/** Hapus standar beserta seluruh butir pertanyaan di bawahnya. */
export async function deleteStandard(id: number) {
  await requireLpm();
  await prisma.auditStandard.delete({ where: { id } });
  revalidateAll();
}

/* =====================================================================
   BUTIR PERTANYAAN (di bawah sebuah standar)
   ===================================================================== */

export async function createQuestion(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const cycleId = Number(formData.get("cycleId"));
    const standardId = Number(formData.get("standardId"));
    const questionText = String(formData.get("questionText") || "").trim();
    const order = Number(formData.get("order") || 0);
    const scope = parseScope(formData);

    if (!cycleId || !standardId || !questionText) {
      return { error: "Standar dan teks pertanyaan wajib diisi." };
    }
    if (!scope.data) return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };

    await prisma.auditQuestion.create({
      data: {
        cycleId,
        standardId,
        questionText,
        order,
        scopeType: scope.data.scopeType,
        scopeCategory: scope.data.scopeCategory,
        scopeUnitId: scope.data.scopeUnitId,
      },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan pertanyaan.") };
  }
}

/**
 * Simpan banyak butir pertanyaan sekaligus (dipakai modal "kelola butir"
 * pada sebuah standar). Teks dikirim sebagai JSON array di field `texts`.
 */
export async function createQuestionsBulk(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const cycleId = Number(formData.get("cycleId"));
    const standardId = Number(formData.get("standardId"));
    const startOrder = Number(formData.get("startOrder") || 0);
    const scope = parseScope(formData);

    let texts: string[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("texts") || "[]"));
      if (Array.isArray(parsed)) {
        texts = parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      texts = [];
    }

    if (!cycleId || !standardId) {
      return { error: "Data standar tidak lengkap." };
    }
    if (texts.length === 0) {
      return { error: "Belum ada butir pertanyaan baru untuk disimpan." };
    }
    if (!scope.data) {
      return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };
    }

    await prisma.auditQuestion.createMany({
      data: texts.map((questionText, i) => ({
        cycleId,
        standardId,
        questionText,
        order: startOrder + i,
        scopeType: scope.data!.scopeType,
        scopeCategory: scope.data!.scopeCategory,
        scopeUnitId: scope.data!.scopeUnitId,
      })),
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan pertanyaan.") };
  }
}

export async function updateQuestion(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireLpm();
    const id = Number(formData.get("id"));
    const standardId = Number(formData.get("standardId"));
    const questionText = String(formData.get("questionText") || "").trim();
    const order = Number(formData.get("order") || 0);
    const scope = parseScope(formData);

    if (!id || !questionText) return { error: "Data pertanyaan tidak lengkap." };
    if (!scope.data) return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };

    await prisma.auditQuestion.update({
      where: { id },
      data: {
        questionText,
        order,
        ...(standardId ? { standardId } : {}),
        scopeType: scope.data.scopeType,
        scopeCategory: scope.data.scopeCategory,
        scopeUnitId: scope.data.scopeUnitId,
      },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui pertanyaan.") };
  }
}

export async function deleteQuestion(id: number) {
  await requireLpm();
  await prisma.auditQuestion.delete({ where: { id } });
  revalidateAll();
}

/**
 * Baca & validasi cakupan pertanyaan dari FormData.
 * Mengembalikan { data } jika valid, atau { error } jika tidak.
 */
function parseScope(
  formData: FormData
):
  | {
      data: {
        scopeType: string;
        scopeCategory: string | null;
        scopeUnitId: number | null;
      };
      error?: undefined;
    }
  | { data?: undefined; error: string } {
  const scopeType = String(formData.get("scopeType") || "all");
  const scopeCategory = String(formData.get("scopeCategory") || "").trim();
  const scopeUnitId = Number(formData.get("scopeUnitId") || 0);

  if (scopeType === "category") {
    if (!scopeCategory) {
      return { error: "Pilih kategori unit untuk cakupan pertanyaan." };
    }
    return { data: { scopeType, scopeCategory, scopeUnitId: null } };
  }
  if (scopeType === "unit") {
    if (!scopeUnitId) {
      return { error: "Pilih unit untuk cakupan pertanyaan." };
    }
    return { data: { scopeType, scopeCategory: null, scopeUnitId } };
  }
  return { data: { scopeType: "all", scopeCategory: null, scopeUnitId: null } };
}
