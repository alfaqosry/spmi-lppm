"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";

export type ActionState = { ok: boolean; error?: string };

const Schema = z.object({
  cycleId: z.coerce.number().int().positive(),
  unitId: z.coerce.number().int().positive(),
});

/**
 * Finalisasi audit oleh auditor untuk satu unit pada siklus tertentu.
 * Setelah difinalisasi status tidak bisa dibatalkan oleh auditor.
 */
export async function finalizeAudit(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "auditor") {
    return { ok: false, error: "Tidak diizinkan." };
  }

  const parsed = Schema.safeParse({
    cycleId: formData.get("cycleId"),
    unitId: formData.get("unitId"),
  });
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const { cycleId, unitId } = parsed.data;

  // Pastikan auditor memang ditugaskan ke unit ini
  const assignment = await prisma.unitAuditor.findFirst({
    where: { userId: user.id, unitId, cycleId },
  });
  if (!assignment)
    return { ok: false, error: "Anda tidak ditugaskan untuk unit ini." };

  await prisma.auditorAuditStatus.upsert({
    where: {
      cycleId_unitId_auditorId: { cycleId, unitId, auditorId: user.id },
    },
    create: {
      cycleId,
      unitId,
      auditorId: user.id,
      finalized: true,
      finalizedAt: new Date(),
    },
    update: { finalized: true, finalizedAt: new Date() },
  });

  await recordActivity({
    userId: user.id,
    userName: user.name,
    action: "auditor.finalize",
    entity: "auditor_audit_status",
    entityId: unitId,
    detail: `Auditor memfinalisasi audit unit_id: ${unitId} siklus_id: ${cycleId}`,
    ip: await getClientIp(),
  });

  revalidatePath("/audit-saya");
  return { ok: true };
}
