/**
 * Pemeriksaan kualitas data (ISO/IEC 25012) — HANYA MEMBACA database & UPLOAD_DIR.
 *
 * Keluaran: ringkasan per aturan (baca manusia) lalu SATU baris JSON berawalan
 * `data-quality:json ` berisi laporan lengkap (untuk diarsipkan/di-parse).
 * Tidak ada data pribadi pada keluaran — hanya id baris contoh pelanggar.
 *
 * Kode keluar: 0 walaupun ada aturan yang gagal (temuan adalah data, bukan
 * kegagalan tugas); 1 hanya bila runner sendiri crash (mis. DB tidak terjangkau).
 *
 * Produksi: dibundel saat deploy (esbuild) dan dijalankan harian oleh Task Scheduler.
 * Lokal: npx tsx scripts/data-quality.ts
 * Dokumentasi: docs/iso/25012-KUALITAS-DATA.md
 */
import { runDataQuality } from "@/lib/data-quality";
import { prisma } from "@/lib/prisma";

const MARK = { pass: "OK  ", fail: "GAGAL", error: "ERROR" } as const;

async function main() {
  const report = await runDataQuality();
  const { summary } = report;
  console.log(
    `${report.checkedAt} data-quality score=${report.score}% rules=${summary.rules} ` +
      `passed=${summary.passed} failed=${summary.failed} errors=${summary.errors}`
  );
  for (const r of report.results) {
    const detail =
      r.status === "error"
        ? `error=${r.error}`
        : `${r.violations}/${r.total} pelanggaran (${r.passRate}% lolos)` +
          (r.sampleIds.length ? ` contoh=${r.sampleIds.join(",")}` : "");
    console.log(
      `  [${MARK[r.status]}] ${r.id} ${r.severity.padEnd(6)} ${r.characteristic.padEnd(14)} ${detail} — ${r.description}`
    );
  }
  console.log(`data-quality:json ${JSON.stringify(report)}`);
}

main()
  .catch((e: unknown) => {
    console.error(
      `data-quality gagal: ${e instanceof Error ? e.name : "Error"}`
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
