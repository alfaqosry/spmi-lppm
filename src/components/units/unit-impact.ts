/** Helper murni ringkasan dampak penghapusan unit (HE-05). */

export type UnitImpactCounts = {
  memberships: number;
  responses: number;
  evidence: number;
  progress: number;
  scopedQuestions: number;
};

const nf = new Intl.NumberFormat("id-ID");
const n = (v: number) => nf.format(v);

/** Daftar butir dampak hapus unit, dalam bahasa Indonesia. */
export function unitDeleteImpact(u: UnitImpactCounts): string[] {
  const lines = [
    `${n(u.memberships)} penempatan akun pada unit ini (akunnya tetap ada, tetapi kehilangan akses ke unit ini)`,
    `${n(u.responses)} jawaban audit di semua siklus` +
      (u.evidence > 0 ? ` (termasuk ${n(u.evidence)} berkas bukti)` : ""),
    `Progres pengisian unit pada ${n(u.progress)} siklus`,
  ];
  if (u.scopedQuestions > 0) {
    lines.push(
      `${n(u.scopedQuestions)} butir pertanyaan khusus unit ini kehilangan unit sasarannya`
    );
  }
  return lines;
}
