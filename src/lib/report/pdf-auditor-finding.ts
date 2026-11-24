import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ── Palet warna ── */
const INDIGO: [number, number, number] = [79, 70, 229];
const SLATE: [number, number, number] = [51, 65, 85];
const SLATE_LIGHT: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [241, 245, 249];
const EMERALD: [number, number, number] = [16, 185, 129];
const ROSE: [number, number, number] = [225, 29, 72];
const AMBER: [number, number, number] = [217, 119, 6];
const WHITE: [number, number, number] = [255, 255, 255];

const MARGIN = 28;
const PAGE_W = 841.89; // A4 landscape pt
const PAGE_H = 595.28;

export type AuditorFindingPdfData = {
  cycleName: string;
  unit: { name: string; category: string };
  generatedAt: Date;
  auditor1: { name: string; role: string } | null;
  auditor2: { name: string; role: string } | null;
  lpmHead: { name: string } | null;
  standards: {
    no: number;
    name: string;
    questions: {
      no: number;
      text: string;
      unitAnswer: "ya" | "tidak" | null;
      temuan: string;
      akarMasalah: string;
      rencanaTL: string;
      efektivitasTL: string;
    }[];
  }[];
};

function padTime(n: number) {
  return String(n).padStart(2, "0");
}

function formatDT(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()} ${padTime(d.getHours())}.${padTime(d.getMinutes())} WIB`;
}

function drawHeader(doc: jsPDF, data: AuditorFindingPdfData) {
  /* Strip indigo */
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, PAGE_W, 52, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("LEMBAR TEMUAN AUDIT MUTU INTERNAL (SPMI)", MARGIN, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Unit: ${data.unit.name}  •  Kategori: ${data.unit.category}  •  Siklus: ${data.cycleName}`,
    MARGIN,
    35
  );
  doc.text(`Dicetak: ${formatDT(data.generatedAt)}`, MARGIN, 45);
}

function drawFooters(doc: jsPDF, data: AuditorFindingPdfData) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, PAGE_H - 24, PAGE_W - MARGIN, PAGE_H - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_LIGHT);
    doc.text(
      `SPMI — Lembar Temuan — ${data.unit.name} — ${data.cycleName}`,
      MARGIN,
      PAGE_H - 14
    );
    doc.text(`Halaman ${i} dari ${pages}`, PAGE_W - MARGIN, PAGE_H - 14, {
      align: "right",
    });
  }
}

export function buildAuditorFindingPdf(
  data: AuditorFindingPdfData
): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  drawHeader(doc, data);

  /* ── Tabel temuan ── */
  type Cell =
    | string
    | { content: string; rowSpan?: number; styles?: Record<string, unknown> };

  const body: Cell[][] = [];

  for (const std of data.standards) {
    std.questions.forEach((q, qi) => {
      const answerLabel =
        q.unitAnswer === "ya"
          ? "Ada"
          : q.unitAnswer === "tidak"
            ? "Tidak Ada"
            : "Belum Diisi";
      const answerColor =
        q.unitAnswer === "ya"
          ? EMERALD
          : q.unitAnswer === "tidak"
            ? ROSE
            : AMBER;

      const row: Cell[] = [];

      /* Kolom Standar — rowspan hanya di baris pertama */
      if (qi === 0) {
        row.push({
          content: `${std.no}. ${std.name}`,
          rowSpan: std.questions.length,
          styles: {
            valign: "middle",
            fontStyle: "bold",
            fillColor: LIGHT,
            textColor: SLATE,
          },
        });
      }

      row.push({
        content: `${q.no}`,
        styles: { halign: "center", valign: "middle", textColor: SLATE_LIGHT },
      });
      row.push({ content: q.text, styles: { textColor: SLATE } });
      row.push({
        content: answerLabel,
        styles: {
          halign: "center",
          valign: "middle",
          fontStyle: "bold",
          textColor: answerColor,
        },
      });
      row.push({ content: q.temuan || "—", styles: { textColor: SLATE } });
      row.push({ content: q.akarMasalah || "—", styles: { textColor: SLATE } });
      row.push({ content: q.rencanaTL || "—", styles: { textColor: SLATE } });
      row.push({
        content: q.efektivitasTL || "—",
        styles: { textColor: SLATE },
      });

      body.push(row);
    });
  }

  autoTable(doc, {
    startY: 62,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      valign: "top",
      lineColor: [203, 213, 225],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: INDIGO,
      textColor: WHITE,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 90 }, // Standar
      1: { cellWidth: 20, halign: "center" }, // No
      2: { cellWidth: 160 }, // Pertanyaan
      3: { cellWidth: 52, halign: "center" }, // Ada/Tidak
      4: { cellWidth: 100 }, // Temuan
      5: { cellWidth: 100 }, // Akar Masalah
      6: { cellWidth: 100 }, // Rencana TL
      7: { cellWidth: 100 }, // Efektivitas TL
    },
    head: [
      [
        "Standar",
        "No",
        "Pertanyaan",
        "Ada / Tidak",
        "Temuan",
        "Akar Masalah",
        "Rencana Tindak Lanjut",
        "Efektivitas Tindak Lanjut",
      ],
    ],
    body,
  });

  /* ── Blok tanda tangan ── */
  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? PAGE_H - 160;

  const sigBlockH = 110;
  let sy = tableEnd + 20;

  /* Jika tidak muat di halaman ini, tambah halaman baru */
  if (sy + sigBlockH > PAGE_H - 32) {
    doc.addPage();
    drawHeader(doc, data);
    sy = 70;
  }

  const colW = (PAGE_W - MARGIN * 2) / 3;
  const lineY = sy + 68;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);

  /* ── Auditor 1 (kiri) ── */
  const x1 = MARGIN;
  doc.text("Auditor 1 (Ketua Tim),", x1, sy);
  doc.setDrawColor(...SLATE_LIGHT);
  doc.setLineWidth(0.6);
  doc.line(x1, lineY, x1 + colW - 16, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    data.auditor1?.name ?? "( ................................ )",
    x1,
    lineY + 13
  );
  if (data.auditor1) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_LIGHT);
    doc.text(data.auditor1.role, x1, lineY + 24);
  }

  /* ── Kepala LPM (tengah) ── */
  const x2 = MARGIN + colW;
  const lpmLabel = "Mengetahui,";
  const lpmTitle = "Kepala LPM";
  const lpmLabelW = doc.getTextWidth(lpmLabel);
  const midX = x2 + (colW - 16) / 2;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(lpmLabel, midX - lpmLabelW / 2, sy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const lpmTitleW = doc.getTextWidth(lpmTitle);
  doc.text(lpmTitle, midX - lpmTitleW / 2, sy + 11);
  doc.setDrawColor(...SLATE_LIGHT);
  doc.line(x2, lineY, x2 + colW - 16, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const lpmName = data.lpmHead?.name ?? "( ................................ )";
  const lpmNameW = doc.getTextWidth(lpmName);
  doc.setTextColor(...SLATE);
  doc.text(lpmName, midX - lpmNameW / 2, lineY + 13);

  /* ── Auditor 2 (kanan) ── */
  const x3 = MARGIN + colW * 2;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Auditor 2 (Anggota Tim),", x3, sy);
  doc.setDrawColor(...SLATE_LIGHT);
  doc.line(x3, lineY, x3 + colW - 16, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    data.auditor2?.name ?? "( ................................ )",
    x3,
    lineY + 13
  );
  if (data.auditor2) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_LIGHT);
    doc.text(data.auditor2.role, x3, lineY + 24);
  }

  drawFooters(doc, data);

  const buf = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(buf);
}
