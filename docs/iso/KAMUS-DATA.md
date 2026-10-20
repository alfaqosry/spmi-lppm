# Kamus Data SPMI

Definisi setiap tabel dan kolom basis data **Sistem Informasi SPMI** (MySQL 8, `utf8mb4_unicode_ci`), diturunkan
langsung dari [`prisma/schema.prisma`](../../prisma/schema.prisma). Dipakai sebagai acuan karakteristik
**keterpahaman** ISO/IEC 25012 — lihat [25012-KUALITAS-DATA](25012-KUALITAS-DATA.md).

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3         | Dokumen Internal |
| 1.1           | 20 Oktober 2026 | v1.2.2         | Dokumen Internal |

Perubahan 1.1: cakupan standar (`audit_standards.scope_*`), unique `(cycle_id, name)` dihapus, nama constraint FK
eksplisit (`fk_*`) — migrasi manual [`prisma/sql/2026-10-20-cakupan-standar.sql`](../../prisma/sql/2026-10-20-cakupan-standar.sql).

## Konvensi

- **Tipe** adalah tipe MySQL hasil pemetaan Prisma: `Int` → `INT`, `String` → `VARCHAR(191)` bila tanpa `@db.*`,
  `Boolean` → `TINYINT(1)`, `DateTime` → `DATETIME(3)` (UTC, presisi milidetik), `@db.Date` → `DATE`, enum → `ENUM`.
- **Null:** `Y` boleh kosong, `T` wajib.
- **Batasan:** `PK` kunci primer auto-increment · `UQ` unik · `FK→tabel (aksi)` kunci asing dengan aksi saat induk
  dihapus · `IDX` ber-index · `DEF` nilai bawaan · `AUTO` diisi otomatis Prisma (`@updatedAt`).
- **DP** (data pribadi, UU 27/2022 PDP): `Ya` data pribadi · `Ya*` data pribadi tersamarkan/turunan · `Rahasia`
  kredensial · `—` bukan data pribadi.
- **Retensi** mengacu [legal/RoPA](../legal/RoPA.md) dan Pengaturan; "usulan" berarti belum disahkan Bagian Hukum.
- Seluruh timestamp disimpan **UTC**, ditampilkan/diekspor dalam WIB (`Asia/Jakarta`, ISO 8601 `+07:00`).
- Kolom `created_at` (`DEF now()`) dan `updated_at` (`AUTO`) ada di hampir semua tabel dan tidak diulang maknanya:
  waktu baris dibuat / terakhir diubah.

## Enum

| Enum             | Nilai                                                                                   | Dipakai di               |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| `Role`           | `superadmin`, `lpm_admin`, `lpm_member`, `auditee_head`, `auditee_member`, `pengunjung` | `users.role`             |
| `DocumentType`   | `penetapan`, `evaluasi`                                                                 | `documents.type`         |
| `AnswerValue`    | `ya`, `tidak`                                                                           | `audit_responses.answer` |
| `ResponseStatus` | `pending` (menunggu verifikasi), `verified` (terverifikasi), `revision` (perlu revisi)  | `audit_responses.status` |

Nilai "enum lunak" (disimpan `VARCHAR`, divalidasi aplikasi): `unit_memberships.role` (`head`|`member`),
`unit_progress.status` (`belum_mulai`|`mengisi`|`selesai`), `audit_questions.scope_type` & `audit_standards.scope_type` (`all`|`category`|`unit`, whitelist `SCOPE_TYPES`/`isScopeType()` di `src/lib/scope.ts`),
`login_logs.method` (`password`|`sso`).

## Ringkasan Tabel

| Model Prisma     | Tabel              | Isi                                         | Retensi                                                                                                                                        |
| ---------------- | ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`           | `users`            | Akun pengguna                               | Selama akun dibutuhkan; ≤ 1 tahun setelah tidak menjabat (RoPA A-1); Pengunjung tak berperan 180 hari tidak aktif (usulan, **belum otomatis**) |
| `UnitMembership` | `unit_memberships` | Penempatan akun pada unit (rangkap jabatan) | Mengikuti akun/unit (cascade)                                                                                                                  |
| `Unit`           | `units`            | Unit audit (prodi, biro, lembaga, …)        | Selama unit ada                                                                                                                                |
| `AuditCycle`     | `audit_cycles`     | Periode audit mutu internal                 | Siklus + 5 tahun (usulan, akreditasi)                                                                                                          |
| `AuditStandard`  | `audit_standards`  | Standar induk butir per siklus + cakupan    | Mengikuti siklus                                                                                                                               |
| `AuditQuestion`  | `audit_questions`  | Butir pertanyaan + cakupan                  | Mengikuti siklus                                                                                                                               |
| `AuditResponse`  | `audit_responses`  | Jawaban unit, bukti, verifikasi LPM, RTL    | Siklus + 5 tahun (usulan)                                                                                                                      |
| `UnitProgress`   | `unit_progress`    | Status pengisian unit per siklus            | Mengikuti siklus                                                                                                                               |
| `Document`       | `documents`        | Dokumen Penetapan/Evaluasi SPMI             | Selama dokumen berlaku + 5 tahun (usulan)                                                                                                      |
| `AppSetting`     | `app_settings`     | Konfigurasi key-value                       | Selama sistem beroperasi                                                                                                                       |
| `LoginLog`       | `login_logs`       | Riwayat percobaan login                     | `log.loginRetentionDays` (default **90 hari**), purge harian + saat login                                                                      |
| `ActivityLog`    | `activity_logs`    | Jejak audit aktivitas pengguna              | `log.activityRetentionDays` (default **365 hari**), purge harian                                                                               |

## 1. `users` — Akun pengguna (`User`)

| Kolom             | Tipe         | Null | Batasan                  | Makna                                                                            | DP      |
| ----------------- | ------------ | ---- | ------------------------ | -------------------------------------------------------------------------------- | ------- |
| `id`              | INT          | T    | PK                       | Id akun                                                                          | —       |
| `name`            | VARCHAR(160) | T    |                          | Nama lengkap                                                                     | Ya      |
| `email`           | VARCHAR(190) | T    | UQ                       | Email login, disimpan huruf kecil                                                | Ya      |
| `username`        | VARCHAR(190) | Y    | UQ                       | NIDN/NIM/NIP dari SSO (pencocokan akun AB-17)                                    | Ya      |
| `password`        | VARCHAR(255) | Y    |                          | Hash bcrypt; kosong untuk akun SSO-only                                          | Rahasia |
| `sso_id`          | VARCHAR(190) | Y    |                          | Subjek (`sub`) dari SSO UP                                                       | Ya      |
| `role`            | ENUM `Role`  | T    |                          | Peran global; untuk auditee disinkronkan dari penempatan (AB-13)                 | —       |
| `unit_id`         | INT          | Y    | FK→units (SET NULL), IDX | Unit utama (sinkron dengan penempatan pertama/head); null untuk peran tanpa unit | —       |
| `is_unit_head`    | TINYINT(1)   | T    | DEF false                | Menjabat Kepala Unit pada ≥ 1 unit                                               | —       |
| `is_lpm_head`     | TINYINT(1)   | T    | DEF false                | Ketua LPM (penandatangan laporan, maks. satu — AB-15)                            | —       |
| `is_active`       | TINYINT(1)   | T    | DEF true                 | Akun aktif; nonaktif ditolak saat login                                          | —       |
| `session_version` | INT          | T    | DEF 0                    | Versi sesi; dinaikkan saat logout/ganti sandi/ubah peran → token lama ditolak    | —       |
| `consented_at`    | DATETIME(3)  | Y    |                          | Waktu menyetujui kebijakan privasi                                               | Ya      |
| `consent_version` | VARCHAR(40)  | Y    |                          | Versi kebijakan yang disetujui (`YYYY-MM-DD`, lihat `CONSENT_VERSION`)           | Ya      |
| `created_at`      | DATETIME(3)  | T    | DEF now()                | Dibuat                                                                           | —       |
| `updated_at`      | DATETIME(3)  | T    | AUTO                     | Diubah                                                                           | —       |

## 2. `unit_memberships` — Penempatan (`UnitMembership`)

| Kolom        | Tipe        | Null | Batasan                                | Makna                                         | DP  |
| ------------ | ----------- | ---- | -------------------------------------- | --------------------------------------------- | --- |
| `id`         | INT         | T    | PK                                     | Id penempatan                                 | —   |
| `user_id`    | INT         | T    | FK→users (CASCADE), IDX, UQ(user,unit) | Akun yang ditempatkan                         | Ya* |
| `unit_id`    | INT         | T    | FK→units (CASCADE), IDX, UQ(user,unit) | Unit tujuan                                   | —   |
| `role`       | VARCHAR(20) | T    | DEF `member`                           | `head` (Kepala Unit, maks. 1/unit) / `member` | —   |
| `created_at` | DATETIME(3) | T    | DEF now()                              | Dibuat                                        | —   |
| `updated_at` | DATETIME(3) | T    | AUTO                                   | Diubah                                        | —   |

## 3. `units` — Unit audit (`Unit`)

| Kolom         | Tipe         | Null | Batasan   | Makna                                                                                          | DP  |
| ------------- | ------------ | ---- | --------- | ---------------------------------------------------------------------------------------------- | --- |
| `id`          | INT          | T    | PK        | Id unit                                                                                        | —   |
| `name`        | VARCHAR(160) | T    |           | Nama unit (tidak unik di skema — dipantau DQ-12)                                               | —   |
| `category`    | VARCHAR(80)  | T    |           | Kategori bebas (saran `CATEGORIES`: Program Studi, Biro, Lembaga, …); dasar cakupan `category` | —   |
| `description` | TEXT         | Y    |           | Keterangan                                                                                     | —   |
| `created_at`  | DATETIME(3)  | T    | DEF now() | Dibuat                                                                                         | —   |
| `updated_at`  | DATETIME(3)  | T    | AUTO      | Diubah                                                                                         | —   |

## 4. `audit_cycles` — Siklus audit (`AuditCycle`)

| Kolom        | Tipe         | Null | Batasan   | Makna                                               | DP  |
| ------------ | ------------ | ---- | --------- | --------------------------------------------------- | --- |
| `id`         | INT          | T    | PK        | Id siklus                                           | —   |
| `name`       | VARCHAR(120) | T    |           | Nama siklus (mis. "AMI 2026")                       | —   |
| `start_date` | DATE         | T    |           | Tanggal mulai (≤ `end_date`, AB-04)                 | —   |
| `end_date`   | DATE         | T    |           | Tanggal selesai, inklusif s.d. 23:59:59 WIB (AB-02) | —   |
| `is_active`  | TINYINT(1)   | T    | DEF false | Siklus aktif (maks. satu, AB-01)                    | —   |
| `created_at` | DATETIME(3)  | T    | DEF now() | Dibuat                                              | —   |
| `updated_at` | DATETIME(3)  | T    | AUTO      | Diubah                                              | —   |

## 5. `audit_standards` — Standar (`AuditStandard`)

| Kolom            | Tipe         | Null | Batasan                                                    | Makna                                                                                                                | DP  |
| ---------------- | ------------ | ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --- |
| `id`             | INT          | T    | PK                                                         | Id standar                                                                                                           | —   |
| `cycle_id`       | INT          | T    | FK→audit_cycles (CASCADE) `fk_audit_standards_cycle`, IDX  | Siklus pemilik                                                                                                       | —   |
| `name`           | VARCHAR(160) | T    | — (unik per siklus + cakupan **di aplikasi**, bukan di DB) | Nama standar, mis. "Standar Tata Pamong"; nama sama boleh bila cakupannya berbeda (AB-21, DQ-41)                     | —   |
| `order`          | INT          | T    | DEF 0                                                      | Urutan tampil (baru = terakhir + 1 **pada cakupan yang sama**)                                                       | —   |
| `scope_type`     | VARCHAR(20)  | T    | DEF `all`                                                  | Cakupan: `all` semua unit / `category` / `unit` (AB-26, DQ-39); standar lama hasil migrasi = `all`                   | —   |
| `scope_category` | VARCHAR(80)  | Y    |                                                            | Kategori unit bila `scope_type = category` (ejaan kanonis `CATEGORIES` atau kategori unit yang ada); selain itu NULL | —   |
| `scope_unit_id`  | INT          | Y    | FK→units (SET NULL) `fk_audit_standards_scope_unit`, IDX   | Unit target bila `scope_type = unit`; selain itu NULL                                                                | —   |
| `created_at`     | DATETIME(3)  | T    | DEF now()                                                  | Dibuat                                                                                                               | —   |
| `updated_at`     | DATETIME(3)  | T    | AUTO                                                       | Diubah                                                                                                               | —   |

Catatan:

- Unique index `audit_standards_cycle_id_name_key (cycle_id, name)` **dihapus pada v1.2.2**. Unique index lima
  kolom `(cycle_id, name, scope_type, scope_category, scope_unit_id)` tidak andal karena kolom nullable (di MySQL
  `NULL ≠ NULL`), sehingga keunikan dijaga `createStandard`/`updateStandard` dengan kunci `SELECT … FOR UPDATE` dalam
  transaksi. Penyisipan langsung via SQL/seed dapat menghasilkan duplikat → dipantau DQ-41 (RISK-REGISTER R-32).
- Bila unit target dihapus, `scope_unit_id` menjadi NULL sementara `scope_type` tetap `unit` → standar "yatim"
  (dideteksi DQ-39); butir di bawahnya juga tidak lagi memenuhi aturan cakupan (DQ-40).
- Cakupan butir wajib sama atau lebih sempit dari cakupan standarnya (`isScopeWithin()`, AB-27, DQ-40).

## 6. `audit_questions` — Butir pertanyaan (`AuditQuestion`)

| Kolom            | Tipe        | Null | Batasan                                                         | Makna                                                   | DP  |
| ---------------- | ----------- | ---- | --------------------------------------------------------------- | ------------------------------------------------------- | --- |
| `id`             | INT         | T    | PK                                                              | Id butir                                                | —   |
| `cycle_id`       | INT         | T    | FK→audit_cycles (CASCADE) `fk_audit_questions_cycle`, IDX       | Siklus (harus sama dengan siklus standarnya — DQ-16)    | —   |
| `standard_id`    | INT         | T    | FK→audit_standards (CASCADE) `fk_audit_questions_standard`, IDX | Standar induk (cakupan butir ⊆ cakupan standar — DQ-40) | —   |
| `question_text`  | TEXT        | T    |                                                                 | Teks butir                                              | —   |
| `order`          | INT         | T    | DEF 0                                                           | Urutan dalam standar                                    | —   |
| `scope_type`     | VARCHAR(20) | T    | DEF `all`                                                       | Cakupan: `all` semua unit / `category` / `unit`         | —   |
| `scope_category` | VARCHAR(80) | Y    |                                                                 | Kategori unit bila `scope_type = category`              | —   |
| `scope_unit_id`  | INT         | Y    | FK→units (SET NULL) `fk_audit_questions_scope_unit`, IDX        | Unit target bila `scope_type = unit`                    | —   |
| `created_at`     | DATETIME(3) | T    | DEF now()                                                       | Dibuat                                                  | —   |
| `updated_at`     | DATETIME(3) | T    | AUTO                                                            | Diubah                                                  | —   |

Catatan: bila unit target dihapus, `scope_unit_id` menjadi NULL sementara `scope_type` tetap `unit` → butir tidak
berlaku bagi unit mana pun (dideteksi DQ-17).

## 7. `audit_responses` — Jawaban audit (`AuditResponse`)

| Kolom               | Tipe                  | Null | Batasan                                                 | Makna                                                                              | DP  |
| ------------------- | --------------------- | ---- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | --- |
| `id`                | INT                   | T    | PK                                                      | Id jawaban                                                                         | —   |
| `cycle_id`          | INT                   | T    | FK→audit_cycles (CASCADE), IDX, UQ(cycle,unit,question) | Siklus                                                                             | —   |
| `unit_id`           | INT                   | T    | FK→units (CASCADE), IDX, UQ                             | Unit penjawab                                                                      | —   |
| `audit_question_id` | INT                   | T    | FK→audit_questions (CASCADE), UQ                        | Butir yang dijawab                                                                 | —   |
| `answer`            | ENUM `AnswerValue`    | Y    |                                                         | Ya/Tidak (selalu terisi oleh `saveResponse`)                                       | —   |
| `evidence_file`     | VARCHAR(255)          | Y    | IDX                                                     | Path logis bukti PDF `/uploads/bukti/<nama acak>.pdf` (wajib bila Ya tanpa tautan) | —   |
| `evidence_link`     | VARCHAR(500)          | Y    |                                                         | Tautan bukti http/https                                                            | —   |
| `reason`            | TEXT                  | Y    |                                                         | Alasan (wajib bila Tidak)                                                          | Ya* |
| `status`            | ENUM `ResponseStatus` | T    | DEF `pending`, IDX                                      | Status verifikasi; kembali `pending` setiap jawaban diubah (AB-09)                 | —   |
| `lpm_notes`         | TEXT                  | Y    |                                                         | Catatan LPM (wajib bila `revision`)                                                | Ya* |
| `rtl`               | TEXT                  | Y    |                                                         | Rencana Tindak Lanjut dari auditee                                                 | Ya* |
| `verified_by`       | INT                   | Y    | FK→users (SET NULL)                                     | Akun LPM yang memverifikasi                                                        | Ya* |
| `verified_at`       | DATETIME(3)           | Y    |                                                         | Waktu verifikasi                                                                   | —   |
| `created_at`        | DATETIME(3)           | T    | DEF now()                                               | Dibuat                                                                             | —   |
| `updated_at`        | DATETIME(3)           | T    | AUTO                                                    | Diubah                                                                             | —   |

`Ya*` pada teks bebas: tidak dirancang memuat data pribadi, tetapi pengguna dapat menuliskannya.

## 8. `unit_progress` — Progres unit (`UnitProgress`)

| Kolom             | Tipe        | Null | Batasan                                   | Makna                                                   | DP  |
| ----------------- | ----------- | ---- | ----------------------------------------- | ------------------------------------------------------- | --- |
| `id`              | INT         | T    | PK                                        | Id progres                                              | —   |
| `cycle_id`        | INT         | T    | FK→audit_cycles (CASCADE), UQ(cycle,unit) | Siklus                                                  | —   |
| `unit_id`         | INT         | T    | FK→units (CASCADE), UQ(cycle,unit)        | Unit                                                    | —   |
| `status`          | VARCHAR(40) | T    | DEF `belum_mulai`                         | `belum_mulai` / `mengisi` / `selesai` (dihitung, AB-11) | —   |
| `last_updated_by` | INT         | Y    | FK→users (SET NULL)                       | Akun terakhir yang memicu hitung ulang                  | Ya* |
| `updated_at`      | DATETIME(3) | T    | AUTO                                      | Diubah                                                  | —   |
| `created_at`      | DATETIME(3) | T    | DEF now()                                 | Dibuat                                                  | —   |

Data turunan: dapat dihitung ulang dari `audit_responses` + `audit_questions` (DQ-23 memverifikasi).

## 9. `documents` — Dokumen SPMI (`Document`)

| Kolom         | Tipe                | Null | Batasan                        | Makna                                                          | DP  |
| ------------- | ------------------- | ---- | ------------------------------ | -------------------------------------------------------------- | --- |
| `id`          | INT                 | T    | PK                             | Id dokumen                                                     | —   |
| `cycle_id`    | INT                 | T    | FK→audit_cycles (CASCADE), IDX | Siklus                                                         | —   |
| `type`        | ENUM `DocumentType` | T    | IDX                            | `penetapan` / `evaluasi` (juga nama folder berkas)             | —   |
| `title`       | VARCHAR(255)        | T    |                                | Judul                                                          | —   |
| `file_path`   | VARCHAR(255)        | Y    | IDX                            | Path logis `/uploads/<type>/<nama acak>.pdf`                   | —   |
| `link`        | VARCHAR(500)        | Y    |                                | Tautan http/https (wajib salah satu dengan `file_path`, AB-22) | —   |
| `uploaded_by` | INT                 | Y    | FK→users (SET NULL)            | Akun LPM pengunggah                                            | Ya* |
| `created_at`  | DATETIME(3)         | T    | DEF now()                      | Dibuat                                                         | —   |
| `updated_at`  | DATETIME(3)         | T    | AUTO                           | Diubah                                                         | —   |

## 10. `app_settings` — Pengaturan (`AppSetting`)

| Kolom        | Tipe         | Null | Batasan   | Makna                                                                                        | DP           |
| ------------ | ------------ | ---- | --------- | -------------------------------------------------------------------------------------------- | ------------ |
| `id`         | INT          | T    | PK        | Id                                                                                           | —            |
| `key`        | VARCHAR(120) | T    | UQ        | Kunci (daftar sah: `SETTING_DEFAULTS` di `src/lib/settings.ts`)                              | —            |
| `value`      | TEXT         | Y    |           | Nilai teks; menimpa default. `sso.adminEmails` memuat email (DP), `sso.clientSecret` rahasia | Ya / Rahasia |
| `is_secret`  | TINYINT(1)   | T    | DEF false | Nilai rahasia — disamarkan di UI, tidak pernah dikirim ke klien (AB-23)                      | —            |
| `updated_at` | DATETIME(3)  | T    | AUTO      | Diubah                                                                                       | —            |
| `updated_by` | INT          | Y    |           | Id akun pengubah (tanpa FK)                                                                  | Ya*          |

Kunci pengaturan: `site.*` (identitas/SEO; `site.logo`, `site.favicon`, `site.ogImage` berisi path `/uploads/branding/…`),
`log.login.enabled`, `log.activity.enabled` (`true`/`false`), `log.loginRetentionDays` (0–3650, default 90),
`log.activityRetentionDays` (0–3650, default 365), `sso.*`, `security.sessionDays` (1–30, default 7),
`security.loginMaxAttempts` (1–5), `security.loginWindowMinutes` (1–60), `maintenance.enabled`, `maintenance.message`.

## 11. `login_logs` — Log login (`LoginLog`)

| Kolom        | Tipe         | Null | Batasan        | Makna                                               | DP  |
| ------------ | ------------ | ---- | -------------- | --------------------------------------------------- | --- |
| `id`         | INT          | T    | PK             | Id                                                  | —   |
| `email`      | VARCHAR(190) | T    | IDX            | Email **tersamarkan** `a***@domain` (`maskEmail`)   | Ya* |
| `user_id`    | INT          | Y    | (tanpa FK)     | Akun bila dikenali                                  | Ya* |
| `success`    | TINYINT(1)   | T    | DEF false      | Berhasil/gagal                                      | —   |
| `method`     | VARCHAR(20)  | T    | DEF `password` | `password` / `sso`                                  | —   |
| `ip`         | VARCHAR(64)  | Y    |                | IP klien (tepercaya hanya via Cloudflare, `net.ts`) | Ya  |
| `user_agent` | VARCHAR(400) | Y    |                | User-Agent browser                                  | Ya  |
| `message`    | VARCHAR(255) | Y    |                | Keterangan (disanitasi `redactText`)                | —   |
| `created_at` | DATETIME(3)  | T    | DEF now(), IDX | Waktu percobaan                                     | —   |

## 12. `activity_logs` — Log aktivitas (`ActivityLog`)

| Kolom        | Tipe         | Null | Batasan        | Makna                                                   | DP  |
| ------------ | ------------ | ---- | -------------- | ------------------------------------------------------- | --- |
| `id`         | INT          | T    | PK             | Id                                                      | —   |
| `user_id`    | INT          | Y    | IDX (tanpa FK) | Pelaku                                                  | Ya* |
| `user_name`  | VARCHAR(160) | Y    |                | Nama pelaku saat aksi (tetap terbaca bila akun dihapus) | Ya  |
| `action`     | VARCHAR(80)  | T    |                | Kode aksi, mis. `response.save`, `account.delete`       | —   |
| `entity`     | VARCHAR(80)  | Y    |                | Jenis objek, mis. `audit_response`, `user`              | —   |
| `entity_id`  | VARCHAR(80)  | Y    |                | Id objek (bisa komposit `siklus:unit:butir`)            | —   |
| `detail`     | VARCHAR(500) | Y    |                | Ringkasan (disanitasi; email disamarkan)                | Ya* |
| `ip`         | VARCHAR(64)  | Y    |                | IP klien                                                | Ya  |
| `created_at` | DATETIME(3)  | T    | DEF now(), IDX | Waktu aksi                                              | —   |

## Data di Luar Database

| Data                   | Lokasi                                                          | Format                   | DP  | Retensi                                            |
| ---------------------- | --------------------------------------------------------------- | ------------------------ | --- | -------------------------------------------------- |
| Berkas bukti & dokumen | `UPLOAD_DIR/{bukti,penetapan,evaluasi}/<epoch>-<uuid>.pdf`      | PDF ≤ 10 MB              | Ya* | Mengikuti baris yang merujuk; berkas yatim dihapus |
| Aset branding          | `UPLOAD_DIR/branding/<epoch>-<uuid>.{png,jpg,webp,ico,gif}`     | Gambar ≤ 2 MB            | —   | Selama dirujuk pengaturan                          |
| Backup                 | `E:\www\spmi-prod\backups\daily-<ts>\db.sql`, `uploads-mirror\` | Dump SQL, salinan berkas | Ya  | 30 hari                                            |
| Sesi                   | Cookie `__Host-` JWT HS256                                      | JWT                      | Ya* | `security.sessionDays` (default 7)                 |

Tidak ada kolom nomor telepon maupun data keuangan di skema (lihat 25012 §6).
