/**
 * Helper murni ringkasan dampak penghapusan siklus (HE-04) dan
 * pencocokan konfirmasi ketik-nama.
 */

export type CycleImpactCounts = {
  /** Unit yang memiliki progres/jawaban pada siklus ini. */
  units: number;
  responses: number;
  evidence: number;
  standards: number;
  questions: number;
  documents: number;
};

const nf = new Intl.NumberFormat("id-ID");
const n = (v: number) => nf.format(v);

/** Daftar butir dampak hapus siklus, dalam bahasa Indonesia. */
export function cycleDeleteImpact(c: CycleImpactCounts): string[] {
  return [
    `${n(c.responses)} jawaban audit dari ${n(c.units)} unit` +
      (c.evidence > 0 ? ` (termasuk ${n(c.evidence)} berkas bukti)` : ""),
    `${n(c.standards)} standar dan ${n(c.questions)} butir pertanyaan`,
    `${n(c.documents)} dokumen siklus`,
    `Progres pengisian seluruh unit pada siklus ini`,
  ];
}

/** Konfirmasi ketik-nama: cocok persis setelah spasi tepi dan ganda dirapikan. */
export function matchesConfirmation(typed: string, expected: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  const want = norm(expected);
  return want.length > 0 && norm(typed) === want;
}
