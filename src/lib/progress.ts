import { prisma } from "@/lib/prisma";
import { isQuestionForUnit } from "@/lib/scope";

/**
 * Hitung ulang progres sebuah unit pada siklus tertentu lalu simpan ke unit_progress.
 * Hanya pertanyaan yang RELEVAN dengan unit (berdasarkan cakupan) yang dihitung.
 *
 * Aturan status:
 *  - belum_mulai : belum ada jawaban sama sekali
 *  - mengisi     : sebagian pertanyaan relevan sudah dijawab
 *  - selesai     : semua pertanyaan relevan sudah dijawab
 */
export async function recalcUnitProgress(
  cycleId: number,
  unitId: number,
  userId?: number | null
) {
  const [unit, questions] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, category: true },
    }),
    prisma.auditQuestion.findMany({
      where: { cycleId },
      select: {
        id: true,
        scopeType: true,
        scopeCategory: true,
        scopeUnitId: true,
      },
    }),
  ]);

  const relevant = unit
    ? questions.filter((q) => isQuestionForUnit(q, unit))
    : questions;
  const relevantIds = relevant.map((q) => q.id);
  const totalQuestions = relevantIds.length;

  const answered = await prisma.auditResponse.count({
    where: {
      cycleId,
      unitId,
      auditQuestionId: { in: relevantIds },
      answer: { not: null },
    },
  });

  let status: "belum_mulai" | "mengisi" | "selesai" = "belum_mulai";
  if (answered > 0 && totalQuestions > 0 && answered >= totalQuestions) {
    status = "selesai";
  } else if (answered > 0) {
    status = "mengisi";
  }

  await prisma.unitProgress.upsert({
    where: { cycleId_unitId: { cycleId, unitId } },
    create: {
      cycleId,
      unitId,
      status,
      lastUpdatedBy: userId ?? null,
    },
    update: {
      status,
      lastUpdatedBy: userId ?? null,
    },
  });

  return { totalQuestions, answered, status };
}
