"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLpm } from "@/lib/guards";
import { cleanupUnreferencedUploads, saveUpload } from "@/lib/upload";
import { toActionError, isSafeHttpUrl, runAction } from "@/lib/errors";
import { LIMITS, fileField, oneOf, requireId, str } from "@/lib/validate";
import { enforceRateLimit, LIMITS_RL } from "@/lib/ratelimit";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";

export type ActionState = { ok?: boolean; error?: string } | undefined;

/** Jenis dokumen yang sah (whitelist, mencegah nilai sembarang). */
const DOCUMENT_TYPES = ["penetapan", "evaluasi"] as const;

export async function createDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireLpm();
    const cycleId = requireId(formData.get("cycleId"), "Siklus");
    const type = oneOf(
      formData.get("type") || "penetapan",
      DOCUMENT_TYPES,
      "Jenis dokumen tidak valid."
    );
    const title = str(formData, "title", {
      max: LIMITS.title,
      required: true,
      label: "Judul dokumen",
    });
    const link = str(formData, "link", { max: LIMITS.url, label: "Tautan" });
    const file = fileField(formData, "file");

    if (link && !isSafeHttpUrl(link)) {
      return { error: "Tautan tidak valid. Gunakan alamat http/https." };
    }
    if (!file && !link) {
      return { error: "Unggah file atau isi tautan dokumen." };
    }

    const cycle = await prisma.auditCycle.findUnique({
      where: { id: cycleId },
      select: { id: true },
    });
    if (!cycle) return { error: "Siklus tidak ditemukan." };

    let filePath: string | null = null;
    if (file) {
      enforceRateLimit(
        `upload:${user.id}`,
        LIMITS_RL.upload.limit,
        LIMITS_RL.upload.windowMs
      );
      const res = await saveUpload(file, type);
      if (!res.ok) return { error: res.error };
      filePath = res.path;
    }

    const doc = await prisma.document.create({
      data: {
        cycleId,
        type,
        title,
        filePath,
        link: link || null,
        uploadedBy: user.id,
      },
    });

    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "document.create",
      entity: "document",
      entityId: doc.id,
      detail: `${type}: ${title}`,
      ip: await getClientIp(),
    });
    revalidatePath(`/${type}`);
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan dokumen.") };
  }
}

export async function deleteDocument(id: number): Promise<ActionState> {
  // Galat bisnis (mis. mode pemeliharaan) dikembalikan sebagai nilai agar pesan aslinya
  // tampil di produksi; galat tak terduga diganti pesan umum (tanpa detail internal).
  return runAction(async () => {
    const user = await requireLpm();
    const docId = requireId(id, "Dokumen");
    const doc = await prisma.document.delete({ where: { id: docId } });
    // Hapus berkas fisik bila tidak dipakai dokumen/jawaban lain.
    await cleanupUnreferencedUploads([doc.filePath]);
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "document.delete",
      entity: "document",
      entityId: docId,
      ip: await getClientIp(),
    });
    revalidatePath(`/${doc.type}`);
  }, "Gagal menghapus dokumen.");
}
