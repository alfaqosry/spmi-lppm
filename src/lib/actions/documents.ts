"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { saveUpload } from "@/lib/upload";
import { AppError, toActionError, isSafeHttpUrl } from "@/lib/errors";

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

/** Jenis dokumen yang sah (whitelist, mencegah nilai sembarang). */
const DOCUMENT_TYPES = ["penetapan", "evaluasi"] as const;
type ValidDocumentType = (typeof DOCUMENT_TYPES)[number];

export async function createDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireLpm();
    const cycleId = Number(formData.get("cycleId"));
    const typeRaw = String(formData.get("type") || "penetapan");
    const title = String(formData.get("title") || "").trim();
    const link = String(formData.get("link") || "").trim();
    const file = formData.get("file") as File | null;

    if (!cycleId || !title) {
      return { error: "Siklus dan judul dokumen wajib diisi." };
    }
    if (!DOCUMENT_TYPES.includes(typeRaw as ValidDocumentType)) {
      return { error: "Jenis dokumen tidak valid." };
    }
    const type = typeRaw as ValidDocumentType;

    if (link && !isSafeHttpUrl(link)) {
      return { error: "Tautan tidak valid. Gunakan alamat http/https." };
    }

    let filePath: string | null = null;
    if (file && file.size > 0) {
      const res = await saveUpload(file, type);
      if (!res.ok) return { error: res.error };
      filePath = res.path;
    }

    if (!filePath && !link) {
      return { error: "Unggah file atau isi tautan dokumen." };
    }

    await prisma.document.create({
      data: {
        cycleId,
        type,
        title,
        filePath,
        link: link || null,
        uploadedBy: user.id,
      },
    });

    revalidatePath(`/${type}`);
    return { ok: true };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan dokumen.") };
  }
}

export async function deleteDocument(id: number) {
  await requireLpm();
  const doc = await prisma.document.delete({ where: { id } });
  revalidatePath(`/${doc.type}`);
}
