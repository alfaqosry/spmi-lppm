"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unitIdsOf } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { recalcUnitProgress } from "@/lib/progress";
import { isQuestionForUnit } from "@/lib/scope";
import { cycleClosedReason } from "@/lib/cycles";
import { toActionError, isSafeHttpUrl } from "@/lib/errors";

export type ActionState = { ok?: boolean; error?: string } | undefined;

/**
 * Simpan jawaban auditee untuk satu butir pertanyaan.
 * Aturan: Ya -> wajib bukti (file/link); Tidak -> wajib alasan.
 */
export async function saveResponse(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Sesi tidak valid." };

    const cycleId = Number(formData.get("cycleId"));
    const questionId = Number(formData.get("questionId"));
    const unitIdRaw = formData.get("unitId");
    const unitId = unitIdRaw ? Number(unitIdRaw) : user.unitId;
    const answer = String(formData.get("answer") || "") as "ya" | "tidak" | "";
    const reason = String(formData.get("reason") || "").trim();
    const evidenceLink = String(formData.get("evidenceLink") || "").trim();
    const existingFile = String(formData.get("existingFile") || "").trim();
    const file = formData.get("file") as File | null;

    if (!unitId) return { error: "Akun Anda belum ditautkan ke unit." };
    // Pastikan pengguna memang ditempatkan pada unit yang sedang diisi.
    if (!unitIdsOf(user).includes(unitId)) {
      return { error: "Anda tidak memiliki akses ke unit tersebut." };
    }

    if (!cycleId || !questionId) return { error: "Data tidak lengkap." };
    if (answer !== "ya" && answer !== "tidak") {
      return { error: "Pilih jawaban Ya atau Tidak." };
    }

    // Penegakan sisi server: tolak pengisian jika siklus nonaktif / lewat batas waktu.
    const cycle = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      select: { isActive: true, endDate: true },
    });
    const closedReason = cycleClosedReason(cycle);
    if (closedReason) return { error: closedReason };

    let evidenceFile: string | null = existingFile || null;
    if (file && file.size > 0) {
      const res = await saveUpload(file, "bukti");
      if (!res.ok) return { error: res.error };
      evidenceFile = res.path;
    }

    if (evidenceLink && !isSafeHttpUrl(evidenceLink)) {
      return { error: "Tautan bukti tidak valid. Gunakan alamat http/https." };
    }

    if (answer === "ya" && !evidenceFile && !evidenceLink) {
      return { error: "Jawaban Ya wajib disertai bukti (file atau tautan)." };
    }
    if (answer === "tidak" && !reason) {
      return { error: "Jawaban Tidak wajib disertai alasan." };
    }

    // Pastikan pertanyaan memang relevan untuk unit pengguna (sesuai cakupan).
    const [question, unit] = await Promise.all([
      prisma.auditQuestion.findUnique({
        where: { id: questionId },
        select: { scopeType: true, scopeCategory: true, scopeUnitId: true },
      }),
      prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, category: true },
      }),
    ]);
    if (!question || !unit) {
      return { error: "Pertanyaan atau unit tidak ditemukan." };
    }
    if (!isQuestionForUnit(question, unit)) {
      return { error: "Pertanyaan ini tidak termasuk dalam cakupan unit Anda." };
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

    await recalcUnitProgress(cycleId, unitId, user.id);
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
    const user = await getCurrentUser();
    if (!user) return { error: "Sesi tidak valid." };
    const id = Number(formData.get("id"));
    const rtl = String(formData.get("rtl") || "").trim();
    if (!id || !rtl) return { error: "Rencana tindak lanjut wajib diisi." };

    const resp = await prisma.auditResponse.findUnique({ where: { id } });
    if (!resp) return { error: "Data temuan tidak ditemukan." };
    if (!unitIdsOf(user).includes(resp.unitId))
      return { error: "Anda tidak berhak mengubah data ini." };

    const cycle = await prisma.auditCycle.findUnique({
      where: { id: resp.cycleId },
      select: { isActive: true, endDate: true },
    });
    const closedReason = cycleClosedReason(cycle);
    if (closedReason) return { error: closedReason };

    await prisma.auditResponse.update({ where: { id }, data: { rtl } });
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
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== "lpm_admin" &&
        user.role !== "lpm_member" &&
        user.role !== "superadmin")
    ) {
      return { error: "Akses ditolak." };
    }
    const id = Number(formData.get("id"));
    const status = String(formData.get("status") || "") as
      | "verified"
      | "revision";
    const lpmNotes = String(formData.get("lpmNotes") || "").trim();

    if (!id || (status !== "verified" && status !== "revision")) {
      return { error: "Data verifikasi tidak lengkap." };
    }
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
    revalidatePath("/audit");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal memverifikasi.") };
  }
}
