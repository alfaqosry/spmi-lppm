# 01 — Dokumen Perancangan Sistem

**Sistem:** SPMI — Sistem Penjaminan Mutu Internal, LPM Universitas Pahlawan Tuanku Tambusai
**URL produksi:** <https://spmi.universitaspahlawan.ac.id>
**Versi dokumen:** 1.0 (2026-10-17) — mengacu pada kode di branch `main`

> Dokumen ini disusun dari kode sumber. Setiap aturan merujuk berkas sumbernya agar dapat diverifikasi.
> Bila kode berubah, perbarui dokumen ini dalam PR yang sama (lihat [07-STANDAR-ENGINEERING.md](07-STANDAR-ENGINEERING.md)).

---

## 1. Ruang Lingkup

SPMI adalah aplikasi web internal untuk mengelola **audit mutu internal (AMI)** unit-unit universitas
(Program Studi, Wakil Rektor, Pusat, Perpustakaan, Biro, Lembaga, dll.). Siklus kerjanya:

1. LPM membuat **siklus audit** dan menetapkan batas waktu pengisian.
2. LPM menyusun **Standar** dan **butir pertanyaan** dengan cakupan _semua unit / per kategori / per unit_.
3. Auditee (Kepala/Anggota Unit) menjawab **Ya/Tidak** disertai bukti atau alasan.
4. LPM **memverifikasi** jawaban (terverifikasi / perlu revisi), auditee mengisi **RTL**.
5. LPM memantau progres, menganalisis kepatuhan, dan **mengekspor laporan PDF** yang ditandatangani Ketua LPM.

Di luar lingkup saat ini: modul **Monev** (placeholder, `src/app/(dashboard)/monev/page.tsx`), API publik,
dan integrasi data akademik (SAINS).

---

## 2. Aktor dan Peran

Peran disimpan pada enum `Role` (`prisma/schema.prisma`) dan diperiksa ulang dari database pada setiap
permintaan melalui `getCurrentUser()` (`src/lib/auth.ts`) — perubahan peran berlaku tanpa perlu login ulang.

| Peran (`Role`)   | Label UI (`src/lib/format.ts`) | Ringkasan hak akses                                                                                                                                                               |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `superadmin`     | Superadmin                     | Semua hak `lpm_admin` + menu **Pengaturan** (identitas/SEO, SSO, log, keamanan, pemeliharaan, akun superadmin). Satu-satunya peran yang tetap dapat masuk saat mode pemeliharaan. |
| `lpm_admin`      | Admin LPM                      | Kelola siklus, unit, akun & penempatan, Ketua LPM, dokumen, standar & pertanyaan, verifikasi, analitik & ekspor PDF.                                                              |
| `lpm_member`     | Anggota LPM                    | Kelola standar & pertanyaan, dokumen, verifikasi, dashboard & analitik/ekspor. **Tidak** dapat mengelola akun/unit/siklus.                                                        |
| `auditee_head`   | Kepala Unit                    | Mengisi jawaban audit & RTL untuk unit tempatnya ditempatkan, membaca dokumen Penetapan/Evaluasi.                                                                                 |
| `auditee_member` | Anggota Unit                   | Sama dengan Kepala Unit (pengisian tidak dibedakan di sisi server).                                                                                                               |
| `pengunjung`     | Pengunjung (Tamu)              | Tanpa akses fitur. Setelah login diarahkan ke `/no-access` (tanpa sidebar/navbar). Default untuk akun baru via SSO.                                                               |

Aktor eksternal:

- **SSO UP** (`https://sso-v2.universitaspahlawan.ac.id`) — penyedia identitas OAuth 2.0.
- **Cloudflare** — DNS, proksi TLS, WAF.
- **Administrator server** — menjalankan deploy, backup, dan pemulihan.

Matriks menu (sumber: `src/components/layout/nav-items.ts` dan guard di setiap `page.tsx`):

| Menu / rute                              |     superadmin      |      lpm_admin      |     lpm_member      |     auditee_*     | pengunjung |
| ---------------------------------------- | :-----------------: | :-----------------: | :-----------------: | :---------------: | :--------: |
| `/dashboard`                             |       ✔ (LPM)       |       ✔ (LPM)       |       ✔ (LPM)       |    ✔ (auditee)    |     ✖      |
| `/siklus`, `/unit`, `/role-penempatan`   |          ✔          |          ✔          |          ✖          |         ✖         |     ✖      |
| `/penetapan`, `/evaluasi`                |       kelola        |       kelola        |       kelola        |       baca        |     ✖      |
| `/monev`                                 |          ✔          |          ✔          |          ✔          |         ✔         |     ✖      |
| `/audit`                                 | kelola + verifikasi | kelola + verifikasi | kelola + verifikasi | isi jawaban & RTL |     ✖      |
| `/analitik`, `/api/export` (keseluruhan) |          ✔          |          ✔          |          ✔          |         ✖         |     ✖      |
| `/api/export?unitId=` (per unit)         |          ✔          |          ✔          |          ✔          |   unit sendiri    |     ✖      |
| `/pengaturan`                            |          ✔          |          ✖          |          ✖          |         ✖         |     ✖      |
| `/profil`                                |          ✔          |          ✔          |          ✔          |         ✔         |     ✖      |

---

## 3. Kebutuhan Fungsional

| Kode  | Kebutuhan                                                                                          | Implementasi                                                                           |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| KF-01 | Login email + kata sandi (bcrypt) dengan pembatas percobaan                                        | `src/lib/actions/auth.ts` (`loginAction`), `src/lib/ratelimit.ts`                      |
| KF-02 | Login via SSO UP (OAuth 2.0 Authorization Code) dengan auto-provisioning akun sebagai `pengunjung` | `src/app/api/sso/[...sso]/route.ts`, `src/lib/sso.ts`                                  |
| KF-03 | Logout (hapus cookie sesi aplikasi + cookie SSO)                                                   | `logoutAction` di `src/lib/actions/auth.ts`                                            |
| KF-04 | Ubah kata sandi mandiri (min. 8 karakter; akun SSO-only ditolak)                                   | `src/lib/actions/profile.ts`                                                           |
| KF-05 | CRUD siklus audit; hanya satu siklus aktif; nonaktifkan manual                                     | `src/lib/actions/cycles.ts`                                                            |
| KF-06 | CRUD unit audit dengan kategori bebas (saran: `CATEGORIES`)                                        | `src/lib/actions/units.ts`, `src/lib/scope.ts`                                         |
| KF-07 | CRUD akun, penempatan multi-unit (rangkap jabatan), maks. 1 Kepala Unit per unit                   | `src/lib/actions/units.ts` (`assignMember`, `removeMember`, `syncUserAccess`)          |
| KF-08 | Penunjukan tunggal Ketua LPM (penandatangan laporan)                                               | `setLpmHead` / `unsetLpmHead` di `src/lib/actions/units.ts`                            |
| KF-09 | Repositori dokumen Penetapan & Evaluasi (PDF atau tautan http/https)                               | `src/lib/actions/documents.ts`                                                         |
| KF-10 | Standar (induk) dan butir pertanyaan (tunggal & massal) dengan cakupan all/category/unit           | `src/lib/actions/questions.ts`, `src/lib/scope.ts`                                     |
| KF-11 | Pengisian jawaban Ya/Tidak + bukti/alasan, ditolak bila siklus tertutup                            | `saveResponse` di `src/lib/actions/responses.ts`                                       |
| KF-12 | Verifikasi LPM (verified / revision + catatan wajib)                                               | `verifyResponse` di `src/lib/actions/responses.ts`                                     |
| KF-13 | Pengisian RTL oleh auditee                                                                         | `saveRtl` di `src/lib/actions/responses.ts`                                            |
| KF-14 | Progres unit otomatis (`belum_mulai` / `mengisi` / `selesai`)                                      | `src/lib/progress.ts`                                                                  |
| KF-15 | Dashboard monitoring & analitik kepatuhan per standar/kategori                                     | `src/app/(dashboard)/dashboard`, `src/app/(dashboard)/analitik`                        |
| KF-16 | Ekspor PDF keseluruhan dan per unit dengan blok tanda tangan Ketua LPM                             | `src/app/api/export/route.ts`, `src/lib/report/*`                                      |
| KF-17 | Pengaturan sistem (identitas/SEO, SSO, log, keamanan, pemeliharaan, superadmin)                    | `src/lib/actions/settings.ts`, `src/lib/settings.ts`                                   |
| KF-18 | Log login & log aktivitas (dapat dimatikan, retensi log login)                                     | `src/lib/logs.ts`                                                                      |
| KF-19 | Privasi: persetujuan (consent), ekspor data pribadi (`/api/me/export`), pembersihan data terjadwal | _Sedang ditambahkan_ — lihat [legal/RoPA.md](legal/RoPA.md) dan [03-API.md](03-API.md) |

## 4. Kebutuhan Non-Fungsional

| Kode   | Kategori        | Kebutuhan                                                                                                       | Implementasi / catatan                                   |
| ------ | --------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| KNF-01 | Keamanan        | Sesi JWT HS256 di cookie `httpOnly`, `SameSite=Lax`, prefix `__Host-` + `Secure` di produksi                    | `src/lib/auth.ts`                                        |
| KNF-02 | Keamanan        | `AUTH_SECRET` ≥ 32 karakter wajib di produksi (server gagal start bila tidak)                                   | `resolveAuthSecret()` di `src/lib/auth.ts`               |
| KNF-03 | Keamanan        | Header keamanan: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy                  | `next.config.ts`                                         |
| KNF-04 | Keamanan        | Unggahan: whitelist folder & ekstensi, verifikasi _magic bytes_, PDF ≤ 10 MB, gambar branding ≤ 2 MB, tanpa SVG | `src/lib/upload.ts`                                      |
| KNF-05 | Keamanan        | Pesan error generik ke klien, detail hanya di log server                                                        | `src/lib/errors.ts` (`AppError`, `toActionError`)        |
| KNF-06 | Keamanan        | Peran SSO tidak dipercaya kecuali email ada di daftar admin atau `SSO_TRUST_ROLE=true`                          | `resolveLocalRole()` di `src/lib/sso.ts`                 |
| KNF-07 | Ketersediaan    | Satu instance Next.js (PM2 fork) di belakang IIS ARR; rollback otomatis bila smoke test gagal                   | [04-DEPLOYMENT-IIS.md](04-DEPLOYMENT-IIS.md)             |
| KNF-08 | Kinerja         | Server Actions `bodySizeLimit` 10 MB; kompresi gzip; output `standalone`                                        | `next.config.ts`                                         |
| KNF-09 | Aksesibilitas   | Target WCAG 2.1 AA, diuji dengan axe                                                                            | [06-PENGUJIAN.md](06-PENGUJIAN.md)                       |
| KNF-10 | Lokalisasi      | UI berbahasa Indonesia, `lang="id"`, format tanggal `id-ID`, zona waktu Asia/Jakarta                            | `src/app/layout.tsx`, `src/lib/format.ts`                |
| KNF-11 | Privasi         | Kepatuhan UU 27/2022 (PDP)                                                                                      | [legal/](legal/RoPA.md)                                  |
| KNF-12 | Keterpeliharaan | TypeScript strict, lint, format, uji unit/E2E di CI                                                             | [02-PANDUAN-PENGEMBANGAN.md](02-PANDUAN-PENGEMBANGAN.md) |

---

## 5. Arsitektur

### 5.1 Arsitektur Deployment

```mermaid
flowchart LR
    U["Browser pengguna"] -->|"HTTPS 443"| CF["Cloudflare<br/>DNS + proxy + WAF<br/>SSL Full strict"]
    CF -->|"HTTPS 443"| IIS["IIS 10 Windows Server<br/>URL Rewrite + ARR<br/>site spmi.universitaspahlawan.ac.id"]
    IIS -->|"HTTP 127.0.0.1:3002<br/>X-Forwarded-Proto"| APP["Next.js 16 standalone<br/>server.js dikelola PM2 app spmi"]
    APP -->|"Prisma TCP 127.0.0.1"| DB[("MySQL 8<br/>lpm_spmi")]
    APP -->|"baca/tulis"| FS[("Penyimpanan berkas<br/>shared/storage/uploads")]
    U -.->|"redirect OAuth2"| SSO["SSO UP<br/>sso-v2.universitaspahlawan.ac.id"]
    APP -->|"token exchange + userinfo<br/>server-to-server HTTPS"| SSO
```

### 5.2 Arsitektur Aplikasi (lapisan)

```mermaid
flowchart TB
    subgraph Klien
        RC["Client Components<br/>src/components/**"]
    end
    subgraph Server["Next.js App Router - server"]
        PG["Server Components page.tsx dan layout.tsx<br/>src/app/(dashboard)/**"]
        SA["Server Actions<br/>src/lib/actions/*.ts<br/>validasi + otorisasi"]
        RH["Route Handlers<br/>src/app/api/**"]
        LIB["Layanan domain<br/>auth, cycles, scope, progress,<br/>settings, logs, upload, report"]
        PR["Prisma Client<br/>src/lib/prisma.ts"]
    end
    RC -->|"form action / useActionState"| SA
    PG -->|"render + data"| RC
    PG --> LIB
    SA --> LIB
    RH --> LIB
    LIB --> PR
    PR --> DB[("MySQL 8")]
```

Catatan arsitektur:

- **Tidak ada `middleware.ts`/`proxy.ts`.** Otentikasi ditegakkan di `src/app/(dashboard)/layout.tsx`
  (redirect ke `/login`, `/no-access`, atau halaman pemeliharaan), diulang di setiap `page.tsx` dan
  di setiap Server Action / Route Handler melalui penjaga terpusat `src/lib/guards.ts` (_defense in depth_) —
  Server Action dapat dipanggil langsung via POST tanpa melewati layout.
- **Pengaturan runtime** disimpan di tabel `app_settings` dan dibaca sekali per permintaan
  (`getSettings` dibungkus `React.cache`, `src/lib/settings.ts`). Nilai SSO di DB menimpa `.env`.
- **Pembatas laju login** bersifat _in-memory_ (`src/lib/ratelimit.ts`) — valid untuk satu instance PM2.

---

## 6. Model Data (ERD)

Dihasilkan dari `prisma/schema.prisma`. Nama tabel/kolom fisik (snake_case via `@@map`/`@map`) yang ditampilkan.
Kolom `users.session_version`, `users.consented_at`, `users.consent_version` dan indeks `file_path`/`evidence_file`
ditambahkan pada pekerjaan pengerasan keamanan & privasi (revokasi sesi, persetujuan kebijakan privasi, unduhan berkas terotorisasi).

```mermaid
erDiagram
    audit_cycles {
        int id PK
        varchar name "VARCHAR(120)"
        date start_date
        date end_date
        boolean is_active "default false"
        datetime created_at
        datetime updated_at
    }
    units {
        int id PK
        varchar name "VARCHAR(160)"
        varchar category "VARCHAR(80)"
        text description "nullable"
        datetime created_at
        datetime updated_at
    }
    users {
        int id PK
        varchar name "VARCHAR(160)"
        varchar email UK "VARCHAR(190)"
        varchar username UK "nullable NIDN/NIM/NIP"
        varchar password "nullable bcrypt hash"
        varchar sso_id "nullable"
        enum role "Role"
        int unit_id FK "nullable unit utama"
        boolean is_unit_head "default false"
        boolean is_lpm_head "default false"
        boolean is_active "default true"
        int session_version "default 0 revokasi sesi"
        datetime consented_at "nullable persetujuan privasi"
        varchar consent_version "nullable VARCHAR(40)"
        datetime created_at
        datetime updated_at
    }
    unit_memberships {
        int id PK
        int user_id FK
        int unit_id FK
        varchar role "head atau member"
        datetime created_at
        datetime updated_at
    }
    documents {
        int id PK
        int cycle_id FK
        enum type "penetapan atau evaluasi"
        varchar title "VARCHAR(255)"
        varchar file_path "nullable"
        varchar link "nullable VARCHAR(500)"
        int uploaded_by FK "nullable"
        datetime created_at
        datetime updated_at
    }
    audit_standards {
        int id PK
        int cycle_id FK
        varchar name "VARCHAR(160)"
        int order "default 0"
        datetime created_at
        datetime updated_at
    }
    audit_questions {
        int id PK
        int cycle_id FK
        int standard_id FK
        text question_text
        int order "default 0"
        varchar scope_type "all, category, unit"
        varchar scope_category "nullable"
        int scope_unit_id FK "nullable"
        datetime created_at
        datetime updated_at
    }
    audit_responses {
        int id PK
        int cycle_id FK
        int unit_id FK
        int audit_question_id FK
        enum answer "ya atau tidak, nullable"
        varchar evidence_file "nullable"
        varchar evidence_link "nullable VARCHAR(500)"
        text reason "nullable"
        enum status "pending, verified, revision"
        text lpm_notes "nullable"
        text rtl "nullable"
        int verified_by FK "nullable"
        datetime verified_at "nullable"
        datetime created_at
        datetime updated_at
    }
    unit_progress {
        int id PK
        int cycle_id FK
        int unit_id FK
        varchar status "belum_mulai, mengisi, selesai"
        int last_updated_by FK "nullable"
        datetime created_at
        datetime updated_at
    }
    app_settings {
        int id PK
        varchar key UK "VARCHAR(120)"
        text value "nullable"
        boolean is_secret "default false"
        datetime updated_at
        int updated_by "tanpa FK"
    }
    login_logs {
        int id PK
        varchar email "VARCHAR(190)"
        int user_id "tanpa FK"
        boolean success
        varchar method "password atau sso"
        varchar ip "nullable"
        varchar user_agent "nullable"
        varchar message "nullable"
        datetime created_at
    }
    activity_logs {
        int id PK
        int user_id "tanpa FK"
        varchar user_name "nullable"
        varchar action "VARCHAR(80)"
        varchar entity "nullable"
        varchar entity_id "nullable"
        varchar detail "nullable VARCHAR(500)"
        varchar ip "nullable"
        datetime created_at
    }

    audit_cycles ||--o{ documents : "memiliki"
    audit_cycles ||--o{ audit_standards : "memiliki"
    audit_cycles ||--o{ audit_questions : "memiliki"
    audit_cycles ||--o{ audit_responses : "memiliki"
    audit_cycles ||--o{ unit_progress : "memiliki"
    audit_standards ||--o{ audit_questions : "mengelompokkan"
    audit_questions ||--o{ audit_responses : "dijawab"
    units ||--o{ audit_responses : "menjawab"
    units ||--o{ unit_progress : "dipantau"
    units ||--o{ unit_memberships : "beranggota"
    users ||--o{ unit_memberships : "ditempatkan"
    units |o--o{ users : "unit utama"
    units |o--o{ audit_questions : "cakupan unit"
    users |o--o{ documents : "mengunggah"
    users |o--o{ audit_responses : "memverifikasi"
    users |o--o{ unit_progress : "memperbarui"
```

Batasan & indeks penting:

| Tabel                         | Batasan                                                                                                      | Perilaku hapus                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `users`                       | `email` UNIQUE, `username` UNIQUE, indeks `unit_id`                                                          | Hapus unit → `unit_id` = NULL                                                                 |
| `documents`                   | indeks `cycle_id`, `type`, `file_path` (pencarian otorisasi unduhan)                                         | CASCADE dari siklus; uploader → NULL                                                          |
| `unit_memberships`            | UNIQUE (`user_id`, `unit_id`)                                                                                | CASCADE dari user dan unit                                                                    |
| `audit_standards`             | UNIQUE (`cycle_id`, `name`)                                                                                  | Hapus standar → CASCADE ke pertanyaan → CASCADE ke jawaban                                    |
| `audit_responses`             | UNIQUE (`cycle_id`, `unit_id`, `audit_question_id`); indeks `unit_id`, `cycle_id`, `status`, `evidence_file` | CASCADE dari siklus/unit/pertanyaan; verifikator → NULL                                       |
| `unit_progress`               | UNIQUE (`cycle_id`, `unit_id`)                                                                               | CASCADE dari siklus/unit                                                                      |
| `audit_cycles`                | —                                                                                                            | **Hapus siklus menghapus seluruh dokumen, standar, pertanyaan, jawaban, progres siklus tsb.** |
| `login_logs`, `activity_logs` | indeks `created_at`, `email`/`user_id`                                                                       | Tidak ber-FK (jejak tetap ada meski user dihapus)                                             |

---

## 7. Use Case per Peran

```mermaid
flowchart LR
    SA(["Superadmin"])
    AD(["Admin LPM"])
    AM(["Anggota LPM"])
    KH(["Kepala / Anggota Unit"])
    PG(["Pengunjung"])

    subgraph SPMI["Sistem SPMI"]
        UC1["Login lokal / SSO"]
        UC2["Kelola pengaturan sistem"]
        UC3["Kelola akun superadmin"]
        UC4["Kelola siklus audit"]
        UC5["Kelola unit"]
        UC6["Kelola akun dan penempatan"]
        UC7["Tunjuk Ketua LPM"]
        UC8["Kelola dokumen Penetapan/Evaluasi"]
        UC9["Kelola standar dan pertanyaan"]
        UC10["Verifikasi jawaban"]
        UC11["Lihat analitik dan ekspor PDF"]
        UC12["Isi jawaban audit + bukti"]
        UC13["Isi RTL"]
        UC14["Baca dokumen"]
        UC15["Lihat halaman tanpa akses"]
        UC16["Ubah kata sandi"]
    end

    SA --> UC2 & UC3
    SA --> UC4
    AD --> UC4 & UC5 & UC6 & UC7
    AD --> UC8 & UC9 & UC10 & UC11
    AM --> UC8 & UC9 & UC10 & UC11
    KH --> UC12 & UC13 & UC14
    PG --> UC15
    SA & AD & AM & KH & PG --> UC1
    SA & AD & AM & KH --> UC16
```

> Superadmin mewarisi seluruh use case Admin LPM (garis tidak digambar agar diagram terbaca).

| Peran               | Use case utama                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Superadmin          | UC1–UC11, UC16; ditambah UC2 (Identitas & SEO, Integrasi SSO + Uji Koneksi, Log, Keamanan, Pemeliharaan) dan UC3 |
| Admin LPM           | UC1, UC4–UC11, UC16                                                                                              |
| Anggota LPM         | UC1, UC8–UC11, UC16                                                                                              |
| Kepala/Anggota Unit | UC1, UC12–UC14, UC16 (dashboard auditee)                                                                         |
| Pengunjung          | UC1, UC15 (tautan email ke `lpm@universitaspahlawan.ac.id`, tombol Keluar)                                       |

---

## 8. Diagram Sekuens

### 8.1 Login lokal (email + kata sandi)

```mermaid
sequenceDiagram
    autonumber
    actor P as Pengguna
    participant B as Browser
    participant L as login-form.tsx
    participant A as loginAction
    participant R as ratelimit.ts
    participant D as MySQL
    P->>B: Isi email dan kata sandi
    B->>A: POST Server Action (FormData)
    A->>D: Baca app_settings (maks percobaan, jendela)
    A->>R: rateLimit("login:IP")
    alt Melebihi batas
        A->>D: INSERT login_logs (gagal, rate limit)
        A-->>B: error "Terlalu banyak percobaan..."
    else Dalam batas
        A->>D: SELECT users WHERE email
        A->>A: bcrypt.compare
        alt Akun tidak ada / nonaktif / sandi salah
            A->>D: INSERT login_logs (gagal)
            A-->>B: error "Email atau kata sandi salah."
        else Valid
            A->>R: resetRateLimit
            A->>A: SignJWT HS256 (exp = security.sessionDays)
            A-->>B: Set-Cookie __Host-lpm_session (httpOnly, Secure, Lax)
            A->>D: INSERT login_logs (sukses) dan activity_logs (auth.login)
            A-->>B: redirect /dashboard atau /no-access
        end
    end
```

### 8.2 Login SSO UP

```mermaid
sequenceDiagram
    autonumber
    actor P as Pengguna
    participant B as Browser
    participant H as /api/sso/[...sso]
    participant S as SSO UP
    participant D as MySQL
    P->>B: Klik "Login via SSO UP"
    B->>H: GET /api/sso/redirect
    H->>D: getSsoRuntimeConfig (DB menimpa .env)
    alt SSO nonaktif / Client ID atau Secret kosong
        H-->>B: 307 /login?sso_error=konfigurasi
    else Terkonfigurasi
        H-->>B: 307 ke SSO authorize (client_id, redirect_uri, scope, prompt)
        B->>S: Halaman login SSO
        S-->>B: 302 /api/sso/callback?code=...
        B->>H: GET /api/sso/callback?code
        H->>S: Tukar code menjadi token (server-to-server)
        H->>S: GET userinfo (username, email, name, sub, role)
        H->>D: Cari user: username, lalu email, lalu sso_id
        alt Belum ada
            H->>D: INSERT users role = resolveLocalRole (lpm_admin bila email di daftar admin, selain itu pengunjung)
        else Ada dan aktif
            H->>D: UPDATE sso_id, username, name, email (peran tidak diubah)
        end
        H-->>B: Set-Cookie sesi aplikasi + cookie sso_session dan sso_access_token
        H->>D: INSERT login_logs (sso) dan activity_logs (sso.login / sso.register)
        H-->>B: 307 /dashboard (pengunjung dialihkan layout ke /no-access)
    end
```

### 8.3 Pengisian audit + unggah bukti

```mermaid
sequenceDiagram
    autonumber
    actor K as Auditee
    participant B as Browser (AuditeeAuditWorkspace)
    participant A as saveResponse
    participant U as upload.ts
    participant FS as Penyimpanan berkas
    participant D as MySQL
    K->>B: Pilih unit, jawab Ya/Tidak, lampirkan PDF atau tautan / alasan
    B->>A: POST Server Action (multipart, maks 10 MB)
    A->>D: getCurrentUser (sesi + peran terbaru)
    A->>A: Cek unitId termasuk penempatan pengguna
    A->>D: SELECT audit_cycles (is_active, end_date)
    alt Siklus nonaktif atau lewat end_date
        A-->>B: error alasan penutupan
    else Siklus terbuka
        opt Ada berkas
            A->>U: saveUpload(file, "bukti")
            U->>U: Cek ukuran, ekstensi .pdf, magic bytes %PDF-
            U->>FS: Tulis nama acak timestamp-nama-uuid.pdf
            U-->>A: path berkas
        end
        A->>A: Ya wajib bukti, Tidak wajib alasan, tautan harus http/https
        A->>D: Cek cakupan pertanyaan untuk unit (isQuestionForUnit)
        A->>D: UPSERT audit_responses status = pending, catatan LPM direset
        A->>D: recalcUnitProgress, UPSERT unit_progress
        A-->>B: ok, revalidatePath /audit dan /dashboard
    end
```

### 8.4 Verifikasi LPM

```mermaid
sequenceDiagram
    autonumber
    actor L as Admin / Anggota LPM
    participant B as Browser (AdminAuditWorkspace)
    participant A as verifyResponse
    participant D as MySQL
    actor K as Auditee
    L->>B: Buka jawaban unit, tinjau bukti / alasan
    B->>A: POST status = verified atau revision, lpmNotes
    A->>D: getCurrentUser, peran harus LPM
    alt status revision tanpa catatan
        A-->>B: error "Catatan revisi wajib diisi."
    else Valid
        A->>D: UPDATE audit_responses status, lpm_notes, verified_by, verified_at
        A->>D: recalcUnitProgress
        A-->>B: ok
    end
    K->>B: Melihat status Perlu Revisi dan Catatan LPM
    K->>B: Isi RTL atau ubah jawaban (kembali ke pending)
```

### 8.5 Ekspor laporan PDF

```mermaid
sequenceDiagram
    autonumber
    actor L as Pengguna LPM / auditee
    participant B as Browser
    participant E as GET /api/export
    participant R as report/data.ts
    participant P as report/pdf.ts atau pdf-unit.ts
    participant D as MySQL
    L->>B: Klik "Unduh Laporan PDF" di /analitik
    B->>E: GET /api/export?cycleId=..&unitId=.. (cookie sesi)
    E->>D: getCurrentUser
    alt Tanpa sesi
        E-->>B: 401 JSON error
    else Pengunjung, atau auditee meminta laporan keseluruhan / unit lain
        E-->>B: 403 JSON error "Akses ditolak."
    else Pemeliharaan aktif atau melebihi 10 per menit
        E-->>B: 503 atau 429 JSON error
    else cycleId kosong / tidak valid
        E-->>B: 400 JSON error
    else Valid
        E->>R: buildReportData / buildUnitReportData
        R->>D: Ambil siklus, unit, standar, pertanyaan, jawaban, Ketua LPM aktif
        alt Tidak ditemukan
            E-->>B: 404 JSON error
        else Ada
            E->>P: Render jsPDF + autotable + blok tanda tangan Ketua LPM
            E->>D: INSERT activity_logs (report.export)
            E-->>B: 200 application/pdf (attachment, private no-store)
        end
    end
```

---

## 9. Aturan Bisnis

| Kode  | Aturan                                                                                                                                                                                                               | Penegakan (sumber)                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| AB-01 | **Hanya satu siklus aktif.** Mengaktifkan siklus menonaktifkan semua siklus lain dalam satu transaksi.                                                                                                               | `createCycle`, `updateCycle`, `setActiveCycle` — `src/lib/actions/cycles.ts`                         |
| AB-02 | **Siklus terbuka** hanya bila `is_active = true` **dan** waktu sekarang < akhir hari `end_date` (inklusif s.d. 23:59:59 waktu server).                                                                               | `isCycleOpen`, `cycleClosedReason` — `src/lib/cycles.ts`                                             |
| AB-03 | Pengisian jawaban **dan** RTL ditolak di server bila siklus tertutup (nonaktif manual atau lewat `end_date`).                                                                                                        | `saveResponse`, `saveRtl` — `src/lib/actions/responses.ts`                                           |
| AB-04 | `end_date` tidak boleh sebelum `start_date`.                                                                                                                                                                         | `readCycleForm` dipakai `createCycle` & `updateCycle`                                                |
| AB-05 | Auditee hanya melihat/mengisi **siklus aktif**; LPM dapat melihat siklus terakhir walau nonaktif.                                                                                                                    | `src/app/(dashboard)/audit/page.tsx`                                                                 |
| AB-06 | **Jawaban Ya wajib bukti** (berkas PDF atau tautan http/https); **jawaban Tidak wajib alasan**.                                                                                                                      | `saveResponse`                                                                                       |
| AB-07 | Bukti berkas hanya PDF (cek ekstensi + _magic bytes_ `%PDF-`), maks. 10 MB.                                                                                                                                          | `saveUpload` — `src/lib/upload.ts`                                                                   |
| AB-08 | Pengguna hanya boleh menjawab untuk unit tempat ia ditempatkan, dan hanya pertanyaan yang berlaku bagi unit tsb. (cakupan `all` / `category` sesuai kategori unit / `unit` sesuai id).                               | `saveResponse` + `isQuestionForUnit` — `src/lib/scope.ts`                                            |
| AB-09 | Setiap perubahan jawaban mengembalikan status ke `pending` dan menghapus catatan & data verifikasi LPM.                                                                                                              | `saveResponse` (upsert `update`)                                                                     |
| AB-10 | Verifikasi hanya oleh `lpm_admin`, `lpm_member`, `superadmin`; status `revision` **wajib** catatan.                                                                                                                  | `verifyResponse`                                                                                     |
| AB-11 | Status progres unit: `belum_mulai` (0 dijawab), `mengisi` (sebagian), `selesai` (semua pertanyaan relevan dijawab). Status verifikasi tidak memengaruhi progres.                                                     | `recalcUnitProgress` — `src/lib/progress.ts`                                                         |
| AB-12 | **Satu Kepala Unit per unit.** Penempatan sebagai `head` ditolak bila unit sudah memiliki kepala lain.                                                                                                               | `assertHeadAvailable` — `src/lib/actions/units.ts`                                                   |
| AB-13 | Satu akun dapat ditempatkan di banyak unit (rangkap jabatan). Peran global disinkronkan: punya ≥1 `head` → `auditee_head`, selain itu `auditee_member`; tanpa penempatan → `pengunjung`.                             | `syncUserAccess`                                                                                     |
| AB-14 | Akun LPM/superadmin tidak dapat ditempatkan pada unit audit; peran tanpa unit: `superadmin`, `lpm_admin`, `lpm_member`, `pengunjung`.                                                                                | `assignMember`, `NO_UNIT_ROLES`                                                                      |
| AB-15 | **Satu Ketua LPM** aktif; menunjuk yang baru mencabut yang lama (transaksi). Hanya akun `lpm_admin`/`superadmin` yang aktif. Ketua LPM menjadi penandatangan PDF.                                                    | `setLpmHead`; `report/data.ts`                                                                       |
| AB-16 | Akun baru via SSO menjadi `pengunjung`, kecuali email tercantum di `sso.adminEmails` (→ `lpm_admin`). Klaim `role` SSO diabaikan kecuali `SSO_TRUST_ROLE=true`. Peran akun yang sudah ada **tidak** diubah oleh SSO. | `resolveLocalRole` — `src/lib/sso.ts`; `route.ts`                                                    |
| AB-17 | Pencocokan akun SSO: `username` (NIDN/NIM/NIP) → `email` → `sso_id`.                                                                                                                                                 | `src/app/api/sso/[...sso]/route.ts`                                                                  |
| AB-18 | Kata sandi minimal 8 karakter (akun baru, ubah akun, ubah mandiri, superadmin, seed).                                                                                                                                | `units.ts`, `profile.ts`, `settings.ts`, `prisma/seed.ts`                                            |
| AB-19 | Pesan login seragam ("Email atau kata sandi salah.") untuk mencegah enumerasi akun; akun nonaktif ditolak.                                                                                                           | `loginAction`                                                                                        |
| AB-20 | Mode pemeliharaan: hanya `superadmin` yang dapat membuka dashboard maupun menjalankan aksi/ekspor.                                                                                                                   | `src/app/(dashboard)/layout.tsx`, `assertNotMaintenance` di `src/lib/guards.ts`, `/api/export` (503) |
| AB-21 | Nama standar unik per siklus; urutan standar baru = urutan terakhir + 1. Hapus standar menghapus seluruh butirnya.                                                                                                   | `createStandard`, `deleteStandard`                                                                   |
| AB-22 | Dokumen wajib berkas PDF **atau** tautan http/https; jenis hanya `penetapan`/`evaluasi`.                                                                                                                             | `createDocument`                                                                                     |
| AB-23 | Nilai rahasia pengaturan (`sso.clientSecret`) tidak pernah dikirim ke klien; nilai kosong/terselubung tidak menimpa nilai tersimpan.                                                                                 | `getSettingsForAdmin`, `saveSettings` — `src/lib/settings.ts`                                        |
| AB-24 | Log login dihapus otomatis setelah `log.loginRetentionDays` (default 90 hari) saat ada login baru.                                                                                                                   | `recordLogin` — `src/lib/logs.ts`                                                                    |
| AB-25 | Admin tidak dapat menghapus akunnya sendiri.                                                                                                                                                                         | `deleteAccount`                                                                                      |

---

## 10. Keputusan Arsitektur

Lihat ADR di [adr/](adr/):
[0001](adr/0001-nextjs-app-router-server-actions.md) ·
[0002](adr/0002-prisma-mysql.md) ·
[0003](adr/0003-sso-up-oauth2.md) ·
[0004](adr/0004-jwt-cookie-session.md) ·
[0005](adr/0005-iis-arr-pm2-deployment.md) ·
[0006](adr/0006-private-upload-storage.md)
