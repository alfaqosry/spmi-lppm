import { CalendarClock, Lock } from "lucide-react";
import type { CycleDeadline } from "@/components/audit/audit-helpers";

/**
 * HE-01: batas waktu pengisian siklus untuk auditee (komponen server).
 * Tiga keadaan: terbuka (netral), segera berakhir ≤ 7 hari (peringatan),
 * dan ditutup (lewat batas / dinonaktifkan LPM).
 */
export function DeadlineBanner({ deadline }: { deadline: CycleDeadline }) {
  if (deadline.state === "closed") {
    return (
      <div
        role="status"
        className="mb-4 flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      >
        <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Periode pengisian ditutup</p>
          <p className="mt-0.5 text-xs">
            Batas pengisian: {deadline.label}.{" "}
            {deadline.closedReason ??
              "Pengisian jawaban tidak dapat dilakukan."}{" "}
            Jawaban yang sudah tersimpan tetap dapat dilihat.
          </p>
        </div>
      </div>
    );
  }

  const soon = deadline.state === "soon";
  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        soon
          ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
          : "border-indigo-400/25 bg-indigo-500/10 text-slate-200"
      }`}
    >
      <CalendarClock
        className={`mt-0.5 h-5 w-5 shrink-0 ${soon ? "" : "text-indigo-300"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          Batas pengisian: <time>{deadline.label}</time>
        </p>
        <p className="mt-0.5 text-xs">
          {soon
            ? `Segera berakhir — ${deadline.remainingText}. Simpan setiap jawaban sebelum batas waktu; setelahnya pengisian otomatis ditutup.`
            : `Masih ${deadline.daysLeft} hari lagi. Setelah batas waktu, pengisian otomatis ditutup.`}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
          soon
            ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
            : "border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
        }`}
      >
        {deadline.daysLeft === 0
          ? "Hari terakhir"
          : `${deadline.daysLeft} hari lagi`}
      </span>
    </div>
  );
}
