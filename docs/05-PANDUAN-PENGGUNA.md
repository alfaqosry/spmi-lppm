# 05 — Panduan Pengguna

**Alamat:** <https://spmi.universitaspahlawan.ac.id> · **Bantuan:** `lpm@universitaspahlawan.ac.id`

Panduan ini disusun per peran. Temukan peran Anda di menu profil (ikon nama di kanan atas → **Profil**).

| Peran                      | Bagian                                            |
| -------------------------- | ------------------------------------------------- |
| Semua pengguna             | [§1 Masuk, keluar, kata sandi](#1-semua-pengguna) |
| Pengunjung (Tamu)          | [§2](#2-pengunjung-tamu)                          |
| Kepala Unit / Anggota Unit | [§3](#3-kepala-unit-dan-anggota-unit-auditee)     |
| Anggota LPM                | [§4](#4-anggota-lpm)                              |
| Admin LPM                  | [§5](#5-admin-lpm)                                |
| Superadmin                 | [§6](#6-superadmin)                               |

---

## 1. Semua Pengguna

### 1.1 Masuk

- **Login via SSO UP** (disarankan bagi dosen/tendik/mahasiswa): klik tombol **Login via SSO UP**, masuk dengan
  akun SSO Universitas Pahlawan, Anda dikembalikan ke SPMI secara otomatis.
- **Email & kata sandi**: untuk akun yang dibuat LPM. Setelah beberapa kali gagal (default 5 kali per menit per email+IP, dan 30 kali per menit per IP),
  Anda harus menunggu sebelum mencoba lagi.
- Pertama kali masuk, baca dan setujui **Kebijakan Privasi** bila diminta.

### 1.2 Keluar

Klik nama Anda (kanan atas) → **Keluar**. Selalu keluar bila memakai komputer bersama.

### 1.3 Ubah kata sandi

**Profil → Ubah Kata Sandi**: isi kata sandi saat ini, kata sandi baru (minimal 8 karakter) dan konfirmasinya.
Akun yang hanya masuk via SSO tidak memiliki kata sandi lokal — kelola kata sandi di SSO UP.

### 1.4 Tema

Gunakan tombol tema (terang/gelap) di bilah atas.

### 1.5 Data pribadi Anda

Anda dapat mengunduh salinan data pribadi Anda (format JSON) melalui halaman **Profil** (tautan unduh data
pribadi, endpoint `/api/me/export` — tersedia mulai rilis fitur privasi).
Permintaan koreksi atau penghapusan data diajukan ke LPM melalui email di atas.

---

## 2. Pengunjung (Tamu)

Akun yang baru pertama kali masuk via SSO berstatus **Pengunjung** dan belum memiliki akses fitur.

1. Setelah masuk, Anda melihat halaman **"Akun Anda Belum Memiliki Akses"**.
2. Klik **Hubungi LPM via Email** — email permohonan akses otomatis terisi nama dan email Anda.
3. Setelah LPM menempatkan Anda pada unit atau memberi peran, muat ulang halaman; Anda akan diarahkan ke Dashboard.

---

## 3. Kepala Unit dan Anggota Unit (Auditee)

### 3.1 Dashboard

Menampilkan siklus aktif, status pengisian (Belum Mulai / Sedang Mengisi / Selesai) dan apakah periode
pengisian masih terbuka.

### 3.2 Membaca dokumen Penetapan & Evaluasi

Menu **Penetapan** atau **Evaluasi** → klik dokumen untuk membuka PDF/tautan. Auditee hanya dapat membaca.

### 3.3 Mengisi audit

1. Buka **Audit & Verifikasi**. Bila Anda ditempatkan di lebih dari satu unit, pilih unit pada pemilih unit di atas.
2. Pertanyaan dikelompokkan per **Standar**. Untuk setiap butir:
   - Pilih **Ya** → **wajib** melampirkan bukti: unggah **PDF (maks. 10 MB)** atau isi **tautan** `https://…`
     (mis. Google Drive yang dapat diakses LPM).
   - Pilih **Tidak** → **wajib** menuliskan **alasan**.
3. Klik **Simpan** pada butir tersebut. Status butir menjadi **Menunggu Verifikasi**.
4. Ulangi sampai semua butir terjawab — status unit menjadi **Selesai**.

Hal yang perlu diperhatikan:

- Pengisian hanya bisa dilakukan saat siklus **aktif** dan **sebelum batas waktu** (sampai akhir hari tanggal selesai).
  Setelah itu muncul pesan _"Periode pengisian ditutup"_ dan formulir terkunci.
- Mengubah jawaban yang sudah diverifikasi akan mengembalikan statusnya ke **Menunggu Verifikasi**.
- Hanya berkas PDF asli yang diterima (berkas lain yang diganti ekstensinya akan ditolak).

### 3.4 Menindaklanjuti revisi dan mengisi RTL

1. Butir berstatus **Perlu Revisi** menampilkan **Catatan LPM**.
2. Perbaiki jawaban/bukti lalu simpan, **dan/atau** isi **Rencana Tindak Lanjut (RTL)** pada kotak RTL → **Simpan RTL**.
3. Kotak RTL juga muncul untuk butir yang dijawab **Tidak**.

---

## 4. Anggota LPM

Semua fitur pada bagian ini juga tersedia untuk Admin LPM dan Superadmin.

### 4.1 Dashboard monitoring

Statistik unit, siklus, pertanyaan, progres per unit, serta grafik (bar/pie/radar) jawaban Ya/Tidak dan status verifikasi.

### 4.2 Mengelola dokumen Penetapan / Evaluasi

1. Menu **Penetapan** atau **Evaluasi** → **Tambah Dokumen**.
2. Pilih **siklus**, isi **judul**, lalu unggah **PDF** (maks. 10 MB) **atau** isi **tautan http/https**.
3. **Simpan**. Untuk menghapus, klik ikon hapus pada dokumen.

### 4.3 Menyusun Standar dan butir pertanyaan

1. **Audit & Verifikasi** → pilih **kategori unit** (atau **Umum** untuk semua unit) → pilih tab unit.
2. **Tambah Standar** (mis. "Standar Tata Pamong"). Nama standar harus unik dalam satu siklus.
3. Klik nama standar atau **Kelola Butir** → tambahkan beberapa butir ke daftar sementara → **Simpan** (sekaligus).
4. Tentukan **cakupan** butir: _Semua Unit_, _Kategori_ tertentu, atau _Unit_ tertentu.
5. Ubah/hapus butir yang tersimpan di modal yang sama.

> **Perhatian:** menghapus standar menghapus seluruh butir **beserta jawaban auditee** untuk butir tersebut.

### 4.4 Memverifikasi jawaban

1. **Audit & Verifikasi** → panel verifikasi → pilih unit.
2. Buka bukti (PDF/tautan) atau baca alasan.
3. Pilih **Terverifikasi**, atau **Perlu Revisi** dengan **catatan wajib** yang menjelaskan kekurangan (temuan/KTS).
4. Pantau RTL yang diisi auditee.

### 4.5 Analitik & laporan PDF

1. **Analitik & Laporan** → pilih siklus → **Tampilkan**.
2. Lihat profil kepatuhan per standar & kategori, serta rekap per unit.
3. **Unduh Laporan PDF** (keseluruhan) atau tombol unduh pada baris unit (laporan observasi per unit).
4. Laporan memuat blok tanda tangan **Ketua LPM**. Bila belum ditunjuk, minta Admin LPM menunjuknya (§5.4).

---

## 5. Admin LPM

Admin LPM memiliki seluruh fitur Anggota LPM (§4) ditambah:

### 5.1 Siklus & Periode

1. **Siklus & Periode** → **Tambah Siklus**: nama (mis. "Siklus 2026/2027"), tanggal mulai, tanggal selesai.
2. Centang **Aktif** untuk membukanya. Hanya **satu** siklus aktif; mengaktifkan siklus lain menonaktifkan yang lama.
3. **Nonaktifkan** untuk menutup pengisian lebih awal. Pengisian juga tertutup otomatis setelah tanggal selesai.
4. **Hapus** siklus hanya bila benar-benar keliru — seluruh dokumen, standar, pertanyaan, dan jawaban siklus tersebut ikut terhapus.

### 5.2 Unit Audit

**Unit Audit** → **Tambah Unit**: nama, kategori (Program Studi, Wakil Rektor, Pusat, Perpustakaan, Biro, Lembaga,
Unit Lainnya, atau ketik kategori baru), deskripsi. Menghapus unit menghapus jawaban & progres unit tersebut.

### 5.3 Role & Penempatan

- **Tambah akun**: nama, email, kata sandi awal (min. 8 karakter), peran, dan unit (wajib untuk peran auditee).
  Sampaikan kata sandi awal melalui kanal aman dan minta pengguna menggantinya.
- **Ubah akun**: ganti nama, peran, unit, status aktif, atau setel ulang kata sandi.
- **Penempatan per unit**: buka panel unit → **Tambah** → pilih akun terdaftar (termasuk akun Pengunjung hasil SSO)
  → pilih **Kepala** atau **Anggota**. Satu akun boleh di banyak unit; **satu unit hanya satu Kepala Unit**.
- Menghapus penempatan terakhir sebuah akun mengembalikannya menjadi **Pengunjung**.
- Akun LPM tidak dapat ditempatkan sebagai auditee.

### 5.4 Menunjuk Ketua LPM

Pada daftar akun, klik **ikon mahkota** di akun Admin LPM yang menjabat. Hanya satu Ketua LPM; menunjuk akun
lain otomatis mencabut yang lama. Nama Ketua LPM tercetak sebagai penandatangan laporan PDF.

---

## 6. Superadmin

Superadmin memiliki seluruh fitur Admin LPM ditambah menu **Pengaturan**:

| Tab              | Isi                                                                                                                                                                     | Tips                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Identitas & SEO  | Nama sistem, nama singkat, deskripsi, organisasi, logo/favicon/OG (PNG/JPG/WEBP/GIF/ICO ≤ 2 MB, tanpa SVG), kata kunci, URL dasar, verifikasi Google, `index`/`noindex` | Sistem internal sebaiknya `noindex`                                                                                                   |
| Integrasi SSO    | Aktif/nonaktif, URL, Client ID, Client Secret (disamarkan), Redirect URI, Scope, Prompt, email admin SSO, **Uji Koneksi**                                               | Redirect URI harus `https://spmi.universitaspahlawan.ac.id/api/sso/callback`. Kosongkan kolom secret untuk mempertahankan nilai lama. |
| Log & Pemantauan | Aktif/nonaktif log login dan log aktivitas, masa simpan log login, bersihkan log                                                                                        | Jangan mematikan log tanpa alasan — dibutuhkan untuk investigasi insiden                                                              |
| Keamanan         | Masa sesi (hari), maks. percobaan login, jendela pembatasan (menit)                                                                                                     | Default 7 hari / 5 kali / 1 menit (rentang yang diizinkan: 1–30 hari, 1–5 kali, 1–60 menit)                                           |
| Pemeliharaan     | Mode pemeliharaan + pesan                                                                                                                                               | Saat aktif hanya superadmin yang dapat masuk dashboard                                                                                |
| Superadmin       | Daftar & tambah superadmin                                                                                                                                              | Batasi jumlah superadmin seminimal mungkin                                                                                            |

---

## 7. Pertanyaan Umum

| Pertanyaan                                           | Jawaban                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Tombol _Login via SSO UP_ tidak ada                  | SSO belum dikonfigurasi; hubungi superadmin.                                                         |
| Saya login SSO tetapi melihat "Belum Memiliki Akses" | Akun Anda masih Pengunjung; hubungi LPM (§2).                                                        |
| Tidak bisa menyimpan jawaban                         | Periode pengisian sudah ditutup, atau bukti/alasan belum diisi, atau berkas bukan PDF/terlalu besar. |
| Menu Audit tidak menampilkan unit saya               | Anda belum ditempatkan di unit; hubungi Admin LPM.                                                   |
| Laporan PDF tanpa nama penandatangan                 | Ketua LPM belum ditunjuk (§5.4).                                                                     |
