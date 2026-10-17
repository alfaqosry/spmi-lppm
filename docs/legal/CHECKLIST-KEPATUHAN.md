# Checklist Kepatuhan Pelindungan Data Pribadi & Regulasi Sistem Elektronik

**Sistem:** SPMI — LPM Universitas Pahlawan Tuanku Tambusai · **Per:** 2026-10-17

Legenda: ✅ terpenuhi · 🟡 sebagian / sedang dikerjakan · ⏳ menunggu keputusan/tindakan non-teknis · ❌ belum

## 1. Tata Kelola

| No   | Kewajiban                                                       | Dasar                  | Status | Catatan / bukti                                                                                                                    |
| ---- | --------------------------------------------------------------- | ---------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| T-01 | Penunjukan **Pejabat/Petugas PDP**                              | UU 27/2022 Pasal 53–54 |   ⏳   | Wajib bila pemrosesan untuk pelayanan publik / berskala besar / data spesifik. Perlu SK Rektor; sementara koordinator = Ketua LPM. |
| T-02 | Catatan aktivitas pemrosesan (RoPA)                             | Pasal 31               |   🟡   | [RoPA.md](RoPA.md) disusun; dasar hukum & retensi menunggu konfirmasi Bagian Hukum                                                 |
| T-03 | Prosedur insiden & notifikasi 3×24 jam                          | Pasal 46               |   🟡   | [INSIDEN-DATA.md](INSIDEN-DATA.md); kontak tim & saluran Lembaga perlu dilengkapi                                                  |
| T-04 | **Tinjauan hukum** kebijakan privasi, S&K, dasar hukum, retensi | —                      |   ⏳   | Bagian Hukum universitas                                                                                                           |
| T-05 | Penilaian dampak PDP (DPIA)                                     | Pasal 34               |   ⏳   | Dinilai perlu/tidak oleh Bagian Hukum (indikasi: bukti audit dapat memuat data mahasiswa dalam jumlah besar)                       |
| T-06 | Perjanjian dengan prosesor (Cloudflare, pengelola SSO)          | Pasal 51               |   ⏳   | DPA Cloudflare (standar), kesepakatan internal dengan pengelola SSO UP                                                             |
| T-07 | Pelatihan kesadaran PDP bagi pengguna LPM & auditee             | Pasal 35               |   ❌   | Materi singkat: jangan unggah data spesifik di bukti                                                                               |

## 2. Registrasi Sistem Elektronik

| No   | Kewajiban                                             | Dasar                                                |                Status                | Catatan                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ----------------------------------------------------- | ---------------------------------------------------- | :----------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | **Pendaftaran PSE** di Komdigi (OSS-RBA / portal PSE) | PP 71/2019 Pasal 6; Permenkominfo 5/2020 jo. 10/2021 | ⏳ **perlu konfirmasi Bagian Hukum** | Universitas Pahlawan berbadan hukum yayasan (PTS) sehingga, bila wajib, kategorinya **PSE Lingkup Privat** (Lingkup Publik ditujukan bagi instansi penyelenggara negara). SPMI adalah sistem **internal** dengan pengguna terbatas (tanpa layanan ke masyarakat umum); kewajiban pendaftaran perlu dinilai — dapat juga ditempuh pendaftaran terpusat atas nama universitas untuk seluruh sistemnya. |
| R-02 | Nama domain `.ac.id`                                  | PP 71/2019                                           |                  ✅                  | `spmi.universitaspahlawan.ac.id`                                                                                                                                                                                                                                                                                                                                                                     |

## 3. Hak Subjek Data

| No   | Hak                                                             | Dasar          | Status | Implementasi                                                                                                           |
| ---- | --------------------------------------------------------------- | -------------- | :----: | ---------------------------------------------------------------------------------------------------------------------- |
| H-01 | Informasi pemrosesan (kebijakan privasi)                        | Pasal 5        |   🟡   | Halaman `/kebijakan-privasi`, `/syarat-ketentuan` (sedang ditambahkan; diperiksa `smoke-test.ps1`)                     |
| H-02 | Persetujuan & bukti persetujuan                                 | Pasal 20–22    |   🟡   | `users.consented_at`, `consent_version` (skema ditambahkan)                                                            |
| H-03 | Akses & salinan data                                            | Pasal 7, 13    |   🟡   | `GET /api/me/export` (sedang ditambahkan)                                                                              |
| H-04 | Perbaikan data                                                  | Pasal 6        |   🟡   | Nama/email sinkron dari SSO; koreksi lain via Admin LPM (permintaan email)                                             |
| H-05 | Penghapusan / pemusnahan                                        | Pasal 8, 43–44 |   🟡   | Admin LPM dapat menghapus akun; tugas purge terjadwal (sedang ditambahkan); berkas fisik yatim belum terhapus otomatis |
| H-06 | Menarik persetujuan                                             | Pasal 9        |   ⏳   | Prosedur via email LPM; dampak: akun dinonaktifkan                                                                     |
| H-07 | Batas waktu respons permintaan (3×24 jam untuk akses/perbaikan) | Pasal 30–33    |   ⏳   | SOP LPM perlu ditetapkan                                                                                               |

## 4. Keamanan Teknis (Pasal 35, 39)

| No   | Kontrol                                              | Status | Bukti                                                                                                                         |
| ---- | ---------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------- |
| K-01 | Enkripsi transit (TLS, HSTS)                         |   ✅   | Cloudflare Full (strict), `next.config.ts`                                                                                    |
| K-02 | Hash kata sandi (bcrypt) & kebijakan min. 8 karakter |   ✅   | `src/lib/auth.ts`, actions                                                                                                    |
| K-03 | Sesi aman (`__Host-`, httpOnly, Secure) + revokasi   |   🟡   | `src/lib/auth.ts`; `session_version` sedang diterapkan                                                                        |
| K-04 | RBAC di server                                       |   🟡   | Semua action memeriksa peran; celah eskalasi peran oleh Admin LPM perlu ditutup (lihat [README](../README.md#temuan-terbuka)) |
| K-05 | Pembatasan brute force                               |   🟡   | `src/lib/ratelimit.ts`; IP klien di balik Cloudflare via `src/lib/net.ts`                                                     |
| K-06 | Validasi unggahan & penyimpanan privat               |   🟡   | `src/lib/upload.ts`; ADR-0006 sedang diimplementasikan                                                                        |
| K-07 | Header keamanan (CSP, XFO, nosniff)                  |   ✅   | `next.config.ts`, diverifikasi smoke test                                                                                     |
| K-08 | Pesan error aman                                     |   ✅   | `src/lib/errors.ts` (kecuali error callback paket SSO)                                                                        |
| K-09 | Log akses & aktivitas + retensi                      |   🟡   | `src/lib/logs.ts`; retensi log aktivitas belum otomatis                                                                       |
| K-10 | Penyamaran data pribadi di log                       |   🟡   | `src/lib/redact.ts` (sedang diterapkan)                                                                                       |
| K-11 | Backup harian + uji restore                          |   🟡   | `scripts/deploy/backup.ps1`; salinan off-host & uji restore perlu dijadwalkan                                                 |
| K-12 | Enkripsi backup off-host                             |   ❌   | Disarankan BitLocker pada volume backup / arsip terenkripsi                                                                   |
| K-13 | Pembatasan akses server & DB                         |   ✅   | MySQL loopback `127.0.0.1:33063`, ACL `shared\`                                                                               |
| K-14 | Audit dependensi berkala                             |   ✅   | `npm run audit`                                                                                                               |
| K-15 | Pengujian keamanan sebelum rilis                     |   🟡   | [LAPORAN_KEAMANAN.md](../../LAPORAN_KEAMANAN.md) (2026-10-16); jadwalkan ulang tiap rilis MAJOR                               |

## 5. Tindak Lanjut Prioritas

1. ⏳ SK penunjukan Pejabat/Petugas PDP.
2. ⏳ Konfirmasi Bagian Hukum: kewajiban & kategori pendaftaran PSE, dasar hukum per aktivitas, masa retensi, perlu/tidaknya DPIA.
3. ⏳ Tinjauan hukum teks kebijakan privasi dan syarat & ketentuan sebelum diumumkan.
4. 🟡 Selesaikan fitur privasi (consent, ekspor data, purge terjadwal, unduhan berkas terotorisasi).
5. ❌ Enkripsi & salinan backup off-host; uji restore pertama.
