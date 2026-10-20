# Laporan Penyelesaian Pengujian (Test Completion Report) — SPMI v1.1.3 (+ addendum v1.2.1–v1.2.2, §8)

Acuan: ISO/IEC/IEEE 29119-3 §7.5. Rencana: [TEST-PLAN](TEST-PLAN.md) (TP-SPMI-1.1).

| Item             | Keterangan                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Identitas        | TCR-SPMI-1.1.3                                                                                      |
| Rilis            | **v1.1.3** (tag Git; dideploy 17 Oktober 2026)                                                      |
| Periode eksekusi | 16–17 Oktober 2026                                                                                  |
| Disusun          | Manajer uji (tim pengembang), 17 Oktober 2026                                                       |
| Lingkungan       | ENV-1 unit, ENV-2 E2E lokal + MySQL sekali pakai, ENV-5 produksi (smoke, Lighthouse, E2E baca-saja) |

## 1. Ringkasan Eksekutif

Seluruh level uji **otomatis** lulus tanpa kegagalan: **287** uji unit (17 berkas), **108** uji E2E lulus / **27** dilewati
/ **0** gagal di 5 profil peramban, **4/4** E2E terautentikasi di produksi, **0** pelanggaran axe pada halaman publik,
**0** kerentanan `npm audit`, dan smoke test pasca-deploy lulus. Satu kriteria **tidak terpenuhi**: kinerja
Lighthouse **mobile 66–77** (target ≥ 90). UAT manual dan uji usabilitas **belum dieksekusi**.

**Rekomendasi:** v1.1.3 **layak tetap beroperasi di produksi** (diterima dengan catatan). Sebelum siklus AMI berikutnya
dibuka, UAT prioritas tinggi wajib dieksekusi dan risiko residual §6 ditindaklanjuti.

## 2. Hasil per Level

| Level / jenis                    | Alat & perintah                                            | Hasil                                                                                                    | Kriteria keluar         | Status |
| -------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- | ------ |
| Unit                             | Vitest 4.1 — `npm run test`                                | **287 lulus / 287**, 17 berkas, ±2,2 dtk                                                                 | 100% lulus              | ✅     |
| Statis                           | `npm run lint`, `format:check`, `typecheck`                | 0 galat, 0 peringatan                                                                                    | bersih                  | ✅     |
| E2E lintas peramban              | Playwright — `npm run test:e2e` (27 test × 5 profil = 135) | **108 lulus, 27 dilewati, 0 gagal**                                                                      | 0 gagal; skip beralasan | ✅     |
| E2E terautentikasi (produksi)    | `tests/e2e/auth.spec.ts` dengan akun khusus, HTTPS         | **4/4 lulus** (login → dashboard, cookie httpOnly/Lax, redirect `/login`, axe dashboard)                 | 0 gagal                 | ✅     |
| Aksesibilitas                    | axe-core — `npm run test:a11y`                             | **0 pelanggaran**: login, login + galat, login 320 px, 404, kebijakan privasi, S&K; dashboard (produksi) | 0 pelanggaran           | ✅     |
| Keamanan dependensi              | `npm audit --omit=dev --audit-level=high`                  | **0 kerentanan** (override `deepmerge-ts` 8.0.2)                                                         | 0 high/critical         | ✅     |
| Smoke pasca-deploy               | `scripts/deploy/smoke-test.ps1`                            | Semua cek `[OK]` (health db ok, rute & kode status, header keamanan)                                     | semua OK                | ✅     |
| Kinerja — desktop                | Lighthouse 12.8 (produksi)                                 | Performance **96–97**, LCP 0,8–0,9 dtk, TBT 100–130 ms, CLS 0                                            | ≥ 90                    | ✅     |
| Kinerja — mobile                 | Lighthouse 12.8 (produksi)                                 | Performance **66–77**, LCP 2,4–3,4 dtk, TBT 780–1.400 ms                                                 | ≥ 90                    | ❌     |
| Aksesibilitas & SEO (Lighthouse) | Lighthouse 12.8                                            | Accessibility **100**, SEO **100**; Best Practices 82 (skrip Cloudflare)                                 | ≥ 95                    | ✅     |
| UAT manual                       | [FORMULIR-UAT](FORMULIR-UAT.md)                            | Belum dieksekusi                                                                                         | prioritas tinggi lulus  | ⏳     |
| Usabilitas                       | [../9241-USABILITAS](../9241-USABILITAS/README.md)         | Evaluasi heuristik selesai (31 temuan); uji pengguna belum                                               | SUS ≥ 68                | ⏳     |

### 2.1 Rincian E2E per Profil

| Profil    | Total   | Lulus   | Dilewati | Gagal | Alasan dilewati                                                                                             |
| --------- | ------- | ------- | -------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| chromium  | 27      | 23      | 4        | 0     | 4 × `auth.spec.ts` (`E2E_EMAIL`/`E2E_PASSWORD` tidak diset di lingkungan lokal)                             |
| firefox   | 27      | 23      | 4        | 0     | idem                                                                                                        |
| webkit    | 27      | 22      | 5        | 0     | idem + 1 "email dapat dicapai dengan Tab dari awal halaman" (Safari tidak memfokuskan semua elemen via Tab) |
| pixel-7   | 27      | 20      | 7        | 0     | idem + 3 uji navigasi keyboard (dilewati di perangkat sentuh)                                               |
| iphone-14 | 27      | 20      | 7        | 0     | idem + 3 uji navigasi keyboard                                                                              |
| **Total** | **135** | **108** | **27**   | **0** | 20 butuh akun · 6 keyboard di seluler · 1 batas WebKit                                                      |

Alur terautentikasi yang dilewati secara lokal dieksekusi terpisah terhadap produksi (4/4 lulus, mode serial).

### 2.2 Cakupan

- Kasus uji: **130** ([TEST-CASES](TEST-CASES.md)) — 50 ✅, 40 ⚠️ (logika lulus otomatis, UI belum), 39 ⏳, 1 ❌ (TC-NF-09).
- Kebutuhan: **61** (19 KF, 17 KNF termasuk 5 turunan, 25 AB) — 100% memiliki kasus uji; 46% terverifikasi otomatis
  ujung-ke-ujung, 31% hanya logika ([TRACEABILITY §3](TRACEABILITY.md#3-ringkasan-cakupan)).
- Cakupan kode diukur untuk `src/lib/**` kecuali `report/` dan `actions/` (`vitest.config.mts`).

## 3. Penyimpangan dari Rencana

| No  | Penyimpangan                                                                                                   | Alasan / dampak                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | E2E terautentikasi dijalankan ke **produksi**, padahal `playwright.config.ts` melarang `E2E_BASE_URL` produksi | Hanya 4 test baca-saja, akun khusus, mode serial; data tidak diubah. Ke depan: jalankan di ENV-2/ENV-3 dengan seed |
| 2   | Workflow CI (`ci.yml`, `e2e.yml`) belum berjalan di GitHub                                                     | Repositori belum di-push; gerbang test di `deploy-production.ps1` menggantikan sementara                           |
| 3   | UAT & uji usabilitas belum dieksekusi                                                                          | Bukan syarat deploy v1.1.3 (rilis perbaikan/pengerasan); dijadwalkan Nov 2026                                      |
| 4   | Pengukuran PageSpeed Insights (mesin acuan Google) tidak tersedia                                              | Kuota anonim habis; skor mobile berasal dari Lighthouse di server produksi (CPU lebih lambat)                      |

## 4. Defect yang Ditemukan & Diperbaiki Selama Siklus Uji

| ID   | Defect                                                                                                                                          | Ditemukan oleh                         | Severity         | Perbaikan                                                                                                                                                                                                                    | Rilis  | Status                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------- |
| D-01 | Selector E2E kurang spesifik / tidak stabil antar-peramban → kegagalan palsu (bukan defect aplikasi). Rincian per kasus tidak tercatat terpisah | E2E lintas peramban                    | S3 (uji)         | Selector diganti berbasis peran & nama aksesibel persis — pola yang kini dipakai: `getByRole('button', { name: 'Masuk', exact: true })`, `getByRole('textbox', { name: /^Email/ })`, `getByRole('alert').or(getByText(...))` | v1.1.x | ✅ Tertutup                       |
| D-02 | **WebKit gagal memuat halaman di `http://127.0.0.1`**: CSP `upgrade-insecure-requests` memaksa sumber daya ke HTTPS pada server uji HTTP        | E2E profil `webkit`/`iphone-14`        | S2               | Direktif hanya disertakan bila situs dilayani HTTPS (`SERVES_HTTPS` di `src/proxy.ts`)                                                                                                                                       | v1.1.1 | ✅ Tertutup                       |
| D-03 | Metadata halaman di-_stream_ ke `<body>`, bukan `<head>`                                                                                        | Lighthouse SEO / audit metadata        | S3               | `htmlLimitedBots: /.*/`                                                                                                                                                                                                      | v1.1.1 | ✅ Tertutup                       |
| D-04 | Teks < 12 px dan target sentuh daftar isi halaman legal terlalu kecil                                                                           | Lighthouse (legible font, tap targets) | S4               | Ukuran teks minimum 12 px, target sentuh diperbesar                                                                                                                                                                          | v1.1.1 | ✅ Tertutup                       |
| D-05 | Smoke test menganggap header `X-Powered-By` kosong dari ARR sebagai kebocoran (gagal palsu)                                                     | Smoke test produksi                    | S3 (uji)         | Logika cek diperbaiki di `smoke-test.ps1`                                                                                                                                                                                    | v1.1.1 | ✅ Tertutup                       |
| D-06 | **Insiden PM2 `EPERM`**: folder `logs` dikunci ACL sehingga PM2 gagal start saat deploy 17 Okt 2026; rollback otomatis terpicu                  | Deploy produksi                        | S1 (operasional) | Folder `logs` tidak lagi dikunci ACL; rollback tetap mengaktifkan rilis sebelumnya walau restore DB gagal; pemeliharaan dicabut hanya setelah smoke lulus; dump/restore DB via `scripts/deploy/lib-db.ps1`                   | v1.1.2 | ✅ Tertutup                       |
| D-07 | Kinerja mobile rendah (blob dekoratif `blur-3xl`, `backdrop-filter` mahal)                                                                      | Lighthouse mobile                      | S3               | Diganti `radial-gradient`; efek kaca hanya di layar lebar ber-pointer presisi                                                                                                                                                | v1.1.3 | ⚠️ Membaik, target belum tercapai |

Sumber: `CHANGELOG.md` (1.1.1–1.1.3), riwayat commit (`edcc960`, `3e4a343`), [09-DAFTAR-STANDAR §6, §13](../../09-DAFTAR-STANDAR.md).
Temuan keamanan pra-rilis (audit 16–17 Okt, B-1…B-18) dilaporkan terpisah di `LAPORAN_KEAMANAN.md` dan semuanya ditutup
dengan uji regresi unit (`upload`, `guards`, `net`, `auth`, `redact`).

### 4.1 Defect / Temuan Terbuka

| ID   | Deskripsi                                                                                                                      | Severity | Rujukan                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------- |
| O-01 | Kinerja mobile 66–77 (TBT 780–1.400 ms; ±700 ms dari skrip Cloudflare)                                                         | S3       | TC-NF-09; [09 §6](../../09-DAFTAR-STANDAR.md#6-performa-web)   |
| O-02 | 12 temuan terbuka dokumentasi/kode (OAuth `state` paket lama, logout SSO, berkas bukti tidak ikut terhapus saat CASCADE, dll.) | S2–S4    | [docs/README "Temuan Terbuka"](../../README.md#temuan-terbuka) |
| O-03 | 31 temuan kegunaan (8 severity 3)                                                                                              | —        | [EVALUASI-HEURISTIK](../9241-USABILITAS/EVALUASI-HEURISTIK.md) |
| O-04 | Dokumentasi menyebut batas login default 8×/5 menit; kode 5×/1 menit + 30×/menit per IP                                        | S4       | HE-29                                                          |

## 5. Metrik

| Metrik                                      | Nilai                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Test otomatis dieksekusi                    | 287 unit + 135 E2E (+4 produksi)                                                             |
| Tingkat kelulusan (tidak termasuk dilewati) | 100%                                                                                         |
| Defect ditemukan selama siklus              | 7 (D-01…D-07)                                                                                |
| Defect tertutup                             | 6; 1 membaik                                                                                 |
| Defect S1 lolos ke produksi                 | 0 defect fungsional; 1 insiden operasional saat deploy (D-06) — dipulihkan rollback otomatis |
| Kebutuhan dengan kasus uji                  | 61/61 (100%)                                                                                 |

## 6. Risiko Residual

| ID   | Risiko                                                                                        | Kemungkinan   | Dampak | Mitigasi sementara                                    | Tindakan                                      |
| ---- | --------------------------------------------------------------------------------------------- | ------------- | ------ | ----------------------------------------------------- | --------------------------------------------- |
| RR-1 | Server Actions inti (verifikasi, RTL, penempatan, Ketua LPM, standar) tanpa uji otomatis (G1) | Sedang        | Tinggi | Guard & validasi diuji unit; UAT sebelum siklus       | Uji integrasi dengan DB sekali pakai          |
| RR-2 | Isi laporan PDF tidak diuji otomatis (G2) — salah data berdampak akreditasi                   | Sedang        | Tinggi | UAT N-02…N-04 & pemeriksaan manual LPM                | Uji ekstraksi teks PDF                        |
| RR-3 | Penghapusan berantai (siklus/unit/standar) dengan konfirmasi minim (HE-03/04/05)              | Rendah–sedang | Tinggi | Backup harian + backup pra-deploy, uji restore 17 Okt | Perbaiki dialog; pertimbangkan soft-delete    |
| RR-4 | Auditee tidak melihat tenggat & revisi tersembunyi (HE-01/02) → pengisian tidak tuntas        | Tinggi        | Sedang | Pengumuman LPM via email                              | Perbaikan UI sebelum siklus berikutnya        |
| RR-5 | Kinerja mobile di bawah target                                                                | Tinggi        | Rendah | Desktop memadai                                       | Setelan Cloudflare + optimasi hidrasi (09 §6) |
| RR-6 | Alur SSO nyata belum dieksekusi end-to-end (Redirect URI produksi menunggu pendaftaran)       | Sedang        | Sedang | Login email tersedia                                  | TC-LOG-12…17 setelah 09 backlog #1            |
| RR-7 | CI belum aktif; staging belum ada                                                             | Sedang        | Sedang | Gerbang test di skrip deploy                          | Push ke GitHub; siapkan staging               |
| RR-8 | Uji keamanan independen belum dilakukan                                                       | Rendah        | Tinggi | Audit internal + regresi                              | Uji penetrasi pihak ketiga                    |

## 7. Rekomendasi & Keputusan

1. **Terima v1.1.3 untuk operasi produksi** dengan catatan risiko residual RR-1…RR-8 (keputusan pemilik produk).
2. **Wajib sebelum membuka siklus AMI berikutnya:** eksekusi UAT kasus prioritas tinggi (LOG, SIK, ROL, AUD, ANL —
   status ⚠️/⏳ di [TEST-CASES](TEST-CASES.md)), perbaikan HE-01, HE-02, HE-08, dan pendaftaran Redirect URI SSO.
3. **Rilis berikutnya:** uji integrasi Server Actions & PDF (G1, G2), E2E per peran (G3), aktifkan CI.
4. Ulangi Lighthouse mobile setelah setelan Cloudflare; bila < 90, masukkan optimasi hidrasi ke backlog.

| Keputusan                                        | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak |
| ------------------------------------------------ | ---------------------------------------------- |
| Pemilik produk (Ketua LPM) — nama & tanda tangan | ______________________ Tanggal: ________       |
| Manajer uji — nama & tanda tangan                | ______________________ Tanggal: ________       |

---

Catatan baseline: angka di laporan ini adalah hasil v1.1.3. Pekerjaan setelahnya (mis. berkas uji tambahan di branch kerja)
dilaporkan pada laporan penyelesaian rilis berikutnya.

## 8. Addendum — v1.2.1 & v1.2.2 (20 Oktober 2026)

| Item       | Keterangan                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identitas  | TCR-SPMI-1.2.2-ADD                                                                                                                                          |
| Rilis      | **v1.2.1** (17 Okt 2026: seed demo dipisah ke `prisma/seed-demo.ts`) · **v1.2.2** (20 Okt 2026: cakupan standar, migrasi SQL manual)                        |
| Basis uji  | KF-20, AB-21 (dikoreksi), AB-26…AB-29 di [01-PERANCANGAN](../../01-PERANCANGAN.md); temuan C-1…C-8 `LAPORAN_KEAMANAN.md` "Audit Lanjutan — 20 Oktober 2026" |
| Objek uji  | Pohon kerja `main` (v1.2.2) + perbaikan keamanan audit lanjutan & perbaikan dari suite E2E alur — **belum dirilis/di-tag** pada saat laporan ini            |
| Lingkungan | ENV-1 (unit), salinan DB produksi (gladi migrasi), mesin pengembang (pengaman seed demo dengan `DATABASE_URL` palsu)                                        |

### 8.1 Hasil

| Level / jenis             | Perintah / bukti                                                                                     | Hasil                                                                                                                        | Status |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| Unit                      | `npx vitest run`                                                                                     | **402 lulus / 402**, 23 berkas (v1.1.3: 287/17). Baru: `questions-actions` 23, `data-quality` 36 (+6), `scope` 20 (+6), dll. | ✅     |
| Statis                    | `npm run lint`, `npm run format:check`, `npm run typecheck`                                          | 0 galat; `typecheck` kini dua lintasan (aplikasi + `tsconfig.test.json`) — menutup C-7 / R-33 setelah dirilis                | ✅     |
| Kualitas data (ISO 25012) | `tests/unit/data-quality.test.ts`                                                                    | 41 aturan (DQ-39…41 baru) hanya-baca; skenario cacat cakupan terdeteksi (TC-NF-14)                                           | ✅     |
| Keselamatan migrasi skema | Gladi `prisma/sql/2026-10-20-cakupan-standar.sql` pada salinan produksi (CHANGELOG 1.2.2)            | Jumlah baris 12 tabel identik sebelum/sesudah; `prisma migrate diff` kosong (TC-NF-15)                                       | ✅     |
| Pengaman seed demo        | `npx tsx prisma/seed-demo.ts` dengan `NODE_ENV=production` / tanpa `SEED_DEMO`                       | Keduanya ditolak exit 1 sebelum menyentuh DB (TC-SEC-13)                                                                     | ✅     |
| E2E alur bisnis           | `npx playwright test -c playwright.flows.config.ts` (`tests/e2e/flows/**`, DB sekali pakai)          | Suite ditulis 20 Okt 2026 (TC-AUD-01, -18, -29, -33 dan alur koordinator #1–#6); hasil eksekusi belum dicatat                | ⏳     |
| Penerapan produksi v1.2.2 | Prosedur [04 §5.1](../../04-DEPLOYMENT-IIS.md#51-perubahan-skema-basis-data-migrasi-manual) + deploy | Belum dieksekusi pada saat laporan (TC-NF-16)                                                                                | ⏳     |

Cakupan setelah addendum: **148** kasus uji (64 ✅, 41 ⚠️, 42 ⏳, 1 ❌); **66** kebutuhan, 100% memiliki kasus uji, A 47%,
A + B 79% ([TRACEABILITY §3](TRACEABILITY.md#3-ringkasan-cakupan)).

### 8.2 Defect ditemukan (v1.2.2)

| ID   | Defect                                                                                                        | Ditemukan oleh              | Severity | Perbaikan / status                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-08 | `prisma db push` 6.19 menghasilkan `DROP FOREIGN KEY` ganda untuk perubahan cakupan standar → gagal di tengah | Gladi pada salinan produksi | S1 (ops) | Migrasi SQL manual + prosedur wajib [RENCANA-PEMELIHARAAN §4.1](../RENCANA-PEMELIHARAAN.md#41-prosedur-wajib-perubahan-skema-basis-data) (R-31) — ✅ |
| D-09 | C-1: ubah nama standar menjadikan standar unit/kategori menjadi Umum                                          | Audit keamanan lanjutan     | S2       | Cakupan dipertahankan bila `scopeType` tidak dikirim — ✅ (TC-AUD-23)                                                                                |
| D-10 | C-2/C-4: butir dapat berada di luar cakupan standar; `updateStandard` tanpa cek duplikat                      | Audit keamanan lanjutan     | S2       | `isScopeWithin` ditegakkan; cek duplikat & eksistensi — ✅ (TC-AUD-24…27, -34)                                                                       |
| D-11 | C-3: `/audit` auditee memuat butir & unit lain di payload RSC                                                 | Audit keamanan lanjutan     | S2       | Filter sisi server — ✅ kode; verifikasi E2E ⏳ (TC-AUD-29)                                                                                          |
| D-12 | C-5/C-6: race duplikat tanpa unique DB; kategori cakupan string bebas                                         | Audit keamanan lanjutan     | S3       | Kunci `FOR UPDATE`; whitelist + ejaan kanonis — ✅ (TC-AUD-22, -28, -32 ⚠️)                                                                          |
| D-13 | C-7: `tsconfig.json` mengecualikan kode uji dari typecheck                                                    | Audit keamanan lanjutan     | S3       | `tsconfig.test.json` — ✅ (TC-NF-17)                                                                                                                 |

### 8.3 Risiko residual baru

R-31…R-36 di [RISK-REGISTER](../RISK-REGISTER.md): skema tanpa riwayat migrasi + cacat mesin migrasi (R-31), keunikan
nama standar hanya di aplikasi (R-32, dipantau DQ-41), typecheck uji (R-33, sedang ditutup), perubahan kategori unit
melanggar aturan cakupan (R-34, dipantau DQ-40), perubahan instrumen siklus nonaktif (R-35, diterima), seed demo ke DB
produksi (R-36). RR-1 berkurang untuk standar/butir (kini diuji dengan Prisma mock).

### 8.4 Rekomendasi

1. Catat hasil eksekusi suite `tests/e2e/flows/**` (5 profil atau minimal chromium) sebelum men-tag rilis perbaikan.
2. Terapkan v1.2.2 ke produksi **hanya** dengan prosedur §4.1/04 §5.1 (SQL manual sebelum `deploy-production.ps1`),
   lalu jalankan `scripts/data-quality.ts` dan perbarui [25012 §4](../25012-KUALITAS-DATA.md) dengan 41 aturan.
3. Tag rilis berikutnya (perbaikan C-1…C-7) setelah butir 1 lulus.
