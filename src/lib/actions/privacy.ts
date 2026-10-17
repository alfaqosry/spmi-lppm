"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/guards";
import { toActionError } from "@/lib/errors";
import { saveConsent, CONSENT_VERSION } from "@/lib/privacy";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { toIsoJakarta } from "@/lib/format";

export type ConsentState =
  | {
      ok?: boolean;
      error?: string;
      consentedAt?: string | null;
      version?: string;
    }
  | undefined;

/**
 * Catat persetujuan kebijakan privasi (UU 27/2022 PDP) untuk pengguna yang
 * sedang login, versi `CONSENT_VERSION`. Dapat dipanggil langsung
 * (`await recordConsent()`) atau sebagai action form (`useActionState`):
 * form wajib mengirim checkbox `agree=on`.
 */
export async function recordConsent(
  _prev?: ConsentState,
  formData?: FormData
): Promise<ConsentState> {
  try {
    // Persetujuan tetap bisa dicatat saat pemeliharaan (tidak mengubah data audit).
    const user = await requireUser({ allowDuringMaintenance: true });
    if (formData && formData.get("agree") !== "on") {
      return {
        error: "Centang persetujuan kebijakan privasi untuk melanjutkan.",
      };
    }
    const at = await saveConsent(user.id);
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "privacy.consent",
      entity: "user",
      entityId: user.id,
      detail: `Menyetujui kebijakan privasi versi ${CONSENT_VERSION}`,
      ip: await getClientIp(),
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      consentedAt: toIsoJakarta(at),
      version: CONSENT_VERSION,
    };
  } catch (e) {
    return { error: toActionError(e, "Gagal menyimpan persetujuan.") };
  }
}
