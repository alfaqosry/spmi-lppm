# Formulir User Acceptance Test (UAT) — SPMI

Formulir cetak untuk eksekusi UAT ([TEST-PLAN §5](TEST-PLAN.md#5-jadwal)). Nomor merujuk [TEST-CASES](TEST-CASES.md)
(langkah & prasyarat rinci ada di sana). Isi **Lulus/Gagal** dengan **L** atau **G**; bila G, tulis nomor issue di Catatan.
Uji dilakukan di lingkungan uji ber-data fiktif — **bukan produksi**.

| Versi aplikasi | Lingkungan / URL | Tanggal mulai | Tanggal selesai | Koordinator UAT |
| -------------- | ---------------- | ------------- | --------------- | --------------- |
| v______        |                  |               |                 |                 |

Petunjuk: satu modul diisi oleh penguji dengan peran yang sesuai (kolom "Peran penguji"). Paraf penguji di setiap baris
yang dieksekusi. Catat perangkat/peramban di kepala tiap modul.

<div style="page-break-after: always"></div>

## Modul 1 — Login, SSO & Sesi

Peran penguji: semua peran · Penguji: ______________ · Perangkat/peramban: ______________

| No        | Skenario                              | Hasil yang diharapkan                                                              | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ------------------------------------- | ---------------------------------------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-LOG-02 | Login email & sandi benar             | Masuk ke Dashboard                                                                 |              |             |         |       |
| TC-LOG-03 | Sandi salah / email tidak terdaftar   | Pesan sama "Email atau kata sandi salah.", tetap di halaman login                  |              |             |         |       |
| TC-LOG-04 | Login akun nonaktif                   | Pesan sama dengan TC-LOG-03                                                        |              |             |         |       |
| TC-LOG-06 | Gagal login 6× dalam 1 menit          | Pesan "Terlalu banyak percobaan…"; login benar ditolak sementara                   |              |             |         |       |
| TC-LOG-08 | Periksa cookie sesi (DevTools)        | `__Host-lpm_session` HttpOnly, Secure, SameSite=Lax                                |              |             |         |       |
| TC-LOG-10 | Buka `/dashboard` di jendela privat   | Dialihkan ke `/login`                                                              |              |             |         |       |
| TC-LOG-11 | Keluar, lalu tekan Back               | Kembali ke login; dashboard tidak terbuka                                          |              |             |         |       |
| TC-LOG-12 | Login SSO akun baru                   | Akun Pengunjung → halaman "Belum Memiliki Akses"                                   |              |             |         |       |
| TC-LOG-13 | Login SSO email admin                 | Akun menjadi Admin LPM                                                             |              |             |         |       |
| TC-LOG-15 | Login SSO akun lokal yang sudah ada   | Peran tetap; nama/email tersinkron                                                 |              |             |         |       |
| TC-LOG-16 | SSO belum dikonfigurasi               | Kembali ke login dengan pesan "Login SSO belum dikonfigurasi…"                     |              |             |         |       |
| TC-LOG-17 | Variasi galat SSO (`?sso_error=`)     | Pesan Indonesia sesuai kode                                                        |              |             |         |       |
| TC-LOG-19 | Ubah kata sandi (valid & tidak valid) | Valid tersimpan; tidak valid ditolak dengan petunjuk; sesi perangkat lain berakhir |              |             |         |       |
| TC-LOG-20 | Profil akun SSO-only                  | Tertulis terhubung via SSO; tidak bisa ubah sandi lokal                            |              |             |         |       |

## Modul 2 — Dashboard

Peran penguji: Admin/Anggota LPM, Kepala Unit · Penguji: ______________ · Perangkat: ______________

| No        | Skenario                 | Hasil yang diharapkan                                  | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ------------------------ | ------------------------------------------------------ | ------------ | :---------: | ------- | ----- |
| TC-DSH-01 | Dashboard LPM            | Statistik, progres per unit, grafik tampil             |              |             |         |       |
| TC-DSH-02 | Dashboard Kepala Unit    | Hanya unit sendiri; tombol PDF per unit                |              |             |         |       |
| TC-DSH-03 | Auditee menjawab 1 butir | Status unit di dashboard LPM menjadi "Sedang Mengisi"  |              |             |         |       |
| TC-DSH-04 | Semua siklus nonaktif    | Tidak ada galat; auditee tidak melihat siklus nonaktif |              |             |         |       |

## Modul 3 — Siklus & Periode

Peran penguji: Admin LPM · Penguji: ______________

| No        | Skenario                              | Hasil yang diharapkan                                       | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ------------------------------------- | ----------------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-SIK-01 | Buat siklus aktif                     | Siklus tersimpan & berbadge Aktif                           |              |             |         |       |
| TC-SIK-02 | Aktifkan siklus kedua                 | Siklus pertama otomatis Arsip                               |              |             |         |       |
| TC-SIK-03 | Tanggal selesai < tanggal mulai       | Ditolak dengan pesan                                        |              |             |         |       |
| TC-SIK-04 | Isi jawaban pada hari tanggal selesai | Masih bisa sampai 23.59 WIB                                 |              |             |         |       |
| TC-SIK-05 | Nonaktifkan / lewat batas             | Auditee melihat "Periode pengisian ditutup"; simpan ditolak |              |             |         |       |
| TC-SIK-06 | Anggota LPM / auditee buka `/siklus`  | Dialihkan ke Dashboard                                      |              |             |         |       |
| TC-SIK-07 | Hapus siklus berisi data              | Konfirmasi; seluruh data siklus terhapus                    |              |             |         |       |

## Modul 4 — Unit Audit

Peran penguji: Admin LPM · Penguji: ______________

| No        | Skenario                         | Hasil yang diharapkan                                     | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | -------------------------------- | --------------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-UNT-01 | Tambah unit                      | Tampil di daftar & di kategori panel Instrumen            |              |             |         |       |
| TC-UNT-02 | Kategori baru di luar daftar     | Tersimpan sebagai kategori baru                           |              |             |         |       |
| TC-UNT-03 | Ubah lalu hapus unit             | Perubahan tampil; penempatan & jawaban unit ikut terhapus |              |             |         |       |
| TC-UNT-04 | Tambah unit dari panel Instrumen | Unit muncul sebagai tab kategori                          |              |             |         |       |
| TC-UNT-05 | Anggota LPM buka `/unit`         | Dialihkan                                                 |              |             |         |       |

## Modul 5 — Akun, Penempatan & Ketua LPM

Peran penguji: Admin LPM · Penguji: ______________

| No        | Skenario                              | Hasil yang diharapkan                                | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ------------------------------------- | ---------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-ROL-01 | Akun Anggota Unit tanpa unit          | Ditolak                                              |              |             |         |       |
| TC-ROL-02 | Sandi 7 karakter                      | Ditolak                                              |              |             |         |       |
| TC-ROL-03 | Email duplikat                        | Ditolak "Email sudah terdaftar."                     |              |             |         |       |
| TC-ROL-04 | Kepala Unit kedua pada unit yang sama | Ditolak dengan nama kepala yang ada                  |              |             |         |       |
| TC-ROL-05 | Satu akun di 2 unit                   | Pemilih unit tampil di Audit                         |              |             |         |       |
| TC-ROL-06 | Tempatkan akun Pengunjung             | Menjadi Anggota/Kepala Unit, dapat membuka Dashboard |              |             |         |       |
| TC-ROL-07 | Hapus penempatan terakhir             | Akun kembali Pengunjung                              |              |             |         |       |
| TC-ROL-08 | Tunjuk Ketua LPM A lalu B             | Hanya B bermahkota; PDF menampilkan B                |              |             |         |       |
| TC-ROL-09 | Tempatkan Admin LPM ke unit           | Ditolak                                              |              |             |         |       |
| TC-ROL-10 | Admin LPM membuat Superadmin          | Ditolak                                              |              |             |         |       |
| TC-ROL-11 | Hapus akun sendiri                    | Ditolak                                              |              |             |         |       |
| TC-ROL-12 | Nonaktifkan akun yang sedang login    | Pengguna tersebut dialihkan ke login                 |              |             |         |       |

## Modul 6 — Penetapan & Evaluasi

Peran penguji: Anggota LPM; auditee untuk TC-DOK-07 · Penguji: ______________

| No        | Skenario                                   | Hasil yang diharapkan                  | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ------------------------------------------ | -------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-DOK-01 | Unggah PDF ≤ 10 MB                         | Tersimpan; dapat dibuka                |              |             |         |       |
| TC-DOK-02 | Tautan https; tanpa berkas & tautan        | Tautan tersimpan; kosong ditolak       |              |             |         |       |
| TC-DOK-03 | Tautan `javascript:` / `data:`             | Ditolak                                |              |             |         |       |
| TC-DOK-04 | Berkas palsu berganti nama `.pdf`          | Ditolak                                |              |             |         |       |
| TC-DOK-06 | PDF > 10 MB                                | Ditolak dengan pesan ukuran            |              |             |         |       |
| TC-DOK-07 | Auditee membuka menu                       | Hanya baca, tanpa tombol unggah/hapus  |              |             |         |       |
| TC-DOK-08 | Buka URL berkas tanpa login; setelah hapus | 401; setelah hapus tidak dapat diakses |              |             |         |       |

## Modul 7 — Audit & Verifikasi

Peran penguji: Anggota LPM (instrumen & verifikasi), Kepala/Anggota Unit (pengisian) · Penguji: ______________ · Perangkat: ☐ Laptop ☐ Ponsel

| No        | Skenario                                | Hasil yang diharapkan                                     | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | --------------------------------------- | --------------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-AUD-01 | Tambah standar; nama duplikat           | Tersimpan; duplikat ditolak                               |              |             |         |       |
| TC-AUD-02 | Tambah 3 butir sekaligus                | 3 butir tersimpan berurutan                               |              |             |         |       |
| TC-AUD-03 | Butir cakupan kategori Biro             | Hanya unit Biro melihatnya                                |              |             |         |       |
| TC-AUD-04 | Butir cakupan 1 unit                    | Hanya unit tersebut melihatnya                            |              |             |         |       |
| TC-AUD-07 | Ya tanpa bukti                          | Ditolak "wajib disertai bukti"                            |              |             |         |       |
| TC-AUD-08 | Tidak tanpa alasan                      | Ditolak                                                   |              |             |         |       |
| TC-AUD-09 | Ya + PDF valid                          | Status "Menunggu Verifikasi"                              |              |             |         |       |
| TC-AUD-10 | Ya + tautan https / `javascript:`       | https tersimpan; lainnya ditolak                          |              |             |         |       |
| TC-AUD-11 | Ubah `unitId` ke unit lain (DevTools)   | Ditolak "tidak memiliki akses"                            |              |             |         |       |
| TC-AUD-12 | Ubah `existingFile` ke bukti unit lain  | Ditolak/diabaikan                                         |              |             |         |       |
| TC-AUD-13 | Verifikasi (Sesuai)                     | Status Terverifikasi + nama verifikator                   |              |             |         |       |
| TC-AUD-14 | Minta Revisi tanpa catatan              | Ditolak                                                   |              |             |         |       |
| TC-AUD-15 | Revisi dengan catatan → auditee isi RTL | Catatan tampil di auditee; RTL tampil di LPM              |              |             |         |       |
| TC-AUD-16 | Ubah jawaban terverifikasi              | Kembali Menunggu Verifikasi; catatan LPM terhapus         |              |             |         |       |
| TC-AUD-17 | Jawab semua butir relevan               | Status unit Selesai                                       |              |             |         |       |
| TC-AUD-18 | Hapus standar berisi jawaban            | Konfirmasi; butir & jawaban semua kategori terhapus       |              |             |         |       |
| TC-AUD-19 | Buka URL bukti unit lain                | Ditolak (403)                                             |              |             |         |       |
| TC-AUD-20 | Rangkap jabatan: ganti unit             | Pertanyaan & progres sesuai unit; catat bila input hilang |              |             |         |       |
| TC-AUD-21 | Auditee memanggil verifikasi langsung   | Ditolak                                                   |              |             |         |       |

## Modul 8 — Analitik & Laporan PDF

Peran penguji: Anggota/Admin LPM; Kepala Unit untuk TC-ANL-05 · Penguji: ______________

| No        | Skenario                                               | Hasil yang diharapkan                          | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ------------------------------------------------------ | ---------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-ANL-01 | Pilih siklus → Tampilkan                               | Grafik & rekap sesuai data                     |              |             |         |       |
| TC-ANL-02 | Unduh Laporan PDF keseluruhan                          | Nama berkas benar; blok tanda tangan Ketua LPM |              |             |         |       |
| TC-ANL-03 | Unduh PDF per unit                                     | Tabel kolom sesuai format laporan observasi    |              |             |         |       |
| TC-ANL-04 | Tanpa Ketua LPM                                        | PDF tetap terbentuk                            |              |             |         |       |
| TC-ANL-05 | Auditee: ekspor keseluruhan / unit lain / unit sendiri | 403 / 403 / PDF                                |              |             |         |       |
| TC-ANL-06 | Ekspor tanpa login; > 10× per menit                    | 401; 429                                       |              |             |         |       |
| TC-ANL-07 | Parameter salah                                        | 400 / 404 JSON                                 |              |             |         |       |
| TC-ANL-08 | Ganti dropdown siklus tanpa "Tampilkan" lalu unduh     | PDF untuk siklus yang dipilih                  |              |             |         |       |

## Modul 9 — Pengaturan (Superadmin)

Peran penguji: Superadmin · Penguji: ______________

| No        | Skenario                                 | Hasil yang diharapkan                                     | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ---------------------------------------- | --------------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-SET-01 | Ubah nama sistem                         | Judul tab & halaman login berubah                         |              |             |         |       |
| TC-SET-02 | Unggah logo PNG; coba SVG                | PNG diterima; SVG ditolak                                 |              |             |         |       |
| TC-SET-03 | Simpan & buka ulang secret SSO           | Tersamar; tidak hilang saat simpan ulang                  |              |             |         |       |
| TC-SET-04 | Uji Koneksi SSO                          | Berhasil bila SSO terjangkau                              |              |             |         |       |
| TC-SET-05 | Login gagal → lihat log                  | Entri tercatat, email tersamar                            |              |             |         |       |
| TC-SET-07 | Masa sesi 1 hari                         | Cookie kedaluwarsa 1 hari                                 |              |             |         |       |
| TC-SET-08 | Aktifkan pemeliharaan; login Admin LPM   | Admin melihat halaman pemeliharaan; superadmin tetap bisa |              |             |         |       |
| TC-SET-09 | Tambah superadmin; Admin buka Pengaturan | Superadmin baru bisa masuk; Admin dialihkan               |              |             |         |       |

## Modul 10 — Privasi, Persetujuan & Ekspor Data

Peran penguji: akun baru + akun lama · Penguji: ______________

| No        | Skenario                                 | Hasil yang diharapkan                                | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| --------- | ---------------------------------------- | ---------------------------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-PRV-01 | Buka kebijakan privasi & S&K tanpa login | Tampil                                               |              |             |         |       |
| TC-PRV-02 | Login pertama kali                       | Dialog persetujuan; tersimpan setelah setuju         |              |             |         |       |
| TC-PRV-03 | Versi kebijakan dinaikkan                | Diminta menyetujui ulang                             |              |             |         |       |
| TC-PRV-04 | Esc / klik latar; "Tidak setuju, keluar" | Dialog tidak tertutup; tombol keluar mengakhiri sesi |              |             |         |       |
| TC-PRV-05 | Unduh data saya                          | JSON milik sendiri, tanpa hash sandi                 |              |             |         |       |
| TC-PRV-06 | Ekspor data tanpa login                  | 401                                                  |              |             |         |       |
| TC-PRV-08 | Jalankan tugas purge                     | Log melewati retensi terhapus                        |              |             |         |       |
| TC-PRV-09 | Ganti sandi di perangkat A               | Sesi di perangkat B berakhir                         |              |             |         |       |

## Modul 11 — Non-Fungsional (sampel manual)

Penguji: ______________

| No       | Skenario                                      | Hasil yang diharapkan            | Hasil aktual | Lulus/Gagal | Catatan | Paraf |
| -------- | --------------------------------------------- | -------------------------------- | ------------ | :---------: | ------- | ----- |
| TC-NF-05 | Alur pengisian di Safari iOS (perangkat asli) | Berfungsi tanpa galat tata letak |              |             |         |       |
| TC-NF-11 | Unggah bukti 9,9 MB melalui URL publik        | Tersimpan                        |              |             |         |       |
| TC-NF-12 | Pengisian & verifikasi dengan keyboard saja   | Semua langkah dapat diselesaikan |              |             |         |       |

<div style="page-break-after: always"></div>

## Rekapitulasi

| Modul                          | Dieksekusi | Lulus | Gagal | Issue terbuka (nomor) |
| ------------------------------ | ---------- | ----- | ----- | --------------------- |
| 1 Login, SSO & Sesi            |            |       |       |                       |
| 2 Dashboard                    |            |       |       |                       |
| 3 Siklus & Periode             |            |       |       |                       |
| 4 Unit Audit                   |            |       |       |                       |
| 5 Akun, Penempatan & Ketua LPM |            |       |       |                       |
| 6 Penetapan & Evaluasi         |            |       |       |                       |
| 7 Audit & Verifikasi           |            |       |       |                       |
| 8 Analitik & Laporan PDF       |            |       |       |                       |
| 9 Pengaturan                   |            |       |       |                       |
| 10 Privasi                     |            |       |       |                       |
| 11 Non-fungsional              |            |       |       |                       |
| **Total**                      |            |       |       |                       |

Keputusan penerimaan: ☐ **Diterima** ☐ **Diterima dengan catatan** (issue di atas diperbaiki paling lambat ________) ☐ **Ditolak**

Catatan: ____________________________________________________________________________________________

## Pengesahan

| Peran                        | Nama | Tanda tangan | Tanggal |
| ---------------------------- | ---- | ------------ | ------- |
| Penguji — Superadmin         |      |              |         |
| Penguji — Admin LPM          |      |              |         |
| Penguji — Anggota LPM        |      |              |         |
| Penguji — Kepala Unit        |      |              |         |
| Penguji — Anggota Unit       |      |              |         |
| Manajer uji / Tim pengembang |      |              |         |
| **Menyetujui — Ketua LPM**   |      |              |         |
