import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { APP_TIME_ZONE, toIsoDate, toIsoJakarta } from "@/lib/format";
import { maskEmail } from "@/lib/redact";

/* =====================================================================
   Pelindungan Data Pribadi (UU 27/2022 PDP) — logika sisi server
   ---------------------------------------------------------------------
   - Persetujuan (consent) kebijakan privasi per versi
   - Ekspor data pribadi milik pengguna (hak akses subjek data)
   - Retensi: penghapusan otomatis log login & log aktivitas lama
   ===================================================================== */

/**
 * Versi kebijakan privasi yang berlaku. NAIKKAN nilai ini setiap kali isi
 * halaman /kebijakan-privasi berubah secara material — seluruh pengguna akan
 * diminta menyetujui ulang pada login berikutnya.
 */
export const CONSENT_VERSION = "2026-10-17";

/** Apakah pengguna perlu (ulang) menyetujui kebijakan privasi. */
export function needsConsent(user: {
  consentedAt: Date | null;
  consentVersion: string | null;
}): boolean {
  return !user.consentedAt || user.consentVersion !== CONSENT_VERSION;
}

/** Catat persetujuan pengguna atas kebijakan privasi versi saat ini. */
export async function saveConsent(userId: number): Promise<Date> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { consentedAt: now, consentVersion: CONSENT_VERSION },
  });
  return now;
}

export type PurgeResult = {
  loginLogs: number;
  activityLogs: number;
  loginCutoff: string | null;
  activityCutoff: string | null;
};

function cutoff(days: number): Date | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() - Math.floor(days) * 24 * 60 * 60 * 1000);
}

/**
 * Hapus data yang melewati masa simpan (retensi):
 *  - log login   > `log.loginRetentionDays` hari (default 90)
 *  - log aktivitas > `log.activityRetentionDays` hari (default 365)
 * Nilai 0 = simpan tanpa batas (tidak dihapus).
 *
 * Dipanggil oleh tugas terjadwal (lihat `POST /api/cron/purge`) atau skrip.
 */
export async function purgeExpiredData(): Promise<PurgeResult> {
  const s = await getSettings();
  const loginCut = cutoff(Number(s["log.loginRetentionDays"]));
  const activityCut = cutoff(Number(s["log.activityRetentionDays"]));

  const [login, activity] = await Promise.all([
    loginCut
      ? prisma.loginLog.deleteMany({ where: { createdAt: { lt: loginCut } } })
      : Promise.resolve({ count: 0 }),
    activityCut
      ? prisma.activityLog.deleteMany({
          where: { createdAt: { lt: activityCut } },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    loginLogs: login.count,
    activityLogs: activity.count,
    loginCutoff: toIsoJakarta(loginCut),
    activityCutoff: toIsoJakarta(activityCut),
  };
}

/** Batas jumlah baris log per jenis pada ekspor (mencegah respons raksasa). */
const EXPORT_LOG_LIMIT = 5000;

/**
 * Metadata lokal eksplisit untuk respons JSON (`/api/health`, `/api/me/export`).
 * Lihat docs/iso/STANDAR-KODE-DATA.md: ISO 639-1 (bahasa), BCP 47 (locale),
 * ISO 3166-1 alpha-2 (negara), IANA tz + ISO 8601 (waktu). ISO 4217 N/A.
 */
export const LOCALE_METADATA = {
  language: "id",
  locale: "id-ID",
  country: "ID",
  timezone: APP_TIME_ZONE,
  utcOffset: "+07:00",
  dateFormat: "ISO 8601",
  currency: null,
  currencyNote:
    "SPMI tidak memproses data moneter; kode mata uang ISO 4217 tidak berlaku (N/A).",
} as const;

/** Nilai header `Content-Language` (ISO 639-1) untuk respons API. */
export const CONTENT_LANGUAGE = LOCALE_METADATA.language;

/**
 * Kumpulkan seluruh data pribadi milik pengguna untuk diekspor (JSON).
 * TIDAK menyertakan hash kata sandi, versi sesi, atau data pengguna lain.
 * Semua timestamp ISO 8601 dengan offset +07:00.
 */
export async function buildMyDataExport(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      unit: { select: { id: true, name: true, category: true } },
      memberships: {
        include: { unit: { select: { id: true, name: true, category: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!user) return null;
  const settings = await getSettings();

  const [loginLogs, activityLogs, documents, verified, progress] =
    await Promise.all([
      prisma.loginLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LOG_LIMIT,
      }),
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: EXPORT_LOG_LIMIT,
      }),
      prisma.document.findMany({
        where: { uploadedBy: userId },
        include: { cycle: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditResponse.findMany({
        where: { verifiedBy: userId },
        include: {
          unit: { select: { name: true } },
          cycle: { select: { name: true } },
        },
        orderBy: { verifiedAt: "desc" },
        take: EXPORT_LOG_LIMIT,
      }),
      prisma.unitProgress.findMany({
        where: { lastUpdatedBy: userId },
        include: {
          unit: { select: { name: true } },
          cycle: { select: { name: true } },
        },
      }),
    ]);

  return {
    meta: {
      format: "spmi-data-export",
      formatVersion: 1,
      generatedAt: toIsoJakarta(new Date()),
      timeZone: "Asia/Jakarta",
      note:
        "Salinan data pribadi Anda pada Sistem Informasi SPMI (UU 27/2022 tentang Pelindungan Data Pribadi). " +
        "Hash kata sandi dan data pengguna lain tidak disertakan.",
    },
    locale: LOCALE_METADATA,
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      ssoLinked: Boolean(user.ssoId),
      hasLocalPassword: Boolean(user.password),
      role: user.role,
      isActive: user.isActive,
      isUnitHead: user.isUnitHead,
      isLpmHead: user.isLpmHead,
      primaryUnit: user.unit,
      createdAt: toIsoJakarta(user.createdAt),
      updatedAt: toIsoJakarta(user.updatedAt),
    },
    consent: {
      consentedAt: toIsoJakarta(user.consentedAt),
      consentVersion: user.consentVersion,
      currentVersion: CONSENT_VERSION,
    },
    memberships: user.memberships.map((m) => ({
      unit: m.unit,
      role: m.role,
      createdAt: toIsoJakarta(m.createdAt),
    })),
    loginHistory: loginLogs.map((l) => ({
      at: toIsoJakarta(l.createdAt),
      success: l.success,
      method: l.method,
      ip: l.ip,
      userAgent: l.userAgent,
      message: l.message,
    })),
    activityHistory: activityLogs.map((a) => ({
      at: toIsoJakarta(a.createdAt),
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      detail: a.detail,
      ip: a.ip,
    })),
    uploadedDocuments: documents.map((d) => ({
      id: d.id,
      cycle: d.cycle.name,
      type: d.type,
      title: d.title,
      filePath: d.filePath,
      link: d.link,
      createdAt: toIsoJakarta(d.createdAt),
    })),
    verificationsPerformed: verified.map((r) => ({
      responseId: r.id,
      cycle: r.cycle.name,
      unit: r.unit.name,
      status: r.status,
      lpmNotes: r.lpmNotes,
      verifiedAt: toIsoJakarta(r.verifiedAt),
    })),
    progressUpdates: progress.map((p) => ({
      cycle: p.cycle.name,
      unit: p.unit.name,
      status: p.status,
      updatedAt: toIsoJakarta(p.updatedAt),
    })),
    retention: {
      loginLogDays: Number(settings["log.loginRetentionDays"]) || 0,
      activityLogDays: Number(settings["log.activityRetentionDays"]) || 0,
    },
  };
}

/** Ringkasan untuk log aktivitas (tanpa data pribadi utuh). */
export function exportAuditDetail(email: string): string {
  return `Ekspor data pribadi oleh ${maskEmail(email)}`;
}

export { toIsoDate };
