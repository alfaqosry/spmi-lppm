# Matriks Ketertelusuran Kebutuhan ↔ Uji — SPMI v1.1.3

Acuan: ISO/IEC/IEEE 29119-3 (Test Design Specification — ketertelusuran ke basis uji). Kebutuhan memakai ID stabil
dari [01-PERANCANGAN](../../01-PERANCANGAN.md): **KF-01…KF-19** (§3), **KNF-01…KNF-12** (§4), **AB-01…AB-25** (§9),
ditambah **KNF-13…KNF-17** turunan yang diusulkan (§1.3). Kasus uji: [TEST-CASES](TEST-CASES.md) (awalan `TC-` dihilangkan).

**Tingkat cakupan:**
**A** = perilaku inti diverifikasi test otomatis yang lulus di v1.1.3 ·
**B** = logika inti lulus uji unit, tetapi UI/integrasi (Server Action, DB, rute) hanya dicakup kasus manual yang belum dieksekusi ·
**C** = hanya kasus manual, belum dieksekusi · **F** = diuji, gagal.

Berkas test: `auth` = `tests/unit/auth.test.ts` dst.; E2E ditulis `e2e/<nama>` = `tests/e2e/<nama>.spec.ts`.

## 1. Kebutuhan → Kasus Uji → Test Otomatis

### 1.1 Kebutuhan Fungsional (01 §3)

| ID    | Kebutuhan (ringkas)                                                    | Risiko   | Kasus uji                            | Test otomatis                          | Cakupan |
| ----- | ---------------------------------------------------------------------- | -------- | ------------------------------------ | -------------------------------------- | ------- |
| KF-01 | Login email + sandi dengan pembatas percobaan                          | R09      | LOG-01, -02, -03, -05, -06, -07, -09 | `e2e/login`, `e2e/auth`, `ratelimit`   | A       |
| KF-02 | Login SSO UP + auto-provisioning `pengunjung`                          | R10      | LOG-12, -16, -17                     | `sso`                                  | B       |
| KF-03 | Logout (hapus cookie sesi + SSO)                                       | R03      | LOG-11                               | `auth`                                 | B       |
| KF-04 | Ubah kata sandi mandiri                                                | R03      | LOG-19, -20                          | `password`                             | B       |
| KF-05 | CRUD siklus; satu aktif; nonaktif manual                               | R04, R07 | SIK-01, -06, -07                     | `guards`                               | B       |
| KF-06 | CRUD unit, kategori bebas                                              | R07      | UNT-01 … UNT-05                      | `guards`                               | B       |
| KF-07 | CRUD akun, penempatan multi-unit, 1 Kepala/unit                        | R01      | ROL-01, -03, -10, -12                | `auth`, `guards`, `validate`           | B       |
| KF-08 | Ketua LPM tunggal (penandatangan)                                      | R06      | ROL-08                               | —                                      | **C**   |
| KF-09 | Dokumen Penetapan/Evaluasi (PDF/tautan)                                | R02      | DOK-01, -02, -07                     | `upload`, `errors`                     | B       |
| KF-10 | Standar & butir (tunggal/massal), cakupan                              | R05      | AUD-01 … AUD-06                      | `scope`                                | A       |
| KF-11 | Jawaban Ya/Tidak + bukti/alasan; tolak bila tertutup                   | R04, R05 | AUD-07 … AUD-10                      | `errors`                               | B       |
| KF-12 | Verifikasi LPM (verified/revision + catatan)                           | R01      | AUD-13, -15                          | —                                      | **C**   |
| KF-13 | RTL oleh auditee                                                       | —        | AUD-15                               | —                                      | **C**   |
| KF-14 | Progres unit otomatis                                                  | R05      | DSH-03, AUD-17                       | `progress`                             | A       |
| KF-15 | Dashboard & analitik                                                   | —        | DSH-01, -02, -04, ANL-01             | `e2e/auth`, `guards`, `format`         | B       |
| KF-16 | Ekspor PDF keseluruhan & per unit + tanda tangan                       | R06, R01 | ANL-02 … ANL-08                      | `guards`, `ratelimit`, `validate`      | B       |
| KF-17 | Pengaturan sistem (identitas, SSO, keamanan, pemeliharaan, superadmin) | R15      | SET-01, -02, -04, -07, -09, -10      | `settings`, `upload`, `auth`, `guards` | A       |
| KF-18 | Log login & aktivitas, retensi                                         | R08      | SET-05, -06                          | `logs`                                 | A       |
| KF-19 | Privasi: persetujuan, ekspor data, purge                               | R08      | PRV-02 … PRV-06, PRV-08              | `privacy`, `format`, `ratelimit`       | A\*     |

\* KF-19 di 01 §3 masih tertulis "_Sedang ditambahkan_", padahal fitur sudah dirilis di v1.1.0 — usulkan pemilik 01 memperbarui kolom implementasi.

### 1.2 Kebutuhan Non-Fungsional (01 §4)

| ID     | Kebutuhan (ringkas)                                            | Kasus uji                                       | Test otomatis / alat                              | Cakupan                              |
| ------ | -------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| KNF-01 | Sesi JWT cookie aman (`__Host-`, httpOnly, Lax, Secure)        | LOG-08, -10, PRV-09, SEC-01, -03, -04, -09, -12 | `auth`, `guards`, `net`, `e2e/auth`, `e2e/public` | A                                    |
| KNF-02 | `AUTH_SECRET` ≥ 32 wajib (fail-closed)                         | SEC-02                                          | `auth`                                            | A                                    |
| KNF-03 | Header keamanan (CSP, HSTS, XFO, nosniff, …)                   | SEC-05                                          | `e2e/public`, `smoke-test.ps1`                    | A                                    |
| KNF-04 | Unggahan aman (whitelist, magic bytes, ukuran, tanpa SVG)      | DOK-04, -05, -06, -08, AUD-19, SET-02, SEC-08   | `upload`, `guards`                                | A                                    |
| KNF-05 | Pesan galat generik ke klien                                   | SEC-06, -07, -10                                | `errors`, `validate`, `e2e/public`                | A                                    |
| KNF-06 | Peran SSO tidak dipercaya kecuali whitelist / `SSO_TRUST_ROLE` | LOG-14, -18                                     | `sso`                                             | A                                    |
| KNF-07 | Satu instance PM2 + rollback otomatis                          | NF-10                                           | `smoke-test.ps1`, `rollback.ps1`                  | A                                    |
| KNF-08 | `bodySizeLimit` 10 MB, gzip, standalone                        | NF-11                                           | —                                                 | **C**                                |
| KNF-09 | WCAG 2.1 AA (axe)                                              | DSH-05, NF-01, -02, -03, -12                    | `e2e/a11y`, `e2e/login`, `e2e/auth`               | A (publik); dashboard hanya produksi |
| KNF-10 | Lokalisasi Indonesia, `id-ID`, Asia/Jakarta                    | NF-06                                           | `format`, `e2e/public`                            | A                                    |
| KNF-11 | Kepatuhan UU 27/2022 PDP                                       | PRV-01, -07                                     | `redact`, `e2e/public`                            | A                                    |
| KNF-12 | Keterpeliharaan: TS strict, lint, uji di CI                    | SEC-11                                          | `npm run ci`, `npm run audit`                     | A                                    |

### 1.3 Kebutuhan Turunan (diusulkan)

Belum tercantum di 01; diturunkan dari [09-DAFTAR-STANDAR](../../09-DAFTAR-STANDAR.md) dan
[../9241-USABILITAS/KONTEKS-PENGGUNAAN §5](../9241-USABILITAS/KONTEKS-PENGGUNAAN.md#5-sasaran-kegunaan-terukur).
Usulkan agar pemilik 01 menambahkannya ke §4.

| ID     | Kebutuhan                                                                                | Sumber      | Kasus uji  | Test otomatis / alat             | Cakupan                   |
| ------ | ---------------------------------------------------------------------------------------- | ----------- | ---------- | -------------------------------- | ------------------------- |
| KNF-13 | Kompatibilitas Chrome/Edge, Firefox, Safari, Android, iOS; responsif ≥ 320 px, zoom 200% | 09 §4, §15  | NF-04, -05 | `e2e/login`, 5 profil Playwright | A (iOS perangkat asli ⏳) |
| KNF-14 | SEO & metadata; halaman privat `noindex`, tidak di sitemap                               | 09 §8       | NF-07      | `e2e/public`, Lighthouse SEO     | A                         |
| KNF-15 | Kinerja: Lighthouse Perf ≥ 90 (desktop & mobile), LCP < 2,5 s, CLS < 0,1                 | 09 §6       | NF-08, -09 | Lighthouse                       | **F** (mobile 66–77)      |
| KNF-16 | Operasional: smoke test pasca-deploy, health endpoint, backup sebelum deploy             | 09 §19      | NF-10      | `smoke-test.ps1`                 | A                         |
| KNF-17 | Kegunaan: sukses tugas kritis ≥ 90%, SUS ≥ 68 (target ≥ 75)                              | ISO 9241-11 | NF-13      | —                                | **C**                     |

### 1.4 Aturan Bisnis (01 §9)

| ID    | Aturan (ringkas)                                | Kasus uji                | Test otomatis       | Cakupan                        |
| ----- | ----------------------------------------------- | ------------------------ | ------------------- | ------------------------------ |
| AB-01 | Hanya satu siklus aktif                         | SIK-02                   | —                   | **C**                          |
| AB-02 | Siklus terbuka s.d. 23:59:59 WIB `end_date`     | SIK-04                   | `cycles`            | A                              |
| AB-03 | Jawaban & RTL ditolak bila siklus tertutup      | SIK-05                   | `cycles`            | B                              |
| AB-04 | `end_date` ≥ `start_date`                       | SIK-03                   | `validate`          | B                              |
| AB-05 | Auditee hanya siklus aktif; LPM siklus terakhir | DSH-04                   | —                   | **C**                          |
| AB-06 | Ya wajib bukti; Tidak wajib alasan              | AUD-07, -08, -10         | `errors`            | B                              |
| AB-07 | Bukti hanya PDF (magic bytes) ≤ 10 MB           | DOK-06, AUD-09           | `upload`            | A                              |
| AB-08 | Hanya unit penempatan & butir yang berlaku      | AUD-11, -12              | `guards`            | B                              |
| AB-09 | Ubah jawaban → `pending`, catatan LPM direset   | AUD-16                   | —                   | **C**                          |
| AB-10 | Verifikasi hanya LPM; revisi wajib catatan      | AUD-13, -14, -21, SEC-04 | `guards`, `auth`    | A (otorisasi); catatan wajib C |
| AB-11 | Status progres belum_mulai/mengisi/selesai      | AUD-17                   | `progress`          | A                              |
| AB-12 | Satu Kepala Unit per unit                       | ROL-04                   | —                   | **C**                          |
| AB-13 | Rangkap jabatan; sinkron peran global           | ROL-05, -06, -07, AUD-20 | `auth`, `scope`     | B                              |
| AB-14 | Akun LPM tidak dapat ditempatkan pada unit      | ROL-09                   | `guards`            | B                              |
| AB-15 | Satu Ketua LPM; penandatangan PDF               | ROL-08, ANL-04           | —                   | **C**                          |
| AB-16 | Akun SSO baru = pengunjung kecuali whitelist    | LOG-12, -13, -15         | `sso`               | B                              |
| AB-17 | Pencocokan SSO username → email → sso_id        | LOG-15                   | —                   | **C**                          |
| AB-18 | Kata sandi min. 8 (+ kebijakan)                 | LOG-19, ROL-02           | `password`          | B                              |
| AB-19 | Pesan login seragam; akun nonaktif ditolak      | LOG-03, -04              | `e2e/login`, `auth` | A                              |
| AB-20 | Pemeliharaan: hanya superadmin                  | SET-08                   | `guards`            | B                              |
| AB-21 | Nama standar unik; hapus standar berantai       | AUD-01, -18              | —                   | **C**                          |
| AB-22 | Dokumen wajib PDF atau tautan http(s)           | DOK-02, -03              | `errors`            | A                              |
| AB-23 | Secret pengaturan tidak dikirim ke klien        | SET-03                   | `settings`          | A                              |
| AB-24 | Retensi log login otomatis                      | PRV-08                   | `privacy`           | A                              |
| AB-25 | Admin tidak dapat menghapus akunnya sendiri     | ROL-11                   | —                   | **C**                          |

## 2. Test Otomatis → Kebutuhan (arah balik)

| Berkas test                     | Eksekusi\*         | Kebutuhan yang diverifikasi                                   |
| ------------------------------- | ------------------ | ------------------------------------------------------------- |
| `tests/unit/auth.test.ts`       | 18                 | KF-03, KF-07, KF-17, KNF-01, KNF-02, AB-10, AB-13, AB-19      |
| `tests/unit/cycles.test.ts`     | 9                  | AB-02, AB-03                                                  |
| `tests/unit/errors.test.ts`     | 22                 | KNF-05, KF-09, KF-11, AB-06, AB-22                            |
| `tests/unit/format.test.ts`     | 16                 | KNF-10, KF-15, KF-19                                          |
| `tests/unit/guards.test.ts`     | 7                  | KNF-01, KF-05…KF-07, KF-15, KF-16, AB-08, AB-10, AB-14, AB-20 |
| `tests/unit/logs.test.ts`       | 6                  | KF-18, KNF-11                                                 |
| `tests/unit/net.test.ts`        | 13                 | KNF-01 (IP klien untuk rate limit & log)                      |
| `tests/unit/password.test.ts`   | 9                  | KF-04, AB-18                                                  |
| `tests/unit/privacy.test.ts`    | 5                  | KF-19, AB-24                                                  |
| `tests/unit/progress.test.ts`   | 5                  | KF-14, AB-11                                                  |
| `tests/unit/ratelimit.test.ts`  | 11                 | KF-01, KF-16, KF-19                                           |
| `tests/unit/redact.test.ts`     | 14                 | KNF-11, KF-18                                                 |
| `tests/unit/scope.test.ts`      | 14                 | KF-10, AB-08, AB-13                                           |
| `tests/unit/settings.test.ts`   | 14                 | KF-17, AB-23                                                  |
| `tests/unit/sso.test.ts`        | 10                 | KF-02, KNF-06, AB-16                                          |
| `tests/unit/upload.test.ts`     | 73                 | KNF-04, KF-09, KF-17, AB-07                                   |
| `tests/unit/validate.test.ts`   | 41                 | KNF-05, KF-07, KF-16, AB-04                                   |
| `tests/e2e/login.spec.ts`       | 8 × 5 profil       | KF-01, AB-19, KNF-09, KNF-13                                  |
| `tests/e2e/public.spec.ts`      | 9 × 5              | KNF-01, KNF-03, KNF-05, KNF-10, KNF-11, KNF-14                |
| `tests/e2e/a11y.spec.ts`        | 6 × 5              | KNF-09                                                        |
| `tests/e2e/auth.spec.ts`        | 4 × 5 (butuh akun) | KF-01, KNF-01, KNF-09, KF-15                                  |
| `scripts/deploy/smoke-test.ps1` | 1 skrip            | KNF-03, KNF-07, KNF-16                                        |

\* Jumlah eksekusi test (termasuk ekspansi `it.each`) pada baseline v1.1.3 — total Vitest **287** (17 berkas), Playwright **27 × 5 profil = 135**.

## 3. Ringkasan Cakupan

| Kelompok            | Jumlah | A            | B            | C            | F          | Tanpa kasus uji |
| ------------------- | ------ | ------------ | ------------ | ------------ | ---------- | --------------- |
| KF (fungsional)     | 19     | 6            | 10           | 3            | 0          | 0               |
| KNF-01…12           | 12     | 11           | 0            | 1            | 0          | 0               |
| KNF-13…17 (turunan) | 5      | 3            | 0            | 1            | 1          | 0               |
| AB (aturan bisnis)  | 25     | 8            | 9            | 8            | 0          | 0               |
| **Total**           | **61** | **28 (46%)** | **19 (31%)** | **13 (21%)** | **1 (2%)** | **0**           |

Interpretasi: **100%** kebutuhan memiliki ≥ 1 kasus uji; **77%** (A + B) memiliki verifikasi otomatis atas logika intinya;
hanya **46%** yang perilaku ujung-ke-ujungnya terverifikasi otomatis. Seluruh B/C bergantung pada eksekusi UAT.

## 4. Celah & Tindak Lanjut

| No  | Celah                                                                                                                                      | Kebutuhan                                                     | Usulan                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G1  | Server Actions (`src/lib/actions/*`) dikecualikan dari cakupan unit — verifikasi, RTL, penempatan, Ketua LPM, standar tidak diuji otomatis | KF-08, KF-12, KF-13, AB-01, AB-09, AB-12, AB-15, AB-21, AB-25 | Uji integrasi Vitest + MySQL sekali pakai (Testcontainers) untuk `responses.ts`, `units.ts`, `cycles.ts`, `questions.ts` |
| G2  | Laporan PDF (`src/lib/report/**`) tidak diuji                                                                                              | KF-16, AB-15                                                  | Uji isi PDF (ekstrak teks) & snapshot struktur; uji sanitasi `pdfText()`                                                 |
| G3  | E2E terautentikasi hanya 4 test, satu akun; tidak ada alur per peran                                                                       | KF-05…KF-16                                                   | Fixture login per peran dari seed; alur siklus → pengisian → verifikasi → ekspor                                         |
| G4  | Callback SSO & sinkronisasi akun tidak diuji otomatis                                                                                      | KF-02, AB-16, AB-17                                           | Mock server OAuth untuk `/api/sso/*`                                                                                     |
| G5  | Route handler `/api/export`, `/api/files/*`, `/api/me/export` hanya diuji manual                                                           | KF-16, KF-19, KNF-04                                          | Test `request` Playwright untuk 401/403/400/404/429                                                                      |
| G6  | Kinerja mobile gagal                                                                                                                       | KNF-15                                                        | Lihat [09 §6](../../09-DAFTAR-STANDAR.md#6-performa-web) tindak lanjut                                                   |
| G7  | Kegunaan belum diukur                                                                                                                      | KNF-17                                                        | [RENCANA-UJI-USABILITAS](../9241-USABILITAS/RENCANA-UJI-USABILITAS.md)                                                   |
| G8  | `bodySizeLimit` 10 MB melalui Cloudflare/IIS belum diverifikasi                                                                            | KNF-08                                                        | Eksekusi TC-NF-11 di lingkungan setara produksi                                                                          |
| G9  | 01 tidak memuat KNF untuk kompatibilitas, SEO, kinerja, operasional, kegunaan                                                              | KNF-13…17                                                     | Tambahkan ke 01 §4 (pemilik dokumen 01)                                                                                  |
