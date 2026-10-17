/**
 * Helper murni (tanpa React/DB) untuk ruang kerja audit — dapat diuji unit.
 *
 * - `cycleDeadline`        : HE-01 batas pengisian siklus (WIB) + sisa hari.
 * - `isResponseDirty`      : HE-08 deteksi input jawaban yang belum disimpan.
 * - `standardDeleteImpact` : HE-03 dampak nyata penghapusan standar.
 */
import { APP_TIME_ZONE } from "@/lib/format";
import { cycleClosedReason, endOfCycleDay, isCycleOpen } from "@/lib/cycles";

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ambang peringatan "segera berakhir" (hari kalender, inklusif). */
export const DEADLINE_WARN_DAYS = 7;

export type CycleDeadline = {
  /** mis. "Sabtu, 31 Oktober 2026 23.59 WIB" */
  label: string;
  /** Sisa hari kalender WIB (0 = hari terakhir); null bila sudah ditutup. */
  daysLeft: number | null;
  state: "open" | "soon" | "closed";
  /** Teks sisa waktu ringkas, mis. "sisa 5 hari" / "hari terakhir". */
  remainingText: string | null;
  closedReason: string | null;
};

/** Nomor hari kalender WIB (hari sejak epoch) untuk sebuah instan. */
function wibDayNumber(d: Date): number {
  return Math.floor((d.getTime() + WIB_OFFSET_MS) / DAY_MS);
}

/** Label batas pengisian: akhir hari `endDate` (23.59 WIB). */
export function formatCycleDeadline(endDate: Date): string {
  const datePart = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(endDate);
  return `${datePart} 23.59 WIB`;
}

export function cycleDeadline(
  cycle: { isActive: boolean; endDate: Date },
  now: Date = new Date()
): CycleDeadline {
  const label = formatCycleDeadline(cycle.endDate);
  if (!isCycleOpen(cycle, now)) {
    return {
      label,
      daysLeft: null,
      state: "closed",
      remainingText: null,
      closedReason: cycleClosedReason(cycle, now),
    };
  }
  // Hari terakhir (WIB) = hari sebelum batas eksklusif endOfCycleDay.
  const lastDay = wibDayNumber(
    new Date(endOfCycleDay(cycle.endDate).getTime() - 1)
  );
  const daysLeft = Math.max(0, lastDay - wibDayNumber(now));
  return {
    label,
    daysLeft,
    state: daysLeft <= DEADLINE_WARN_DAYS ? "soon" : "open",
    remainingText: daysLeft === 0 ? "hari terakhir" : `sisa ${daysLeft} hari`,
    closedReason: null,
  };
}

/* ------------------------------------------------------------------------ */

export type ResponseBaseline = {
  answer: "ya" | "tidak" | null;
  evidenceLink: string | null;
  reason: string | null;
};

/**
 * Nilai formulir saat ini. Field bernilai `null` berarti tidak sedang
 * dirender (mis. "reason" saat jawaban "Ya") sehingga tidak dibandingkan.
 */
export type ResponseCurrent = {
  answer: string | null;
  evidenceLink: string | null;
  reason: string | null;
  hasFile: boolean;
};

const norm = (v: string | null | undefined) => (v ?? "").trim();

/** Apakah isian jawaban berbeda dari yang tersimpan di server. */
export function isResponseDirty(
  baseline: ResponseBaseline | undefined,
  current: ResponseCurrent
): boolean {
  const savedAnswer = baseline?.answer ?? "";
  const answer = current.answer ?? "";
  if (answer !== savedAnswer) return true;
  if (current.hasFile) return true;
  if (
    current.evidenceLink !== null &&
    norm(current.evidenceLink) !== norm(baseline?.evidenceLink)
  )
    return true;
  if (
    current.reason !== null &&
    norm(current.reason) !== norm(baseline?.reason)
  )
    return true;
  return false;
}

/* ------------------------------------------------------------------------ */

type ImpactQuestion = {
  id: number;
  standardId: number;
  scopeType: string;
  scopeCategory: string | null;
  scopeUnitId: number | null;
};

type ImpactResponse = {
  auditQuestionId: number;
  unitId: number;
  evidenceFile: string | null;
};

export type StandardDeleteImpact = {
  questionCount: number;
  /** Label cakupan yang terdampak, mis. ["Umum", "Kategori Biro", "Unit X"]. */
  scopes: string[];
  responseCount: number;
  unitCount: number;
  evidenceCount: number;
};

/** Dampak penghapusan satu standar di SELURUH kategori/unit siklus. */
export function standardDeleteImpact(
  standardId: number,
  questions: ImpactQuestion[],
  responses: ImpactResponse[],
  unitNameById: Map<number, string> = new Map()
): StandardDeleteImpact {
  const qs = questions.filter((q) => q.standardId === standardId);
  const qIds = new Set(qs.map((q) => q.id));
  const scopes = new Map<string, string>();
  for (const q of qs) {
    if (q.scopeType === "category") {
      const c = q.scopeCategory ?? "";
      scopes.set(`c:${c}`, `Kategori ${c}`);
    } else if (q.scopeType === "unit") {
      const id = q.scopeUnitId ?? 0;
      scopes.set(`u:${id}`, `Unit ${unitNameById.get(id) ?? `#${id}`}`);
    } else {
      scopes.set("all", "Umum");
    }
  }
  const rs = responses.filter((r) => qIds.has(r.auditQuestionId));
  return {
    questionCount: qs.length,
    scopes: Array.from(scopes.values()),
    responseCount: rs.length,
    unitCount: new Set(rs.map((r) => r.unitId)).size,
    evidenceCount: rs.filter((r) => r.evidenceFile).length,
  };
}
