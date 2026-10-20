# Strategi Pengujian (Test Strategy) — SPMI

Acuan: ISO/IEC/IEEE 29119-2 §7.2.4.5, 29119-3 §6.3 & §7.2, teknik desain 29119-4. Berlaku untuk rilis v1.x.
Implementasi alat & perintah: [06-PENGUJIAN](../../06-PENGUJIAN.md).

## 1. Pendekatan

**Berbasis risiko** (29119-1 §5.4): risiko produk diidentifikasi (§2), lalu dipetakan ke level, jenis, dan teknik uji.
Piramida: banyak uji unit cepat → E2E lintas peramban untuk alur & kontrak HTTP → a11y otomatis → smoke test tiap deploy →
UAT & uji usabilitas manual tiap rilis MINOR/MAJOR.

## 2. Analisis Risiko Produk

Skala: Kemungkinan (K) & Dampak (D) 1–3; Skor = K × D (≥ 6 tinggi, 3–4 sedang, ≤ 2 rendah).

| ID  | Risiko                                                                             | K   | D   | Skor | Mitigasi uji                                                                                                                               |
| --- | ---------------------------------------------------------------------------------- | --- | --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R01 | Eskalasi peran / akses lintas unit (IDOR) membocorkan data audit                   | 2   | 3   | 6    | Unit `guards.test.ts` (matriks peran, `requireUnitMember`, `canReadUnit`); UAT A-08, A-15, R-10, N-05                                      |
| R02 | Unggahan berbahaya (bukan PDF, PDF aktif, path traversal)                          | 2   | 3   | 6    | Unit `upload.test.ts` (magic bytes, `/JavaScript`, whitelist folder, MIME); UAT P-04                                                       |
| R03 | Sesi dapat dipalsukan / tidak dapat dicabut                                        | 1   | 3   | 3    | Unit `auth.test.ts` (JWT, `session_version`, fail-closed); E2E cookie                                                                      |
| R04 | Batas waktu siklus salah (zona waktu) → auditee terkunci / masih bisa mengisi      | 2   | 3   | 6    | Unit `cycles.test.ts` (nilai batas 23:59:59 / 00:00 WIB); UAT S-05                                                                         |
| R05 | Cakupan pertanyaan salah → unit menjawab butir yang tidak berlaku / progres keliru | 2   | 3   | 6    | Unit `scope.test.ts`, `progress.test.ts`, `questions-actions.test.ts` (cakupan butir ⊆ standar, v1.2.2), DQ-17/39/40; UAT A-03, A-04, A-13 |
| R06 | Laporan PDF salah data / penandatangan                                             | 2   | 3   | 6    | UAT N-02–N-04 (⚠ belum ada uji otomatis `src/lib/report/**`)                                                                               |
| R07 | Kehilangan data karena penghapusan berantai                                        | 2   | 3   | 6    | UAT S-, U-03, A-14 + evaluasi heuristik HE-03/04/05                                                                                        |
| R08 | Kebocoran data pribadi di log / galat                                              | 2   | 2   | 4    | Unit `redact.test.ts`, `logs.test.ts`, `errors.test.ts`                                                                                    |
| R09 | Brute force login / penyalahgunaan endpoint                                        | 2   | 2   | 4    | Unit `ratelimit.test.ts`, `net.test.ts` (IP palsu); UAT L-05, N-07                                                                         |
| R10 | SSO gagal / salah memetakan akun & peran                                           | 2   | 2   | 4    | Unit `sso.test.ts`; UAT L-07–L-10 (⚠ callback tidak diuji otomatis)                                                                        |
| R11 | Regresi tampilan / aksesibilitas di peramban tertentu (Safari, ponsel)             | 2   | 2   | 4    | E2E 5 profil, axe, reflow 320 px / 200%                                                                                                    |
| R12 | Deploy gagal → layanan mati                                                        | 1   | 3   | 3    | Gerbang test + smoke test + rollback otomatis (`scripts/deploy/*`)                                                                         |
| R13 | Kinerja mobile buruk menurunkan penyelesaian pengisian                             | 3   | 1   | 3    | Lighthouse per rilis (target ≥ 90)                                                                                                         |
| R14 | Kegunaan rendah (auditee tidak tahu tenggat/revisi)                                | 3   | 2   | 6    | Evaluasi heuristik + uji usabilitas ([9241](../9241-USABILITAS/README.md))                                                                 |
| R15 | Pengaturan rahasia (Client Secret SSO) bocor ke klien                              | 1   | 3   | 3    | Unit `settings.test.ts`; UAT G-03                                                                                                          |

## 3. Level Uji

| Level                      | Alat / lokasi                                                                                             | Objek                                                                                                     | Teknik utama                                    | Pemicu                                                                                  | Penanggung jawab |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------- |
| Unit / komponen            | **Vitest 4** — `tests/unit/*.test.ts` (17 berkas), `vitest.config.mts` (env `node`, `TZ=Asia/Jakarta`)    | Fungsi murni & layanan `src/lib/**` dengan Prisma di-_mock_; cakupan diukur kecuali `report/`, `actions/` | Partisi ekuivalen, nilai batas, tabel keputusan | CI (`ci.yml`), gerbang deploy (`deploy-production.ps1` langkah b), lokal sebelum commit | Pengembang       |
| Sistem — E2E UI & HTTP     | **Playwright** — `tests/e2e/*.spec.ts`; 5 profil: `chromium`, `firefox`, `webkit`, `pixel-7`, `iphone-14` | Halaman publik, redirect guard, header keamanan, SEO, 404; alur login (opsional dengan akun)              | Skenario, kontrak HTTP                          | PR yang menyentuh UI, `e2e.yml` (manual + terjadwal 19:00 UTC), sebelum rilis           | Pengembang       |
| Aksesibilitas              | **@axe-core/playwright** — `tests/e2e/a11y.spec.ts` (tag `@a11y`, WCAG 2.0 A/AA + 2.1 AA)                 | Login, login + galat, 320 px, 404, legal; dashboard (dengan akun)                                         | Pemindaian aturan + pemeriksaan manual grafik   | `npm run test:a11y` sebelum rilis                                                       | Pengembang       |
| Keamanan statis/dependensi | `npm run audit`, ESLint, CodeQL (`.github/workflows/codeql.yml`), review checklist PR                     | Dependensi produksi, kode                                                                                 | Analisis statis                                 | CI                                                                                      | Pengembang       |
| Smoke / operasional        | `scripts/deploy/smoke-test.ps1`                                                                           | `/api/health` (db ok), rute dasar, kode status, header keamanan                                           | Uji asap                                        | Setiap deploy (otomatis; gagal → rollback)                                              | Operator         |
| Kinerja                    | Lighthouse 12.x (desktop & mobile)                                                                        | `/login`, halaman legal                                                                                   | Pengukuran terhadap anggaran                    | Per rilis MINOR                                                                         | Pengembang       |
| Penerimaan (UAT)           | [FORMULIR-UAT](FORMULIR-UAT.md) / [TEST-CASES](TEST-CASES.md) tipe manual                                 | Seluruh modul per peran pada lingkungan uji                                                               | Skenario bisnis, eksploratif berbatas waktu     | Rilis MINOR/MAJOR                                                                       | Perwakilan peran |
| Usabilitas                 | [RENCANA-UJI-USABILITAS](../9241-USABILITAS/RENCANA-UJI-USABILITAS.md)                                    | Tugas kritis per peran                                                                                    | Uji moderasi, SUS/SEQ                           | Rilis MAJOR / perubahan UI besar                                                        | LPM + pengembang |

## 4. Teknik Desain (29119-4) — contoh penerapan

| Teknik                      | Penerapan pada SPMI                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Partisi ekuivalen           | Peran (6 kelas) × fungsi guard; ekstensi/MIME berkas valid vs berbahaya; skema URL `http(s)` vs lainnya                                 |
| Analisis nilai batas        | `end_date` 23:59:59 vs 00:00 WIB; ukuran 10 MB / 2 MB; kata sandi 7/8 karakter & 72 byte; masa sesi 1/30 hari; ID 0/−1/2147483648       |
| Tabel keputusan             | Jawaban × lampiran: Ya+bukti ✔, Ya tanpa bukti ✖, Tidak+alasan ✔, Tidak tanpa alasan ✖; siklus terbuka × peran × penempatan             |
| Transisi status             | Jawaban `pending` → `verified`/`revision` → (ubah) `pending`; progres `belum_mulai` → `mengisi` → `selesai`; peran pengunjung ↔ auditee |
| Uji berbasis skenario       | UAT per peran (06 §4, [FORMULIR-UAT](FORMULIR-UAT.md))                                                                                  |
| Tebakan galat / eksploratif | Manipulasi `unitId`/`existingFile` di DevTools, Server Action dipanggil langsung, token JWT `alg=none`                                  |

## 5. Kriteria Masuk & Keluar

| Level   | Kriteria masuk                                                                                               | Kriteria keluar (lulus)                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Unit    | Kode terkompilasi (`npm run typecheck`), lint bersih                                                         | 100% test lulus; tidak ada test `.only`; cakupan `src/lib` tidak turun dari rilis sebelumnya                                  |
| E2E     | Build produksi (`npm run build`) berjalan; DB uji sekali pakai ter-_seed_; `E2E_BASE_URL` **bukan** produksi | 0 gagal di 5 profil; setiap _skip_ beralasan terdokumentasi (akun tidak diset, keyboard di perangkat sentuh, batas WebKit)    |
| A11y    | Seperti E2E                                                                                                  | 0 pelanggaran axe (seluruh tingkat, tag WCAG yang diuji)                                                                      |
| Smoke   | Rilis tersalin & PM2 berjalan                                                                                | Semua cek `[OK]`; bila gagal → rollback otomatis                                                                              |
| Kinerja | Build produksi di server produksi/uji                                                                        | Desktop Perf ≥ 90, A11y ≥ 95, SEO ≥ 95; mobile Perf ≥ 90 (**saat ini tidak terpenuhi — risiko diterima**)                     |
| UAT     | Rilis kandidat di lingkungan uji; akun uji tiap peran; seed data                                             | Semua kasus prioritas tinggi lulus; gagal lainnya tercatat sebagai issue dengan keputusan penerimaan; formulir ditandatangani |
| Rilis   | Semua di atas                                                                                                | `npm run ci` hijau, `npm run audit` 0 high/critical, tidak ada defect S1/S2 terbuka, laporan penyelesaian disetujui           |

**Penangguhan:** E2E/UAT dihentikan bila lingkungan tidak stabil (> 20% gagal karena infrastruktur) atau ditemukan S1;
dilanjutkan setelah perbaikan dan uji ulang _smoke_.

## 6. Lingkungan Uji

| Lingkungan       | Deskripsi                                                                                                                                                                                    | Dipakai untuk                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Lokal pengembang | `npm run dev` / `docker-compose`, `.env` lokal                                                                                                                                               | Unit, E2E saat pengembangan                                                 |
| E2E sekali pakai | Kontainer **MySQL 8** baru per eksekusi (lokal) atau _service_ `mysql:8.4` DB `lpm_spmi_e2e` di `e2e.yml`; `prisma db push` + `npm run db:seed`; aplikasi standalone `http://127.0.0.1:3002` | E2E, a11y, UAT terkontrol                                                   |
| Staging          | ⏳ belum ada ([09 §14](../../09-DAFTAR-STANDAR.md#14-manajemen-lingkungan))                                                                                                                  | (rencana) UAT, usabilitas                                                   |
| Produksi         | `https://spmi.universitaspahlawan.ac.id` (Cloudflare → IIS ARR → PM2)                                                                                                                        | Smoke test, Lighthouse, E2E **baca-saja** terautentikasi dengan akun khusus |

## 7. Data Uji

- Data sintetis dari `prisma/seed.ts` (akun e2e `*@example.test`, sandi dibangkitkan per _run_ di CI).
- Berkas uji dibangkitkan dalam test (`Buffer` PDF minimal, PDF dengan `/JavaScript`, berkas > 10 MB) — tidak ada berkas nyata.
- Larangan: menyalin dump produksi ke lingkungan uji tanpa anonimisasi.

## 8. Otomatisasi & Regresi

- Hook pre-commit menjalankan Prettier + ESLint pada berkas staged (`scripts/hooks/pre-commit`); seluruh suite unit dijalankan di CI (`ci.yml`: lint, format, typecheck,
  `test:coverage`, audit, build) dan **gerbang deploy** produksi.
- Suite E2E penuh = regresi rilis; `--project=chromium` untuk umpan balik cepat.
- Test _flaky_ diperbaiki atau dikarantina dengan issue — tidak dibiarkan diulang (`retries` hanya 2 di CI).

## 9. Metrik & Pelaporan

Jumlah test lulus/gagal/dilewati per level & profil; defect per severity & modul; cakupan kebutuhan
([TRACEABILITY](TRACEABILITY.md)); skor Lighthouse; hasil UAT & SUS. Dilaporkan di [TEST-COMPLETION-REPORT](TEST-COMPLETION-REPORT.md) tiap rilis.

## 10. Celah Strategi yang Diketahui

| Celah                                                                                          | Rencana                                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Server Actions (`src/lib/actions/**`) & laporan PDF (`src/lib/report/**`) tidak diuji otomatis | Uji integrasi dengan DB sekali pakai; uji isi PDF (teks) dengan parser |
| E2E terautentikasi hanya 4 test & satu peran                                                   | Fixture login per peran + alur siklus, pengisian, verifikasi, ekspor   |
| Callback SSO tidak diuji otomatis                                                              | Mock server OAuth di E2E                                               |
| Axe dashboard memerlukan akun di CI                                                            | Isi `E2E_EMAIL`/`E2E_PASSWORD` di `e2e.yml` (sudah di-_seed_)          |
| Uji perangkat iOS asli, pembaca layar manual                                                   | Sesi manual per rilis MAJOR                                            |
