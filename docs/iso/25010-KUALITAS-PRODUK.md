# ISO/IEC 25010:2023 + ISO/IEC 25023 — Model & Pengukuran Kualitas Produk SPMI

Evaluasi kualitas produk **Sistem Informasi SPMI — LPM Universitas Pahlawan Tuanku Tambusai**
(`https://spmi.universitaspahlawan.ac.id`) terhadap **9 karakteristik** model kualitas produk ISO/IEC 25010:2023,
dengan ukuran (_measures_) mengacu ISO/IEC 25023:2016.

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3         | Dokumen Internal |
| 1.1           | 20 Oktober 2026 | v1.2.2         | Dokumen Internal |

Perubahan 1.1 (addendum v1.2.2): KF-20 cakupan standar ditambahkan ke §3.1 (20 kebutuhan), angka uji unit & aturan
kualitas data diperbarui (§3.2). Ukuran lain tetap hasil pengukuran 17 Okt 2026.

Keterangan: ✅ memenuhi target · ⚠️ sebagian / di bawah target · ❌ tidak memenuhi · ⏳ belum diukur (butuh
tindakan/alat/data di luar kode) · **N/U** belum diukur. Semua angka di dokumen ini **diukur nyata** pada tanggal di atas
atau dikutip dari hasil terukur di [09-DAFTAR-STANDAR](../09-DAFTAR-STANDAR.md); yang tidak diukur ditandai demikian.

## 1. Metode

- **Model:** ISO/IEC 25010:2023 (9 karakteristik: kesesuaian fungsional, efisiensi kinerja, kompatibilitas, kapabilitas
  interaksi, keandalan, keamanan, keterpeliharaan, fleksibilitas, keselamatan).
- **Ukuran:** ISO/IEC 25023:2016 — kode ukuran ditulis seperti di standar (mis. `PTb-1-G`). ISO/IEC 25023 belum
  diterbitkan ulang untuk model 2023, sehingga sub-karakteristik baru (_resistance_, _scalability_, _inclusivity_,
  _user engagement_, _self-descriptiveness_, seluruh _safety_) memakai **ukuran turunan** bertanda `D-…` dengan formula
  yang dinyatakan eksplisit.
- **Proses evaluasi:** ringkas mengikuti ISO/IEC 25040 (tetapkan kebutuhan → spesifikasi ukuran & target → ukur →
  nilai). Kualitas **data** dievaluasi terpisah di [25012-KUALITAS-DATA](25012-KUALITAS-DATA.md).
- **Lingkungan ukur:** server produksi (Windows Server 2025, Intel Xeon E5-2673 v3 @ 2,40 GHz, RAM 32 GB), Node 20.19,
  Next.js 16 standalone di PM2 → IIS ARR → Cloudflare.

## 2. Ringkasan

| No  | Karakteristik (ISO 25010:2023)       | Ukuran kunci (hasil)                                                                              | Status |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------ |
| 1   | Kesesuaian fungsional                | Kebutuhan terimplementasi 20/20 (100%); kebutuhan teruji otomatis 14/20 (70%) — v1.2.2            | ⚠️     |
| 2   | Efisiensi kinerja                    | p95 origin 10–26 ms; p95 via Cloudflare 470–662 ms; Lighthouse desktop 96–97, mobile 66–77        | ⚠️     |
| 3   | Kompatibilitas                       | 5 profil browser lulus E2E; berbagi server dengan aplikasi lain tanpa konflik port                | ✅     |
| 4   | Kapabilitas interaksi                | Lighthouse A11y 100; axe 0 pelanggaran; 320 px tanpa scroll horizontal; UAT/SUS belum             | ⚠️     |
| 5   | Keandalan                            | MTTR insiden 17 Okt ≈ 6 menit; uji restore lulus; ketersediaan % belum dipantau eksternal         | ⚠️     |
| 6   | Keamanan                             | 29/29 temuan audit internal ditutup; `npm audit` 0; 7/7 header keamanan; audit pihak ketiga belum | ✅ ⏳  |
| 7   | Keterpeliharaan                      | Coverage `src/lib` baris 95,3% / cabang 91,7%; lint 0; TS strict 0 error; 3 komponen > 900 LOC    | ⚠️     |
| 8   | Fleksibilitas                        | Konfigurasi via env & Pengaturan; deploy skrip ±5 menit + rollback; skala 1 instance              | ⚠️     |
| 9   | Keselamatan (_safety_, baru di 2023) | Fail-safe (AUTH_SECRET fail-closed, mode pemeliharaan 503, rollback otomatis), konfirmasi aksi    | ✅     |

Prioritas perbaikan: (1) uji otomatis Server Actions (KF-07/08/12/13/15/16), (2) performa mobile & ekor latensi
Cloudflare, (3) monitor uptime eksternal untuk mengukur ketersediaan, (4) pecah komponen `audit-workspace.tsx`.

## 3. Kesesuaian Fungsional (_Functional suitability_)

### 3.1 Kelengkapan fungsional — `FCp-1-G` _functional coverage_

Formula: `X = 1 − A/B`, A = fungsi yang tidak ada/hilang, B = fungsi yang dispesifikasikan (KF-01…KF-20,
[01-PERANCANGAN §3](../01-PERANCANGAN.md)). Target: X = 1,0.

| Kode  | Kebutuhan (ringkas)                        | Implementasi                                                         | Uji otomatis (bukti)                                                               |
| ----- | ------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| KF-01 | Login email + sandi, pembatas percobaan    | `actions/auth.ts`, `ratelimit.ts`                                    | ✅ `auth`, `password`, `ratelimit`; E2E `auth.spec` (prod)                         |
| KF-02 | Login SSO UP                               | `api/sso/[...sso]`, `sso.ts`                                         | ✅ `sso.test.ts`                                                                   |
| KF-03 | Logout & revokasi sesi                     | `logoutAction`, `session_version`                                    | ✅ `auth.test.ts`                                                                  |
| KF-04 | Ubah kata sandi mandiri                    | `actions/profile.ts`                                                 | ✅ `password.test.ts` (kebijakan)                                                  |
| KF-05 | CRUD siklus, satu siklus aktif             | `actions/cycles.ts`                                                  | ✅ `cycles.test.ts` (logika buka/tutup) — aksi CRUD ❌                             |
| KF-06 | CRUD unit, kategori                        | `actions/units.ts`, `scope.ts`                                       | ⚠️ `scope.test.ts` (kategori) — aksi CRUD ❌                                       |
| KF-07 | Akun, penempatan multi-unit, 1 Kepala Unit | `assignMember`, `syncUserAccess`                                     | ❌ (dijaga data oleh DQ-03…DQ-05)                                                  |
| KF-08 | Ketua LPM tunggal                          | `setLpmHead`                                                         | ❌ (dijaga data oleh DQ-06)                                                        |
| KF-09 | Repositori dokumen PDF/tautan              | `actions/documents.ts`                                               | ✅ `upload.test.ts`                                                                |
| KF-10 | Standar & butir, cakupan all/category/unit | `actions/questions.ts`, `scope.ts`                                   | ✅ `scope.test.ts`, `questions-actions.test.ts` (Server Actions)                   |
| KF-11 | Jawaban Ya/Tidak + bukti/alasan            | `saveResponse`                                                       | ✅ `cycles`, `scope`, `upload`, `guards`                                           |
| KF-12 | Verifikasi LPM                             | `verifyResponse`                                                     | ❌ (otorisasi saja di `guards.test.ts`)                                            |
| KF-13 | RTL auditee                                | `saveRtl`                                                            | ❌                                                                                 |
| KF-14 | Progres unit otomatis                      | `progress.ts`                                                        | ✅ `progress.test.ts`                                                              |
| KF-15 | Dashboard & analitik                       | `(dashboard)/dashboard`, `analitik`                                  | ❌                                                                                 |
| KF-16 | Ekspor PDF + tanda tangan Ketua LPM        | `api/export`, `lib/report/*`                                         | ❌ (`lib/report` dikecualikan dari coverage)                                       |
| KF-17 | Pengaturan sistem                          | `actions/settings.ts`, `settings.ts`                                 | ✅ `settings.test.ts`                                                              |
| KF-18 | Log login & aktivitas                      | `logs.ts`                                                            | ✅ `logs.test.ts`, `redact.test.ts`                                                |
| KF-19 | Privasi: consent, ekspor data, purge       | `privacy.ts`, `api/me/export`, `privacy-purge`                       | ✅ `privacy.test.ts`                                                               |
| KF-20 | Cakupan standar (v1.2.2)                   | `createStandard`/`updateStandard`, `isScopeWithin`, `audit/page.tsx` | ✅ `questions-actions.test.ts`, `scope.test.ts`, `data-quality.test.ts` (DQ-39…41) |

| Ukuran                                 | Formula                              | Target | Hasil            | Status |
| -------------------------------------- | ------------------------------------ | ------ | ---------------- | ------ |
| `FCp-1-G` cakupan fungsional           | 1 − (KF tidak terimplementasi / 20)  | 1,0    | **1,0** (20/20)  | ✅     |
| `D-FCp` cakupan uji otomatis kebutuhan | KF dengan uji otomatis langsung / 20 | ≥ 0,9  | **0,70** (14/20) | ⚠️     |

Catatan: catatan v1.0 bahwa KF-19 di 01-PERANCANGAN tertulis "_Sedang ditambahkan_" sudah tidak berlaku — 01 §3 kini
menulis "Diterapkan (v1.1.0)".

### 3.2 Kebenaran fungsional — `FCr-1-G` _functional correctness_

| Ukuran                                    | Formula                                 | Target | Hasil                                                                                                   | Status |
| ----------------------------------------- | --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- | ------ |
| `FCr-1-G` rasio uji lulus (unit)          | uji lulus / uji dijalankan              | 1,0    | **402/402** (23 berkas, 20 Okt 2026, pohon kerja v1.2.2 + perbaikan audit lanjutan; v1.0: 317/317)      | ✅     |
| `FCr-1-G` rasio uji lulus (E2E)           | uji lulus / uji dijalankan              | 1,0    | **108/108** dijalankan, 27 dilewati (butuh akun uji) — 5 profil browser                                 | ✅     |
| `D-FCr` kebenaran aturan bisnis pada data | aturan DQ lolos (berbobot), lihat 25012 | ≥ 95%  | **98,9%** (37/38 aturan; produksi 17 Okt 2026). 41 aturan sejak v1.2.2 — belum diukur ulang di produksi | ✅     |

Bukti: `npx vitest run` (17 Okt 2026); E2E dari [09 §12](../09-DAFTAR-STANDAR.md); `npx tsx scripts/data-quality.ts`.

### 3.3 Ketepatan fungsional — `FAp-1-G` _functional appropriateness_

Aturan bisnis AB-01…AB-25 ([01 §9](../01-PERANCANGAN.md)) ditegakkan **di server** (bukan hanya UI): siklus tertutup,
bukti wajib, satu kepala unit, satu Ketua LPM, cakupan butir. Ukuran berbasis tugas pengguna (_task completion_)
**N/U** — butuh UAT [06 §4](../06-PENGUJIAN.md) yang checklist-nya masih kosong (⏳).

## 4. Efisiensi Kinerja (_Performance efficiency_)

### 4.1 Perilaku waktu — `PTb-1-G` _mean response time_, `PTb-2-G` _response time adequacy_

Pengukuran 17 Okt 2026 ±11:30 WIB, **30 GET berurutan per endpoint** (jeda 0,2 dtk), `curl -w %{time_total}`,
koneksi baru setiap permintaan (termasuk DNS + TCP + TLS). Jalur **Cloudflare** = `https://spmi.universitaspahlawan.ac.id`
(dari server produksi sendiri, jadi mencakup perjalanan keluar ke edge Cloudflare lalu kembali ke origin);
jalur **origin** = `http://127.0.0.1:3002` dengan `Host: spmi.universitaspahlawan.ac.id` & `X-Forwarded-Proto: https`
(tanpa IIS & Cloudflare). Semua 240 permintaan berstatus **200**.

| Endpoint             | Jenis                      | Cloudflare p50 | Cloudflare p95 | Origin p50 | Origin p95 | Selisih p50 (≈ biaya CF+TLS) |
| -------------------- | -------------------------- | -------------: | -------------: | ---------: | ---------: | ---------------------------: |
| `/login`             | Halaman (SSR, dinamis)     |         173 ms |         596 ms |      18 ms |      26 ms |                       155 ms |
| `/kebijakan-privasi` | Halaman publik             |         161 ms |         618 ms |      18 ms |      25 ms |                       143 ms |
| `/api/health`        | JSON + `SELECT 1` ke MySQL |         143 ms |         662 ms |       8 ms |      10 ms |                       135 ms |
| `/robots.txt`        | Teks statis                |         149 ms |         470 ms |       8 ms |      12 ms |                       141 ms |

Rincian fase 12 permintaan `/api/health` via Cloudflare (median): DNS 17 ms, TCP 32 ms, TLS selesai 75 ms,
TTFB 137 ms. Ekor p95 (470–700 ms) muncul sporadis (±1 dari 10 permintaan) pada fase TCP/TLS & TTFB edge — **bukan**
origin (origin p95 ≤ 26 ms).

| Ukuran                               | Formula                  | Target                    | Hasil                                                   | Status |
| ------------------------------------ | ------------------------ | ------------------------- | ------------------------------------------------------- | ------ |
| `PTb-1-G` waktu respons rerata (p50) | median `time_total`      | halaman ≤ 300 ms (via CF) | 143–173 ms                                              | ✅     |
| `PTb-2-G` kecukupan waktu respons    | p95 ≤ target             | p95 halaman ≤ 500 ms (CF) | 470–662 ms                                              | ⚠️     |
| `PTb-2-G` (origin)                   | p95 origin ≤ target      | ≤ 200 ms                  | 10–26 ms                                                | ✅     |
| `D-PTb` LCP (Lighthouse)             | Largest Contentful Paint | < 2,5 dtk                 | desktop 0,8–0,9; mobile 2,4–2,6 (origin) / 3,3–3,4 (CF) | ⚠️     |
| `D-PTb` TBT (proksi INP)             | Total Blocking Time      | < 200 ms                  | desktop 100–130 ✅; mobile 780–1.400 ❌                 | ⚠️     |
| `D-PTb` skor Lighthouse Performance  | —                        | ≥ 90                      | desktop 96–97 ✅; mobile 66–77 ❌                       | ⚠️     |

Angka Lighthouse dari [09 §6](../09-DAFTAR-STANDAR.md) (Lighthouse 12.8, 17 Okt 2026). Penyebab mobile: hidrasi
React/runtime Next + skrip Cloudflare (`/cdn-cgi/challenge-platform` ±700 ms CPU). Tindak lanjut di 09 §6.

### 4.2 Pemanfaatan sumber daya — `PRu-2-G` _memory utilization_

| Ukuran                  | Formula                                    | Target      | Hasil                                                                | Status |
| ----------------------- | ------------------------------------------ | ----------- | -------------------------------------------------------------------- | ------ |
| `PRu-2-G` memori proses | private bytes / batas `max_memory_restart` | ≤ 50%       | 180 MB / 768 MB = **23%** (working set 47 MB; PID port 3002, 29 mnt) | ✅     |
| `PRu-1-G` CPU rerata    | CPU proses / waktu                         | —           | **N/U** di bawah beban (11,6 dtk CPU selama 29 menit idle-ringan)    | ⏳     |
| `D-PRu` anggaran JS/CSS | ukuran gzip pihak pertama                  | JS ≤ 150 KB | JS ±160 KB ⚠️; CSS 13 KB ✅ (09 §6)                                  | ⚠️     |

Bukti: `Get-Process` pada PID pemilik port 3002; `ecosystem.config.cjs` (`max_memory_restart: "768M"`).
Catatan: `pm2 jlist` di Windows melaporkan memori 0 MB (keterbatasan PM2 di Windows), sehingga dipakai `Get-Process`.

### 4.3 Kapasitas — `PCa-1-G` _transaction processing capacity_

**N/U ⏳** — belum ada uji beban. Perkiraan kebutuhan: ±100–300 pengguna (auditee + LPM), puncak saat tenggat siklus.
Rekomendasi: uji beban `k6`/`autocannon` terhadap staging (belum ada lingkungan staging — 09 §14) dengan target
≥ 50 req/dtk halaman dashboard pada p95 ≤ 500 ms.

## 5. Kompatibilitas (_Compatibility_)

| Sub-karakteristik | Ukuran                                     | Target                          | Hasil                                                                                                                                      | Status |
| ----------------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Ko-eksistensi     | `CCo-1-G` ko-eksistensi dengan produk lain | tanpa konflik sumber daya       | Satu server dengan aplikasi PM2 lain (`satpam`) & situs IIS lain; SPMI listen hanya `127.0.0.1:3002`, IIS site 67, DB kontainer port 33063 | ✅     |
| Interoperabilitas | `CIn-1-G` format data dapat dipertukarkan  | format terbuka & terdokumentasi | JSON UTF-8 + ISO 8601 `+07:00` (`/api/me/export`, `/api/health`), PDF (ekspor), OAuth 2.0 Authorization Code (SSO UP)                      | ✅     |
| Interoperabilitas | `CIn-2-G` kecukupan protokol pertukaran    | standar                         | HTTP/1.1 & HTTPS via Cloudflare, RFC 9110 kode status (03-API)                                                                             | ✅     |
| (Platform klien)  | `D-CCo` rasio profil browser lulus E2E     | 5/5                             | **5/5** (Chromium, Firefox, WebKit, Pixel 7, iPhone 14 emulasi); iOS perangkat asli ⏳                                                     | ✅     |

Catatan: aplikasi PM2 lain di server (`satpam`, bukan bagian SPMI) tercatat 368 restart — tidak memengaruhi SPMI
(proses terpisah, `spmi` 2 restart), tetapi relevan bagi pengelola server dalam menilai ko-eksistensi.

## 6. Kapabilitas Interaksi (_Interaction capability_, dahulu _Usability_)

| Sub-karakteristik                         | Ukuran                                       | Target                     | Hasil                                                                                                        | Status |
| ----------------------------------------- | -------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| Kemudahan dikenali                        | `UAp-1-G` kelengkapan deskripsi              | tersedia                   | Panduan pengguna per peran [05](../05-PANDUAN-PENGGUNA.md); judul & meta unik per halaman                    | ✅     |
| Kemudahan dipelajari                      | `ULe-1-G` kelengkapan panduan                | semua modul                | 05-PANDUAN-PENGGUNA mencakup login, pengisian, verifikasi, ekspor                                            | ✅     |
| Kemudahan dioperasikan                    | `UOp-1-G` konsistensi operasional            | konsisten                  | Komponen bersama `primitives.tsx`; Nielsen 10 heuristik (09 §4)                                              | ✅     |
| Perlindungan kesalahan pengguna           | `UEp-1-G` pencegahan kesalahan operasi       | aksi berisiko dikonfirmasi | `ConfirmAction` untuk hapus unit/akun/standar/butir/dokumen, nonaktif siklus, purge log                      | ✅     |
| Perlindungan kesalahan pengguna           | `UEp-2-S` koreksi kesalahan input            | pesan per field            | Komponen `Field`, validasi server `validate.ts`, pesan Bahasa Indonesia                                      | ✅     |
| Keterlibatan pengguna (baru)              | `D-UEn` kepuasan (SUS)                       | SUS ≥ 70                   | **N/U ⏳** — kuesioner SUS belum dilakukan                                                                   | ⏳     |
| Inklusivitas (baru; dahulu aksesibilitas) | `UAc-1-G` aksesibilitas pengguna disabilitas | WCAG 2.1 AA                | Lighthouse Accessibility **100**; axe-core **0** pelanggaran di 5 profil (halaman publik); zoom 200%, 320 px | ✅     |
| Bantuan pengguna                          | `D-UAs` pesan status & bantuan kontekstual   | tersedia                   | `loading.tsx`, empty state, `aria-live`, halaman 404/403/503 ramah                                           | ✅     |
| Deskriptif mandiri (baru)                 | `D-USd` label & status sistem jelas          | tersedia                   | Label status `STATUS_LABEL` (format.ts), badge cakupan, label peran                                          | ✅     |
| Estetika (_user engagement_)              | `D-UIn` konsistensi visual                   | konsisten                  | Palet & font Plus Jakarta Sans self-hosted, tema terang/gelap kontras ≥ 4,5:1                                | ✅     |

Celah: axe belum dijalankan pada halaman dashboard (butuh akun uji di CI — 09 §5); ukuran berbasis pengguna (waktu
tugas, tingkat keberhasilan, SUS) belum diukur — dokumen usabilitas ISO 9241 ditangani terpisah di `docs/iso/9241-USABILITAS/`.

## 7. Keandalan (_Reliability_)

| Sub-karakteristik                 | Ukuran                            | Formula / cara                                 | Target          | Hasil                                                                                                                                    | Status |
| --------------------------------- | --------------------------------- | ---------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Bebas kesalahan (_faultlessness_) | `RMa-1-G` koreksi kesalahan       | temuan ditutup / temuan                        | 1,0             | **29/29** temuan audit keamanan internal (16 Okt: 11; 17 Okt: 18) ditutup                                                                | ✅     |
| Bebas kesalahan                   | `RMa-2-G` cakupan uji             | lihat §9 (`MTe-1-G`)                           | —               | baris 95,3%, cabang 91,7% (`src/lib`, tanpa `actions`/`report`)                                                                          | ⚠️     |
| Ketersediaan                      | `RAv-1-G` ketersediaan sistem     | waktu operasi / waktu terjadwal                | ≥ 99,5% / bulan | **N/U ⏳** — belum ada monitor uptime eksternal; mekanisme: PM2 `autorestart`, `/api/health` (cek DB 3 dtk)                              | ⏳     |
| Ketersediaan                      | `RAv-2-G` rerata waktu henti      | Σ durasi henti / jumlah henti                  | ≤ 15 mnt        | 1 insiden tercatat (17 Okt 2026, PM2 gagal start `EPERM` log) ≈ **6 menit**                                                              | ✅     |
| Toleransi kesalahan               | `RFt-1-G` penghindaran kegagalan  | kegagalan deploy yang tidak sampai ke pengguna | 100%            | Gerbang test + smoke test + **rollback otomatis** (teruji pada insiden nyata 17 Okt 2026); mode 503 saat deploy                          | ✅     |
| Toleransi kesalahan               | `D-RFt` degradasi terkendali      | —                                              | —               | Kegagalan log/pengaturan tidak menggagalkan alur utama (`logs.ts`, `settings.ts` best-effort)                                            | ✅     |
| Keterpulihan                      | `RRe-1-G` MTTR                    | Σ waktu pulih / jumlah insiden                 | ≤ 30 mnt        | **≈ 6 menit** (insiden 17 Okt 2026; runbook [04 §11](../04-DEPLOYMENT-IIS.md))                                                           | ✅     |
| Keterpulihan                      | `RRe-2-G` kelengkapan backup data | item ter-backup / item yang wajib              | 1,0             | DB + unggahan + `.env` (pra-deploy & harian 01:30, retensi 30 hari, salinan D:) = 3/3; **uji restore lulus 17 Okt 2026** ke DB sementara | ✅     |
| Keterpulihan                      | `D-RRe` salinan di luar server    | —                                              | ada             | ⏳ belum (NAS/cloud — 09 §19)                                                                                                            | ⏳     |

Bukti: `pm2 describe spmi` (`autorestart: true`, `max_memory_restart: 768M`, 2 restart sejak start terakhir),
`E:\www\spmi-prod\logs\deploy-20261017-*.log`, `scripts/deploy/rollback.ps1`, `lib-db.ps1`, CHANGELOG v1.1.2.

## 8. Keamanan (_Security_)

| Sub-karakteristik | Ukuran                                      | Target                 | Hasil                                                                                                                    | Status |
| ----------------- | ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| Kerahasiaan       | `SCo-1-G` kemampuan kontrol akses           | 100% aksi berotorisasi | `requireUser/requireLpm/requireSuperadmin/requireUnitMember` di baris pertama aksi & route; uji `guards` (matriks peran) | ✅     |
| Kerahasiaan       | `SCo-2-G` enkripsi data                     | TLS + hash sandi       | HTTPS (Cloudflare Full strict + Let's Encrypt), HSTS 2 tahun; bcrypt; DQ-09: 2/2 sandi ter-hash bcrypt                   | ✅     |
| Integritas        | `SIn-1-G` integritas sistem/perangkat lunak | dependensi bebas CVE   | `npm audit --omit=dev`: **0 kerentanan** (diukur ulang 17 Okt 2026)                                                      | ✅     |
| Integritas        | `SIn-2-S` pencegahan korupsi data internal  | —                      | Prisma (parameter binding), validasi server, FK + unique; aturan DQ konsistensi 100% lolos                               | ✅     |
| Non-repudiasi     | `SNo-1-G` penggunaan tanda tangan digital   | —                      | ⚠️ Tidak ada tanda tangan kriptografis; jejak `verified_by/verified_at` + log aktivitas sebagai bukti tindakan           | ⚠️     |
| Akuntabilitas     | `SAc-1-G` kelengkapan jejak audit pengguna  | aksi penting tercatat  | `recordActivity` pada aksi CRUD/verifikasi; log login sukses/gagal; DQ-35 jejak merujuk akun 100%                        | ✅     |
| Akuntabilitas     | `SAc-2-S` retensi log sistem                | sesuai kebijakan       | Login 90 hari, aktivitas 365 hari; purge harian; **DQ-33 lolos** (0/12 log melewati masa simpan)                         | ✅     |
| Autentisitas      | `SAu-1-G` kecukupan mekanisme autentikasi   | —                      | Sandi (min 8, huruf+angka) + SSO OAuth2 `state` 256-bit; sesi JWT HS256 `__Host-` cookie, dapat dicabut                  | ✅     |
| Autentisitas      | `SAu-2-S` kesesuaian aturan autentikasi     | —                      | Rate limit 5×/menit email+IP, 30×/menit IP; pesan login seragam (anti-enumerasi)                                         | ✅     |
| Resistansi (baru) | `D-SRe` header keamanan aktif di produksi   | 7/7                    | **7/7**: CSP nonce, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP (curl 17 Okt 2026)    | ✅     |
| Resistansi        | `D-SRe` uji penetrasi pihak ketiga          | ada                    | ⏳ belum (audit internal saja)                                                                                           | ⏳     |

Temuan kecil terukur: respons via Cloudflare masih membawa header `X-Powered-By` **kosong** (nilai dikosongkan, header tidak
dihapus) — sejalan dengan kegagalan cek `tanpa header x-powered-by` pada smoke test publik di
`deploy-20261017-103234.log`. Selain itu HSTS di produksi tanpa `preload` sementara [04 §7](../04-DEPLOYMENT-IIS.md)
menyebut `preload` — salah satunya perlu diselaraskan. Rinci kontrol: [27001-SOA](27001-SOA.md).

## 9. Keterpeliharaan (_Maintainability_)

| Sub-karakteristik      | Ukuran                                      | Formula / alat                                           | Target                    | Hasil                                                                                                                                                                                                                  | Status |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Modularitas            | `MMo-1-G` keterkaitan komponen              | lapisan Page → Server Action → `src/lib` → Prisma        | terlapis                  | Lapisan konsisten; ADR 0001–0006                                                                                                                                                                                       | ✅     |
| Modularitas            | `MMo-2-S` kecukupan kompleksitas siklomatik | titik keputusan (`if/for/case/&&/\|\|/??/?:`) per berkas | ≤ 75 per berkas           | Hot spot: `audit-workspace.tsx` **173** (2.115 LOC, 50 fungsi; fungsi terbesar `ResponseForm` ±262 LOC), `account-manager.tsx` 79 (967 LOC), `actions/units.ts` 77 (593 LOC), `api/sso/[...sso]/route.ts` 63 (380 LOC) | ⚠️     |
| Penggunaan ulang       | `MRe-1-G` aset dapat dipakai ulang          | —                                                        | —                         | Utilitas bersama `validate`, `errors`, `redact`, `format`, `scope`, `upload`; komponen `primitives.tsx`                                                                                                                | ✅     |
| Penggunaan ulang       | `MRe-2-S` kepatuhan aturan penulisan kode   | `npm run lint` (ESLint flat + jsx-a11y), Prettier        | 0 error                   | **0 error, 0 peringatan** (17 Okt 2026); Prettier lulus                                                                                                                                                                | ✅     |
| Kemudahan dianalisis   | `MAn-1-G` kelengkapan log sistem            | —                                                        | —                         | Log tersamarkan `[action-error]`, `[security]`; log deploy bertanggal; `/api/health` versi                                                                                                                             | ✅     |
| Kemudahan dimodifikasi | `MMd-1-G` efisiensi modifikasi              | —                                                        | —                         | TypeScript **strict: true**, `tsc --noEmit` **0 error**; 97 berkas TS/TSX, 17.072 LOC di `src/`                                                                                                                        | ✅     |
| Kemudahan diuji        | `MTe-1-G` kelengkapan fungsi uji (coverage) | `npx vitest run --coverage` (v8), `src/lib/**`           | baris ≥ 80%, cabang ≥ 75% | Sebelum modul DQ: baris **92,16%**, cabang **92,13%**, fungsi 89,11%; setelah: baris **95,28%**, cabang **91,65%**, fungsi 94,22%                                                                                      | ✅     |
| Kemudahan diuji        | `D-MTe` cakupan lapisan aksi                | `src/lib/actions/**`, `src/lib/report/**`                | diuji                     | **Dikecualikan** dari coverage (`vitest.config.mts`) dan tidak punya uji unit → 3.410 LOC (aksi 2.256 + laporan 1.154) tanpa uji langsung                                                                              | ❌     |
| Kemudahan diuji        | `MTe-2-S` keterujian mandiri                | —                                                        | —                         | Prisma di-mock (Vitest), E2E memakai MySQL sekali pakai; TZ dipaksa UTC                                                                                                                                                | ✅     |

Coverage per berkas terendah (sebelum modul DQ): `privacy.ts` baris 44% / cabang 62,5% (`buildMyDataExport` tidak
diuji), `net.ts` 83,9% / 82,4%, `ratelimit.ts` 83,3%, `upload.ts` 89,6%. Modul baru `data-quality.ts`: baris 99,6%,
cabang 90,4%.

Bukti: `npx vitest run --coverage` (17 Okt 2026), `npm run lint`, `npx tsc --noEmit`, `tsconfig.json` (`"strict": true`).

## 10. Fleksibilitas (_Flexibility_, dahulu _Portability_)

| Sub-karakteristik   | Ukuran                                        | Target                      | Hasil                                                                                                                    | Status |
| ------------------- | --------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| Adaptabilitas       | `PAd-3-S` adaptasi lingkungan operasi         | konfigurasi tanpa ubah kode | 12-Factor: env (`DATABASE_URL`, `AUTH_SECRET`, `UPLOAD_DIR`, `TRUST_PROXY`) + Pengaturan di DB (SSO, retensi, sesi, SEO) | ✅     |
| Adaptabilitas       | `PAd-1-G` adaptasi lingkungan perangkat keras | —                           | Output `standalone` Node ≥ 20.19; MySQL 8 di Docker; tidak bergantung OS (dev Docker, prod Windows)                      | ✅     |
| Skalabilitas (baru) | `D-PSc` skala horizontal                      | ≥ 2 instance                | ⚠️ 1 instance PM2 fork; rate limiter in-memory per proses (`ratelimit.ts`) → skala horizontal butuh store bersama        | ⚠️     |
| Kemudahan instalasi | `PIn-1-G` efisiensi waktu instalasi           | ≤ 15 mnt deploy             | Deploy berskrip penuh (`deploy-production.ps1`): ±5 menit per log 17 Okt (10:32→10:37, 10:44→10:49)                      | ✅     |
| Kemudahan instalasi | `PIn-2-G` kemudahan instalasi                 | berskrip                    | `setup-production.ps1`, `register-tasks.ps1`, runbook [04](../04-DEPLOYMENT-IIS.md)                                      | ✅     |
| Kemudahan diganti   | `PRe-1-G` kemiripan penggunaan                | —                           | Menggantikan SPMI lama; URL lama `/uploads/*` tetap berfungsi (rewrite ke `/api/files/*`)                                | ✅     |
| Kemudahan diganti   | `PRe-3-S` inklusivitas fungsional / data      | ekspor terbuka              | Ekspor data pribadi JSON, laporan PDF, dump SQL harian                                                                   | ✅     |

## 11. Keselamatan (_Safety_, karakteristik baru ISO 25010:2023)

SPMI tidak mengendalikan perangkat fisik; "bahaya" di sini adalah **keputusan mutu yang salah, kehilangan data audit,
dan pelanggaran data pribadi**. Ukuran turunan:

| Sub-karakteristik        | Ukuran turunan                           | Target | Hasil                                                                                                                           | Status |
| ------------------------ | ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Batasan operasional      | `D-SaO` penegakan batas di server        | 100%   | Siklus tertutup menolak jawaban/RTL (AB-03), mode pemeliharaan hanya superadmin (AB-20), batas unggah 10 MB                     | ✅     |
| Identifikasi risiko      | `D-SaR` register risiko & insiden        | ada    | [legal/INSIDEN-DATA](../legal/INSIDEN-DATA.md) (3×24 jam), RoPA, register risiko ISO 27001                                      | ✅     |
| Gagal-aman (_fail safe_) | `D-SaF` perilaku gagal-tertutup          | ada    | `AUTH_SECRET` < 32 karakter → server tidak start; `/api/health` 503 bila DB gagal; rollback otomatis; upload `wx` (tak menimpa) | ✅     |
| Peringatan bahaya        | `D-SaW` konfirmasi aksi destruktif       | 100%   | `ConfirmAction` (alertdialog) pada semua aksi hapus/nonaktif/purge; peringatan `-RestoreDb` di runbook                          | ✅     |
| Integrasi aman           | `D-SaI` integrasi pihak luar tervalidasi | —      | SSO: klaim role diabaikan kecuali `SSO_TRUST_ROLE`; `CF-Connecting-IP` hanya dari rentang Cloudflare (`net.ts`)                 | ✅     |

## 12. Temuan & Cacat yang Teridentifikasi

| No  | Temuan                                                                                                                                                                                                                     | Karakteristik     | Saran                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| 1   | `src/lib/actions/**` & `src/lib/report/**` dikecualikan dari coverage; sebagian aksi kini diuji dengan Prisma mock (`questions-actions.test.ts`, `account-cycle-actions.test.ts`, 20 Okt 2026), KF-07/08/12/13/15/16 belum | Keterpeliharaan   | Uji aksi dengan Prisma mock, minimal `assignMember`, `setLpmHead`, `verifyResponse` |
| 2   | `audit-workspace.tsx` 2.115 LOC / ±173 titik keputusan                                                                                                                                                                     | Keterpeliharaan   | Pecah per panel (Instrumen, ResponseForm, Verifikasi) menjadi berkas terpisah       |
| 3   | p95 via Cloudflare 470–662 ms (origin ≤ 26 ms); Lighthouse mobile 66–77                                                                                                                                                    | Efisiensi kinerja | Setelan Cloudflare (09 §6), ukur ulang dari luar server / PageSpeed                 |
| 4   | Ketersediaan tidak terukur (tanpa monitor uptime eksternal)                                                                                                                                                                | Keandalan         | Pasang monitor `/api/health` 1–5 menit (04 §10)                                     |
| 5   | `X-Powered-By` kosong masih dikirim via Cloudflare; HSTS tanpa `preload` vs dokumen 04                                                                                                                                     | Keamanan          | Hapus header di IIS (`<remove name="X-Powered-By"/>`), selaraskan dokumen HSTS      |
| 6   | `clearBranding()` & unggah ulang branding mengosongkan/mengganti nilai Pengaturan tanpa menghapus berkas lama                                                                                                              | Efisiensi (data)  | Panggil `deleteUpload()` untuk nilai lama; terpantau oleh aturan DQ-29              |
| 7   | ~~01-PERANCANGAN KF-19 masih "_Sedang ditambahkan_"; AB-24 menyebut purge "saat ada login baru"~~ — **selesai** (diverifikasi 20 Okt 2026: KF-19 "Diterapkan (v1.1.0)", AB-24 menyebut tugas harian 02:00)                 | Dokumentasi       | —                                                                                   |
| 8   | Rate limiter in-memory → tidak berlaku lintas instance                                                                                                                                                                     | Fleksibilitas     | Dokumentasikan batas 1 instance atau pindah ke store bersama bila diskalakan        |

## 13. Cara Mengulang Pengukuran

```bash
npx vitest run --coverage                 # MTe-1-G (coverage src/lib), FCr-1-G
npm run lint && npm run typecheck        # MRe-2-S, MMd-1-G (tsc aplikasi + tsconfig.test.json untuk kode uji)
npm audit --omit=dev                      # SIn-1-G
# PTb-1-G / PTb-2-G — 30 permintaan berurutan per endpoint
for i in $(seq 30); do curl -s -o /dev/null -w "%{time_total}\n" https://spmi.universitaspahlawan.ac.id/login; sleep 0.2; done
for i in $(seq 30); do curl -s -o /dev/null -w "%{time_total}\n" -H "Host: spmi.universitaspahlawan.ac.id" \
  -H "X-Forwarded-Proto: https" http://127.0.0.1:3002/login; sleep 0.2; done
npx tsx scripts/data-quality.ts           # D-FCr & ISO 25012 (butuh DATABASE_URL, UPLOAD_DIR)
```

Jadwal evaluasi ulang: setiap rilis MINOR/MAJOR dan minimal sekali per semester (bersama uji restore).
