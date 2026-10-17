# Kebijakan Pengujian (Test Policy) — SPMI

Acuan: ISO/IEC/IEEE 29119-2 §6.2 (proses kebijakan uji organisasi), 29119-3 §6.2.
Berlaku untuk seluruh pengembangan dan pemeliharaan Sistem Informasi SPMI (LPM Universitas Pahlawan Tuanku Tambusai).

| Versi | Tanggal         | Disusun        | Disetujui (Ketua LPM) |
| ----- | --------------- | -------------- | --------------------- |
| 1.0   | 17 Oktober 2026 | Tim pengembang | ⏳                    |

## 1. Tujuan Pengujian

1. Memberi **keyakinan berbasis bukti** bahwa SPMI memenuhi kebutuhan fungsional (KF) dan non-fungsional (KNF) di
   [01-PERANCANGAN](../../01-PERANCANGAN.md) sebelum dipakai pada siklus AMI.
2. **Melindungi data audit & data pribadi** (UU 27/2022 PDP): otorisasi per peran, isolasi unit, penanganan berkas.
3. Mendeteksi defect sedini mungkin (_shift-left_) dan mencegah regresi.
4. Menyediakan informasi risiko residual yang jujur kepada pemangku kepentingan (LPM, Puskom) untuk keputusan rilis.

## 2. Prinsip

| No  | Prinsip                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Berbasis risiko** — intensitas uji sebanding dengan dampak × kemungkinan (lihat [TEST-STRATEGY §2](TEST-STRATEGY.md#2-analisis-risiko-produk)).          |
| P2  | **Uji pada level serendah mungkin** — logika domain dipisahkan ke fungsi murni di `src/lib/` dan diuji Vitest tanpa database.                              |
| P3  | **Setiap bug yang diperbaiki disertai uji regresi** (unit bila memungkinkan, E2E bila hanya terlihat di UI).                                               |
| P4  | **Tidak ada data uji di produksi; tidak ada data produksi di pengujian.** E2E memakai DB sekali pakai; uji di produksi hanya alur baca dengan akun khusus. |
| P5  | **Otomatis lebih dulu** untuk regresi; uji manual/eksploratif & UAT untuk alur bisnis lintas peran dan penilaian manusia.                                  |
| P6  | **Kegagalan menghentikan rilis** — gerbang test di CI dan di skrip deploy (`scripts/deploy/deploy-production.ps1`).                                        |
| P7  | **Ketertelusuran** — setiap kasus uji merujuk kebutuhan (KF/KNF/AB); setiap kebutuhan berisiko tinggi punya ≥ 1 kasus uji.                                 |
| P8  | **Hasil jujur** — test yang dilewati (_skipped_), gagal, atau belum dieksekusi dilaporkan apa adanya.                                                      |
| P9  | **Aksesibilitas & kegunaan adalah kualitas**, bukan opsional (WCAG 2.1 AA, ISO 9241-11).                                                                   |

## 3. Organisasi & Tanggung Jawab

| Peran                 | Diemban oleh                         | Tanggung jawab                                                                                    |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Pemilik produk        | Ketua LPM / Admin LPM                | Menyetujui kebijakan & rencana uji, keputusan rilis, menerima risiko residual, menandatangani UAT |
| Manajer uji           | Ketua tim pengembang                 | Menyusun strategi/rencana, memantau, melaporkan penyelesaian uji                                  |
| Pengembang            | Tim pengembang                       | Uji unit & E2E bersama perubahan kode (PR yang sama), memperbaiki defect                          |
| Penguji UAT           | Perwakilan tiap peran (LPM, auditee) | Menjalankan [FORMULIR-UAT](FORMULIR-UAT.md)                                                       |
| Operator / Superadmin | Puskom                               | Smoke test pasca-deploy, verifikasi pemantauan & backup                                           |
| Peninjau keamanan     | Internal; ⏳ pihak ketiga            | Audit keamanan (`LAPORAN_KEAMANAN.md`)                                                            |

## 4. Standar & Acuan

ISO/IEC/IEEE 29119-1/2/3/4 · ISO/IEC 25010 (model kualitas) · ISO 9241-11/110/210 (kegunaan) · WCAG 2.1 AA ·
OWASP ASVS 4.0 L2 / Top 10 · UU 27/2022 PDP · [07-STANDAR-ENGINEERING](../../07-STANDAR-ENGINEERING.md) ·
[09-DAFTAR-STANDAR](../../09-DAFTAR-STANDAR.md).

## 5. Proses Uji (ringkas)

Perencanaan → desain (teknik 29119-4) → implementasi & eksekusi (otomatis di hook/CI/deploy; manual per rilis) →
pelaporan insiden → laporan penyelesaian → perbaikan proses. Detail di [TEST-STRATEGY](TEST-STRATEGY.md).

## 6. Pengelolaan Defect

- Defect dicatat sebagai **GitHub Issue** (templat di `.github/`) dengan label severity: **S1 Kritis** (kebocoran data,
  eskalasi peran, kehilangan data, layanan mati), **S2 Mayor** (fungsi utama gagal tanpa jalan pintas), **S3 Minor**
  (ada jalan pintas), **S4 Kosmetik**.
- Rilis **diblokir** oleh S1/S2 terbuka kecuali diterima tertulis oleh pemilik produk.
- Temuan kegunaan memakai skala Nielsen 0–4 ([../9241-USABILITAS/EVALUASI-HEURISTIK](../9241-USABILITAS/EVALUASI-HEURISTIK.md)).

## 7. Metrik Organisasi

| Metrik                                                     | Target                                   |
| ---------------------------------------------------------- | ---------------------------------------- |
| Kelulusan suite unit & E2E di gerbang rilis                | 100% (0 gagal)                           |
| Cakupan baris `src/lib/**` (kecuali `report/`, `actions/`) | ≥ 80% (dipantau `npm run test:coverage`) |
| Kebutuhan berisiko tinggi tanpa kasus uji                  | 0                                        |
| Defect S1/S2 lolos ke produksi per rilis                   | 0                                        |
| Pelanggaran axe serious/critical                           | 0                                        |
| Waktu perbaikan defect S1                                  | ≤ 1 hari kerja                           |

## 8. Perbaikan Proses

Setelah setiap rilis MINOR/MAJOR: retrospektif singkat atas laporan penyelesaian uji (apa yang lolos, test yang
_flaky_, celah otomatisasi) → butir backlog. Kebijakan ditinjau **tahunan** atau bila terjadi insiden produksi S1.
