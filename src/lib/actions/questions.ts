"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireLpm } from "@/lib/guards";
import { AppError, toActionError } from "@/lib/errors";
import { LIMITS, checkText, intField, requireId, str } from "@/lib/validate";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { cleanupUnreferencedUploads } from "@/lib/upload";
import {
  CATEGORIES,
  isScopeType,
  isScopeWithin,
  sameScope,
  type QuestionScope,
  type ScopeType,
} from "@/lib/scope";

export type ActionState = { ok?: boolean; error?: string } | undefined;

/** Batas jumlah butir per simpan massal. */
const BULK_MAX = 200;
const ORDER_RANGE = { min: -100000, max: 100000 };

const MSG_SCOPE_MISMATCH =
  "Cakupan butir pertanyaan harus sama dengan atau lebih sempit daripada cakupan standar induknya.";
const MSG_DUP_STANDARD =
  "Standar dengan nama tersebut sudah ada pada cakupan ini.";

type Tx = Prisma.TransactionClient;

/** Cakupan hasil validasi `parseScope`. */
type ParsedScope = {
  scopeType: ScopeType;
  scopeCategory: string | null;
  scopeUnitId: number | null;
  /** Kategori unit cakupan (hanya untuk validasi; tidak disimpan). */
  unitCategory: string | null;
};

function revalidateAll() {
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  revalidatePath("/analitik");
  revalidatePath("/siklus");
}

async function audit(
  user: { id: number; name: string },
  action: string,
  entityId: number | string,
  detail?: string
) {
  await recordActivity({
    userId: user.id,
    userName: user.name,
    action,
    entity: action.startsWith("standard") ? "standard" : "question",
    entityId,
    detail,
    ip: await getClientIp(),
  });
}

/** Kolom cakupan yang disimpan ke database. */
function scopeColumns(s: QuestionScope) {
  return {
    scopeType: s.scopeType,
    scopeCategory: s.scopeCategory,
    scopeUnitId: s.scopeUnitId,
  };
}

/** Ringkasan cakupan untuk log aktivitas, mis. "scope=unit:5". */
function describeScope(s: QuestionScope): string {
  if (s.scopeType === "category") return `scope=category:${s.scopeCategory}`;
  if (s.scopeType === "unit") return `scope=unit:${s.scopeUnitId}`;
  return "scope=all";
}

/**
 * Kunci baris siklus (SELECT ... FOR UPDATE) agar pembuatan/perubahan standar
 * pada siklus yang sama berjalan berurutan. Pengganti unique index
 * (cycle_id, name) yang dihapus: cek duplikat nama per cakupan + urutan
 * tidak lagi rentan race condition.
 */
async function lockCycle(tx: Tx, cycleId: number) {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM audit_cycles WHERE id = ${cycleId} FOR UPDATE`;
  if (!rows.length) throw new AppError("Siklus tidak ditemukan.");
}

/**
 * Kunci & baca standar. Penguncian mencegah race antara perubahan cakupan
 * standar dan penambahan/pemindahan butir ke standar tersebut.
 */
async function lockStandard(tx: Tx, standardId: number) {
  await tx.$queryRaw`
    SELECT id FROM audit_standards WHERE id = ${standardId} FOR UPDATE`;
  const std = await tx.auditStandard.findUnique({
    where: { id: standardId },
    select: {
      id: true,
      cycleId: true,
      scopeType: true,
      scopeCategory: true,
      scopeUnitId: true,
    },
  });
  if (!std) throw new AppError("Standar tidak ditemukan.");
  return std;
}

/**
 * Pastikan standar ada, milik siklus yang sama, DAN cakupan butir berada di
 * dalam cakupan standar (lihat `isScopeWithin`).
 */
async function assertStandardAccepts(
  tx: Tx,
  standardId: number,
  cycleId: number,
  scope: ParsedScope
) {
  const std = await lockStandard(tx, standardId);
  if (std.cycleId !== cycleId) {
    throw new AppError("Standar tidak ditemukan pada siklus ini.");
  }
  if (!isScopeWithin(scope, std, scope.unitCategory)) {
    throw new AppError(MSG_SCOPE_MISMATCH);
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
    const scope = await parseScope(formData, "standar");
    if (!scope.data)
      return { error: scope.error ?? "Cakupan standar tidak valid." };
    const columns = scopeColumns(scope.data);

    const created = await prisma.$transaction(async (tx) => {
      await lockCycle(tx, cycleId);
      const existing = await tx.auditStandard.findFirst({
        where: { cycleId, name, ...columns },
        select: { id: true },
      });
      if (existing) throw new AppError(MSG_DUP_STANDARD);

      const last = await tx.auditStandard.findFirst({
        where: { cycleId, ...columns },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      return tx.auditStandard.create({
        data: { cycleId, name, order: (last?.order ?? 0) + 1, ...columns },
        select: { id: true },
      });
    });
    await audit(user, "standard.create", created.id, describeScope(columns));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan standar.") };
  }
}

/**
 * Ubah nama (dan opsional cakupan) standar.
 * - Bila field `scopeType` TIDAK dikirim, cakupan lama dipertahankan
 *   (form ubah-nama di UI hanya mengirim `id` + `name`).
 * - Nama dicek unik pada cakupan tujuan (tanpa menghitung dirinya sendiri).
 * - Perubahan cakupan DITOLAK bila ada butir di dalamnya yang cakupannya
 *   berada di luar cakupan baru (tidak ada kaskade diam-diam).
 */
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
    let requested: ParsedScope | null = null;
    if (formData.has("scopeType")) {
      const scope = await parseScope(formData, "standar");
      if (!scope.data)
        return { error: scope.error ?? "Cakupan standar tidak valid." };
      requested = scope.data;
    }

    const result = await prisma.$transaction(async (tx) => {
      const pre = await tx.auditStandard.findUnique({
        where: { id },
        select: { cycleId: true },
      });
      if (!pre) throw new AppError("Standar tidak ditemukan.");
      await lockCycle(tx, pre.cycleId);
      const std = await lockStandard(tx, id);

      const next = scopeColumns(requested ?? std);
      const duplicate = await tx.auditStandard.findFirst({
        where: { cycleId: std.cycleId, name, ...next, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) throw new AppError(MSG_DUP_STANDARD);

      const scopeChanged = !sameScope(std, next);
      if (scopeChanged) {
        const qs = await tx.auditQuestion.findMany({
          where: { standardId: id },
          select: {
            scopeType: true,
            scopeCategory: true,
            scopeUnitId: true,
            scopeUnit: { select: { category: true } },
          },
        });
        const outside = qs.filter(
          (q) => !isScopeWithin(q, next, q.scopeUnit?.category ?? null)
        ).length;
        if (outside > 0) {
          throw new AppError(
            `Cakupan standar tidak dapat diubah: ${outside} butir pertanyaan di dalamnya berada di luar cakupan baru. Pindahkan atau ubah cakupan butir tersebut terlebih dahulu.`
          );
        }
      }

      await tx.auditStandard.update({
        where: { id },
        data: { name, ...next },
      });
      return { next, scopeChanged };
    });
    await audit(
      user,
      "standard.update",
      id,
      result.scopeChanged ? describeScope(result.next) : undefined
    );
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
    const scope = await parseScope(formData, "pertanyaan");
    if (!scope.data)
      return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };
    const scopeData = scope.data;

    const created = await prisma.$transaction(async (tx) => {
      await assertStandardAccepts(tx, standardId, cycleId, scopeData);
      return tx.auditQuestion.create({
        data: {
          cycleId,
          standardId,
          questionText,
          order,
          ...scopeColumns(scopeData),
        },
        select: { id: true },
      });
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
    const scope = await parseScope(formData, "pertanyaan");

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
    const scopeData = scope.data;

    await prisma.$transaction(async (tx) => {
      await assertStandardAccepts(tx, standardId, cycleId, scopeData);
      await tx.auditQuestion.createMany({
        data: texts.map((questionText, i) => ({
          cycleId,
          standardId,
          questionText,
          order: startOrder + i,
          ...scopeColumns(scopeData),
        })),
      });
    });
    await audit(user, "question.bulk_create", `${standardId}:${texts.length}`);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan pertanyaan.") };
  }
}

/**
 * Ubah butir pertanyaan. Standar tujuan (baru atau lama) harus satu siklus
 * dan cakupannya harus mencakup cakupan butir. Bila `scopeType` tidak
 * dikirim, cakupan lama butir dipertahankan.
 */
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
    let requested: ParsedScope | null = null;
    if (formData.has("scopeType")) {
      const scope = await parseScope(formData, "pertanyaan");
      if (!scope.data)
        return { error: scope.error ?? "Cakupan pertanyaan tidak valid." };
      requested = scope.data;
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.auditQuestion.findUnique({
        where: { id },
        select: {
          cycleId: true,
          standardId: true,
          scopeType: true,
          scopeCategory: true,
          scopeUnitId: true,
          scopeUnit: { select: { category: true } },
        },
      });
      if (!current) throw new AppError("Pertanyaan tidak ditemukan.");

      let scope = requested;
      if (!scope) {
        if (!isScopeType(current.scopeType)) {
          throw new AppError("Cakupan pertanyaan tidak valid.");
        }
        scope = {
          scopeType: current.scopeType,
          scopeCategory: current.scopeCategory,
          scopeUnitId: current.scopeUnitId,
          unitCategory: current.scopeUnit?.category ?? null,
        };
      }
      await assertStandardAccepts(
        tx,
        standardId ?? current.standardId,
        current.cycleId,
        scope
      );

      await tx.auditQuestion.update({
        where: { id },
        data: {
          questionText,
          order,
          ...(standardId ? { standardId } : {}),
          ...scopeColumns(scope),
        },
      });
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

type ScopeResult =
  | { data: ParsedScope; error?: undefined }
  | { data?: undefined; error: string };

/**
 * Baca & validasi cakupan dari FormData (whitelist jenis + referensi).
 *  - "category": kategori harus dikenal (kategori bawaan `CATEGORIES` atau
 *    kategori unit yang ada); nilai disimpan dalam ejaan kanonis agar
 *    perbandingan `===` di `isQuestionForUnit` tetap cocok.
 *  - "unit": unit harus ada.
 * Fungsi ini sengaja TIDAK diekspor: di berkas "use server" setiap ekspor
 * async menjadi endpoint yang dapat dipanggil klien.
 */
async function parseScope(
  formData: FormData,
  subject: "standar" | "pertanyaan"
): Promise<ScopeResult> {
  const scopeType = String(formData.get("scopeType") || "all");
  if (!isScopeType(scopeType)) {
    return { error: `Cakupan ${subject} tidak valid.` };
  }

  if (scopeType === "category") {
    const raw = str(formData, "scopeCategory", {
      max: LIMITS.category,
      label: "Kategori",
    });
    if (!raw) {
      return { error: `Pilih kategori unit untuk cakupan ${subject}.` };
    }
    let scopeCategory =
      CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase()) ?? null;
    if (!scopeCategory) {
      const unit = await prisma.unit.findFirst({
        where: { category: raw },
        select: { category: true },
      });
      scopeCategory = unit?.category ?? null;
    }
    if (!scopeCategory) return { error: "Kategori unit tidak dikenal." };
    return {
      data: { scopeType, scopeCategory, scopeUnitId: null, unitCategory: null },
    };
  }
  if (scopeType === "unit") {
    const raw = formData.get("scopeUnitId");
    if (!raw || raw === "0") {
      return { error: `Pilih unit untuk cakupan ${subject}.` };
    }
    const scopeUnitId = requireId(raw, "Unit");
    const unit = await prisma.unit.findUnique({
      where: { id: scopeUnitId },
      select: { id: true, category: true },
    });
    if (!unit) return { error: "Unit cakupan tidak ditemukan." };
    return {
      data: {
        scopeType,
        scopeCategory: null,
        scopeUnitId,
        unitCategory: unit.category,
      },
    };
  }
  return {
    data: {
      scopeType: "all",
      scopeCategory: null,
      scopeUnitId: null,
      unitCategory: null,
    },
  };
}
