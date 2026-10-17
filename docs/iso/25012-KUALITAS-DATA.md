# ISO/IEC 25012:2008 — Model Kualitas Data SPMI

Penerapan model kualitas data ISO/IEC 25012 (15 karakteristik) pada data **Sistem Informasi SPMI — LPM Universitas
Pahlawan Tuanku Tambusai**, beserta pemeriksaan otomatis harian dan hasil terukur di produksi.

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3         | Dokumen Internal |

Dokumen terkait: [KAMUS-DATA](KAMUS-DATA.md) (definisi setiap tabel/kolom), [25010-KUALITAS-PRODUK](25010-KUALITAS-PRODUK.md),
[01-PERANCANGAN §6 ERD & §9 Aturan Bisnis](../01-PERANCANGAN.md), [legal/RoPA](../legal/RoPA.md).

## 1. Ruang Lingkup Data

| Kelompok          | Tabel (MySQL)                                                | Pemilik data | Sifat                    |
| ----------------- | ------------------------------------------------------------ | ------------ | ------------------------ |
| Identitas & akses | `users`, `unit_memberships`, `units`                         | Admin LPM    | Data pribadi (UU PDP)    |
| Instrumen audit   | `audit_cycles`, `audit_standards`, `audit_questions`         | Admin LPM    | Data organisasi          |
| Hasil audit       | `audit_responses`, `unit_progress`, `documents` + berkas PDF | Unit / LPM   | Bukti mutu (akreditasi)  |
| Konfigurasi       | `app_settings`                                               | Superadmin   | Sebagian rahasia         |
| Jejak             | `login_logs`, `activity_logs`                                | Sistem       | Data pribadi tersamarkan |

Karakteristik dibagi ISO 25012 menjadi **inheren** (melekat pada data), **bergantung sistem** (dijamin oleh platform),
dan keduanya.

## 2. Pemetaan 15 Karakteristik

| No  | Karakteristik (ISO 25012) | Sudut pandang     | Penerapan pada SPMI (pencegahan)                                                                                                     | Aturan otomatis                          |
| --- | ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 1   | Akurasi                   | Inheren           | Validasi server `validate.ts` (email, tanggal ISO, enum, ID); tanggal tak valid ditolak (`2025-02-31`)                               | DQ-01, DQ-14, DQ-17, DQ-31               |
| 2   | Kelengkapan               | Inheren           | AB-06 Ya → bukti, Tidak → alasan; AB-22 dokumen wajib berkas/tautan; revisi wajib catatan                                            | DQ-19, DQ-20, DQ-24                      |
| 3   | Konsistensi               | Inheren           | FK + `@@unique` Prisma; transaksi "satu siklus aktif" & "satu Ketua LPM"; `syncUserAccess` menyinkronkan peran ↔ penempatan          | DQ-02…06, DQ-13, DQ-16, DQ-18, DQ-30     |
| 4   | Kredibilitas              | Inheren           | Hanya LPM/superadmin yang memverifikasi & mengunggah dokumen (`requireLpm`); identitas via SSO UP                                    | DQ-22                                    |
| 5   | Kekinian (_currentness_)  | Inheren           | Progres dihitung ulang setiap simpan/verifikasi; siklus tertutup otomatis setelah `end_date` (AB-02)                                 | DQ-15, DQ-23                             |
| 6   | Aksesibilitas             | Inheren + sistem  | UI WCAG 2.1 AA (Lighthouse A11y 100); data pribadi dapat diunduh subjek (`/api/me/export`); akun punya cara masuk                    | DQ-08                                    |
| 7   | Kepatuhan                 | Inheren + sistem  | UU 27/2022 PDP: consent per versi, retensi log, RoPA; ISO 8601 `+07:00`; URL hanya http/https; path berkas kanonik                   | DQ-10, DQ-11, DQ-25, DQ-26, DQ-33, DQ-36 |
| 8   | Kerahasiaan               | Inheren + sistem  | bcrypt; email log disamarkan; `redactText`; `is_secret`; berkas privat di luar web root, unduh berotorisasi                          | DQ-09, DQ-34, DQ-37                      |
| 9   | Efisiensi                 | Inheren + sistem  | Kolom ber-index (`cycle_id`, `unit_id`, `status`, `evidence_file`); berkas yatim dibersihkan (`cleanupUnreferencedUploads`)          | DQ-29                                    |
| 10  | Presisi                   | Inheren + sistem  | `DATE` untuk tanggal siklus; `DATETIME(3)` (ms) untuk timestamp; angka pengaturan bulat dalam rentang                                | DQ-38                                    |
| 11  | Ketertelusuran            | Inheren + sistem  | `verified_by/verified_at`, `last_updated_by`, `uploaded_by`, `updated_by`; log aktivitas per aksi                                    | DQ-21, DQ-35                             |
| 12  | Keterpahaman              | Inheren + sistem  | Nama tabel/kolom deskriptif, enum bermakna, label Bahasa Indonesia (`STATUS_LABEL`, `ROLE_LABEL`), kamus data                        | DQ-12                                    |
| 13  | Ketersediaan              | Bergantung sistem | PM2 autorestart, `/api/health` (cek DB), backup harian; berkas yang dirujuk harus ada                                                | DQ-07, DQ-27                             |
| 14  | Portabilitas              | Bergantung sistem | MySQL `utf8mb4_unicode_ci`, JSON UTF-8, dump SQL standar; berkas di satu `UPLOAD_DIR`                                                | DQ-28, DQ-32                             |
| 15  | Keterpulihan              | Bergantung sistem | Backup DB + unggahan harian 01:30 (30 hari, salinan D:), backup pra-deploy, **uji restore lulus 17 Okt 2026**, rollback `-RestoreDb` | — (operasional, §5)                      |

## 3. Pemeriksaan Otomatis (`src/lib/data-quality.ts`)

- **38 aturan bernama** (`DQ-01…DQ-38`), masing-masing `{ id, characteristic, description, severity, check() }`.
  `check()` mengembalikan `{ total, violations, sampleIds }` — `sampleIds` hanya id baris (maks. 10), **tanpa data pribadi**.
- **Hanya-baca:** aturan memakai `findMany` (select kolom minimal) + `stat`/`readdir` pada `UPLOAD_DIR`; uji unit
  memastikan tidak ada metode Prisma lain yang dipanggil. Data dimuat sekali per jalankan lalu dievaluasi di memori.
- **Skor:** `score = Σ bobot aturan lolos / Σ bobot semua aturan × 100` dengan bobot `high = 3`, `medium = 2`, `low = 1`.
  Aturan yang melempar error berstatus `error` (dihitung tidak lolos, hanya nama error yang dicatat).
- **`runDataQuality()`** → `{ score, checkedAt (ISO 8601 +07:00), summary, results[] }`.
- **CLI:** `npx tsx scripts/data-quality.ts` mencetak ringkasan per aturan lalu satu baris `data-quality:json {…}`.
  Kode keluar **0** walaupun ada aturan gagal (temuan adalah data); **1** hanya bila runner crash (mis. DB tak terjangkau).
  Variabel lingkungan: `DATABASE_URL`, `UPLOAD_DIR` (produksi: `E:/www/spmi-prod/shared/storage/uploads`).
  Produksi: dibundel esbuild saat deploy dan dijalankan harian oleh Task Scheduler (penjadwalan oleh tim ops).
- **Uji unit:** `tests/unit/data-quality.test.ts` — 30 uji (Prisma di-mock, berkas nyata di direktori sementara).

### 3.1 Daftar Aturan

| ID    | Karakteristik  | Bobot  | Aturan                                                                                                             | Rujukan                        |
| ----- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| DQ-01 | Akurasi        | high   | Email akun berformat valid & kanonik (huruf kecil, tanpa spasi tepi)                                               | `emailField()`                 |
| DQ-02 | Konsistensi    | high   | Email & username unik tanpa membedakan huruf besar/kecil                                                           | —                              |
| DQ-03 | Konsistensi    | high   | Auditee punya unit utama & ≥ 1 penempatan; superadmin/LPM/pengunjung tanpa unit & penempatan                       | AB-13, AB-14                   |
| DQ-04 | Konsistensi    | medium | `auditee_head` ⇔ penempatan `head`; `is_unit_head` sesuai; unit utama ∈ penempatan                                 | `syncUserAccess()`             |
| DQ-05 | Konsistensi    | high   | Peran penempatan hanya `head`/`member`; ≤ 1 Kepala Unit per unit                                                   | AB-12                          |
| DQ-06 | Konsistensi    | high   | ≤ 1 Ketua LPM; Ketua LPM aktif & berperan `lpm_admin`/`superadmin`                                                 | AB-15                          |
| DQ-07 | Ketersediaan   | high   | Minimal satu Superadmin aktif                                                                                      | `deleteAccount()`              |
| DQ-08 | Aksesibilitas  | medium | Akun aktif punya cara masuk (sandi lokal atau SSO)                                                                 | —                              |
| DQ-09 | Kerahasiaan    | high   | Sandi tersimpan sebagai hash bcrypt                                                                                | `hashPassword()`               |
| DQ-10 | Kepatuhan      | high   | Consent berpasangan (waktu+versi), versi `YYYY-MM-DD` ≤ versi berlaku, waktu setuju ≥ tanggal versi                | UU PDP, `CONSENT_VERSION`      |
| DQ-11 | Kepatuhan      | low    | Akun aktif sudah menyetujui versi kebijakan privasi yang berlaku                                                   | `needsConsent()`               |
| DQ-12 | Keterpahaman   | low    | Nama terisi & rapi, nama unit unik (case-insensitive), teks butir ≥ 10 karakter                                    | —                              |
| DQ-13 | Konsistensi    | high   | ≤ 1 siklus aktif                                                                                                   | AB-01                          |
| DQ-14 | Akurasi        | high   | `start_date` ≤ `end_date`                                                                                          | AB-04                          |
| DQ-15 | Kekinian       | medium | Siklus aktif belum melewati `end_date` (WIB)                                                                       | AB-02                          |
| DQ-16 | Konsistensi    | high   | Butir satu siklus dengan standarnya; jawaban satu siklus dengan butirnya                                           | `assertStandardInCycle()`      |
| DQ-17 | Akurasi        | medium | Cakupan butir valid: `all` tanpa target; `category` dipakai ≥ 1 unit; `unit` merujuk unit yang ada                 | `readScope()`                  |
| DQ-18 | Konsistensi    | medium | Jawaban hanya untuk butir dalam cakupan unit penjawab                                                              | AB-08                          |
| DQ-19 | Kelengkapan    | high   | Jawaban terisi; Ya disertai bukti (berkas/tautan)                                                                  | AB-06                          |
| DQ-20 | Kelengkapan    | high   | Tidak disertai alasan                                                                                              | AB-06                          |
| DQ-21 | Ketertelusuran | high   | `pending` tanpa verifikator; `verified`/`revision` punya `verified_by`+`verified_at`; `revision` punya catatan     | AB-09, AB-10                   |
| DQ-22 | Kredibilitas   | medium | Verifikator & pengunggah dokumen berperan LPM/superadmin                                                           | `requireLpm()`                 |
| DQ-23 | Kekinian       | medium | `unit_progress` = hasil hitung ulang; unit yang sudah menjawab punya baris progres                                 | AB-11                          |
| DQ-24 | Kelengkapan    | high   | Dokumen punya berkas PDF atau tautan                                                                               | AB-22                          |
| DQ-25 | Kepatuhan      | high   | Tautan bukti/dokumen hanya http/https tanpa kredensial                                                             | `isSafeHttpUrl()`              |
| DQ-26 | Kepatuhan      | high   | Path berkas kanonik `/uploads/<folder>/<nama>` & folder sesuai (bukti/penetapan/evaluasi/branding)                 | `parseUploadPath()`            |
| DQ-27 | Ketersediaan   | high   | Berkas yang dirujuk (bukti, dokumen, aset branding) ada secara fisik                                               | `locateUpload()`               |
| DQ-28 | Portabilitas   | low    | Berkas berada di `UPLOAD_DIR` privat, bukan folder lama `public/uploads`                                           | ADR-0006                       |
| DQ-29 | Efisiensi      | low    | Tidak ada berkas yatim di `UPLOAD_DIR`                                                                             | `cleanupUnreferencedUploads()` |
| DQ-30 | Konsistensi    | high   | Integritas referensial (penempatan, unit utama, verifikator, pengunggah, pembaru progres) — tanpa penempatan yatim | FK Prisma                      |
| DQ-31 | Akurasi        | medium | Timestamp tidak di masa depan (toleransi 5 menit) & `updated_at` ≥ `created_at`                                    | —                              |
| DQ-32 | Portabilitas   | low    | Teks bebas tanpa karakter kontrol, U+FFFD, atau mojibake                                                           | UTF-8                          |
| DQ-33 | Kepatuhan      | high   | Tidak ada log login/aktivitas melewati masa simpan (+1 hari toleransi)                                             | `purgeExpiredData()`           |
| DQ-34 | Kerahasiaan    | high   | Email log login tersamarkan; pesan/detail log tersanitasi (`redactText` idempoten)                                 | `recordLogin()`                |
| DQ-35 | Ketertelusuran | low    | `user_id` pada log merujuk akun yang masih ada                                                                     | —                              |
| DQ-36 | Kepatuhan      | low    | Akun Pengunjung tak berpenempatan > 180 hari masih tercatat login dalam masa simpan log                            | RoPA                           |
| DQ-37 | Kerahasiaan    | high   | `sso.clientSecret` yang terisi ditandai `is_secret`                                                                | AB-23                          |
| DQ-38 | Presisi        | medium | Pengaturan: key dikenal, boolean `true/false`, angka bulat dalam rentang form                                      | `NUMBER_RANGES`                |

## 4. Hasil Terukur — Produksi, 17 Oktober 2026 11:47 WIB

Dijalankan sekali, hanya-baca: `DATABASE_URL=<shared\.env> UPLOAD_DIR=E:/www/spmi-prod/shared/storage/uploads npx tsx scripts/data-quality.ts`
(kode keluar 0, durasi < 2 dtk).

| Ukuran                 | Hasil                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Skor kualitas data** | **98,9%** (37/38 aturan lolos, 0 error)                                                          |
| Aturan gagal           | **DQ-11** (Kepatuhan, low): 1/2 akun aktif belum menyetujui kebijakan privasi versi `2026-10-17` |
| Volume data diperiksa  | 2 akun, 0 unit, 0 siklus/standar/butir/jawaban/dokumen, 12 baris log, 0 berkas di `UPLOAD_DIR`   |

**Interpretasi jujur:** produksi baru berisi 2 akun awal (sesuai 09 §14), sehingga sebagian besar aturan instrumen &
jawaban lolos secara **vakum** (total = 0). Skor menjadi bermakna setelah siklus pertama diisi; jalankan harian dan
bandingkan tren. DQ-11 wajar untuk akun awal yang belum login sejak fitur consent dirilis — pengguna akan diminta setuju
pada login berikutnya (tidak perlu perbaikan data).

| Karakteristik  | Aturan | Lolos |
| -------------- | -----: | ----: |
| Akurasi        |      4 |     4 |
| Kelengkapan    |      3 |     3 |
| Konsistensi    |      9 |     9 |
| Kredibilitas   |      1 |     1 |
| Kekinian       |      2 |     2 |
| Aksesibilitas  |      1 |     1 |
| Kepatuhan      |      6 |     5 |
| Kerahasiaan    |      3 |     3 |
| Efisiensi      |      1 |     1 |
| Presisi        |      1 |     1 |
| Ketertelusuran |      2 |     2 |
| Keterpahaman   |      1 |     1 |
| Ketersediaan   |      2 |     2 |
| Portabilitas   |      2 |     2 |

## 5. Keterpulihan & Ketersediaan (bergantung sistem)

| Ukuran                         | Target   | Hasil / bukti                                                                                |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------- |
| RPO (kehilangan data maksimum) | ≤ 24 jam | Backup harian 01:30 + backup pra-deploy → RPO ≤ 24 jam                                       |
| RTO (waktu pulih)              | ≤ 1 jam  | Uji restore 17 Okt 2026 ke DB sementara lulus; MTTR insiden nyata ≈ 6 menit (rollback rilis) |
| Salinan di luar server         | ada      | ⏳ belum — salinan hanya di disk D: server yang sama (09 §19)                                |
| Retensi backup                 | 30 hari  | `backup.ps1`                                                                                 |

## 6. Nomor Telepon & Normalisasi E.164

Skema **tidak memiliki kolom nomor telepon** (diperiksa di `prisma/schema.prisma`: 12 model, tidak ada field
`phone`/`telp`/`hp`/`wa`). Karena itu normalisasi `+62` (E.164) **tidak diterapkan**. Nomor telepon hanya mungkin muncul
sebagai teks bebas (alasan, catatan, RTL, detail log) dan sudah **disamarkan** di log oleh `redactText()`
(pola `(+62|0)8…` → `0812****5678`); DQ-34 memverifikasi tidak ada nomor utuh di log. Bila kelak ditambah kolom telepon,
simpan dalam bentuk E.164 (`+628xxxxxxxxx`, `VARCHAR(16)`) dan tambahkan aturan DQ normalisasi.

## 7. Temuan Kualitas Data dari Kode & Dokumen

| No  | Temuan                                                                                                                                              | Karakteristik    | Saran                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | RoPA menjanjikan penghapusan otomatis akun Pengunjung tak berperan setelah 180 hari tidak aktif, tetapi `purgeExpiredData()` hanya menghapus log    | Kepatuhan        | Implementasikan purge akun, atau ubah RoPA; DQ-36 memantau sementara                                      |
| 2   | Tidak ada kolom "login terakhir"; ketidakaktifan 180 hari tidak dapat diukur karena log login hanya disimpan 90 hari                                | Kekinian         | Tambah `users.last_login_at` (diperbarui saat login)                                                      |
| 3   | RoPA §A-4 & Ringkasan Retensi masih menulis log aktivitas "belum dihapus otomatis", padahal `purgeExpiredData()` sudah menghapusnya (365 hari)      | Kepatuhan (dok.) | Perbarui RoPA                                                                                             |
| 4   | `clearBranding()` dan unggah ulang branding tidak menghapus berkas lama → berkas yatim                                                              | Efisiensi        | Panggil `deleteUpload()` untuk nilai lama; DQ-29 mendeteksi                                               |
| 5   | `unit_progress` hanya dihitung ulang saat jawaban disimpan/diverifikasi; menambah/menghapus butir atau mengubah kategori unit membuat progres usang | Kekinian         | Panggil `recalcUnitProgress` untuk unit terdampak setelah perubahan butir/kategori; DQ-23 mendeteksi      |
| 6   | `units.name` tidak unik di skema (berbeda dengan `audit_standards`)                                                                                 | Keterpahaman     | Tambah `@@unique([name])` setelah data dibersihkan; DQ-12 memantau                                        |
| 7   | `unit_memberships.role`, `unit_progress.status`, `audit_questions.scope_type`, `login_logs.method` adalah `VARCHAR` bebas, bukan enum               | Akurasi          | Jadikan enum Prisma (validasi di DB); DQ-05/17/23 memantau                                                |
| 8   | `login_logs.user_id` & `activity_logs.user_id` tanpa FK — log tetap ada setelah akun dihapus (disengaja untuk jejak audit)                          | Ketertelusuran   | Pertahankan; `user_name` di `activity_logs` menjaga keterbacaan; DQ-35 melaporkan                         |
| 9   | Aturan `EMAIL_RE`, `NO_UNIT_ROLES`, `BOOL_KEYS`, `NUMBER_RANGES`, `isSafeHttpUrl` tidak diekspor sehingga diduplikasi di `data-quality.ts`          | Keterpeliharaan  | Ekspor dari modul asal (`validate.ts`, `actions/units.ts`, `actions/settings.ts`, `errors.ts` tanpa Next) |

## 8. Operasional

1. Jalankan harian (disarankan setelah backup 01:30 & retensi 02:00, mis. 02:30); arsipkan baris `data-quality:json`.
2. Skor turun atau aturan `high` gagal → Admin LPM menelusuri `sampleIds` di menu terkait; perbaikan data dilakukan
   melalui aplikasi (bukan SQL langsung) agar jejak audit tercatat.
3. Tinjau daftar aturan setiap ada perubahan skema atau aturan bisnis (AB-xx); perbarui [KAMUS-DATA](KAMUS-DATA.md).
