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

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Akhir hari (eksklusif) dari tanggal `endDate`, dihitung dalam WIB
 * (Asia/Jakarta, UTC+07:00) — tidak bergantung pada zona waktu server.
 * Kolom DATE dari MySQL dibaca Prisma sebagai 00:00 UTC pada tanggal itu,
 * yang dalam WIB tetap jatuh pada tanggal yang sama.
 */
export function endOfCycleDay(endDate: Date): Date {
  const wib = new Date(endDate.getTime() + WIB_OFFSET_MS);
  // Awal hari berikutnya (00:00 WIB) = batas eksklusif.
  const nextMidnightUtc = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate() + 1
  );
  return new Date(nextMidnightUtc - WIB_OFFSET_MS);
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
