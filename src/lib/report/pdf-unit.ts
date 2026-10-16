import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatDateTime } from "@/lib/format";
import type { UnitReportData } from "@/lib/report/data";

/* Palet warna (RGB) */
const INDIGO: [number, number, number] = [79, 70, 229];
const SLATE: [number, number, number] = [51, 65, 85];
const LIGHT: [number, number, number] = [241, 245, 249];
const EMERALD: [number, number, number] = [16, 185, 129];
const ROSE: [number, number, number] = [225, 29, 72];

const MARGIN = 32;
const PAGE_W = 841.89; // A4 landscape pt
const PAGE_H = 595.28;

function tone(v: number): [number, number, number] {
  if (v >= 80) return EMERALD;
  if (v >= 60) return [217, 119, 6];
  return ROSE;
}

/** Header halaman laporan per unit. */
function drawHeader(doc: jsPDF, data: UnitReportData) {
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, PAGE_W, 56, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Laporan Audit Mutu Internal (SPMI)", MARGIN, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Unit: ${data.unit.name}  •  Kategori: ${data.unit.category}  •  Siklus: ${data.cycle.name}`,
    MARGIN,
    38
  );
  doc.text(
    `Universitas Pahlawan — Lembaga Penjaminan Mutu  •  Dicetak: ${formatDateTime(
      data.generatedAt
    )}`,
    MARGIN,
    48
  );
  return 74;
}

/** Footer dengan nomor halaman. */
function drawFooters(doc: jsPDF, data: UnitReportData) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 26, PAGE_W - MARGIN, PAGE_H - 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 132, 150);
    doc.text(
      `SPMI — ${data.unit.name} — ${data.cycle.name}`,
      MARGIN,
      PAGE_H - 16
    );
    doc.text(`Halaman ${i} dari ${pages}`, PAGE_W - MARGIN, PAGE_H - 16, {
      align: "right",
    });
  }
}

/** Baris ringkasan (identitas unit + statistik). */
function drawSummary(doc: jsPDF, data: UnitReportData, startY: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text("Identitas & Ringkasan", MARGIN, startY);

  autoTable(doc, {
    startY: startY + 6,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 4, textColor: SLATE },
    headStyles: {
      fillColor: INDIGO,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    head: [["Unit Audit", "Kategori", "Periode Siklus", "Butir", "Terjawab", "Ya", "Tidak", "Kepatuhan"]],
    body: [
      [
        data.unit.name,
        data.unit.category,
        `${formatDate(data.cycle.startDate)} – ${formatDate(data.cycle.endDate)}`,
        String(data.summary.total),
        `${data.summary.answered} (${data.summary.progress}%)`,
        String(data.summary.ya),
        String(data.summary.tidak),
        `${data.summary.kepatuhan}%`,
      ],
    ],
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 7) {
        const v = parseInt(String(hook.cell.raw), 10) || 0;
        hook.cell.styles.textColor = tone(v);
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });
}

export function buildUnitReportPdf(data: UnitReportData): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const y = drawHeader(doc, data);
  drawSummary(doc, data, y + 6);

  const summaryEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text("Tabel Observasi / Audit / Visitasi", MARGIN, summaryEnd + 20);

  // Bangun baris: standar (rowSpan) + butir bernomor ulang per standar.
  // PENTING: baris lanjutan dari sel rowSpan harus MENGHILANGKAN sel standar,
  // bukan diisi "" — jika tidak, seluruh kolom akan bergeser.
  type Cell = string | { content: string; rowSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];

  for (const s of data.standards) {
    s.items.forEach((item, i) => {
      const row: Cell[] = [String(i + 1)];
      if (i === 0) {
        row.push({
          content: s.standard,
          rowSpan: s.items.length,
          styles: {
            valign: "middle",
            fontStyle: "bold",
            fillColor: LIGHT,
            textColor: SLATE,
          },
        });
      }
      row.push(item.question);
      row.push(item.observation || "-");
      row.push(item.ya ? "V" : "");
      row.push(item.tidak ? "V" : "");
      row.push(item.notes || "");
      body.push(row);
    });
  }

  autoTable(doc, {
    startY: summaryEnd + 26,
    theme: "grid",
    styles: {
      fontSize: 7.6,
      cellPadding: 3.5,
      textColor: SLATE,
      valign: "top",
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: INDIGO,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 22, halign: "center", valign: "top" },
      1: { cellWidth: 96 },
      2: { cellWidth: 200 },
      3: { cellWidth: 236 },
      4: { cellWidth: 26, halign: "center", valign: "middle" },
      5: { cellWidth: 26, halign: "center", valign: "middle" },
      6: { cellWidth: 130 },
    },
    head: [
      [
        "No",
        "Referensi/Standar/\nButir Mutu",
        "Pertanyaan",
        "Hasil Observasi/Audit/Visitasi\n(catatan audit)",
        "Y*",
        "T*",
        "Catatan Khusus",
      ],
    ],
    body,
    didParseCell: (hook) => {
      if (hook.section === "body" && (hook.column.index === 4 || hook.column.index === 5)) {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fontSize = 9;
      }
    },
  });

  /* Blok tanda tangan pengesahan (Ketua LPM). */
  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? PAGE_H - 60;
  const blockH = 130;
  let sy = tableEnd + 24;
  if (sy + blockH > PAGE_H - 40) {
    doc.addPage();
    drawHeader(doc, data);
    sy = 90;
  }

  const sigW = 200;
  const sigX = PAGE_W - MARGIN - sigW;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Disahkan oleh,", sigX, sy);
  sy += 16;
  doc.setFont("helvetica", "bold");
  doc.text(data.signatory?.title ?? "Ketua LPM", sigX, sy);
  sy += 62;
  doc.setDrawColor(...SLATE);
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

  drawFooters(doc, data);
  const buf = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buf);
}
