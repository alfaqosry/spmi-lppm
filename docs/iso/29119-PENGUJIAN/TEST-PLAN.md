# Rencana Pengujian (Test Plan) — SPMI v1.1.x

Acuan: ISO/IEC/IEEE 29119-3 §7.2. Mengikuti [TEST-STRATEGY](TEST-STRATEGY.md).

| Item          | Keterangan                                                 |
| ------------- | ---------------------------------------------------------- |
| Identitas     | TP-SPMI-1.1                                                |
| Versi dokumen | 1.0 — 17 Oktober 2026                                      |
| Objek         | SPMI rilis **v1.1.0 – v1.1.3** (tag Git), branch `main`    |
| Pemilik       | Manajer uji (ketua tim pengembang); disetujui Ketua LPM ⏳ |

## 1. Konteks

Rilis v1.1.x berisi pengerasan keamanan (audit 18 temuan B-1…B-18), fitur privasi UU PDP, aksesibilitas WCAG 2.1 AA,
SEO, serta deployment IIS + PM2 dengan rollback otomatis (lihat `CHANGELOG.md`). Pengujian berfokus pada **regresi
fungsi AMI** setelah perubahan besar tersebut dan pada **kontrol keamanan/privasi baru**.

## 2. Cakupan

### 2.1 Di dalam cakupan

| Modul                                        | Rute / komponen                                                   | Kebutuhan                         |
| -------------------------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| Login lokal & SSO, sesi, logout              | `/login`, `/api/sso/*`, `src/lib/auth.ts`                         | KF-01–KF-04, KNF-01/02/06         |
| Dashboard LPM & auditee                      | `/dashboard`                                                      | KF-14, KF-15                      |
| Siklus                                       | `/siklus`                                                         | KF-05, AB-01–AB-05                |
| Unit                                         | `/unit`                                                           | KF-06                             |
| Akun, penempatan, Ketua LPM                  | `/role-penempatan`                                                | KF-07, KF-08, AB-12–AB-15         |
| Penetapan / Evaluasi                         | `/penetapan`, `/evaluasi`, `/api/files/*`                         | KF-09, KNF-04, AB-22              |
| Audit: instrumen, pengisian, verifikasi, RTL | `/audit`                                                          | KF-10–KF-14, AB-06–AB-11          |
| Analitik & ekspor PDF                        | `/analitik`, `/api/export`                                        | KF-15, KF-16                      |
| Pengaturan superadmin, log                   | `/pengaturan`                                                     | KF-17, KF-18, AB-20, AB-23, AB-24 |
| Privasi: persetujuan, ekspor data, retensi   | `ConsentDialog`, `/profil`, `/api/me/export`, `privacy-purge.ps1` | KF-19, KNF-11                     |
| Keamanan & RBAC lintas modul                 | `src/lib/guards.ts`, `src/proxy.ts`, `next.config.ts`             | KNF-01–KNF-06                     |
| Non-fungsional                               | a11y, kompatibilitas, kinerja, lokalisasi, operasional            | KNF-07–KNF-12, KNF-13–KNF-17\*    |

\* KNF-13…KNF-17 adalah kebutuhan turunan yang diusulkan ([TRACEABILITY §1.3](TRACEABILITY.md#13-kebutuhan-turunan-diusulkan)).

### 2.2 Di luar cakupan

Modul **Monev** (placeholder), API publik (tidak ada), integrasi SAINS, uji beban/stres (satu instance, pengguna
< 300), uji penetrasi pihak ketiga (⏳ backlog keamanan), paket `@alfaqosry/sso-client-next` (pihak ketiga — hanya
perilaku integrasinya).

## 3. Item Uji & Basis Uji

Kode `main` @ tag `v1.1.3`; basis uji: [01-PERANCANGAN](../../01-PERANCANGAN.md) (KF, KNF, AB), [03-API](../../03-API.md),
[05-PANDUAN-PENGGUNA](../../05-PANDUAN-PENGGUNA.md), `LAPORAN_KEAMANAN.md`, [09-DAFTAR-STANDAR](../../09-DAFTAR-STANDAR.md).

## 4. Pendekatan

Sesuai strategi: unit (287 test) + E2E 5 profil (27 test × 5) + axe + smoke + Lighthouse otomatis/terukur; UAT &
eksploratif manual memakai [TEST-CASES](TEST-CASES.md) tipe **manual** dan [FORMULIR-UAT](FORMULIR-UAT.md).
Prioritas eksekusi manual: kasus dengan risiko skor ≥ 6 (R01, R02, R04–R07, R14).

## 5. Jadwal

| No  | Kegiatan                                                                   | Tanggal                | Status                                                 |
| --- | -------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| 1   | Audit keamanan & perbaikan + uji regresi unit                              | 16–17 Okt 2026         | ✅                                                     |
| 2   | Eksekusi unit + E2E 5 profil + axe (lokal, DB sekali pakai)                | 17 Okt 2026            | ✅                                                     |
| 3   | Deploy v1.1.0 → v1.1.3 + smoke test + E2E terautentikasi produksi (4 test) | 17 Okt 2026            | ✅                                                     |
| 4   | Lighthouse desktop & mobile produksi                                       | 17 Okt 2026            | ✅ (mobile tidak memenuhi)                             |
| 5   | Laporan penyelesaian uji v1.1.3                                            | 17 Okt 2026            | ✅ [TEST-COMPLETION-REPORT](TEST-COMPLETION-REPORT.md) |
| 6   | Siapkan lingkungan UAT (instans + seed per peran)                          | Minggu ke-1 Nov 2026   | ⏳                                                     |
| 7   | UAT per modul oleh perwakilan peran                                        | Minggu ke-2 Nov 2026   | ⏳                                                     |
| 8   | Uji usabilitas moderasi (ISO 9241)                                         | Minggu ke-2–4 Nov 2026 | ⏳                                                     |
| 9   | Laporan UAT & keputusan penerimaan formal                                  | Akhir Nov 2026         | ⏳                                                     |

Tanggal ⏳ adalah usulan dan harus disepakati LPM sebelum siklus AMI berikutnya dibuka.

## 6. Peran & Sumber Daya

| Peran                               | Orang (diisi)      | Tugas dalam rencana ini                             |
| ----------------------------------- | ------------------ | --------------------------------------------------- |
| Manajer uji                         | __________________ | Koordinasi, laporan, keputusan suspend/resume       |
| Pengembang                          | __________________ | Otomatisasi, perbaikan defect, penyiapan lingkungan |
| Penguji UAT — Superadmin            | ______________     | Modul Pengaturan, pemeliharaan, log                 |
| Penguji UAT — Admin LPM             | ______________     | Siklus, unit, akun & penempatan, Ketua LPM, ekspor  |
| Penguji UAT — Anggota LPM           | _____________      | Instrumen, dokumen, verifikasi, analitik            |
| Penguji UAT — Kepala & Anggota Unit | ____               | Pengisian, bukti, RTL, dashboard unit               |
| Operator                            | Puskom             | Lingkungan, deploy, smoke, backup                   |

Kebutuhan: 1 laptop + 1 ponsel Android per penguji auditee, akun uji per peran, ±2 hari kerja penguji untuk UAT.

## 7. Lingkungan

| ID    | Lingkungan             | Konfigurasi                                                                                                                                                                                     |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENV-1 | Unit                   | Node 22 (CI) / Node 20.19 (server dev — EOL, lihat README temuan #10), Vitest 4.1, `TZ=Asia/Jakarta`; tanpa DB                                                                                  |
| ENV-2 | E2E lokal sekali pakai | Kontainer **MySQL 8** baru (dibuang setelah run), `prisma db push`, seed akun uji, `npm run build` + server standalone `127.0.0.1:3002`; `APP_URL` http → CSP tanpa `upgrade-insecure-requests` |
| ENV-3 | E2E CI                 | `.github/workflows/e2e.yml`: service `mysql:8.4`, DB `lpm_spmi_e2e`, `AUTH_SECRET` per run, akun `admin.e2e@example.test` (⏳ aktif setelah push ke GitHub)                                     |
| ENV-4 | UAT / usabilitas       | Instans terpisah ber-seed data fiktif (staging ⏳; sementara ENV-2 di mesin uji)                                                                                                                |
| ENV-5 | Produksi               | `https://spmi.universitaspahlawan.ac.id`; hanya smoke test, Lighthouse, E2E baca-saja dengan akun khusus yang tidak memodifikasi data                                                           |

## 8. Risiko Proyek Pengujian & Kontinjensi

| ID  | Risiko                                                       | Dampak                              | Kontinjensi                                                                  |
| --- | ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| PR1 | Tidak ada staging                                            | UAT bercampur lingkungan pengembang | ENV-2 di mesin khusus; jadwalkan staging (09 backlog #7)                     |
| PR2 | Penguji UAT (dosen/LPM) tidak tersedia di masa sibuk         | UAT tertunda                        | Jadwal di luar masa UTS/UAS; UAT dibagi per modul 1–2 jam                    |
| PR3 | CI GitHub belum aktif (belum push)                           | Regresi bergantung disiplin lokal   | Gerbang test di skrip deploy; push segera (09 backlog #4)                    |
| PR4 | E2E terautentikasi di produksi dapat memicu rate limit / log | Gangguan pengguna, log tercemar     | Mode serial, akun khusus, hanya baca, di luar jam kerja                      |
| PR5 | Cakupan otomatis rendah untuk Server Actions & PDF           | Defect fungsional lolos             | UAT wajib untuk modul tersebut sebelum siklus AMI                            |
| PR6 | Ketergantungan SSO UP (eksternal)                            | Kasus SSO tidak dapat dieksekusi    | Uji dengan konfigurasi Redirect URI uji; kasus ditandai _blocked_ bila belum |

## 9. Kriteria Penangguhan & Dilanjutkan

Ditangguhkan bila: defect S1 ditemukan; lingkungan tidak stabil; data produksi terdeteksi di lingkungan uji.
Dilanjutkan setelah perbaikan terverifikasi dan smoke test lingkungan lulus.

## 10. Kriteria Penyelesaian

Sesuai [TEST-STRATEGY §5](TEST-STRATEGY.md#5-kriteria-masuk--keluar). Untuk v1.1.3: level otomatis ✅ telah
terpenuhi (kecuali kinerja mobile — diterima sebagai risiko); UAT & usabilitas menjadi syarat **sebelum siklus AMI
berikutnya**, bukan syarat deploy v1.1.3.

## 11. Deliverables

[TEST-CASES](TEST-CASES.md) · [TRACEABILITY](TRACEABILITY.md) · laporan Playwright HTML (`playwright-report/`) & lampiran
axe · laporan cakupan (`coverage/`) · log deploy/smoke (`E:\www\spmi-prod\logs\deploy-<ts>.log`) ·
[TEST-COMPLETION-REPORT](TEST-COMPLETION-REPORT.md) · [FORMULIR-UAT](FORMULIR-UAT.md) bertanda tangan.

## 12. Persetujuan

| Peran       | Nama | Tanda tangan | Tanggal |
| ----------- | ---- | ------------ | ------- |
| Manajer uji |      |              |         |
| Ketua LPM   |      |              |         |
