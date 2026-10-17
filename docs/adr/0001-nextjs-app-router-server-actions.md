# ADR-0001: Next.js App Router dengan Server Actions

- **Status:** Diterima
- **Tanggal:** 2026-10-17
- **Pengambil keputusan:** Tim pengembang SPMI, LPM Universitas Pahlawan Tuanku Tambusai

## Konteks

SPMI adalah aplikasi internal berbasis formulir (CRUD siklus, unit, akun, standar, jawaban audit, verifikasi)
dengan tim pengembang kecil. Dibutuhkan:

- satu basis kode untuk UI dan backend agar mudah dipelihara;
- otorisasi berbasis peran yang ditegakkan di server;
- unggahan berkas bukti dan pembuatan laporan PDF;
- tidak ada konsumen API eksternal (lihat [03-API.md](../03-API.md)).

Alternatif: (a) SPA React + REST API terpisah (Express/Laravel), (b) Next.js Pages Router + API Routes,
(c) Next.js App Router + Server Actions.

## Keputusan

Memakai **Next.js 16 App Router** (React 19, Server Components, Turbopack untuk dev) dengan **Server Actions**
sebagai antarmuka mutasi utama (`src/lib/actions/*.ts`). Route Handler (`src/app/api/**`) hanya untuk OAuth SSO,
unduhan PDF/berkas, dan health check. Halaman terproteksi berada di grup rute `src/app/(dashboard)/` dengan
guard sesi di `layout.tsx` yang diulang di setiap `page.tsx` serta setiap action. Build memakai `output: "standalone"`.

## Konsekuensi

**Positif**

- Tanpa lapisan API/DTO terpisah; tipe TypeScript mengalir dari Prisma ke UI.
- Mutasi dilindungi pemeriksaan `Origin` bawaan Next.js (mitigasi CSRF) dan ID action tidak dapat ditebak.
- Data dirender di server sehingga data sensitif tidak perlu diekspos lewat endpoint JSON.
- Form tetap sederhana dengan `useActionState`.

**Negatif / risiko**

- Setiap Server Action secara teknis adalah endpoint yang dapat dipanggil langsung — **wajib** otentikasi & otorisasi di
  dalam action (menyembunyikan tombol tidak cukup). Diatur di [07-STANDAR-ENGINEERING.md](../07-STANDAR-ENGINEERING.md#6-keamanan-wajib-per-pr).
- Batas body Server Action (10 MB, `next.config.ts`) membatasi ukuran unggahan.
- Next.js 16 memiliki perubahan API yang sering; pembaruan mayor perlu uji regresi E2E (lihat `AGENTS.md`).
- Tidak dapat dipakai sebagai API untuk integrasi pihak ketiga — bila dibutuhkan, tambahkan `/api/v1` (03-API §10).
