# Rencana Implementasi: Sistem Informasi SPMI

## Gambaran Umum
**Sistem Informasi SPMI** (Sistem Penjaminan Mutu Internal) adalah aplikasi web berbasis *Single Page Application* (SPA) yang modern, responsif, dan bersih, yang dirancang untuk mengelola audit mutu internal di berbagai unit universitas (Program Studi, Wakil Rektor, Pusat Komputer/Bahasa, Perpustakaan, Biro, dll.).

Sistem ini memungkinkan pihak LPM (Lembaga Penjamin Mutu) untuk mengelola unit audit, akun pengguna (Kepala dan Anggota Unit), mempublikasikan dokumen Penetapan & Evaluasi, mengatur Standar & Pertanyaan SPMI kustom per unit, memantau progres pengisian audit secara *real-time*, menganalisis kualitas institusi melalui diagram pendukung keputusan, serta memverifikasi jawaban dari unit yang diaudit. Sistem ini juga dilengkapi dengan **Integrasi Login SSO** yang serupa dengan aplikasi Webkampus lainnya (seperti LPPM).

---

## Teknologi yang Digunakan (Tech Stack)
- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, Lucide Icons, Recharts (untuk grafik analitik dan dashboard pengambil keputusan), Framer Motion (untuk animasi transisi SPA yang halus).
- **Backend**: Next.js API Routes / Server Actions.
- **Database**: MySQL (terhubung melalui Prisma ORM atau MySQL2).
- **Autentikasi**: 
  - Login standar Email/Password.
  - **Integrasi Login SSO** (menggunakan `@webkampus/sso-client-next` atau klien OAuth2/OIDC ke Server SSO Universitas) dengan tombol **"Login via SSO"** yang menonjol di halaman login.
- **Kontrol Akses (RBAC)**: Admin LPM, Kepala Unit Auditee, Anggota Unit Auditee.

---

## Fitur Utama & Navigasi Sidebar

1. **Manajemen Siklus & Periode Audit (`audit_cycles`)**:
   - Pengelolaan periode/tahun audit (misal: *Siklus 2025/2026*). Memastikan pengarsipan historis dan pelacakan multi-tahun.
   - Pengaturan batas waktu (`deadline`) pengisian instrumen audit untuk setiap unit.

2. **Manajemen Unit & Akun (Auditee Unit Management)**:
   - Pembuatan, pengeditan, dan penghapusan unit audit yang fleksibel (Prodi, Warek, Pusat, Perpustakaan, Biro, dll.).
   - Penugasan Akun Kepala Unit (`Akun Kepala`) dan Anggota Unit (`Akun Anggota`).

3. **Menu Penetapan**:
   - LPM menginput/mengunggah dokumen penetapan (upload file PDF atau tautan/link).
   - Ditampilkan di akun unit yang diaudit sebagai daftar berkas *read-only* (hanya bisa dilihat, tanpa bisa diubah oleh auditee).

4. **Menu Evaluasi**:
   - Repositori dokumen evaluasi di mana file PDF atau link dapat diunggah/diinput langsung oleh pihak berwenang.

5. **Menu Monev (Monitoring & Evaluasi)**:
   - Menu *placeholder* yang dikosongkan sementara untuk persiapan integrasi API di masa mendatang.

6. **Menu Audit & Verifikasi**:
   - **Penyusunan Standar & Pertanyaan oleh LPM**: Halaman daftar **kategori unit**; klik kategori membuka halaman detail berisi **tab per unit**. Setiap **Standar** menjadi induk/pengelompok dan **butir pertanyaan** ditambahkan di bawahnya, semua **inline tanpa modal**.
   - **Formulir Pengisian Auditee**: Unit yang diaudit wajib menjawab semua pertanyaan dengan **Ya** atau **Tidak**:
     - Jika **Ya**: Wajib mengunggah bukti (file PDF atau link).
     - Jika **Tidak**: Wajib memberikan alasan/penjelasan.
   - **Temuan & Rencana Tindak Lanjut (RTL)**: LPM mencatat Ketidaksesuaian (KTS) dan auditee memberikan rencana tindakan perbaikan.
   - **Panel Verifikasi LPM**: Tabel peninjauan dan verifikasi jawaban serta bukti satu per satu oleh LPM.

7. **Dashboard Monitoring & Analisis Keputusan (LPM Analytics Dashboard)**:
   - **Pelacakan Progres Real-Time**: Bar progres dan indikator status untuk memantau unit mana saja yang sudah selesai, sedang mengisi, atau belum mulai mengisi audit.
   - **Diagram Analisis Pendukung Keputusan (Charts)**:
     - *Grafik Tingkat Penyelesaian per Kategori Unit* (Prodi vs Pusat vs Warek vs Biro).
     - *Distribusi Capaian Skor Kepatuhan SPMI* (Diagram radar/persentase kepatuhan per standar).
     - *Breakdown Status Audit* (Pending, Verified, Revisi).
   - **Ekspor Laporan**: Ekspor Berita Acara dan laporan rekapitulasi audit ke format PDF untuk keperluan akreditasi (BAN-PT / LAM).

---

## Estetika Desain UI/UX
- **SPA Modern & Clean**: Navigasi sisi klien yang mulus, tata letak dashboard yang rapi dengan *sidebar* yang dapat diciutkan serta kartu bergaya *glassmorphism*.
- **Palet Warna**: Palet profesional yang harmonis (Nuansa *Deep Indigo/Slate* dengan mode gelap dan gradien aksen modern).
- **Responsif**: Desain *mobile-first* dengan menu laci (*drawer*) yang halus dan tabel yang ramah perangkat sentuh.
- **Halaman Login**: Kartu *glassmorphism* bersih yang menampilkan form kredensial standar beserta tombol **"Login via SSO"** yang mencolok.

---

## Skema Database (MySQL / Prisma)

### 1. `audit_cycles`
- `id` (INT, PK)
- `name` (VARCHAR, contoh: "Siklus 2025/2026")
- `start_date` (DATE)
- `end_date` (DATE)
- `is_active` (BOOLEAN)
- timestamps

### 2. `users`
- `id` (INT, PK)
- `name` (VARCHAR)
- `email` (VARCHAR, UNIQUE)
- `password` (VARCHAR, nullable untuk pengguna SSO)
- `sso_id` (VARCHAR, nullable)
- `role` (ENUM: `lpm_admin`, `auditee_head`, `auditee_member`)
- `unit_id` (INT, FK ke `units`, nullable)
- `is_unit_head` (BOOLEAN)
- timestamps

### 3. `units`
- `id` (INT, PK)
- `name` (VARCHAR)
- `category` (VARCHAR: Prodi, Warek, Pusat, Perpustakaan, Biro, dll.)
- `description` (TEXT)
- timestamps

### 4. `documents`
- `id` (INT, PK)
- `cycle_id` (INT, FK)
- `type` (ENUM: `penetapan`, `evaluasi`)
- `title` (VARCHAR)
- `file_path` (VARCHAR, nullable)
- `link` (VARCHAR, nullable)
- `uploaded_by` (INT, FK ke `users`)
- timestamps

### 5. `audit_standards`
- `id` (INT, PK)
- `cycle_id` (INT, FK ke `audit_cycles`)
- `name` (VARCHAR — nama standar, mis. "Standar Tata Pamong")
- `order` (INT)
- timestamps
- unik per (`cycle_id`, `name`)

### 6. `audit_questions`
- `id` (INT, PK)
- `cycle_id` (INT, FK ke `audit_cycles`)
- `standard_id` (INT, FK ke `audit_standards` — induk/pengelompok)
- `question_text` (TEXT)
- `scope_type` (ENUM: `all`, `category`, `unit`)
- `scope_category` (VARCHAR, nullable)
- `scope_unit_id` (INT, FK ke `units`, nullable)
- `order` (INT)
- timestamps

> Catatan: **Standar** adalah induk/pengelompok butir pertanyaan. Menghapus standar ikut menghapus seluruh butir di bawahnya.

### 7. `audit_responses`
- `id` (INT, PK)
- `cycle_id` (INT, FK)
- `unit_id` (INT, FK)
- `audit_question_id` (INT, FK)
- `answer` (ENUM: `ya`, `tidak`)
- `evidence_file` (VARCHAR, nullable)
- `evidence_link` (VARCHAR, nullable)
- `reason` (TEXT, nullable)
- `status` (ENUM: `pending`, `verified`, `revision`)
- `lpm_notes` (TEXT, nullable)
- `rtl` (TEXT, nullable - Rencana Tindak Lanjut)
- `verified_by` (INT, FK, nullable)
- timestamps

---

## Langkah-Langkah Eksekusi (Eksekusi Mendatang)
1. Inisialisasi proyek Next.js dengan Tailwind CSS di direktori `/home/alfaqosry/Documents/webkampus/lpm`.
2. Konfigurasi koneksi MySQL (Pengaturan skema Prisma & migrasi).
3. Membangun komponen tata letak (*Sidebar*, *Topbar*, wadah SPA responsif).
4. Implementasi modul-modul:
   - Halaman Login dengan form kredensial dan tombol **"Login via SSO"**.
   - **Dashboard Monitoring & Analisis Keputusan LPM** (Bar progres, grafik analitik Recharts).
   - Manajemen Unit & Akun.
   - Penampil/Pengunggah Dokumen Penetapan & Evaluasi.
   - Pembuat Standar & Pertanyaan Audit.
   - Formulir Jawaban Auditee & Tabel Verifikasi LPM.
