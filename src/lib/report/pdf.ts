import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ReportData } from "@/lib/report/data";

/* Palet warna (RGB) */
const INDIGO: [number, number, number] = [79, 70, 229];
const SLATE: [number, number, number] = [51, 65, 85];
const LIGHT: [number, number, number] = [241, 245, 249];
const EMERALD: [number, number, number] = [16, 185, 129];
const ROSE: [number, number, number] = [225, 29, 72];
const AMBER: [number, number, number] = [217, 119, 6];

const MARGIN = 40;
const PAGE_W = 595.28; // A4 portrait pt
const PAGE_H = 841.89;

function tone(v: number): [number, number, number] {
  if (v >= 80) return EMERALD;
  if (v >= 60) return AMBER;
  return ROSE;
}

/** Gambar header (judul + info siklus) di halaman saat ini. */
function drawHeader(doc: jsPDF, data: ReportData, sectionTitle: string) {
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, PAGE_W, 68, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Laporan Audit Mutu Internal (SPMI)", MARGIN, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Siklus: ${data.cycle.name}  •  ${formatDate(data.cycle.startDate)} – ${formatDate(
      data.cycle.endDate
    )}${data.cycle.isActive ? "  •  AKTIF" : ""}`,
    MARGIN,
    47
  );
  doc.text(
    `Universitas Pahlawan — Lembaga Penjaminan Mutu  •  Dicetak: ${formatDateTime(
      data.generatedAt
    )}`,
    MARGIN,
    59
  );

  // Judul bagian
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(sectionTitle, MARGIN, 92);
  doc.setDrawColor(...INDIGO);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, 98, MARGIN + 120, 98);
  return 112;
}

/** Footer dengan nomor halaman di seluruh dokumen. */
function drawFooters(doc: jsPDF, data: ReportData) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 132, 150);
    doc.text(
      `Sistem Penjaminan Mutu Internal — ${data.cycle.name}`,
      MARGIN,
      PAGE_H - 22
    );
    doc.text(`Halaman ${i} dari ${pages}`, PAGE_W - MARGIN, PAGE_H - 22, {
      align: "right",
    });
  }
}

/** Halaman sampul ringkas. */
function drawCover(doc: jsPDF, data: ReportData) {
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("UNIVERSITAS PAHLAWAN", MARGIN, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Lembaga Penjaminan Mutu", MARGIN, 136);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("LAPORAN", MARGIN, 230);
  doc.text("AUDIT MUTU INTERNAL", MARGIN, 266);

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.line(MARGIN, 284, MARGIN + 90, 284);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(`Siklus: ${data.cycle.name}`, MARGIN, 320);
  doc.setFontSize(11);
  doc.text(
    `Periode: ${formatDate(data.cycle.startDate)} – ${formatDate(data.cycle.endDate)}`,
    MARGIN,
    340
  );

  // Kotak ringkasan angka
  const boxY = 400;
  const boxW = (PAGE_W - MARGIN * 2 - 3 * 12) / 4;
  const items = [
    { label: "Unit Diaudit", value: String(data.summary.units) },
    { label: "Jumlah Standar", value: String(data.summary.standards) },
    { label: "Butir Penilaian", value: String(data.summary.questions) },
    { label: "Kepatuhan", value: `${data.summary.kepatuhan}%` },
  ];
  items.forEach((it, i) => {
    const x = MARGIN + i * (boxW + 12);
    doc.setFillColor(255, 255, 255);
    doc.setGState(doc.GState({ opacity: 0.14 }));
    doc.roundedRect(x, boxY, boxW, 74, 8, 8, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(it.value, x + boxW / 2, boxY + 34, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(it.label, x + boxW / 2, boxY + 52, { align: "center" });
  });

  doc.setFontSize(9);
  doc.text(
    `Dicetak pada ${formatDateTime(data.generatedAt)}`,
    MARGIN,
    PAGE_H - 60
  );

  /* Blok tanda tangan pengesahan (Ketua LPM). */
  const sigW = 190;
  const sigX = PAGE_W - MARGIN - sigW;
  let sy = PAGE_H - 260;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Disahkan oleh,", sigX, sy);
  sy += 16;
  doc.setFont("helvetica", "bold");
  doc.text(data.signatory?.title ?? "Ketua LPM", sigX, sy);
  sy += 62;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.8);
  doc.line(sigX, sy, sigX + sigW, sy);
  sy += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.signatory?.name ?? "………………………………", sigX, sy);
  if (data.signatory) {
    sy += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Nama & Tanda Tangan", sigX, sy);
  }
}

/* =====================================================================
   Generator utama
   ===================================================================== */

export function buildReportPdf(data: ReportData): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  drawCover(doc, data);

  /* ---------- 1. Ringkasan Eksekutif ---------- */
  doc.addPage();
  let y = drawHeader(doc, data, "1. Ringkasan Eksekutif");

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, textColor: SLATE },
    headStyles: {
      fillColor: INDIGO,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    head: [["Indikator", "Nilai", "Keterangan"]],
    body: [
      [
        "Unit yang diaudit",
        String(data.summary.units),
        "Jumlah unit dalam siklus",
      ],
      ["Standar audit", String(data.summary.standards), "Standar yang dinilai"],
      ["Butir pertanyaan", String(data.summary.questions), "Butir per standar"],
      ["Total penilaian", String(data.summary.totalPossible), "Butir × unit"],
      [
        "Jawaban terisi",
        `${data.summary.answered} (${data.summary.progress}%)`,
        "Progres pengisian",
      ],
      ['Jawaban "Ya"', String(data.summary.ya), "Memenuhi standar"],
      ['Jawaban "Tidak"', String(data.summary.tidak), "Belum memenuhi standar"],
      ["Terverifikasi", String(data.summary.verified), "Diverifikasi LPM"],
      ["Perlu revisi", String(data.summary.revision), "Menunggu perbaikan"],
      [
        "Menunggu verifikasi",
        String(data.summary.pending),
        "Belum diverifikasi",
      ],
      [
        "Tingkat kepatuhan",
        `${data.summary.kepatuhan}%`,
        'Persentase jawaban "Ya" dari yang terisi',
      ],
    ],
  });

  /* ---------- 2. Kepatuhan per Unit ---------- */
  doc.addPage();
  y = drawHeader(doc, data, "2. Laporan Kepatuhan per Unit");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 4, textColor: SLATE },
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: LIGHT },
    head: [
      [
        "No",
        "Unit",
        "Kategori",
        "Progres",
        "Terjawab",
        "Ya",
        "Tidak",
        "Kepatuhan",
        "Revisi",
      ],
    ],
    body: data.perUnit.map((u, i) => [
      String(i + 1),
      u.unit,
      u.category,
      `${u.progress}%`,
      String(u.answered),
      String(u.ya),
      String(u.tidak),
      `${u.kepatuhan}%`,
      String(u.revision),
    ]),
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 7) {
        const v = parseInt(String(hook.cell.raw), 10) || 0;
        hook.cell.styles.textColor = tone(v);
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  /* ---------- 3. Kepatuhan per Kategori ---------- */
  doc.addPage();
  y = drawHeader(doc, data, "3. Laporan Kepatuhan per Kategori Unit");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, textColor: SLATE },
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255] },
    head: [["Kategori", "Jumlah Unit", "Terjawab", "Total", "Ya", "Kepatuhan"]],
    body: data.perCategory.map((c) => [
      c.category,
      String(c.units),
      String(c.answered),
      String(c.total),
      String(c.ya),
      `${c.kepatuhan}%`,
    ]),
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 5) {
        const v = parseInt(String(hook.cell.raw), 10) || 0;
        hook.cell.styles.textColor = tone(v);
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  /* ---------- 4. Kepatuhan per Standar ---------- */
  doc.addPage();
  y = drawHeader(doc, data, "4. Laporan Kepatuhan per Standar");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 4, textColor: SLATE },
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 0: { cellWidth: 150 } },
    head: [["Standar", "Terjawab", "Total", "Ya", "Kepatuhan"]],
    body: data.perStandard.map((s) => [
      s.title,
      String(s.answered),
      String(s.total),
      String(s.ya),
      `${s.kepatuhan}%`,
    ]),
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 4) {
        const v = parseInt(String(hook.cell.raw), 10) || 0;
        hook.cell.styles.textColor = tone(v);
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  /* ---------- 5. Daftar Temuan & RTL ---------- */
  doc.addPage();
  y = drawHeader(doc, data, "5. Daftar Temuan & Rencana Tindak Lanjut");
  if (data.findings.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...EMERALD);
    doc.text(
      'Tidak ditemukan ketidaksesuaian (tidak ada jawaban "Tidak" maupun revisi).',
      MARGIN,
      y + 6
    );
  } else {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        textColor: SLATE,
        valign: "top",
      },
      headStyles: { fillColor: ROSE, textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 78 },
        1: { cellWidth: 78 },
        2: { cellWidth: 150 },
      },
      head: [["Unit", "Standar", "Butir Temuan", "Alasan", "RTL", "Status"]],
      body: data.findings.map((f) => [
        f.unit,
        f.standard,
        f.question,
        f.reason || "-",
        f.rtl || "-",
        f.status,
      ]),
    });
  }

  /* ---------- 6. Detail Jawaban per Butir ---------- */
  doc.addPage();
  y = drawHeader(doc, data, "6. Detail Jawaban per Butir");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 6.8, cellPadding: 3, textColor: SLATE, valign: "top" },
    headStyles: { fillColor: SLATE, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 56 },
      2: { cellWidth: 128 },
      3: { cellWidth: 24, halign: "center" },
      4: { cellWidth: 48 },
      5: { cellWidth: 66 },
      6: { cellWidth: 66 },
      7: { cellWidth: 66 },
    },
    head: [
      [
        "Unit",
        "Standar",
        "Pertanyaan",
        "Jwb",
        "Status",
        "Bukti",
        "Catatan",
        "RTL",
      ],
    ],
    body: data.detail.map((d) => [
      d.unit,
      d.standard,
      d.question,
      d.answer,
      d.status,
      d.evidence || "-",
      d.notes || "-",
      d.rtl || "-",
    ]),
  });

  drawFooters(doc, data);

  const buf = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buf);
}
