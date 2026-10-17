# Sistem Informasi SPMI

Aplikasi web **Sistem Penjaminan Mutu Internal (SPMI)** untuk mengelola audit mutu internal unit universitas (Program Studi, Wakil Rektor, Pusat, Perpustakaan, Biro, dll.). Dibangun sebagai SPA modern dengan Next.js App Router, Tailwind CSS, Prisma, dan MySQL.

## ✨ Fitur

| Modul                    | Deskripsi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Login & SSO**          | Login email/password (bcrypt + JWT session) serta **Login via SSO UP** menggunakan paket resmi [`@alfaqosry/sso-client-next`](https://www.npmjs.com/package/@alfaqosry/sso-client-next) ke `https://sso-v2.universitaspahlawan.ac.id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Dashboard Monitoring** | Statistik ringkas, bar progres real-time per unit, dan grafik analitik (bar/pie/radar) untuk pengambilan keputusan LPM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Siklus & Periode**     | Pengelolaan siklus audit multi-tahun dengan satu siklus aktif dan batas waktu pengisian. Siklus dapat **dinonaktifkan manual** oleh admin; ketika nonaktif atau melewati batas waktu (`endDate`), auditee **tidak dapat lagi mengisi/menyimpan jawaban** (ditegakkan di sisi server).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Unit Audit**           | CRUD unit audit lintas kategori (Prodi, Warek, Pusat, Perpustakaan, Biro, dll.).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Role & Penempatan**    | Manajemen akun pengguna & perannya: **Kepala Unit** (`auditee_head`), **Anggota Unit** (`auditee_member`), **Admin LPM** (`lpm_admin`), **Anggota LPM** (`lpm_member`), dan **Pengunjung/Tamu** (`pengunjung`, tanpa akses fitur). Dilengkapi statistik akun, filter/pencarian, tambah/ubah/hapus akun, serta **panel penempatan per unit**: memilih **akun yang sudah terdaftar** lewat modal untuk dijadikan kepala/anggota unit. **Satu akun dapat ditempatkan di banyak unit (rangkap jabatan)** — di halaman Audit muncul pemilih unit. Satu unit maksimal **1 Kepala Unit**. Admin LPM juga dapat menunjuk **satu Admin LPM sebagai Ketua LPM** (tombol mahkota) — hanya **satu Ketua LPM** aktif pada satu waktu, yang menjadi **penandatangan dokumen laporan**. |
| **Penetapan & Evaluasi** | Repositori dokumen (unggah PDF atau tautan). LPM dapat mengelola, auditee hanya membaca.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Monev**                | Placeholder untuk integrasi API eksternal di masa mendatang.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Audit & Verifikasi**   | Penyusunan **Standar** (induk/pengelompok) → **butir pertanyaan** di bawahnya. Daftar **kategori unit** → halaman detail berisi **tab per unit** (mis. Warek 1, Warek 2). Mengelola butir pertanyaan sebuah Standar lewat **modal** (klik nama standar / tombol “Kelola Butir”): tambah butir ke daftar sementara lalu **Simpan** sekaligus (bulk), serta ubah/hapus butir tersimpan. Formulir pengisian Ya/Tidak dengan wajib bukti (Ya) atau alasan (Tidak), Temuan & RTL, serta panel verifikasi LPM.                                                                                                                                                                                                                                                                 |
| **Analitik & Laporan**   | Profil kepatuhan **per standar** & kategori, rekapitulasi per unit, **ekspor PDF** keseluruhan, serta **laporan PDF per unit** (tabel observasi/audit/visitasi: No, Standar, Pertanyaan, Hasil Observasi, Y*, T*, Catatan Khusus). Kedua laporan PDF memuat **blok tanda tangan Ketua LPM** (nama & jabatan) sebagai pengesahan.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## 🧱 Tech Stack

- **Next.js 16** (App Router, Server Actions, Turbopack)
- **React 19**, **Tailwind CSS 4**, **Framer Motion**, **Lucide Icons**
- **Recharts** untuk grafik analitik
- **Prisma ORM** + **MySQL 8**
- **jose** (JWT), **bcryptjs** (hash password), **jspdf** + **jspdf-autotable** (ekspor laporan PDF)

## 🚀 Menjalankan Proyek

### 1. Prasyarat

- Node.js 20+
- Docker (untuk MySQL) — atau MySQL 8 yang sudah tersedia

### 2. Jalankan Database

```bash
docker compose up -d
```

MySQL akan tersedia di `localhost:3307` (database `lpm_spmi`).

### 3. Konfigurasi Environment

```bash
cp .env.example .env
```

Sesuaikan `DATABASE_URL` dan `AUTH_SECRET` bila perlu.

### 4. Instalasi & Migrasi

```bash
npm install
npm run db:push    # sinkronkan skema ke MySQL
npm run db:seed    # isi data contoh
```

### 5. Jalankan Aplikasi

```bash
npm run dev        # http://localhost:3002
```

## 🔑 Akun Awal

Seed database membuat **2 akun** dari environment variable:

```bash
SEED_SUPERADMIN_EMAIL="superadmin@universitaspahlawan.ac.id" \
SEED_SUPERADMIN_PASSWORD="passwordkuat" \
SEED_ADMIN_EMAIL="admin@universitaspahlawan.ac.id" \
SEED_ADMIN_PASSWORD="passwordkuat" \
npm run db:seed
```

| Akun       | Env                 | Peran        |
| ---------- | ------------------- | ------------ |
| Superadmin | `SEED_SUPERADMIN_*` | `superadmin` |
| Admin LPM  | `SEED_ADMIN_*`      | `lpm_admin`  |

> Password minimal 8 karakter. Ganti kata sandi segera setelah login pertama.
> Akun lain dibuat melalui menu **Role & Penempatan** di dashboard.

## 🔐 Kontrol Akses (RBAC)

- **`superadmin`** — **akses penuh seluruh fitur Admin LPM** + menu **Pengaturan Sistem** khusus. Dapat mengatur identitas & SEO sistem, integrasi SSO (Client ID/Secret), log login & aktivitas, kebijakan keamanan, mode pemeliharaan, dan membuat superadmin lain. Peran ini hanya dapat dibuat/dikelola oleh superadmin.
- **`lpm_admin`** — akses penuh: siklus, unit, **role & penempatan akun**, dokumen, pertanyaan (per kategori & unit), verifikasi, analitik & ekspor. Dapat menunjuk **Ketua LPM** (penandatangan laporan).
- **`lpm_member`** — pengguna LPM: mengelola instrumen & pertanyaan, memverifikasi jawaban, mengelola dokumen, serta melihat dashboard & analitik. **Tidak** dapat mengelola akun/unit/siklus.
- **`auditee_head` / `auditee_member`** — mengisi formulir audit untuk unitnya, melihat dokumen penetapan/evaluasi, dan mengisi RTL.
- **`pengunjung`** — akun tamu tanpa akses fitur apa pun. Setelah login, hanya ditampilkan **halaman pemberitahuan tanpa sidebar/navbar** (`/no-access`) berisi arahan menghubungi LPM via email `lpm@universitaspahlawan.ac.id`. Akun ini dapat diberi peran/penempatan baru atau dihapus oleh Admin LPM melalui menu **Role & Penempatan**.

## ⚙️ Menu Pengaturan (Superadmin)

Menu **Pengaturan** (`/pengaturan`, khusus `superadmin`) menyediakan:

1. **Identitas & SEO** — nama sistem, nama singkat, deskripsi, organisasi, logo, favicon, gambar Open Graph, kata kunci SEO, URL dasar, kode verifikasi Google Search Console, dan kontrol indeks mesin pencari (`index`/`noindex`). Metadata dinamis langsung diterapkan ke `<head>`.
2. **Integrasi SSO** — URL, Client ID, **Client Secret** (disimpan di DB & disamarkan di UI), Redirect URI, Scope, Prompt, dan daftar email admin SSO. Tersedia tombol **Uji Koneksi**. Nilai dari DB menimpa `.env`.
3. **Log & Pemantauan** — aktif/nonaktif **log login** (sukses/gagal, IP, user-agent) dan **log aktivitas** (audit trail), masa simpan log, serta aksi pembersihan.
4. **Keamanan** — masa sesi (hari), maksimum percobaan login, dan jendela waktu pembatasan.
5. **Pemeliharaan** — mode pemeliharaan + pesan; saat aktif hanya superadmin yang dapat mengakses sistem.
6. **Superadmin** — daftar & pembuatan akun superadmin baru.

> Kredensial SSO sebaiknya diisi lewat menu ini (tersimpan di database). Variabel `SSO_*` pada `.env` hanya dipakai sebagai _fallback_ bila belum diatur di database.

## 🔌 Integrasi SSO UP (Universitas Pahlawan)

Aplikasi menggunakan paket resmi **`@alfaqosry/sso-client-next`** dengan OAuth 2.0 Authorization Code Flow ke server `https://sso-v2.universitaspahlawan.ac.id`.

### Konfigurasi `.env`

```env
SSO_URL="https://sso-v2.universitaspahlawan.ac.id"
SSO_CLIENT_ID="<dari Admin SSO UP>"
SSO_CLIENT_SECRET="<dari Admin SSO UP>"
SSO_REDIRECT_URI="http://localhost:3002/api/sso/callback"
SSO_SCOPE="*"
SSO_PROMPT="login"

# Email yang otomatis diberi peran Admin LPM (pisahkan dengan koma)
SSO_ADMIN_EMAILS="lpm@universitaspahlawan.ac.id"
```

> Daftarkan **Redirect URI** pada Admin SSO UP: lokal `http://localhost:3002/api/sso/callback`, produksi `https://spmi.universitaspahlawan.ac.id/api/sso/callback`.

### Alur

1. Pengguna menekan **Login via SSO UP** → diarahkan ke `/api/sso/redirect`.
2. Server SSO UP menampilkan halaman login; setelah sukses dialihkan ke `/api/sso/callback` dengan `code`.
3. Route handler menukar `code` menjadi token, mengambil profil (`/api/userinfo`), lalu menyinkronkan akun lokal:
   - Pencocokan akun berdasarkan **`username`** (NIDN/NIM/NIP), lalu `email`, lalu `sso_id`.
   - Jika belum ada, akun **dibuat otomatis** sebagai `pengunjung` (tamu tanpa akses) — peran/penempatan selanjutnya diatur Admin LPM melalui menu **Role & Penempatan**.
   - Peran `lpm_admin` hanya diberikan bila email terdaftar di `SSO_ADMIN_EMAILS` (klaim role SSO diabaikan kecuali `SSO_TRUST_ROLE=true`).
4. Sesi aplikasi (cookie JWT) dibuat sehingga RBAC internal tetap berlaku.

### Endpoint

| Path                | Fungsi                                              |
| ------------------- | --------------------------------------------------- |
| `/api/sso/redirect` | Memulai login SSO (authorization redirect)          |
| `/api/sso/callback` | Callback OAuth (token exchange + sinkronisasi user) |
| `/api/sso/logout`   | Logout SSO                                          |

## 🗂️ Struktur Proyek

```
prisma/
  schema.prisma        # Skema database (audit_cycles, units, users, dll.)
  seed.ts              # Data contoh
src/
  app/
    (dashboard)/       # Halaman terproteksi (dashboard, siklus, unit, audit, ...)
    no-access/         # Halaman pemberitahuan tanpa akses (tanpa sidebar/navbar)
    api/sso/[...sso]/  # Route login, callback (dengan state) & logout SSO
    api/files/         # Unduhan berkas unggahan (terautentikasi)
    api/health/        # Health check untuk smoke test
    api/me/export/     # Ekspor data pribadi (UU PDP)
    api/export/        # Ekspor laporan PDF (keseluruhan & per unit via ?unitId=)
    login/             # Halaman login
  components/          # Sidebar, Topbar, Modal, grafik, dan modul UI
  lib/
    actions/           # Server actions per modul (auth, cycles, units, ...)
    auth.ts            # Sesi JWT & hashing password
    prisma.ts          # Prisma client singleton
    progress.ts        # Perhitungan progres unit
    scope.ts           # Model cakupan pertanyaan (umum / kategori / unit) & kategori unit
    actions/questions.ts  # Server action CRUD standar & pertanyaan audit
    upload.ts          # Penyimpanan file unggahan
storage/uploads/       # Berkas bukti & dokumen (privat, di luar public; atur via UPLOAD_DIR)
docs/                  # Dokumentasi teknis (lihat docs/README.md)
scripts/deploy/        # Skrip deploy produksi IIS + PM2
```

## 📤 Catatan Unggahan

File bukti/dokumen disimpan **privat** di `UPLOAD_DIR` (default `storage/uploads/`, maks. 10MB, PDF tervalidasi magic bytes) dan hanya dapat diunduh lewat `/api/files/*` sesuai hak akses. Tautan lama `/uploads/...` tetap berfungsi.

## 📜 Skrip

| Skrip               | Fungsi                                                  |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Menjalankan server pengembangan di port 3002            |
| `npm run build`     | Build produksi                                          |
| `npm run start`     | Menjalankan build produksi                              |
| `npm run db:push`   | Sinkronkan skema Prisma ke database                     |
| `npm run db:seed`   | Buat akun superadmin awal (butuh `SEED_ADMIN_PASSWORD`) |
| `npm run db:studio` | Buka Prisma Studio                                      |
| `npm run lint`      | ESLint (Next core-web-vitals + jsx-a11y)                |
| `npm run format`    | Prettier (`format:check` untuk CI)                      |
| `npm run typecheck` | TypeScript tanpa emit                                   |
| `npm test`          | Uji unit Vitest                                         |
| `npm run test:e2e`  | Uji E2E Playwright lintas browser (`test:a11y` = axe)   |
| `npm run audit`     | Audit dependensi produksi                               |
| `npm run ci`        | Seluruh pemeriksaan CI lokal                            |

## 📚 Dokumentasi & Deploy

Dokumentasi lengkap ada di [`docs/`](docs/README.md). Deploy produksi
(`https://spmi.universitaspahlawan.ac.id`): lihat [`docs/04-DEPLOYMENT-IIS.md`](docs/04-DEPLOYMENT-IIS.md).
