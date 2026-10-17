# Persona Pengguna SPMI

Persona di bawah **fiktif** (nama, usia, detail pribadi rekaan) dan disusun dari peran di
[01-PERANCANGAN §2](../../01-PERANCANGAN.md#2-aktor-dan-peran), konteks di [KONTEKS-PENGGUNAAN](KONTEKS-PENGGUNAAN.md),
serta alur UI nyata. Status: **hipotesis** — ⏳ validasi melalui wawancara singkat 2–3 orang per peran sebelum
uji usabilitas. Jangan menggunakan nama/data pegawai sebenarnya dalam persona (UU PDP).

| ID  | Persona               | Peran            | Kelompok uji |
| --- | --------------------- | ---------------- | ------------ |
| P1  | Dr. Rina Kartika      | `auditee_head`   | A (Auditee)  |
| P2  | Andi Saputra          | `auditee_member` | A (Auditee)  |
| P3  | Dra. Sari Wulandari   | `lpm_member`     | B (LPM)      |
| P4  | Hendra Pratama, M.Pd. | `lpm_admin`      | B (LPM)      |
| P5  | Fajar Ramadhan        | `superadmin`     | C (Admin TI) |
| P6  | Nadia Putri           | `pengunjung`     | D (Baru)     |

---

## P1 — Dr. Rina Kartika, Kepala Program Studi (Kepala Unit)

> "Saya hanya punya waktu di sela mengajar. Yang penting saya tahu apa yang kurang dan kapan tenggatnya."

| Aspek                 | Uraian                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Profil                | 44 tahun, Kaprodi S1 Keperawatan; **rangkap jabatan** sebagai anggota Pusat Penelitian (2 unit di pemilih unit `/audit`)              |
| Perangkat             | Laptop 14" di kantor, ponsel Android saat di luar kelas                                                                               |
| Literasi digital      | Menengah; terbiasa Google Drive, SIAKAD, email                                                                                        |
| Tujuan                | Unit selesai 100% sebelum batas waktu; tidak ada temuan revisi tertunggak; laporan unit untuk rapat prodi                             |
| Tugas utama           | T01, T02, T04–T07                                                                                                                     |
| Frustrasi (hipotesis) | Tidak melihat tanggal tutup di Dashboard Unit (HE-01); butir revisi tidak menonjol (HE-02); mengisi ulang karena input hilang (HE-08) |
| Kebutuhan             | Ringkasan "yang harus dikerjakan" + tenggat; daftar revisi; bisa mendelegasikan ke anggota                                            |

## P2 — Andi Saputra, Staf Administrasi Biro (Anggota Unit)

> "Bukti saya hasil scan, kadang 15 MB. Kalau ditolak, saya ingin tahu sebelum menunggu lama."

| Aspek                 | Uraian                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Profil                | 29 tahun, tendik Biro Administrasi Akademik; ditugasi Kepala Biro mengisi seluruh butir                                                   |
| Perangkat             | Desktop kantor (Windows 10, Chrome), sesekali ponsel                                                                                      |
| Literasi digital      | Menengah–tinggi untuk aplikasi perkantoran; awam soal format PDF                                                                          |
| Tujuan                | Mengisi puluhan butir secepat mungkin dalam satu sesi                                                                                     |
| Tugas utama           | T04, T05, T08                                                                                                                             |
| Frustrasi (hipotesis) | Simpan harus per butir; berkas > 10 MB baru ditolak setelah diunggah penuh (HE-09); jawaban di grup lain hilang saat grup dilipat (HE-08) |
| Kebutuhan             | Validasi ukuran sebelum unggah, petunjuk kompresi PDF, umpan balik tersimpan yang jelas per butir                                         |

## P3 — Dra. Sari Wulandari, Auditor Internal (Anggota LPM)

> "Menjelang tenggat ada ratusan jawaban. Saya perlu melihat yang belum diverifikasi saja, beserta standarnya."

| Aspek                 | Uraian                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Profil                | 52 tahun, dosen senior, auditor AMI bersertifikat                                                                    |
| Perangkat             | Laptop 15" dengan zoom peramban 125%                                                                                 |
| Literasi digital      | Menengah; lebih nyaman dengan dokumen cetak                                                                          |
| Tujuan                | Memverifikasi semua jawaban unit binaannya dengan catatan temuan yang jelas                                          |
| Tugas utama           | T09, T10, T12                                                                                                        |
| Frustrasi (hipotesis) | Filter status default "Semua" (HE-21); konteks standar tak tampil di baris verifikasi (HE-19); tidak ada aksi massal |
| Kebutuhan             | Antrean "Menunggu Verifikasi", tampilan bukti berdampingan, templat catatan KTS                                      |

## P4 — Hendra Pratama, M.Pd., Admin LPM

> "Di awal siklus saya menyiapkan semuanya. Satu salah klik bisa menghapus data satu tahun."

| Aspek                 | Uraian                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Profil                | 38 tahun, sekretaris LPM; pemilik proses AMI                                                                              |
| Perangkat             | Desktop 24" di kantor LPM                                                                                                 |
| Literasi digital      | Tinggi                                                                                                                    |
| Tujuan                | Siklus, unit, akun & penempatan siap tepat waktu; Ketua LPM tertunjuk; laporan PDF akreditasi benar                       |
| Tugas utama           | T13–T15, T10, T12                                                                                                         |
| Frustrasi (hipotesis) | Aktifkan siklus tanpa konfirmasi (HE-11); penghapusan berantai (HE-03, HE-04, HE-05); unduh PDF siklus yang salah (HE-07) |
| Kebutuhan             | Pratinjau dampak sebelum hapus, impor akun massal, pemilih siklus yang konsisten di semua menu (HE-23)                    |

## P5 — Fajar Ramadhan, Superadmin (Puskom)

> "Saya jarang membuka SPMI, tapi saat dibuka biasanya ada insiden."

| Aspek                 | Uraian                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Profil                | 31 tahun, staf jaringan & sistem Puskom                                                                      |
| Perangkat             | Desktop dua monitor                                                                                          |
| Literasi digital      | Sangat tinggi                                                                                                |
| Tujuan                | SSO berfungsi, pemeliharaan saat deploy, log tersedia untuk investigasi                                      |
| Tugas utama           | T16, T01                                                                                                     |
| Frustrasi (hipotesis) | Mode pemeliharaan cukup satu centang tanpa konfirmasi (HE-12); pengguna terkunci tanpa tombol keluar (HE-13) |
| Kebutuhan             | Status sistem ringkas (SSO, pemeliharaan, versi), konfirmasi untuk tindakan berdampak luas                   |

## P6 — Nadia Putri, Dosen Baru (Pengunjung)

> "Saya sudah login SSO, kenapa tidak bisa apa-apa?"

| Aspek                 | Uraian                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Profil                | 27 tahun, dosen baru; diminta Kaprodi "membantu isi AMI"                                                          |
| Perangkat             | Ponsel iPhone                                                                                                     |
| Literasi digital      | Tinggi                                                                                                            |
| Tujuan                | Segera mendapat akses ke unitnya                                                                                  |
| Tugas utama           | T01, T02, T03                                                                                                     |
| Frustrasi (hipotesis) | Halaman `/no-access` tidak memberi tahu kapan/bagaimana mengecek ulang (HE-28); tak tahu siapa yang memberi akses |
| Kebutuhan             | Status permohonan, tombol "periksa akses", estimasi waktu layanan LPM                                             |
