# Catatan Aktivitas Pemrosesan Data Pribadi (RoPA)

**Dasar:** Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP), khususnya Pasal 31
(kewajiban perekaman seluruh kegiatan pemrosesan) dan Pasal 20 (dasar pemrosesan).

| Butir                    | Isi                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pengendali Data Pribadi  | Universitas Pahlawan Tuanku Tambusai, c.q. Lembaga Penjaminan Mutu (LPM)                                                                         |
| Sistem                   | SPMI — Sistem Penjaminan Mutu Internal (<https://spmi.universitaspahlawan.ac.id>)                                                                |
| Kontak                   | `lpm@universitaspahlawan.ac.id`                                                                                                                  |
| Pejabat/Petugas PDP      | ⏳ Belum ditunjuk — lihat [CHECKLIST-KEPATUHAN.md](CHECKLIST-KEPATUHAN.md)                                                                       |
| Prosesor / pihak terkait | Pengelola SSO UP (internal universitas); Cloudflare, Inc. (proksi/CDN — memproses alamat IP & metadata permintaan); pengelola server (Bagian TI) |
| Lokasi data              | Server Windows milik universitas (DB MySQL & berkas di `E:\www\spmi-prod`); lalu lintas melewati jaringan Cloudflare global                      |
| Versi / tanggal          | 1.0 — 2026-10-17 · ditinjau ulang minimal 1×/tahun atau setiap perubahan pemrosesan                                                              |

> Dasar hukum di bawah merupakan usulan teknis dan **perlu dikonfirmasi Bagian Hukum** (status ⏳).
> Rujukan kewajiban SPMI: UU 12/2012 tentang Pendidikan Tinggi (Pasal 51–53) dan Permendikbudristek 53/2023
> tentang Penjaminan Mutu Pendidikan Tinggi.

---

## A-1. Pengelolaan Akun dan Autentikasi Lokal

| Butir                          | Isi                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tujuan                         | Memberikan akses terkendali sesuai peran kepada pelaksana SPMI                                                                                                                                   |
| Kategori subjek                | Pegawai LPM, pimpinan & anggota unit (dosen, tendik), superadmin                                                                                                                                 |
| Kategori data                  | Nama, email, username (NIDN/NIM/NIP bila ada), hash kata sandi (bcrypt), peran, unit & jabatan (kepala/anggota), status aktif, status Ketua LPM, versi sesi, waktu persetujuan kebijakan privasi |
| Data spesifik (Pasal 4 ayat 2) | Tidak ada                                                                                                                                                                                        |
| Dasar hukum                    | Pasal 20 ayat (2) huruf c — pemenuhan kewajiban hukum (penyelenggaraan SPMI); huruf b — pelaksanaan perjanjian/hubungan kerja                                                                    |
| Sumber                         | Diinput Admin LPM (`src/lib/actions/units.ts`), seed awal (`prisma/seed.ts`)                                                                                                                     |
| Penerima                       | Admin LPM & superadmin (manajemen akun); nama tampil ke pengguna LPM                                                                                                                             |
| Retensi                        | Selama akun aktif dibutuhkan; dihapus/anonimkan ≤ 1 tahun setelah tidak lagi menjabat atau atas permintaan, kecuali masih dirujuk laporan audit yang wajib diarsipkan                            |
| Langkah keamanan               | Kata sandi bcrypt (cost 10, min. 8 karakter); sesi JWT `httpOnly`/`Secure`/`__Host-`; pembatas percobaan login; RBAC di server; akses DB hanya loopback; TLS                                     |

## A-2. Login SSO dan Sinkronisasi Identitas

| Butir            | Isi                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tujuan           | Autentikasi tunggal sivitas melalui SSO UP                                                                                                                                                                         |
| Kategori subjek  | Sivitas yang login via SSO (dosen, tendik, mahasiswa)                                                                                                                                                              |
| Kategori data    | `sub`/sso_id, username (NIDN/NIM/NIP), nama, email, klaim role SSO; token akses OAuth (cookie sementara)                                                                                                           |
| Dasar hukum      | Pasal 20 ayat (2) huruf c / e — perlu konfirmasi Bagian Hukum                                                                                                                                                      |
| Sumber           | SSO UP (`src/app/api/sso/[...sso]/route.ts`)                                                                                                                                                                       |
| Penerima         | Sistem SPMI; akun baru tampil ke Admin LPM sebagai Pengunjung                                                                                                                                                      |
| Retensi          | Profil: sama dengan A-1. Akun Pengunjung yang tidak pernah diberi peran: hapus otomatis setelah 180 hari tidak aktif (tugas purge privasi). Cookie `sso_session`/`sso_access_token`: masa berlaku token (≤ 24 jam) |
| Langkah keamanan | Client Secret hanya di server (disamarkan di UI); klaim role SSO tidak dipercaya; akun baru tanpa akses; TLS                                                                                                       |

## A-3. Log Login (Keamanan)

| Butir            | Isi                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Tujuan           | Deteksi penyalahgunaan akun, investigasi insiden, pembatasan brute force                                     |
| Kategori subjek  | Semua yang mencoba login (termasuk email tidak terdaftar)                                                    |
| Kategori data    | Email yang dimasukkan, id pengguna, sukses/gagal, metode (password/sso), alamat IP, user-agent, pesan, waktu |
| Dasar hukum      | Pasal 20 ayat (2) huruf f — kepentingan yang sah (keamanan sistem)                                           |
| Sumber           | `recordLogin` — `src/lib/logs.ts`                                                                            |
| Penerima         | Superadmin (menu Pengaturan → Log)                                                                           |
| Retensi          | `log.loginRetentionDays` (default **90 hari**), dihapus otomatis + tugas purge harian                        |
| Langkah keamanan | Hanya superadmin; dapat dinonaktifkan; data pribadi di log konsol disamarkan (`src/lib/redact.ts`)           |

## A-4. Log Aktivitas (Jejak Audit)

| Butir            | Isi                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tujuan           | Akuntabilitas perubahan data penting (login, pengaturan, pembuatan superadmin, dll.)                                                            |
| Kategori subjek  | Pengguna yang melakukan aksi                                                                                                                    |
| Kategori data    | Id & nama pengguna, aksi, entitas, id entitas, detail, IP, waktu                                                                                |
| Dasar hukum      | Pasal 20 ayat (2) huruf f — kepentingan yang sah; huruf c — akuntabilitas SPMI                                                                  |
| Sumber           | `recordActivity` — `src/lib/logs.ts`                                                                                                            |
| Penerima         | Superadmin                                                                                                                                      |
| Retensi          | Usulan **1 tahun** melalui tugas purge privasi (saat ini kode belum menghapus otomatis — lihat temuan di [README](../README.md#temuan-terbuka)) |
| Langkah keamanan | Hanya superadmin; dapat dinonaktifkan/dibersihkan (aksi pembersihan dicatat)                                                                    |

## A-5. Pengisian Audit Mutu Internal dan Bukti

| Butir            | Isi                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tujuan           | Pelaksanaan audit mutu internal per unit                                                                                                                    |
| Kategori subjek  | Auditee (Kepala/Anggota Unit); **pihak ketiga** yang namanya tercantum dalam dokumen bukti (dosen, mahasiswa, tendik)                                       |
| Kategori data    | Jawaban Ya/Tidak, alasan, tautan bukti, berkas PDF bukti (dapat memuat nama, NIDN/NIM, SK, nilai, foto), RTL, pengguna yang memperbarui progres             |
| Data spesifik    | Tidak dimaksudkan; auditee diminta **tidak** mengunggah data spesifik (kesehatan, biometrik, keuangan pribadi, data anak) atau menyamarkannya               |
| Dasar hukum      | Pasal 20 ayat (2) huruf c — kewajiban hukum penjaminan mutu                                                                                                 |
| Sumber           | `saveResponse`, `saveRtl` — `src/lib/actions/responses.ts`; berkas via `src/lib/upload.ts`                                                                  |
| Penerima         | Pengguna LPM & superadmin; anggota unit yang sama; asesor akreditasi (BAN-PT/LAM) dalam bentuk laporan bila diperlukan                                      |
| Retensi          | Selama siklus + **5 tahun** (satu siklus akreditasi) untuk keperluan akreditasi, kemudian dihapus/diarsipkan — perlu konfirmasi Bagian Hukum & LPM          |
| Langkah keamanan | Validasi PDF (magic bytes, 10 MB); penyimpanan privat di luar web root + unduhan terotorisasi (`/api/files/*`, ADR-0006); otorisasi per unit; backup harian |

## A-6. Verifikasi LPM dan Laporan PDF

| Butir            | Isi                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Tujuan           | Verifikasi kesesuaian, pelaporan hasil AMI, pengesahan oleh Ketua LPM                     |
| Kategori subjek  | Verifikator LPM, Ketua LPM, auditee (nama unit)                                           |
| Kategori data    | Status verifikasi, catatan LPM, id verifikator & waktu, nama & jabatan Ketua LPM pada PDF |
| Dasar hukum      | Pasal 20 ayat (2) huruf c                                                                 |
| Sumber           | `verifyResponse`; `src/app/api/export/route.ts`, `src/lib/report/*`                       |
| Penerima         | Pengguna LPM; pimpinan universitas; asesor akreditasi                                     |
| Retensi          | Sama dengan A-5; berkas PDF yang diunduh menjadi tanggung jawab pengunduh                 |
| Langkah keamanan | Ekspor hanya peran LPM/superadmin; `Cache-Control: no-store`                              |

## A-7. Dokumen Penetapan & Evaluasi

| Butir            | Isi                                                           |
| ---------------- | ------------------------------------------------------------- |
| Tujuan           | Distribusi dokumen kebijakan/standar/evaluasi mutu            |
| Kategori subjek  | Pengunggah (pengguna LPM); pihak yang tercantum dalam dokumen |
| Kategori data    | Judul, berkas/tautan, id pengunggah, waktu                    |
| Dasar hukum      | Pasal 20 ayat (2) huruf c                                     |
| Penerima         | Semua pengguna berperan (selain pengunjung)                   |
| Retensi          | Selama dokumen berlaku + 5 tahun                              |
| Langkah keamanan | Validasi PDF/URL; unduhan terotorisasi                        |

## A-8. Pengaturan Sistem & Sesi

| Butir            | Isi                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Tujuan           | Operasional sistem                                                                                                                           |
| Kategori data    | Id superadmin pengubah pengaturan; cookie sesi (id, nama, email, peran, unit dalam JWT bertanda tangan); cookie `theme` (bukan data pribadi) |
| Dasar hukum      | Pasal 20 ayat (2) huruf f                                                                                                                    |
| Retensi          | Cookie sesi: `security.sessionDays` (default 7 hari)                                                                                         |
| Langkah keamanan | JWT ditandatangani, `httpOnly`; secret disimpan dengan penanda `is_secret`                                                                   |

## A-9. Permintaan Hak Subjek Data dan Persetujuan

| Butir            | Isi                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Tujuan           | Memenuhi hak akses/salinan data (Pasal 7, 13), perbaikan (Pasal 6), penghapusan (Pasal 8), dan mencatat persetujuan kebijakan privasi |
| Kategori data    | `consented_at`, `consent_version`; berkas ekspor JSON (`/api/me/export`) yang diunduh subjek                                          |
| Dasar hukum      | Pasal 20 ayat (2) huruf c (kewajiban pemenuhan hak); huruf a untuk hal yang memerlukan persetujuan                                    |
| Retensi          | Bukti persetujuan selama akun ada + 1 tahun; catatan permintaan hak subjek 3 tahun                                                    |
| Langkah keamanan | Ekspor hanya data milik sesi yang sedang login, tanpa hash sandi                                                                      |

## A-10. Backup dan Pemulihan

| Butir            | Isi                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tujuan           | Kelangsungan layanan & pemulihan bencana                                                                                                                         |
| Kategori data    | Salinan penuh DB dan berkas unggahan (semua kategori di atas)                                                                                                    |
| Dasar hukum      | Pasal 20 ayat (2) huruf f; kewajiban keamanan Pasal 35 & 39                                                                                                      |
| Penerima         | Administrator server                                                                                                                                             |
| Retensi          | Backup harian 30 hari (`scripts/deploy/backup.ps1`); backup pra-deploy mengikuti 5 rilis terakhir (hapus manual yang lebih lama); mirror berkas mengikuti sumber |
| Langkah keamanan | Folder `shared`/`backups` ber-ACL Administrators + SYSTEM; salinan off-host terenkripsi (disarankan BitLocker/7-Zip AES-256); uji restore berkala                |

---

## Ringkasan Retensi

| Data                         | Retensi                       | Mekanisme                                                       |
| ---------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Log login                    | 90 hari (dapat diatur)        | Otomatis saat login + purge harian                              |
| Log aktivitas                | 1 tahun (usulan)              | Purge harian (perlu implementasi)                               |
| Akun Pengunjung tak berperan | 180 hari tidak aktif (usulan) | Purge harian                                                    |
| Jawaban, bukti, laporan      | Siklus + 5 tahun (usulan)     | Manual oleh Admin LPM (hapus siklus) + pembersihan berkas yatim |
| Backup harian                | 30 hari                       | `backup.ps1`                                                    |
