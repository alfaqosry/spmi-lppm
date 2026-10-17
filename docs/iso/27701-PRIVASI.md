# ISO/IEC 27701:2019 — Sistem Manajemen Informasi Privasi (PIMS) SPMI

Pemetaan kontrol ISO/IEC 27701:2019 (perluasan ISO/IEC 27001/27002 untuk privasi) ke **UU No. 27 Tahun 2022 tentang
Pelindungan Data Pribadi (UU PDP)** dan ke implementasi **Sistem Informasi SPMI — LPM Universitas Pahlawan Tuanku Tambusai**.

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3         | Dokumen Internal |

Catatan: ISO/IEC 27701 edisi 2019 merujuk struktur kontrol ISO/IEC 27002:2013; dokumen ini memakai penomoran 27701:2019.
Rujukan pasal UU PDP adalah pemetaan teknis dan **perlu dikonfirmasi Bagian Hukum** (⏳), sama seperti
[legal/RoPA.md](../legal/RoPA.md). Status: ✅ diterapkan · ⚠️ sebagian · ⏳ butuh institusi · N/A.

## 1. Peran dan Ruang Lingkup PIMS

| Butir (27701 §5.2.1)           | Isi                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Peran organisasi               | **Pengendali Data Pribadi** (PII controller): Universitas Pahlawan Tuanku Tambusai c.q. LPM                                           |
| Prosesor                       | Cloudflare, Inc. (proksi/CDN — IP & metadata permintaan, **di luar wilayah Indonesia**); Puskom/Bagian TI (operator server, internal) |
| Pengendali terkait             | Pengelola SSO UP (sumber identitas internal universitas)                                                                              |
| Subjek data                    | Pegawai LPM, pimpinan & anggota unit (dosen/tendik), pengguna SSO (termasuk mahasiswa), pihak ketiga yang tercantum dalam bukti audit |
| Inventaris pemrosesan          | 10 aktivitas A-1…A-10 di [legal/RoPA.md](../legal/RoPA.md)                                                                            |
| Data spesifik (Pasal 4 ayat 2) | Tidak dimaksudkan; risiko masuk lewat berkas bukti (RISK-REGISTER R-12)                                                               |
| Pemrosesan AI/otomatis         | Tidak ada ([42001-AI](42001-AI.md)) — Pasal 10 tidak terpicu                                                                          |

## 2. Kontrol Pengendali — Annex A ISO/IEC 27701 (A.7)

### A.7.2 Syarat pengumpulan dan pemrosesan

| Kontrol | Nama                                     | UU PDP                        | Implementasi SPMI                                                                                                                                                                          | Status |
| ------- | ---------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: |
| A.7.2.1 | Identifikasi & dokumentasi tujuan        | Pasal 16 ayat (2), 27         | Tujuan per aktivitas di [RoPA](../legal/RoPA.md); dipublikasikan di `/kebijakan-privasi`                                                                                                   |   ✅   |
| A.7.2.2 | Identifikasi dasar hukum                 | Pasal 20                      | Usulan dasar per aktivitas (huruf b/c/f) di RoPA — ⏳ konfirmasi Bagian Hukum                                                                                                              |   ⚠️   |
| A.7.2.3 | Menentukan kapan & bagaimana persetujuan | Pasal 20 ayat (2) huruf a, 21 | Persetujuan atas **kebijakan privasi** diminta setelah login (dialog `ConsentDialog` di `src/app/(dashboard)/layout.tsx`); diminta ulang bila `CONSENT_VERSION` berubah (`needsConsent()`) |   ✅   |
| A.7.2.4 | Memperoleh & mencatat persetujuan        | Pasal 22, 24                  | `recordConsent()` (`src/lib/actions/privacy.ts`) → `users.consented_at` + `users.consent_version` (`saveConsent()`), dicatat `activity_logs` `privacy.consent`                             |   ✅   |
| A.7.2.5 | Penilaian dampak privasi (DPIA)          | Pasal 34                      | Belum dilakukan; indikasi perlu karena bukti audit dapat memuat data mahasiswa dalam jumlah besar ([CHECKLIST T-05](../legal/CHECKLIST-KEPATUHAN.md))                                      |   ⏳   |
| A.7.2.6 | Kontrak dengan prosesor                  | Pasal 51                      | DPA Cloudflare & kesepakatan internal SSO UP/Puskom belum didokumentasikan (T-06)                                                                                                          |   ⏳   |
| A.7.2.7 | Pengendali bersama                       | Pasal 18                      | Hubungan dengan pengelola SSO UP perlu ditetapkan (pengendali bersama atau terpisah)                                                                                                       |   ⏳   |
| A.7.2.8 | Catatan pemrosesan data pribadi          | Pasal 31                      | [RoPA](../legal/RoPA.md) v1.0, ditinjau ≥ 1×/tahun; checklist PR mewajibkan pembaruan RoPA ([07 §6](../07-STANDAR-ENGINEERING.md#6-keamanan-wajib-per-pr))                                 |   ✅   |

### A.7.3 Kewajiban kepada subjek data

| Kontrol  | Nama                                   | UU PDP                     | Implementasi SPMI                                                                                                                                                                                                                                                                                | Status |
| -------- | -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: |
| A.7.3.1  | Menentukan & memenuhi kewajiban        | Pasal 5–13, 47             | Hak subjek dipetakan di [CHECKLIST §3](../legal/CHECKLIST-KEPATUHAN.md); SOP LPM untuk permintaan ⏳                                                                                                                                                                                             |   ⚠️   |
| A.7.3.2  | Menentukan informasi untuk subjek      | Pasal 5, 21                | `/kebijakan-privasi`: pengendali, data, tujuan, dasar hukum, pihak ketiga, retensi, hak, kontak                                                                                                                                                                                                  |   ✅   |
| A.7.3.3  | Menyampaikan informasi                 | Pasal 21                   | Tautan kebijakan di halaman login & footer; dialog persetujuan menautkan kebijakan                                                                                                                                                                                                               |   ✅   |
| A.7.3.4  | Mekanisme mengubah/menarik persetujuan | Pasal 9, 40                | Penarikan melalui email LPM; akibat: akun dinonaktifkan. Belum ada tombol mandiri                                                                                                                                                                                                                |   ⚠️   |
| A.7.3.5  | Mekanisme keberatan                    | Pasal 10, 11               | Via email LPM; tidak ada keputusan otomatis/profiling                                                                                                                                                                                                                                            |   ✅   |
| A.7.3.6  | Akses, koreksi, penghapusan            | Pasal 6, 7, 8, 43          | Akses: Profil → "Unduh data saya". Koreksi: nama/email tersinkron SSO, lainnya oleh Admin LPM. Penghapusan: Admin LPM menghapus akun atas permintaan                                                                                                                                             |   ✅   |
| A.7.3.7  | Kewajiban memberi tahu pihak ketiga    | Pasal 45                   | Prosedur belum ditetapkan (mis. memberi tahu pengelola SSO bila data dikoreksi)                                                                                                                                                                                                                  |   ⏳   |
| A.7.3.8  | Menyediakan salinan data yang diproses | Pasal 7, 13 (portabilitas) | `GET /api/me/export` — JSON UTF-8 terstruktur (profil, consent, keanggotaan, riwayat login/aktivitas, dokumen, verifikasi, progres, retensi), ISO 8601 +07:00, metadata `locale` & `Content-Language: id`; tanpa hash sandi; rate limit 5×/menit (`buildMyDataExport()` di `src/lib/privacy.ts`) |   ✅   |
| A.7.3.9  | Menangani permintaan                   | Pasal 30, 32 (3×24 jam)    | Ekspor mandiri seketika; permintaan lain via email — batas 3×24 jam belum di-SOP-kan (H-07)                                                                                                                                                                                                      |   ⚠️   |
| A.7.3.10 | Keputusan otomatis                     | Pasal 10                   | Tidak ada keputusan otomatis yang berdampak pada subjek ([42001-AI §1](42001-AI.md#1-pernyataan-keberlakuan))                                                                                                                                                                                    |  N/A   |

### A.7.4 Privasi sejak desain dan secara bawaan

| Kontrol | Nama                                              | UU PDP              | Implementasi SPMI                                                                                                                                                                                                               | Status |
| ------- | ------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| A.7.4.1 | Membatasi pengumpulan                             | Pasal 16 ayat (2) a | Hanya identitas & peran; tidak ada pelacak/analitik pihak ketiga di kode; cookie esensial saja; font self-hosted                                                                                                                |   ✅   |
| A.7.4.2 | Membatasi pemrosesan                              | Pasal 16, 27        | RBAC & otorisasi per unit (`src/lib/guards.ts`); data ke komponen klien diminimalkan ([07 §3](../07-STANDAR-ENGINEERING.md#3-pola-lapisan))                                                                                     |   ✅   |
| A.7.4.3 | Akurasi & kualitas                                | Pasal 28–30         | Validasi input (`src/lib/validate.ts`); identitas SSO disinkron saat login                                                                                                                                                      |   ✅   |
| A.7.4.4 | Tujuan minimisasi                                 | Pasal 16            | JWT hanya `sub` + `sv` (tanpa data pribadi); ekspor PDF tanpa data pribadi berlebih; checklist PR minimisasi                                                                                                                    |   ✅   |
| A.7.4.5 | De-identifikasi & penghapusan di akhir pemrosesan | Pasal 42–44         | Log login/aktivitas dihapus otomatis; email di log disamarkan. **Celah:** purge akun pengunjung 180 hari (RoPA A-2) belum diimplementasikan (R-25)                                                                              |   ⚠️   |
| A.7.4.6 | Berkas sementara                                  | Pasal 35            | Dump DB sementara di kontainer dihapus di blok `finally` (`scripts/deploy/lib-db.ps1`); worktree build dihapus setelah deploy; berkas bukti yatim dibersihkan best-effort (`cleanupUnreferencedUploads`)                        |   ✅   |
| A.7.4.7 | Retensi                                           | Pasal 42            | `log.loginRetentionDays` 90, `log.activityRetentionDays` 365 (`SETTING_DEFAULTS`, `src/lib/settings.ts`); tugas `\SPMI\SPMI Retensi Data` 02:00 → `purgeExpiredData()`; backup 30 hari; bukti siklus + 5 tahun (usulan, manual) |   ✅   |
| A.7.4.8 | Pembuangan                                        | Pasal 44            | Prosedur pemusnahan & berita acara di [RENCANA-PEMELIHARAAN §9](RENCANA-PEMELIHARAAN.md#9-disposal-penonaktifan-dan-retensi-data)                                                                                               |   ✅   |
| A.7.4.9 | Kendali transmisi                                 | Pasal 35, 39        | HTTPS end-to-end (Cloudflare Full strict + HSTS); ekspor `private, no-store`; tidak ada pengiriman email/WA berisi data pribadi dari aplikasi                                                                                   |   ✅   |

### A.7.5 Berbagi, transfer, dan pengungkapan

| Kontrol | Nama                                     | UU PDP       | Implementasi SPMI                                                                                                                                                                                               | Status |
| ------- | ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| A.7.5.1 | Dasar transfer antar-yurisdiksi          | Pasal 56     | Lalu lintas melewati jaringan Cloudflare global (IP & metadata). Data inti (DB, berkas) tetap di server universitas di Indonesia. Dasar transfer (kesetaraan pelindungan/perjanjian) perlu dinilai Bagian Hukum |   ⏳   |
| A.7.5.2 | Negara/organisasi tujuan transfer        | Pasal 56     | Cloudflare, Inc. (AS) — dicatat di RoPA & kebijakan privasi                                                                                                                                                     |   ✅   |
| A.7.5.3 | Catatan transfer                         | Pasal 31, 56 | Tercatat di RoPA (prosesor & lokasi data)                                                                                                                                                                       |   ✅   |
| A.7.5.4 | Catatan pengungkapan kepada pihak ketiga | Pasal 31     | Pengungkapan laporan ke asesor BAN-PT/LAM dicatat di RoPA A-5/A-6; ekspor PDF tercatat di log aktivitas                                                                                                         |   ✅   |

## 3. Perluasan Kontrol ISO/IEC 27001/27002 untuk Privasi (27701 Klausul 6)

| Klausul 27701 | Perluasan                                       | UU PDP       | Implementasi SPMI                                                                                                                                         | Status |
| ------------- | ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| 6.2.1.1       | Kebijakan KI memuat privasi                     | Pasal 47     | Kebijakan institusi belum ada; kebijakan privasi publik tersedia                                                                                          |   ⏳   |
| 6.3.1.1       | Penanggung jawab privasi                        | Pasal 53–54  | **Pejabat/Petugas PDP belum ditunjuk** (sementara Ketua LPM)                                                                                              |   ⏳   |
| 6.4.2.2       | Kesadaran & pelatihan privasi                   | Pasal 35     | Pelatihan belum ada (T-07 ❌)                                                                                                                             |   ⏳   |
| 6.5.2.1       | Klasifikasi mencakup data pribadi               | Pasal 4      | Kategori data pribadi per aktivitas di RoPA                                                                                                               |   ✅   |
| 6.5.3.1       | Media lepas berisi data pribadi                 | Pasal 35     | Backup di disk D: tidak terenkripsi (K-12 ❌)                                                                                                             |   ⏳   |
| 6.6.2.1       | Registrasi & penghapusan pengguna               | Pasal 8, 43  | Akun dibuat/dihapus Admin LPM; akun SSO baru otomatis tanpa akses; hapus akun → token ditolak                                                             |   ✅   |
| 6.6.4.2       | Prosedur log-on aman                            | Pasal 35, 39 | ASC-01…ASC-06 ([27034](27034-KEAMANAN-APLIKASI.md))                                                                                                       |   ✅   |
| 6.7.1.1       | Kriptografi                                     | Pasal 35     | TLS, bcrypt, JWT HS256; enkripsi backup ⏳                                                                                                                |   ⚠️   |
| 6.8.2.7       | Pembuangan/penggunaan ulang peralatan aman      | Pasal 44     | Prosedur di RENCANA-PEMELIHARAAN §9.3                                                                                                                     |   ⏳   |
| 6.9.3.1       | Backup data pribadi                             | Pasal 35     | Backup harian + uji restore 17 Okt 2026 (`scripts/deploy/backup.ps1`)                                                                                     |   ✅   |
| 6.9.4.1       | Pencatatan kejadian (log)                       | Pasal 35, 39 | `login_logs`, `activity_logs` (`src/lib/logs.ts`)                                                                                                         |   ✅   |
| 6.9.4.2       | Perlindungan informasi log                      | Pasal 35     | Log hanya superadmin; **penyamaran** email/telepon/token (`src/lib/redact.ts`); retensi otomatis; log berkas → rotasi 90 hari (sedang diterapkan)         |   ✅   |
| 6.10.2.1      | Prosedur transfer informasi                     | Pasal 35     | HTTPS; ekspor hanya PDF/JSON; tanpa CSV                                                                                                                   |   ✅   |
| 6.10.2.4      | Perjanjian kerahasiaan                          | Pasal 36     | NDA pegawai/pengembang belum                                                                                                                              |   ⏳   |
| 6.11.1.1      | Persyaratan keamanan termasuk privasi           | Pasal 35     | Checklist PR: perubahan pemrosesan data pribadi → perbarui RoPA; ASC-24                                                                                   |   ✅   |
| 6.11.2.1      | Kebijakan pengembangan aman (privacy by design) | Pasal 35     | [07](../07-STANDAR-ENGINEERING.md), [12207](12207-SIKLUS-HIDUP.md)                                                                                        |   ✅   |
| 6.11.3.1      | Perlindungan data uji                           | Pasal 35     | Data uji sintetis `@example.test`, DB uji sekali-pakai; tanpa data produksi (`.github/workflows/e2e.yml`)                                                 |   ✅   |
| 6.12.1.2      | Pemasok & data pribadi                          | Pasal 51     | DPA Cloudflare/Puskom ⏳                                                                                                                                  |   ⏳   |
| 6.13.1.1      | Tanggung jawab & prosedur insiden               | Pasal 46     | [legal/INSIDEN-DATA](../legal/INSIDEN-DATA.md): T0, triase 1 jam, penahanan, **notifikasi tertulis ≤ 3×24 jam** ke subjek & Lembaga; tim belum ditetapkan |   ⚠️   |
| 6.13.1.5      | Respons insiden                                 | Pasal 46     | Kemampuan teknis: mode pemeliharaan, rotasi `AUTH_SECRET`, nonaktif akun, log investigasi                                                                 |   ✅   |
| 6.15.1.1      | Identifikasi peraturan                          | Pasal 47     | [legal/CHECKLIST-KEPATUHAN](../legal/CHECKLIST-KEPATUHAN.md)                                                                                              |   ✅   |
| 6.15.1.3      | Perlindungan rekaman                            | Pasal 31     | RoPA & bukti persetujuan disimpan; catatan permintaan hak subjek 3 tahun (usulan)                                                                         |   ⚠️   |
| 6.15.2.1      | Tinjauan independen                             | Pasal 47     | Belum ada audit PDP/keamanan independen                                                                                                                   |   ⏳   |

## 4. Matriks Hak Subjek Data → Fitur SPMI

| Hak (UU PDP)                       | Pasal | Fitur / mekanisme                                                                                                    | Waktu pemenuhan     |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Informasi pemrosesan               | 5     | `/kebijakan-privasi`, `/syarat-ketentuan`                                                                            | Seketika            |
| Melengkapi/memperbarui/memperbaiki | 6     | Sinkron SSO; permintaan ke Admin LPM                                                                                 | ≤ 3×24 jam (⏳ SOP) |
| Akses & salinan                    | 7, 32 | `GET /api/me/export` (Profil → Unduh data saya)                                                                      | Seketika            |
| Mengakhiri pemrosesan / menghapus  | 8, 43 | Permintaan email → Admin LPM hapus akun; log terhapus otomatis sesuai retensi                                        | ≤ 3×24 jam (⏳ SOP) |
| Menarik persetujuan                | 9     | Email LPM → akun dinonaktifkan                                                                                       | ≤ 3×24 jam (⏳ SOP) |
| Keberatan atas keputusan otomatis  | 10    | N/A — tidak ada keputusan otomatis                                                                                   | —                   |
| Menunda/membatasi pemrosesan       | 11    | Nonaktif akun sementara                                                                                              | ⏳ SOP              |
| Portabilitas                       | 13    | JSON terstruktur UTF-8 + metadata `locale` ([STANDAR-KODE-DATA §4](STANDAR-KODE-DATA.md#4-metadata-locale-pada-api)) | Seketika            |
| Notifikasi kegagalan pelindungan   | 46    | [legal/INSIDEN-DATA](../legal/INSIDEN-DATA.md) + templat                                                             | ≤ 3×24 jam sejak T0 |

## 5. Ringkasan Status

| Kelompok                              | ✅  | ⚠️  | ⏳  | N/A | Total |
| ------------------------------------- | :-: | :-: | :-: | :-: | :---: |
| A.7.2 Syarat pengumpulan & pemrosesan |  4  |  1  |  3  |  0  |   8   |
| A.7.3 Kewajiban kepada subjek data    |  5  |  3  |  1  |  1  |  10   |
| A.7.4 Privacy by design & by default  |  8  |  1  |  0  |  0  |   9   |
| A.7.5 Berbagi, transfer, pengungkapan |  3  |  0  |  1  |  0  |   4   |
| Perluasan klausul 6 (dipilih)         | 12  |  3  |  8  |  0  |  23   |

Annex B (kontrol **prosesor**) tidak diterapkan karena SPMI/LPM berperan sebagai pengendali; bila kelak LPM memproses
data atas nama pengendali lain (mis. layanan SPMI untuk institusi lain), Annex B wajib dinilai.

## 6. OWASP MASVS — Tidak Berlaku

**N/A.** SPMI tidak memiliki aplikasi mobile (Android/iOS, native maupun hibrida); akses ponsel hanya melalui browser
(web responsif, diuji profil Pixel 7 & iPhone 14 di Playwright). Privasi di perangkat ditangani oleh kontrol web
(cookie `httpOnly`/`Secure`, `no-store`, tanpa penyimpanan lokal data pribadi).

**Kondisi pemicu:** bila aplikasi mobile dibangun, wajib menerapkan **OWASP MASVS L1** sebagai dasar dan **MASVS L2**
bila aplikasi menyimpan data pribadi/bukti audit di perangkat atau memakai autentikasi biometrik; tambahkan kategori
MASVS-STORAGE, MASVS-CRYPTO, MASVS-AUTH, MASVS-NETWORK, MASVS-PRIVACY ke register risiko, uji dengan OWASP MASTG, dan
perbarui RoPA (izin perangkat, SDK pihak ketiga, notifikasi push).

## 7. Tindak Lanjut

| No  | Tindakan                                                              | Kontrol                   | Pemilik            |
| --- | --------------------------------------------------------------------- | ------------------------- | ------------------ |
| 1   | SK Pejabat/Petugas PDP                                                | 6.3.1.1                   | Rektor             |
| 2   | Konfirmasi dasar hukum, retensi, PSE, transfer Cloudflare; DPIA       | A.7.2.2, A.7.2.5, A.7.5.1 | Bagian Hukum       |
| 3   | SOP permintaan hak subjek ≤ 3×24 jam + log permintaan                 | A.7.3.9                   | LPM                |
| 4   | Implementasi purge akun pengunjung tak berperan > 180 hari            | A.7.4.5                   | Pengembang         |
| 5   | Tombol penarikan persetujuan/permintaan penghapusan mandiri di Profil | A.7.3.4                   | Pengembang         |
| 6   | Enkripsi backup & salinan off-host                                    | 6.5.3.1, 6.7.1.1          | Puskom             |
| 7   | DPA Cloudflare & kesepakatan internal SSO UP/Puskom                   | A.7.2.6, 6.12.1.2         | Bagian Hukum / LPM |
| 8   | Pelatihan PDP singkat (larangan unggah data spesifik di bukti)        | 6.4.2.2                   | LPM                |
