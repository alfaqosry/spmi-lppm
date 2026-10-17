import { endOfCycleDay } from "@/lib/cycles";
import { APP_TIME_ZONE } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ambang peringatan batas waktu (H-7, HE-01). */
export const DEADLINE_WARNING_DAYS = 7;

export type DeadlineInfo = {
  /** open = masih lama; warning = ≤ 7 hari; closed = lewat batas / nonaktif. */
  state: "open" | "warning" | "closed";
  /** Mis. "Jumat, 30 Oktober 2026 23.59 WIB". */
  deadlineLabel: string;
  /** Sisa hari kalender (WIB) hingga hari batas; 0 = hari terakhir; null bila tutup. */
  daysLeft: number | null;
  /** Mis. "sisa 14 hari", "hari terakhir", "pengisian ditutup". */
  remainingLabel: string;
  closedReason: "inactive" | "expired" | null;
};

/** Indeks hari kalender WIB (jumlah hari sejak epoch). */
function wibDayIndex(ms: number): number {
  return Math.floor((ms + WIB_OFFSET_MS) / DAY_MS);
}

/** "Jumat, 30 Oktober 2026 23.59 WIB" — menit terakhir hari `endDate` (WIB). */
export function formatDeadline(endDate: Date): string {
  const last = new Date(endOfCycleDay(endDate).getTime() - 1);
  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(last);
  return `${date} 23.59 WIB`;
}

/** Ringkasan batas pengisian siklus untuk auditee (HE-01). */
export function describeDeadline(
  cycle: { isActive: boolean; endDate: Date },
  now: Date = new Date()
): DeadlineInfo {
  const deadlineLabel = formatDeadline(cycle.endDate);
  const end = endOfCycleDay(cycle.endDate).getTime();
  if (!cycle.isActive || now.getTime() >= end) {
    return {
      state: "closed",
      deadlineLabel,
      daysLeft: null,
      remainingLabel: "pengisian ditutup",
      closedReason: cycle.isActive ? "expired" : "inactive",
    };
  }
  const daysLeft = wibDayIndex(end - 1) - wibDayIndex(now.getTime());
  return {
    state: daysLeft <= DEADLINE_WARNING_DAYS ? "warning" : "open",
    deadlineLabel,
    daysLeft,
    remainingLabel:
      daysLeft === 0
        ? "hari terakhir"
        : daysLeft === 1
          ? "sisa 1 hari (berakhir besok)"
          : `sisa ${daysLeft} hari`,
    closedReason: null,
  };
}
