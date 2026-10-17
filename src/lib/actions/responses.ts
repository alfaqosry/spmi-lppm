"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { unitIdsOf } from "@/lib/auth";
import { requireAccess, requireLpm, requireUnitMember } from "@/lib/guards";
import { cleanupUnreferencedUploads, saveUpload } from "@/lib/upload";
import { recalcUnitProgress } from "@/lib/progress";
import { isQuestionForUnit } from "@/lib/scope";
import { cycleClosedReason } from "@/lib/cycles";
import { toActionError, isSafeHttpUrl } from "@/lib/errors";
import { LIMITS, fileField, oneOf, requireId, str } from "@/lib/validate";
import { enforceRateLimit, LIMITS_RL } from "@/lib/ratelimit";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";

export type ActionState = { ok?: boolean; error?: string } | undefined;

/**
 * Simpan jawaban auditee untuk satu butir pertanyaan.
 * Aturan: Ya -> wajib bukti (file/link); Tidak -> wajib alasan.
 *
 * Anti-IDOR:
 *  - unit harus termasuk unit tempat pengguna ditempatkan,
 *  - pertanyaan harus milik siklus yang sama & dalam cakupan unit,
 *  - `existingFile` HANYA diterima bila sama dengan berkas bukti yang sudah
 *    tersimpan pada jawaban ini (tidak bisa "meminjam" berkas unit lain).
 */
export async function saveResponse(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireAccess();

    const cycleId = requireId(formData.get("cycleId"), "Siklus");
    const questionId = requireId(formData.get("questionId"), "Pertanyaan");
    const unitIdRaw = formData.get("unitId");
    const unitId = unitIdRaw ? requireId(unitIdRaw, "Unit") : session.unitId;
    if (!unitId) return { error: "Akun Anda belum ditautkan ke unit." };

    const user = await requireUnitMember(unitId);

    const answerRaw = String(formData.get("answer") ?? "");
    if (answerRaw !== "ya" && answerRaw !== "tidak") {
      return { error: "Pilih jawaban Ya atau Tidak." };
    }
    const answer = oneOf(answerRaw, ["ya", "tidak"] as const);
    const reason = str(formData, "reason", {
      max: LIMITS.longText,
      multiline: true,
      label: "Alasan",
    });
    const evidenceLink = str(formData, "evidenceLink", {
      max: LIMITS.url,
      label: "Tautan bukti",
    });
    const existingFile = str(formData, "existingFile", { max: 255 });
    const file = fileField(formData, "file");

    if (evidenceLink && !isSafeHttpUrl(evidenceLink)) {
      return { error: "Tautan bukti tidak valid. Gunakan alamat http/https." };
    }

    // Penegakan sisi server: tolak pengisian jika siklus nonaktif / lewat batas waktu.
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      select: { isActive: true, endDate: true },
    });
    const closedReason = cycleClosedReason(cycle);
    if (closedReason) return { error: closedReason };

    // Pastikan pertanyaan milik siklus ini & relevan untuk unit (sesuai cakupan).
    const [question, unit, current] = await Promise.all([
      prisma.auditQuestion.findUnique({
        where: { id: questionId },
        select: {
          cycleId: true,
          scopeType: true,
          scopeCategory: true,
          scopeUnitId: true,
        },
      }),
      prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, category: true },
      }),
      prisma.auditResponse.findUnique({
        where: {
          cycleId_unitId_auditQuestionId: {
            cycleId,
            unitId,
            auditQuestionId: questionId,
          },
        },
        select: { evidenceFile: true },
      }),
    ]);
    if (!question || !unit || question.cycleId !== cycleId) {
      return { error: "Pertanyaan atau unit tidak ditemukan." };
    }
    if (!isQuestionForUnit(question, unit)) {
      return {
        error: "Pertanyaan ini tidak termasuk dalam cakupan unit Anda.",
      };
    }

    // Berkas lama hanya boleh dipertahankan bila memang milik jawaban ini.
    let evidenceFile: string | null =
      existingFile && current?.evidenceFile === existingFile
        ? existingFile
        : null;
    if (file) {
      enforceRateLimit(
        `upload:${user.id}`,
        LIMITS_RL.upload.limit,
        LIMITS_RL.upload.windowMs
      );
      const res = await saveUpload(file, "bukti");
      if (!res.ok) return { error: res.error };
      evidenceFile = res.path;
    }

    if (answer === "ya" && !evidenceFile && !evidenceLink) {
      return { error: "Jawaban Ya wajib disertai bukti (file atau tautan)." };
    }
    if (answer === "tidak" && !reason) {
      return { error: "Jawaban Tidak wajib disertai alasan." };
    }

    await prisma.auditResponse.upsert({
      where: {
        cycleId_unitId_auditQuestionId: {
          cycleId,
          unitId,
          auditQuestionId: questionId,
        },
      },
      create: {
        cycleId,
        unitId,
        auditQuestionId: questionId,
        answer,
        evidenceFile,
        evidenceLink: evidenceLink || null,
        reason: reason || null,
        status: "pending",
      },
      update: {
        answer,
        evidenceFile,
        evidenceLink: evidenceLink || null,
        reason: reason || null,
        // setiap perubahan jawaban mengembalikan status ke menunggu verifikasi
        status: "pending",
        lpmNotes: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    });

    // Berkas bukti lama yang tergantikan dihapus dari disk (best-effort).
    if (current?.evidenceFile && current.evidenceFile !== evidenceFile) {
      await cleanupUnreferencedUploads([current.evidenceFile]);
    }

    await recalcUnitProgress(cycleId, unitId, user.id);
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "response.save",
      entity: "audit_response",
      entityId: `${cycleId}:${unitId}:${questionId}`,
      ip: await getClientIp(),
    });
    revalidatePath("/audit");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan jawaban.") };
  }
}

/** Simpan Rencana Tindak Lanjut (RTL) oleh auditee untuk temuan KTS. */
export async function saveRtl(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireAccess();
    const id = requireId(formData.get("id"), "Data temuan");
    const rtl = str(formData, "rtl", {
      max: LIMITS.longText,
      multiline: true,
      required: true,
      label: "Rencana tindak lanjut",
    });

    const resp = await prisma.auditResponse.findUnique({
      where: { id },
      select: { id: true, unitId: true, cycleId: true },
    });
    if (!resp || !unitIdsOf(session).includes(resp.unitId)) {
      // Pesan sama untuk "tidak ada" & "bukan milik Anda" (anti enumerasi ID).
      return { error: "Data temuan tidak ditemukan." };
    }
    const user = await requireUnitMember(resp.unitId);

    const cycle = await prisma.auditCycle.findUnique({
      where: { id: resp.cycleId },
      select: { isActive: true, endDate: true },
    });
    const closedReason = cycleClosedReason(cycle);
    if (closedReason) return { error: closedReason };

    await prisma.auditResponse.update({ where: { id }, data: { rtl } });
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "response.rtl",
      entity: "audit_response",
      entityId: id,
      ip: await getClientIp(),
    });
    revalidatePath("/audit");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan RTL.") };
  }
}

/** Verifikasi jawaban oleh LPM (verified / revision + catatan). */
export async function verifyResponse(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireLpm();
    const id = requireId(formData.get("id"), "Data verifikasi");
    const status = oneOf(
      formData.get("status"),
      ["verified", "revision"] as const,
      "Data verifikasi tidak lengkap."
    );
    const lpmNotes = str(formData, "lpmNotes", {
      max: LIMITS.longText,
      multiline: true,
      label: "Catatan",
    });

    if (status === "revision" && !lpmNotes) {
      return { error: "Catatan revisi wajib diisi." };
    }

    const resp = await prisma.auditResponse.update({
      where: { id },
      data: {
        status,
        lpmNotes: lpmNotes || null,
        verifiedBy: user.id,
        verifiedAt: new Date(),
      },
    });

    await recalcUnitProgress(resp.cycleId, resp.unitId, user.id);
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: `response.${status}`,
      entity: "audit_response",
      entityId: id,
      ip: await getClientIp(),
    });
    revalidatePath("/audit");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memverifikasi.") };
  }
}
