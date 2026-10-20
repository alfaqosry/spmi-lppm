"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLpm } from "@/lib/guards";
import { AppError, toActionError } from "@/lib/errors";
import { LIMITS, checkText, intField, requireId, str } from "@/lib/validate";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { cleanupUnreferencedUploads } from "@/lib/upload";

export type ActionState = { ok?: boolean; error?: string } | undefined;

/** Batas jumlah butir per simpan massal. */
const BULK_MAX = 200;
const ORDER_RANGE = { min: -100000, max: 100000 };

function revalidateAll() {
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  revalidatePath("/analitik");
  revalidatePath("/siklus");
}

async function audit(
  user: { id: number; name: string },
  action: string,
  entityId: number | string
) {
  await recordActivity({
    userId: user.id,
    userName: user.name,
    action,
    entity: action.startsWith("standard") ? "standard" : "question",
    entityId,
    ip: await getClientIp(),
  });
}

/** Pastikan standar ada & milik siklus yang sama. */
async function assertStandardInCycle(standardId: number, cycleId: number) {
  const std = await prisma.auditStandard.findUnique({
    where: { id: standardId },
    select: { cycleId: true },
  });
  if (!std || std.cycleId !== cycleId) {
    throw new AppError("Standar tidak ditemukan pada siklus ini.");
  }
}

/* =====================================================================
   STANDAR (induk/pengelompok butir pertanyaan)
   ===================================================================== */

export async function createStandard(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireLpm();
    const cycleId = requireId(formData.get("cycleId"), "Siklus");
    const name = str(formData, "name", {
      max: LIMITS.standardName,
      required: true,
      label: "Nama standar",
    });
    const scope = await parseScope(formData);
    if (!scope.data) return { error: scope.error ?? "Cakupan standar tidak valid." };

    const existing = await prisma.auditStandard.findFirst({
      where: {
        cycleId,
        name,
        scopeType: scope.data.scopeType,
        scopeCategory: scope.data.scopeCategory,
        scopeUnitId: scope.data.scopeUnitId,
      },
    });
    if (existing) {
      return { error: "Standar dengan nama tersebut sudah ada pada cakupan ini." };
    }

    const last = await prisma.auditStandard.findFirst({
      where: {
        cycleId,
        scopeType: scope.data.scopeType,
        scopeCategory: scope.data.scopeCategory,
        scopeUnitId: scope.data.scopeUnitId,
      },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const created = await prisma.auditStandard.create({
      data: {
        cycleId,
        name,
        order: (last?.order ?? 0) + 1,
        scopeType: scope.data.scopeType,
        scopeCategory: scope.data.scopeCategory,
        scopeUnitId: scope.data.scopeUnitId,
      },
    });
    await audit(user, "standard.create", created.id);
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
    const user = await requireLpm();
    const id = requireId(formData.get("id"), "Standar");
    const name = str(formData, "name", {
      max: LIMITS.standardName,
      required: true,
      label: "Nama standar",
    });
    const scope = await parseScope(formData);
    if (!scope.data) return { error: scope.error ?? "Cakupan standar tidak valid." };

    await prisma.auditStandard.update({
      where: { id },
      data: {
        name,
        scopeType: scope.data.scopeType,
        scopeCategory: scope.data.scopeCategory,
        scopeUnitId: scope.data.scopeUnitId,
      },
    });
    await audit(user, "standard.update", id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui standar.") };
  }
}

/** Hapus standar beserta seluruh butir pertanyaan di bawahnya. */
export async function deleteStandard(id: number) {
  const user = await requireLpm();
  const standardId = requireId(id, "Standar");
  const evidence = await prisma.auditResponse.findMany({
    where: { question: { standardId }, evidenceFile: { not: null } },
    select: { evidenceFile: true },
  });
  await prisma.auditStandard.delete({ where: { id: standardId } });
  await cleanupUnreferencedUploads(evidence.map((r) => r.evidenceFile));
  await audit(user, "standard.delete", standardId);
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
    const user = await requireLpm();
    const cycleId = requireId(formData.get("cycleId"), "Siklus");
    const standardId = requireId(formData.get("standardId"), "Standar");
    const questionText = str(formData, "questionText", {
      max: LIMITS.questionText,
      required: true,
      multiline: true,
      label: "Teks pertanyaan",
    });
    const order = intField(formData, "order", { ...ORDER_RANGE, fallback: 0 });
    const scope = await parseScope(formData);
    if (!scope.data)
      return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };
    await assertStandardInCycle(standardId, cycleId);

    const created = await prisma.auditQuestion.create({
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
    await audit(user, "question.create", created.id);
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
    const user = await requireLpm();
    const cycleId = requireId(formData.get("cycleId"), "Siklus");
    const standardId = requireId(formData.get("standardId"), "Standar");
    const startOrder = intField(formData, "startOrder", {
      ...ORDER_RANGE,
      fallback: 0,
    });
    const scope = await parseScope(formData);

    const rawTexts = String(formData.get("texts") ?? "[]");
    if (rawTexts.length > BULK_MAX * (LIMITS.questionText + 10)) {
      return { error: "Data pertanyaan terlalu besar." };
    }
    let texts: string[] = [];
    try {
      const parsed: unknown = JSON.parse(rawTexts);
      if (Array.isArray(parsed)) {
        texts = parsed
          .filter((t): t is string => typeof t === "string")
          .map((t) =>
            checkText(t, {
              max: LIMITS.questionText,
              multiline: true,
              label: "Teks pertanyaan",
            })
          )
          .filter(Boolean);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      texts = [];
    }

    if (texts.length === 0) {
      return { error: "Belum ada butir pertanyaan baru untuk disimpan." };
    }
    if (texts.length > BULK_MAX) {
      return { error: `Maksimal ${BULK_MAX} butir pertanyaan per simpan.` };
    }
    if (!scope.data) {
      return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };
    }
    await assertStandardInCycle(standardId, cycleId);

    const scopeData = scope.data;
    await prisma.auditQuestion.createMany({
      data: texts.map((questionText, i) => ({
        cycleId,
        standardId,
        questionText,
        order: startOrder + i,
        scopeType: scopeData.scopeType,
        scopeCategory: scopeData.scopeCategory,
        scopeUnitId: scopeData.scopeUnitId,
      })),
    });
    await audit(user, "question.bulk_create", `${standardId}:${texts.length}`);
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
    const user = await requireLpm();
    const id = requireId(formData.get("id"), "Pertanyaan");
    const standardIdRaw = formData.get("standardId");
    const standardId = standardIdRaw
      ? requireId(standardIdRaw, "Standar")
      : null;
    const questionText = str(formData, "questionText", {
      max: LIMITS.questionText,
      required: true,
      multiline: true,
      label: "Teks pertanyaan",
    });
    const order = intField(formData, "order", { ...ORDER_RANGE, fallback: 0 });
    const scope = await parseScope(formData);
    if (!scope.data)
      return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };

    const current = await prisma.auditQuestion.findUnique({
      where: { id },
      select: { cycleId: true },
    });
    if (!current) return { error: "Pertanyaan tidak ditemukan." };
    if (standardId) await assertStandardInCycle(standardId, current.cycleId);

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
    await audit(user, "question.update", id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memperbarui pertanyaan.") };
  }
}

export async function deleteQuestion(id: number) {
  const user = await requireLpm();
  const questionId = requireId(id, "Pertanyaan");
  const evidence = await prisma.auditResponse.findMany({
    where: { auditQuestionId: questionId, evidenceFile: { not: null } },
    select: { evidenceFile: true },
  });
  await prisma.auditQuestion.delete({ where: { id: questionId } });
  await cleanupUnreferencedUploads(evidence.map((r) => r.evidenceFile));
  await audit(user, "question.delete", questionId);
  revalidateAll();
}

/**
 * Baca & validasi cakupan pertanyaan dari FormData (enum + referensi unit).
 * Mengembalikan { data } jika valid, atau { error } jika tidak.
 */
async function parseScope(formData: FormData): Promise<
  | {
      data: {
        scopeType: "all" | "category" | "unit";
        scopeCategory: string | null;
        scopeUnitId: number | null;
      };
      error?: undefined;
    }
  | { data?: undefined; error: string }
> {
  const scopeType = String(formData.get("scopeType") || "all");
  if (scopeType !== "all" && scopeType !== "category" && scopeType !== "unit") {
    return { error: "Cakupan pertanyaan tidak valid." };
  }

  if (scopeType === "category") {
    const scopeCategory = str(formData, "scopeCategory", {
      max: LIMITS.category,
      label: "Kategori",
    });
    if (!scopeCategory) {
      return { error: "Pilih kategori unit untuk cakupan pertanyaan." };
    }
    return { data: { scopeType, scopeCategory, scopeUnitId: null } };
  }
  if (scopeType === "unit") {
    const raw = formData.get("scopeUnitId");
    if (!raw || raw === "0") {
      return { error: "Pilih unit untuk cakupan pertanyaan." };
    }
    const scopeUnitId = requireId(raw, "Unit");
    const unit = await prisma.unit.findUnique({
      where: { id: scopeUnitId },
      select: { id: true },
    });
    if (!unit) return { error: "Unit cakupan tidak ditemukan." };
    return { data: { scopeType, scopeCategory: null, scopeUnitId } };
  }
  return { data: { scopeType: "all", scopeCategory: null, scopeUnitId: null } };
}
