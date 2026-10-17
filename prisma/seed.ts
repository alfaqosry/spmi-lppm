import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed production: membuat 2 akun awal — superadmin & admin LPM.
 *
 * Kredensial dibaca dari environment variable:
 *   SEED_SUPERADMIN_EMAIL      (default: superadmin@universitaspahlawan.ac.id)
 *   SEED_SUPERADMIN_PASSWORD   (WAJIB diisi)
 *   SEED_SUPERADMIN_NAME       (default: Superadmin)
 *   SEED_ADMIN_EMAIL           (default: admin@universitaspahlawan.ac.id)
 *   SEED_ADMIN_PASSWORD        (WAJIB diisi)
 *   SEED_ADMIN_NAME            (default: Admin LPM)
 *
 * Jika password tidak diset, seed ABORT dengan pesan error.
 * Jika akun sudah ada, seed dilewati (idempoten).
 */
async function main() {
  const saEmail = process.env.SEED_SUPERADMIN_EMAIL || "superadmin@universitaspahlawan.ac.id";
  const saPass = process.env.SEED_SUPERADMIN_PASSWORD;
  const saName = process.env.SEED_SUPERADMIN_NAME || "Superadmin";

  const adEmail = process.env.SEED_ADMIN_EMAIL || "admin@universitaspahlawan.ac.id";
  const adPass = process.env.SEED_ADMIN_PASSWORD;
  const adName = process.env.SEED_ADMIN_NAME || "Admin LPM";

  if (!saPass || saPass.length < 8) {
    console.error("❌ SEED_SUPERADMIN_PASSWORD wajib diisi (minimal 8 karakter).");
    process.exit(1);
  }
  if (!adPass || adPass.length < 8) {
    console.error("❌ SEED_ADMIN_PASSWORD wajib diisi (minimal 8 karakter).");
    process.exit(1);
  }

  // Superadmin
  const saExisting = await prisma.user.findUnique({ where: { email: saEmail } });
  if (saExisting) {
    console.log(`ℹ️  Akun superadmin sudah ada: ${saEmail} — dilewati.`);
  } else {
    await prisma.user.create({
      data: {
        name: saName,
        email: saEmail,
        password: await bcrypt.hash(saPass, 10),
        role: "superadmin",
      },
    });
    console.log(`✅ Superadmin dibuat: ${saEmail}`);
  }

  // Admin LPM
  const adExisting = await prisma.user.findUnique({ where: { email: adEmail } });
  if (adExisting) {
    console.log(`ℹ️  Akun Admin LPM sudah ada: ${adEmail} — dilewati.`);
  } else {
    await prisma.user.create({
      data: {
        name: adName,
        email: adEmail,
        password: await bcrypt.hash(adPass, 10),
        role: "lpm_admin",
      },
    });
    console.log(`✅ Admin LPM dibuat: ${adEmail}`);
  }

  console.log("⚠️  Silakan login dan ganti kata sandi kedua akun segera.");
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
