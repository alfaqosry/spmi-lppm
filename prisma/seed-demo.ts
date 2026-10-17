import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed DEMO untuk pengembangan lokal: MENGHAPUS seluruh data lalu mengisi 6 unit,
 * 5 akun demo (sandi lemah yang diketahui publik) dan data contoh.
 *
 * Pengaman (standar: data demo hanya di non-produksi):
 *   - wajib SEED_DEMO=true
 *   - ditolak bila NODE_ENV=production
 * Jalankan: SEED_DEMO=true npm run db:seed:demo
 * Untuk produksi gunakan `npm run db:seed` (akun dari environment variable).
 */
function assertDemoAllowed() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Seed demo DITOLAK: NODE_ENV=production.");
    process.exit(1);
  }
  if (process.env.SEED_DEMO !== "true") {
    console.error(
      "❌ Seed demo menghapus SELURUH data. Setel SEED_DEMO=true untuk melanjutkan (hanya di lokal)."
    );
    process.exit(1);
  }
}

async function main() {
  assertDemoAllowed();
  console.log("🌱 Seeding data DEMO SPMI (lokal)…");

  // Bersihkan data lama (urutan penting karena relasi)
  await prisma.auditResponse.deleteMany();
  await prisma.unitProgress.deleteMany();
  await prisma.auditQuestion.deleteMany();
  await prisma.auditStandard.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.auditCycle.deleteMany();

  /* ------------------------------ SIKLUS ------------------------------ */
  const cycle = await prisma.auditCycle.create({
    data: {
      name: "Siklus 2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
      isActive: true,
    },
  });

  /* ------------------------------- UNIT ------------------------------- */
  const unitData = [
    { name: "Program Studi Teknik Informatika", category: "Program Studi" },
    { name: "Program Studi Manajemen", category: "Program Studi" },
    { name: "Wakil Rektor Bidang Akademik", category: "Wakil Rektor" },
    { name: "Pusat Komputer & Sistem Informasi", category: "Pusat" },
    { name: "Perpustakaan Pusat", category: "Perpustakaan" },
    { name: "Biro Administrasi Umum", category: "Biro" },
  ];
  const units = [];
  for (const u of unitData) {
    units.push(
      await prisma.unit.create({
        data: { ...u, description: `Unit audit: ${u.name}` },
      })
    );
  }

  /* ------------------------------- AKUN ------------------------------- */
  const adminPass = await bcrypt.hash("admin123", 10);
  const unitPass = await bcrypt.hash("unit123", 10);

  await prisma.user.create({
    data: {
      name: "Administrator LPM",
      email: "admin@lpm.ac.id",
      password: adminPass,
      role: "lpm_admin",
    },
  });

  await prisma.user.create({
    data: {
      name: "Rina Marlina, S.Si.",
      email: "anggota.lpm@lpm.ac.id",
      password: unitPass,
      role: "lpm_member",
    },
  });

  const prodi = units[0];
  const headProdi = await prisma.user.create({
    data: {
      name: "Dr. Siti Aminah, M.Kom.",
      email: "kepala.prodi@lpm.ac.id",
      password: unitPass,
      role: "auditee_head",
      unitId: prodi.id,
      isUnitHead: true,
    },
  });
  await prisma.unitMembership.create({
    data: { userId: headProdi.id, unitId: prodi.id, role: "head" },
  });

  const memberProdi = await prisma.user.create({
    data: {
      name: "Ahmad Fauzi, S.Kom.",
      email: "anggota.prodi@lpm.ac.id",
      password: unitPass,
      role: "auditee_member",
      unitId: prodi.id,
    },
  });
  await prisma.unitMembership.create({
    data: { userId: memberProdi.id, unitId: prodi.id, role: "member" },
  });

  const headPerpus = await prisma.user.create({
    data: {
      name: "Dewi Lestari, M.Pd.",
      email: "kepala.perpus@lpm.ac.id",
      password: unitPass,
      role: "auditee_head",
      unitId: units[4].id,
      isUnitHead: true,
    },
  });
  await prisma.unitMembership.create({
    data: { userId: headPerpus.id, unitId: units[4].id, role: "head" },
  });

  /* ------------- STANDAR (induk butir pertanyaan) + PERTANYAAN --------- */
  // Setiap standar dikelompokkan; butir pertanyaan berada di bawah standar.
  const standardDefs = [
    {
      name: "Tata Pamong & Kepemimpinan",
      questions: [
        "Apakah unit memiliki dokumen rencana kerja tahunan yang disahkan pimpinan?",
        "Apakah tersedia struktur organisasi dan uraian tugas yang jelas?",
        "Apakah rapat koordinasi internal dilaksanakan minimal 4 kali per tahun?",
      ],
    },
    {
      name: "Proses Layanan",
      questions: [
        "Apakah terdapat SOP layanan utama yang terdokumentasi?",
        "Apakah pelaksanaan layanan dimonitor dan dievaluasi secara berkala?",
      ],
    },
    {
      name: "Sumber Daya Manusia",
      questions: [
        "Apakah unit memiliki data kepegawaian yang mutakhir?",
        "Apakah tersedia program peningkatan kompetensi SDM setiap tahun?",
      ],
    },
    {
      name: "Sarana & Prasarana",
      questions: [
        "Apakah unit memiliki daftar inventaris sarana yang terpelihara?",
        "Apakah ketersediaan sarana memadai untuk mendukung layanan?",
      ],
    },
  ];

  const questions: { id: number }[] = [];
  let order = 1;
  for (let s = 0; s < standardDefs.length; s++) {
    const standard = await prisma.auditStandard.create({
      data: {
        cycleId: cycle.id,
        name: standardDefs[s].name,
        order: s + 1,
      },
    });
    for (const text of standardDefs[s].questions) {
      const q = await prisma.auditQuestion.create({
        data: {
          cycleId: cycle.id,
          standardId: standard.id,
          questionText: text,
          order: order++,
          scopeType: "all",
        },
      });
      questions.push(q);
    }
  }

  /* ---------------------------- DOKUMEN ------------------------------- */
  await prisma.document.createMany({
    data: [
      {
        cycleId: cycle.id,
        type: "penetapan",
        title: "SK Penetapan Standar Mutu SPMI 2025",
        link: "https://example.com/sk-penetapan-2025.pdf",
      },
      {
        cycleId: cycle.id,
        type: "penetapan",
        title: "SK Penetapan Panitia Audit Mutu Internal",
        link: "https://example.com/sk-panitia-ami.pdf",
      },
      {
        cycleId: cycle.id,
        type: "evaluasi",
        title: "Laporan Evaluasi Diri Siklus Sebelumnya",
        link: "https://example.com/laporan-evaluasi.pdf",
      },
    ],
  });

  /* ------------------------- CONTOH JAWABAN --------------------------- */
  await prisma.auditResponse.create({
    data: {
      cycleId: cycle.id,
      unitId: prodi.id,
      auditQuestionId: questions[0].id,
      answer: "ya",
      evidenceLink: "https://example.com/rencana-kerja-prodi.pdf",
      status: "verified",
    },
  });
  await prisma.auditResponse.create({
    data: {
      cycleId: cycle.id,
      unitId: prodi.id,
      auditQuestionId: questions[1].id,
      answer: "tidak",
      reason:
        "Uraian tugas sedang dalam proses penyusunan dan akan disahkan pada rapat berikutnya.",
      status: "revision",
      lpmNotes: "Lengkapi dengan SK uraian tugas yang telah disahkan.",
    },
  });

  await prisma.unitProgress.createMany({
    data: units.map((u) => ({
      cycleId: cycle.id,
      unitId: u.id,
      status: u.id === prodi.id ? "mengisi" : "belum_mulai",
    })),
  });

  console.log(`✅ Seed selesai.
   Admin LPM      : admin@lpm.ac.id / admin123
   Anggota LPM    : anggota.lpm@lpm.ac.id / unit123
   Kepala Unit    : kepala.prodi@lpm.ac.id / unit123
   Anggota Unit   : anggota.prodi@lpm.ac.id / unit123
   Kepala Perpus  : kepala.perpus@lpm.ac.id / unit123`);
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
