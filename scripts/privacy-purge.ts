/**
 * Retensi data (UU 27/2022 PDP): hapus log login/aktivitas yang melewati masa simpan
 * (diatur di menu Pengaturan → Log & Pemantauan).
 *
 * Produksi: dibundel saat deploy menjadi <rilis>/tools/privacy-purge.cjs dan dijalankan
 * harian oleh Task Scheduler "SPMI Retensi Data" (scripts/deploy/register-tasks.ps1).
 * Lokal: npx tsx scripts/privacy-purge.ts
 */
import { purgeExpiredData } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

async function main() {
  const r = await purgeExpiredData();
  console.log(
    `${new Date().toISOString()} privacy:purge loginLogs=${r.loginLogs} activityLogs=${r.activityLogs}`
  );
}

main()
  .catch((e: unknown) => {
    console.error(
      `privacy:purge gagal: ${e instanceof Error ? e.name : "Error"}`
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
