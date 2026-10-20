# ADR-0002: Prisma ORM dengan MySQL 8

- **Status:** Diterima
- **Tanggal:** 2026-10-17

## Konteks

Data SPMI bersifat relasional kuat: siklus → standar → pertanyaan → jawaban per unit, penempatan pengguna
multi-unit, serta integritas referensial dengan perilaku hapus berantai. Infrastruktur universitas sudah
mengoperasikan MySQL dan tim familiar dengannya. Dibutuhkan akses data bertipe kuat yang aman dari SQL injection.

Alternatif: query SQL mentah (`mysql2`), Drizzle ORM, TypeORM, Prisma; basis data PostgreSQL atau MySQL.

## Keputusan

Memakai **Prisma ORM 6** (`prisma/schema.prisma`, klien singleton `src/lib/prisma.ts`) dengan **MySQL 8**
(`utf8mb4_unicode_ci`, zona waktu `+07:00`). Konvensi: model `PascalCase`, field `camelCase` dengan
`@map("snake_case")`, tabel `snake_case` via `@@map`. Sinkronisasi skema memakai **`prisma db push`**
(lokal: `npm run db:push`; produksi: tahap f `deploy-production.ps1`, tanpa `--accept-data-loss`).
Produksi menjalankan MySQL dalam container `spmi-db` yang hanya mendengarkan `127.0.0.1:33063`
(`deploy/docker-compose.db.yml`).

## Konsekuensi

**Positif**

- Kueri terparameter otomatis (mitigasi SQL injection) dan tipe hasil kueri tersedia di TypeScript.
- Batasan unik & relasi (`onDelete: Cascade/SetNull`) dideklarasikan sekali dan konsisten.
- `db push` tanpa `--accept-data-loss` menggagalkan deploy bila perubahan berisiko kehilangan data.

**Negatif / risiko**

- Tanpa riwayat migrasi berversi (`prisma migrate`): perubahan skema tidak dapat diaudit per versi dan rollback
  skema bergantung pada restore backup. **Tindak lanjut:** beralih ke `prisma migrate deploy` sebelum perubahan skema besar berikutnya.
- Hapus berantai (mis. menghapus siklus menghapus seluruh jawaban) membutuhkan konfirmasi UI dan backup rutin.
- Engine Prisma native harus ikut ke rilis standalone (deploy menyalin `node_modules\.prisma`).
- Beberapa kolom status memakai `VARCHAR` (`unit_progress.status`, `unit_memberships.role`, `audit_questions.scope_type`,
  `audit_standards.scope_type`) sehingga validasi nilai bergantung pada kode aplikasi, bukan DB.

**Pembaruan 20 Oktober 2026 (v1.2.2):** `prisma db push` 6.19 menghasilkan `DROP FOREIGN KEY` ganda untuk perubahan
cakupan standar dan gagal di tengah jalan; perubahan diterapkan dengan skrip manual
`prisma/sql/2026-10-20-cakupan-standar.sql`. Keputusan ini tetap berlaku, dengan prosedur wajib migrasi manual
([RENCANA-PEMELIHARAAN §4.1](../iso/RENCANA-PEMELIHARAAN.md#41-prosedur-wajib-perubahan-skema-basis-data)) sampai
peralihan ke `prisma migrate deploy` (RISK-REGISTER R-16, R-31). Unique `(cycle_id, name)` pada `audit_standards`
dihapus — keunikan nama per cakupan dijaga aplikasi.
