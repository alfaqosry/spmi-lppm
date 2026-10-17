import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { isQuestionForUnit } from "@/lib/scope";

/* =====================================================================
   Tipe data laporan
   ===================================================================== */

export type ReportUnitRow = {
  unit: string;
  category: string;
  total: number;
  answered: number;
  ya: number;
  tidak: number;
  kepatuhan: number;
  verified: number;
  revision: number;
  progress: number;
};

export type ReportStandardRow = {
  code: string;
  title: string;
  category: string;
  answered: number;
  total: number;
  ya: number;
  kepatuhan: number;
};

export type ReportCategoryRow = {
  category: string;
  units: number;
  answered: number;
  total: number;
  ya: number;
  kepatuhan: number;
};

export type ReportFindingRow = {
  unit: string;
  standard: string;
  question: string;
  answer: string;
  reason: string;
  status: string;
  rtl: string;
  notes: string;
};

export type ReportDetailRow = {
  unit: string;
  category: string;
  standard: string;
  question: string;
  answer: string;
  status: string;
  reason: string;
  evidence: string;
  notes: string;
  rtl: string;
  verifier: string;
};

/** Penandatangan dokumen laporan (Ketua LPM). */
export type Signatory = {
  name: string;
  title: string;
};

export type ReportData = {
  cycle: { name: string; startDate: Date; endDate: Date; isActive: boolean };
  generatedAt: Date;
  /** Ketua LPM penandatangan laporan (null bila belum ditunjuk). */
  signatory: Signatory | null;
  summary: {
    units: number;
    standards: number;
    questions: number;
    totalPossible: number;
    answered: number;
    ya: number;
    tidak: number;
    verified: number;
    revision: number;
    pending: number;
    kepatuhan: number;
    progress: number;
  };
  perUnit: ReportUnitRow[];
  perStandard: ReportStandardRow[];
  perCategory: ReportCategoryRow[];
  findings: ReportFindingRow[];
  detail: ReportDetailRow[];
};

const ANSWER_LABEL: Record<string, string> = { ya: "Ya", tidak: "Tidak" };
const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Verifikasi",
  verified: "Terverifikasi",
  revision: "Perlu Revisi",
};

/** Nama standar pertanyaan; fallback "Tanpa Standar". */
function standardOf(standard: { name: string } | null | undefined) {
  return standard?.name?.trim() || "Tanpa Standar";
}

/**
 * Teks aman untuk PDF: buang karakter kontrol / bidi override (dapat merusak
 * tata letak atau menyamarkan isi), rapikan spasi, dan batasi panjang agar
 * input pengguna tidak dapat merusak layout laporan.
 */
export function pdfText(value: string | null | undefined, max = 2000): string {
  if (!value) return "";
  const cleaned = String(value)
    .normalize("NFC")
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,
      ""
    )
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

/* =====================================================================
   Pengumpulan & perhitungan data laporan
   ===================================================================== */

/**
 * Ambil Ketua LPM yang ditunjuk sebagai penandatangan laporan.
 * Bila belum ada akun yang ditandai, kembalikan null (blok tanda tangan
 * tetap dicetak dengan nama kosong agar bisa ditandatangani manual).
 */
export async function getLpmSignatory(): Promise<Signatory | null> {
  const head = await prisma.user.findFirst({
    where: { isLpmHead: true, isActive: true },
    select: { name: true },
  });
  if (!head) return null;
  return { name: pdfText(head.name, 120), title: "Ketua LPM" };
}

export async function buildReportData(
  cycleId: number
): Promise<ReportData | null> {
  const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return null;

  const [questions, units, responses] = await Promise.all([
    prisma.auditQuestion.findMany({
      where: { cycleId },
      include: { standard: { select: { name: true, order: true } } },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.auditResponse.findMany({
      where: { cycleId },
      include: {
        unit: true,
        question: { include: { standard: { select: { name: true } } } },
        verifier: true,
      },
    }),
  ]);

  const relevantCount = (unit: { id: number; category: string }) =>
    questions.filter((q) => isQuestionForUnit(q, unit)).length;

  const totalQuestions = questions.length;
  // Total penilaian = jumlah pertanyaan RELEVAN untuk masing-masing unit.
  const totalPossible = units.reduce((a, u) => a + relevantCount(u), 0);

  const answered = responses.filter((r) => r.answer).length;
  const ya = responses.filter((r) => r.answer === "ya").length;
  const tidak = responses.filter((r) => r.answer === "tidak").length;
  const verified = responses.filter((r) => r.status === "verified").length;
  const revision = responses.filter((r) => r.status === "revision").length;

  /* ---- Rekapitulasi per unit ---- */
  const perUnit: ReportUnitRow[] = units.map((u) => {
    const rs = responses.filter((r) => r.unitId === u.id);
    const a = rs.filter((r) => r.answer).length;
    const y = rs.filter((r) => r.answer === "ya").length;
    const t = rs.filter((r) => r.answer === "tidak").length;
    const totalUnit = relevantCount(u);
    return {
      unit: pdfText(u.name, 160),
      category: pdfText(u.category, 80),
      total: totalUnit,
      answered: a,
      ya: y,
      tidak: t,
      kepatuhan: pct(y, a),
      verified: rs.filter((r) => r.status === "verified").length,
      revision: rs.filter((r) => r.status === "revision").length,
      progress: pct(a, totalUnit),
    };
  });

  /* ---- Kepatuhan per standar (induk butir pertanyaan) ---- */
  const standardMap = new Map<
    string,
    { qIds: number[]; total: number; order: number }
  >();
  for (const q of questions) {
    const key = standardOf(q.standard);
    const entry = standardMap.get(key) ?? {
      qIds: [],
      total: 0,
      order: q.standard?.order ?? 0,
    };
    entry.qIds.push(q.id);
    entry.total += units.filter((u) => isQuestionForUnit(q, u)).length;
    standardMap.set(key, entry);
  }
  const perStandard: ReportStandardRow[] = Array.from(standardMap.entries())
    .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
    .map(([name, v]) => {
      const idSet = new Set(v.qIds);
      const rs = responses.filter(
        (r) => idSet.has(r.auditQuestionId) && r.answer
      );
      const y = rs.filter((r) => r.answer === "ya").length;
      return {
        code: pdfText(name, 160),
        title: pdfText(name, 160),
        category: "-",
        answered: rs.length,
        total: v.total,
        ya: y,
        kepatuhan: pct(y, rs.length),
      };
    });

  /* ---- Kepatuhan per kategori unit ---- */
  const catMap = new Map<
    string,
    { units: number; answered: number; total: number; ya: number }
  >();
  for (const u of units) {
    const entry = catMap.get(u.category) ?? {
      units: 0,
      answered: 0,
      total: 0,
      ya: 0,
    };
    entry.units += 1;
    const rs = responses.filter((r) => r.unitId === u.id && r.answer);
    entry.answered += rs.length;
    entry.total += relevantCount(u);
    entry.ya += rs.filter((r) => r.answer === "ya").length;
    catMap.set(u.category, entry);
  }
  const perCategory: ReportCategoryRow[] = Array.from(catMap.entries()).map(
    ([category, v]) => ({
      category: pdfText(category, 80),
      units: v.units,
      answered: v.answered,
      total: v.total,
      ya: v.ya,
      kepatuhan: pct(v.ya, v.answered),
    })
  );

  /* ---- Temuan: jawaban "Tidak" atau perlu revisi ---- */
  const findings: ReportFindingRow[] = responses
    .filter((r) => r.answer === "tidak" || r.status === "revision")
    .map((r) => ({
      unit: pdfText(r.unit.name, 160),
      standard: pdfText(standardOf(r.question.standard), 160),
      question: pdfText(r.question.questionText),
      answer: r.answer ? (ANSWER_LABEL[r.answer] ?? r.answer) : "-",
      reason: pdfText(r.reason),
      status: STATUS_LABEL[r.status] ?? r.status,
      rtl: pdfText(r.rtl),
      notes: pdfText(r.lpmNotes),
    }))
    .sort(
      (a, b) =>
        a.unit.localeCompare(b.unit) || a.standard.localeCompare(b.standard)
    );

  /* ---- Detail jawaban per butir ---- */
  const respMap = new Map(
    responses.map((r) => [`${r.unitId}:${r.auditQuestionId}`, r])
  );
  const detail: ReportDetailRow[] = questions.flatMap((q) =>
    units
      .filter((u) => isQuestionForUnit(q, u))
      .map((u) => {
        const r = respMap.get(`${u.id}:${q.id}`);
        return {
          unit: pdfText(u.name, 160),
          category: pdfText(u.category, 80),
          standard: pdfText(standardOf(q.standard), 160),
          question: pdfText(q.questionText),
          answer: r?.answer ? (ANSWER_LABEL[r.answer] ?? r.answer) : "-",
          status: r ? (STATUS_LABEL[r.status] ?? r.status) : "Belum Diisi",
          reason: pdfText(r?.reason),
          evidence: pdfText(
            [r?.evidenceLink, r?.evidenceFile].filter(Boolean).join(" | "),
            600
          ),
          notes: pdfText(r?.lpmNotes),
          rtl: pdfText(r?.rtl),
          verifier: pdfText(r?.verifier?.name, 160),
        };
      })
  );

  const signatory = await getLpmSignatory();

  return {
    cycle: {
      name: pdfText(cycle.name, 80),
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      isActive: cycle.isActive,
    },
    generatedAt: new Date(),
    signatory,
    summary: {
      units: units.length,
      standards: standardMap.size,
      questions: totalQuestions,
      totalPossible,
      answered,
      ya,
      tidak,
      verified,
      revision,
      pending: responses.filter((r) => r.status === "pending").length,
      kepatuhan: pct(ya, answered),
      progress: pct(answered, totalPossible),
    },
    perUnit,
    perStandard,
    perCategory,
    findings,
    detail,
  };
}

export { formatDate };

/* =====================================================================
   Laporan PER UNIT (format tabel observasi/visitasi)
   ===================================================================== */

/** Satu butir pertanyaan dalam laporan per unit. */
export type UnitReportItem = {
  /** Teks pertanyaan. */
  question: string;
  /** Hasil Observasi/Audit/Visitasi — alasan (Tidak) atau catatan LPM. */
  observation: string;
  /** Jawaban "Ya". */
  ya: boolean;
  /** Jawaban "Tidak". */
  tidak: boolean;
  /** Catatan khusus — RTL (rencana tindak lanjut) auditee. */
  notes: string;
};

/** Kelompok butir di bawah satu standar. */
export type UnitReportStandard = {
  standard: string;
  items: UnitReportItem[];
};

export type UnitReportData = {
  cycle: { name: string; startDate: Date; endDate: Date; isActive: boolean };
  generatedAt: Date;
  /** Ketua LPM penandatangan laporan (null bila belum ditunjuk). */
  signatory: Signatory | null;
  unit: { id: number; name: string; category: string };
  summary: {
    total: number;
    answered: number;
    ya: number;
    tidak: number;
    kepatuhan: number;
    progress: number;
  };
  standards: UnitReportStandard[];
};

/** Bangun data laporan untuk SATU unit pada siklus tertentu. */
export async function buildUnitReportData(
  cycleId: number,
  unitId: number
): Promise<UnitReportData | null> {
  const cycle = await prisma.auditCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return null;

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return null;

  const questions = await prisma.auditQuestion.findMany({
    where: { cycleId },
    include: { standard: { select: { name: true, order: true } } },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  const responses = await prisma.auditResponse.findMany({
    where: { cycleId, unitId },
  });
  const respByQ = new Map(responses.map((r) => [r.auditQuestionId, r]));

  // Hanya pertanyaan yang relevan untuk unit ini.
  const relevant = questions.filter((q) =>
    isQuestionForUnit(q, { id: unit.id, category: unit.category })
  );

  // Kelompokkan per standar (urut sesuai order standar).
  const map = new Map<
    number,
    { standard: string; order: number; items: UnitReportItem[] }
  >();
  for (const q of relevant) {
    const r = respByQ.get(q.id);
    const entry = map.get(q.standardId) ?? {
      standard: pdfText(standardOf(q.standard), 160),
      order: q.standard?.order ?? 0,
      items: [],
    };
    // Kolom observasi: gabungan alasan (Tidak) + catatan LPM.
    const observation = pdfText(
      [r?.reason, r?.lpmNotes]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(" — "),
      4000
    );
    entry.items.push({
      question: pdfText(q.questionText),
      observation,
      ya: r?.answer === "ya",
      tidak: r?.answer === "tidak",
      notes: pdfText(r?.rtl),
    });
    map.set(q.standardId, entry);
  }

  const standards: UnitReportStandard[] = Array.from(map.values())
    .sort((a, b) => a.order - b.order || a.standard.localeCompare(b.standard))
    .map((s) => ({ standard: s.standard, items: s.items }));

  const answered = relevant.filter((q) => respByQ.get(q.id)?.answer).length;
  const ya = relevant.filter((q) => respByQ.get(q.id)?.answer === "ya").length;
  const tidak = relevant.filter(
    (q) => respByQ.get(q.id)?.answer === "tidak"
  ).length;

  const signatory = await getLpmSignatory();

  return {
    cycle: {
      name: pdfText(cycle.name, 80),
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      isActive: cycle.isActive,
    },
    generatedAt: new Date(),
    signatory,
    unit: {
      id: unit.id,
      name: pdfText(unit.name, 160),
      category: pdfText(unit.category, 80),
    },
    summary: {
      total: relevant.length,
      answered,
      ya,
      tidak,
      kepatuhan: pct(ya, answered),
      progress: pct(answered, relevant.length),
    },
    standards,
  };
}
