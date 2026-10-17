import { prisma } from "@/lib/prisma";
import { getSettings, isOn } from "@/lib/settings";
import { logError, maskEmail, redactText } from "@/lib/redact";

/* =====================================================================
   Log login & log aktivitas
   ---------------------------------------------------------------------
   Pencatatan bersifat best-effort: kegagalan menulis log TIDAK boleh
   menggagalkan alur utama (login/aksi). Semua kegagalan hanya dicatat ke
   konsol server (tersamarkan).

   PRIVASI (UU PDP): email pada log login selalu DISAMARKAN (a***@domain);
   akun tetap dapat ditelusuri lewat `userId`. Teks `detail`/`message`
   dibersihkan dari email, nomor telepon, token, dan secret.
   Penghapusan log lama: lihat `purgeExpiredData()` di src/lib/privacy.ts.
   ===================================================================== */

export type LoginLogInput = {
  email: string;
  userId?: number | null;
  success: boolean;
  method?: "password" | "sso";
  ip?: string | null;
  userAgent?: string | null;
  message?: string | null;
};

/** Catat percobaan login (sukses/gagal) bila fitur log login aktif. */
export async function recordLogin(input: LoginLogInput): Promise<void> {
  try {
    const settings = await getSettings();
    if (!isOn(settings["log.login.enabled"])) return;
    await prisma.loginLog.create({
      data: {
        email: maskEmail(input.email).slice(0, 190),
        userId: input.userId ?? null,
        success: input.success,
        method: input.method ?? "password",
        ip: input.ip?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 400) ?? null,
        message: input.message ? redactText(input.message).slice(0, 255) : null,
      },
    });
    maybePurge();
  } catch (e) {
    logError("[login-log] gagal mencatat:", e);
  }
}

/**
 * Jaring pengaman retensi: selain tugas terjadwal, jalankan penghapusan data
 * kedaluwarsa paling sering sekali per jam per proses (dipicu oleh login).
 */
let lastPurgeAt = 0;
function maybePurge() {
  const now = Date.now();
  if (now - lastPurgeAt < 60 * 60 * 1000) return;
  lastPurgeAt = now;
  import("@/lib/privacy")
    .then((m) => m.purgeExpiredData())
    .catch((e) => logError("[retention] gagal menghapus data kedaluwarsa:", e));
}

export type ActivityLogInput = {
  userId?: number | null;
  userName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  detail?: string | null;
  ip?: string | null;
};

/** Catat aktivitas pengguna (audit trail) bila fitur log aktivitas aktif. */
export async function recordActivity(input: ActivityLogInput): Promise<void> {
  try {
    const settings = await getSettings();
    if (!isOn(settings["log.activity.enabled"])) return;
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        userName: input.userName?.slice(0, 160) ?? null,
        action: input.action.slice(0, 80),
        entity: input.entity?.slice(0, 80) ?? null,
        entityId:
          input.entityId != null ? String(input.entityId).slice(0, 80) : null,
        detail: input.detail ? redactText(input.detail).slice(0, 500) : null,
        ip: input.ip?.slice(0, 64) ?? null,
      },
    });
  } catch (e) {
    logError("[activity-log] gagal mencatat:", e);
  }
}
