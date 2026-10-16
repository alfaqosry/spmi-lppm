/**
 * Utilitas status siklus audit (SPMI).
 *
 * Sebuah siklus dianggap "terbuka" (auditee masih boleh mengisi jawaban)
 * HANYA jika:
 *   1. Ditandai aktif oleh admin (`isActive === true`), DAN
 *   2. Belum melewati batas waktu (`endDate`).
 *
 * `endDate` bertipe DATE (tanpa jam), sehingga batas akhir dihitung inklusif
 * sampai berakhirnya hari tersebut (akhir hari `endDate`).
 */

export type CycleWindow = {
  isActive: boolean;
  endDate: Date;
};

/** Akhir hari (eksklusif) dari tanggal `endDate`. */
export function endOfCycleDay(endDate: Date): Date {
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  // Batas inklusif sampai akhir hari: tambah 1 hari (batas eksklusif).
  end.setDate(end.getDate() + 1);
  return end;
}

/** Apakah siklus masih dalam masa pengisian (aktif & belum lewat batas waktu). */
export function isCycleOpen(
  cycle: CycleWindow | null | undefined,
  now: Date = new Date()
): boolean {
  if (!cycle) return false;
  if (!cycle.isActive) return false;
  return now.getTime() < endOfCycleDay(cycle.endDate).getTime();
}

/** Alasan siklus tertutup, untuk pesan ke pengguna. */
export function cycleClosedReason(
  cycle: CycleWindow | null | undefined,
  now: Date = new Date()
): string | null {
  if (!cycle) return "Siklus audit tidak ditemukan.";
  if (!cycle.isActive)
    return "Siklus audit telah dinonaktifkan oleh LPM. Pengisian jawaban tidak dapat dilakukan.";
  if (now.getTime() >= endOfCycleDay(cycle.endDate).getTime())
    return "Batas waktu pengisian siklus audit telah berakhir. Pengisian jawaban tidak dapat dilakukan.";
  return null;
}
