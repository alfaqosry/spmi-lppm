"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";

export type ActionState = { ok: boolean; error?: string };

const SaveFindingSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  unitId: z.coerce.number().int().positive(),
  auditQuestionId: z.coerce.number().int().positive(),
  temuan: z.string().max(2000).optional(),
  akarMasalah: z.string().max(2000).optional(),
  rencanaTL: z.string().max(2000).optional(),
  efektivitasTL: z.string().max(2000).optional(),
});

/**
 * Menyimpan temuan audit (data bersama per unit per pertanyaan).
 * Dapat diedit oleh:
 *  - Auditor yang ditugaskan ke unit tersebut (lead/member)
 *  - Kepala LPM (isLpmHead = true) — dapat mengedit semua unit
 */
export async function saveAuditorFinding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Tidak diizinkan." };

  const isAuditor = user.role === "auditor";
  const isLpmHead = user.isLpmHead;
  if (!isAuditor && !isLpmHead) return { ok: false, error: "Tidak diizinkan." };

  const parsed = SaveFindingSchema.safeParse({
    cycleId: formData.get("cycleId"),
    unitId: formData.get("unitId"),
    auditQuestionId: formData.get("auditQuestionId"),
    temuan: formData.get("temuan"),
    akarMasalah: formData.get("akarMasalah"),
    rencanaTL: formData.get("rencanaTL"),
    efektivitasTL: formData.get("efektivitasTL"),
  });
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const {
    cycleId,
    unitId,
    auditQuestionId,
    temuan,
    akarMasalah,
    rencanaTL,
    efektivitasTL,
  } = parsed.data;

  // Auditor biasa: harus ditugaskan ke unit ini
  if (isAuditor && !isLpmHead) {
    const assignment = await prisma.unitAuditor.findFirst({
      where: { userId: user.id, unitId, cycleId },
    });
    if (!assignment)
      return { ok: false, error: "Anda tidak ditugaskan untuk unit ini." };
  }

  const finding = await prisma.auditorFinding.upsert({
    where: {
      cycleId_unitId_auditQuestionId: { cycleId, unitId, auditQuestionId },
    },
    create: {
      cycleId,
      unitId,
      auditQuestionId,
      lastEditedBy: user.id,
      temuan: temuan || null,
      akarMasalah: akarMasalah || null,
      rencanaTL: rencanaTL || null,
      efektivitasTL: efektivitasTL || null,
    },
    update: {
      lastEditedBy: user.id,
      temuan: temuan || null,
      akarMasalah: akarMasalah || null,
      rencanaTL: rencanaTL || null,
      efektivitasTL: efektivitasTL || null,
    },
  });

  await recordActivity({
    userId: user.id,
    userName: user.name,
    action: "audit.save_finding",
    entity: "auditor_finding",
    entityId: finding.id,
    detail: `${user.name} menyimpan temuan pertanyaan #${auditQuestionId} unit_id: ${unitId}`,
    ip: await getClientIp(),
  });

  revalidatePath("/audit-saya");
  revalidatePath("/rtl");
  return { ok: true };
}
