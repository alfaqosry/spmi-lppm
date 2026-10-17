# Rencana Uji Usabilitas Moderasi — SPMI v1.1.x

| Item      | Keterangan                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| Acuan     | ISO 9241-11:2018 (ukuran kegunaan), ISO 9241-210:2019 §8 (evaluasi berbasis pengguna), ISO/IEC 25066 (format laporan) |
| Objek uji | SPMI v1.1.3 (atau rilis berikutnya) pada **lingkungan uji dengan data fiktif** — bukan produksi                       |
| Status    | ⏳ Rencana disetujui → menunggu pelaksanaan                                                                           |
| Pemilik   | LPM (sponsor) + tim pengembang (fasilitator/analis)                                                                   |

## 1. Tujuan

1. Mengukur **efektivitas, efisiensi, kepuasan** terhadap sasaran di [KONTEKS-PENGGUNAAN §5](KONTEKS-PENGGUNAAN.md#5-sasaran-kegunaan-terukur).
2. Memvalidasi (atau menggugurkan) temuan [EVALUASI-HEURISTIK](EVALUASI-HEURISTIK.md), terutama HE-01, HE-02, HE-06, HE-07, HE-08.
3. Menemukan masalah kegunaan baru pada alur kritis (pengisian audit, verifikasi, ekspor PDF, penyiapan siklus).
4. Memvalidasi [PERSONA](PERSONA.md) dan [USER-JOURNEY](USER-JOURNEY.md).

## 2. Metode

- **Uji moderasi tatap muka** (ruang LPM, 1 peserta + 1 fasilitator + 1 pencatat) — utama; **jarak jauh** (Zoom/Meet,
  berbagi layar) sebagai cadangan.
- Protokol **think-aloud** konkuren; fasilitator tidak membantu kecuali peserta menyerah (> batas gagal) atau terjebak > 2 mnt.
- Durasi per sesi **45–60 menit**; perangkat: laptop uji (Chrome terbaru, 1366×768 & 1920×1080) dan ponsel Android
  (Chrome) untuk ≥ 3 peserta kelompok A.
- Perekaman layar + suara (dengan persetujuan); stopwatch/ log waktu oleh pencatat.

## 3. Peserta

| Kelompok | Peran yang diwakili              | Jumlah        | Kriteria inklusi                                                                    | Persona |
| -------- | -------------------------------- | ------------- | ----------------------------------------------------------------------------------- | ------- |
| A        | `auditee_head`, `auditee_member` | **8** (4 + 4) | Pernah/akan mengisi AMI; ≥ 2 kategori unit (Prodi, Biro, Pusat); ≥ 3 memakai ponsel | P1, P2  |
| B        | `lpm_member`, `lpm_admin`        | **6** (4 + 2) | Auditor AMI aktif / pengelola LPM                                                   | P3, P4  |
| C        | `superadmin`                     | **3–5**       | Staf Puskom/TI (populasi kecil — 3 diterima)                                        | P5      |
| D        | `pengunjung` (pengguna baru)     | **5**         | Belum pernah memakai SPMI                                                           | P6      |

Total 22–24 sesi. Dasar: 5–8 peserta per kelompok homogen menemukan ±80% masalah utama (Nielsen & Landauer);
untuk estimasi SUS dengan IK 90% dibutuhkan ≥ 8 — kelompok A memenuhi, kelompok lain dilaporkan dengan IK lebar.
Pengecualian: pengembang SPMI, peserta uji pilot. Insentif: sertifikat/ucapan terima kasih (tanpa imbalan uang
yang memengaruhi jawaban).

## 4. Lingkungan & Data Uji

- **Lingkungan:** instans terpisah (lokal `docker-compose` atau server uji) dengan DB **sekali pakai**; staging belum
  tersedia ([09 §14](../../09-DAFTAR-STANDAR.md#14-manajemen-lingkungan)). Jangan memakai produksi atau data asli.
- **Akun uji** per peserta (mis. `a01.uji@example.test`) agar riwayat tidak bercampur; dibuat ulang tiap sesi.
- **Data seed:** 2 siklus ("Siklus Uji 2025/2026" non-aktif berisi jawaban; "Siklus Uji 2026/2027" aktif, `end_date` = H+10),
  6 unit lintas kategori, 3 standar × 4 butir dengan cakupan campuran, 1 akun Pengunjung hasil "SSO", jawaban contoh
  berstatus pending/verified/revision, 3 berkas PDF contoh (1 MB, 4 MB, 12 MB) dan 1 berkas `.docx`.
- SSO: gunakan login email untuk tugas inti; T01 (SSO) hanya bila SSO uji tersedia — jika tidak, dilakukan sebagai
  _walkthrough_ dengan tangkapan layar.

## 5. Skenario & Kriteria Sukses

Skenario ditulis berorientasi tujuan (tanpa menyebut nama menu). Waktu target dari KONTEKS §5.2.

| ID  | Kel.      | Skenario (dibacakan ke peserta)                                                                                 | Kriteria sukses                                                              | Target   | Temuan diuji     |
| --- | --------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | ---------------- |
| S01 | A,D       | "Anda baru pertama kali membuka SPMI. Masuklah menggunakan akun yang kami berikan."                             | Sampai Dashboard (A) atau `/no-access` (D) dan menyetujui kebijakan privasi  | ≤ 75 dtk | HE-15, HE-16     |
| S02 | D         | "Anda belum bisa memakai fitur apa pun. Minta akses ke pihak yang berwenang."                                   | Menemukan & memicu "Hubungi LPM via Email" atau menyebut email LPM           | ≤ 60 dtk | HE-28            |
| S03 | A         | "Kapan batas akhir unit Anda harus menyelesaikan pengisian audit?"                                              | Menyebut tanggal benar                                                       | ≤ 60 dtk | **HE-01**        |
| S04 | A         | "Jawab butir pertama Standar Tata Pamong: unit Anda **memiliki** dokumennya. Lampirkan berkas `renstra.pdf`."   | Status butir "Menunggu Verifikasi" dengan berkas tersimpan                   | ≤ 90 dtk | HE-09            |
| S05 | A         | "Butir kedua **tidak** dimiliki unit Anda karena belum disahkan. Simpan jawabannya."                            | Jawaban Tidak + alasan tersimpan                                             | ≤ 60 dtk | —                |
| S06 | A         | "Lampirkan `laporan-scan.pdf` (12 MB) sebagai bukti butir ketiga."                                              | Memahami penolakan & tindakan perbaikan (kompres/tautan Drive) tanpa bantuan | ≤ 3 mnt  | HE-09            |
| S07 | A         | "Isi dua butir di Standar berikutnya, lalu pindah ke unit Anda yang lain." (peserta rangkap jabatan)            | Kedua jawaban tersimpan sebelum pindah (kehilangan input = gagal)            | ≤ 4 mnt  | **HE-08**        |
| S08 | A         | "LPM meminta perbaikan pada salah satu jawaban unit Anda. Temukan dan tuliskan rencana tindak lanjutnya."       | RTL tersimpan pada butir yang benar                                          | ≤ 2 mnt  | **HE-02**        |
| S09 | A         | "Unduh laporan audit unit Anda."                                                                                | Berkas PDF unit terunduh                                                     | ≤ 45 dtk | HE-31            |
| S10 | B         | "Verifikasi semua jawaban Biro Administrasi Akademik yang belum diperiksa; satu jawaban buktinya tidak sesuai." | Semua pending → verified, satu → revision dengan catatan                     | ≤ 5 mnt  | HE-19–HE-21      |
| S11 | B         | "Tambahkan standar 'Standar Sarana Prasarana' dengan 3 butir yang hanya berlaku untuk unit kategori Biro."      | Standar + 3 butir cakupan kategori Biro                                      | ≤ 4 mnt  | HE-03            |
| S12 | B         | "Unduh laporan PDF keseluruhan untuk **Siklus Uji 2025/2026** (bukan yang aktif)."                              | PDF siklus yang benar terunduh (salah siklus = kesalahan kritis)             | ≤ 60 dtk | **HE-07, HE-06** |
| S13 | B (admin) | "Siapkan siklus baru 'Siklus Uji 2027/2028' yang langsung dibuka untuk pengisian."                              | Siklus dibuat & aktif; peserta menyadari siklus lama menjadi nonaktif        | ≤ 2 mnt  | HE-11            |
| S14 | B (admin) | "Dosen Nadia sudah login lewat SSO. Jadikan ia Kepala Unit Prodi Kebidanan."                                    | Penempatan head pada unit benar; peran berubah ke Kepala Unit                | ≤ 2 mnt  | —                |
| S15 | B (admin) | "Unit 'Pusat Uji Coba' sudah tidak ada. Hapus, tetapi jangan sampai jawaban unit lain hilang."                  | Unit terhapus; peserta dapat menjelaskan dampak (ukur pemahaman pesan)       | ≤ 90 dtk | HE-05            |
| S16 | C         | "Akan ada pemeliharaan server 30 menit. Beri tahu pengguna dan cegah mereka mengubah data."                     | Mode pemeliharaan aktif dengan pesan                                         | ≤ 60 dtk | HE-12, HE-13     |
| S17 | C         | "Pastikan login SSO berfungsi tanpa harus mencoba login."                                                       | Menggunakan **Uji Koneksi**                                                  | ≤ 90 dtk | —                |

Tiap peserta mengerjakan skenario kelompoknya (A: S01, S03–S09; B: S10–S12 + S13–S15 untuk admin; C: S01, S16, S17;
D: S01, S02). Urutan S04–S08 diacak sebagian (S04/S05 dan S07/S08) untuk mengurangi efek urutan.

## 6. Metrik

| Dimensi     | Metrik                                                                                                                              | Cara catat                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Efektivitas | Sukses tugas (biner: sukses mandiri / gagal), kesalahan kritis & non-kritis                                                         | Lembar observasi (§9)             |
| Efisiensi   | Waktu tugas (detik, dari selesai dibacakan sampai peserta menyatakan selesai), jumlah klik/halaman, efisiensi relatif terhadap ahli | Rekaman + stopwatch               |
| Kepuasan    | SEQ per tugas, SUS di akhir sesi                                                                                                    | [KUESIONER-SUS](KUESIONER-SUS.md) |
| Kualitatif  | Kutipan think-aloud, kebingungan, saran                                                                                             | Catatan pencatat                  |

Masalah yang ditemukan diberi ID `UT-xx`, severity 0–4 (skala sama dengan evaluasi heuristik), frekuensi (n/N peserta),
dan ditautkan ke HE bila ada.

## 7. Naskah Fasilitator

1. **Pembukaan (3 mnt).** "Terima kasih telah bersedia. Hari ini kami menguji **sistemnya**, bukan Anda — tidak ada jawaban
   salah. Silakan berpikir keras: ucapkan apa yang Anda lihat, cari, dan rasakan. Saya mungkin tidak menjawab
   pertanyaan agar mirip penggunaan nyata. Anda boleh berhenti kapan saja."
2. **Persetujuan (3 mnt).** Bacakan/serahkan formulir §8; tanda tangan; konfirmasi perekaman. Mulai rekaman setelah setuju.
3. **Pemanasan (3 mnt).** Pertanyaan latar: peran, pengalaman AMI, perangkat yang biasa dipakai, pernah memakai SPMI?
4. **Tugas (30–40 mnt).** Bacakan satu skenario, serahkan kartu skenario. Setelah tiap tugas: SEQ (Q1–Q4).
   Bantuan hanya: "Apa yang akan Anda lakukan bila sendirian?" / "Silakan lanjut ke tugas berikutnya."
5. **SUS (3 mnt).** Isi lembar SUS tanpa diskusi.
6. **Debriefing (5 mnt).** "Apa yang paling menyulitkan? Apa yang paling membantu? Bila bisa mengubah satu hal?"
7. **Penutup.** Ucapan terima kasih; jelaskan penggunaan data & hak menarik diri; hentikan rekaman.

Uji **pilot** 1 sesi per kelompok (A, B) sebelum sesi resmi untuk menyempurnakan skenario & waktu (data pilot tidak dianalisis).

## 8. Formulir Persetujuan Peserta (Informed Consent)

> **Persetujuan Mengikuti Uji Kegunaan Sistem Informasi SPMI**
>
> Saya yang bertanda tangan di bawah ini menyatakan telah memperoleh penjelasan bahwa:
>
> 1. **Tujuan:** menilai kemudahan penggunaan SPMI untuk perbaikan sistem. Yang dinilai adalah sistem, bukan kinerja saya,
>    dan hasilnya **tidak** memengaruhi penilaian kepegawaian/akademik saya.
> 2. **Data yang dikumpulkan:** rekaman layar, rekaman suara, catatan pengamatan, waktu pengerjaan, jawaban kuesioner,
>    serta data latar (peran, lama pengalaman AMI). Wajah **tidak** direkam kecuali saya setujui (☐ setuju direkam wajah).
> 3. **Penggunaan:** dianalisis oleh tim LPM dan pengembang SPMI; laporan hanya memuat **kode peserta** (mis. A03) dan kutipan
>    tanpa identitas.
> 4. **Penyimpanan & retensi:** rekaman disimpan terenkripsi di penyimpanan institusi dengan akses terbatas, **dihapus paling lambat
>    6 bulan** setelah laporan final; lembar persetujuan disimpan terpisah dari data hasil.
> 5. **Hak saya** (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi): mengikuti secara sukarela, berhenti kapan saja tanpa
>    konsekuensi, meminta akses, perbaikan, atau **penghapusan** data saya melalui `lpm@universitaspahlawan.ac.id`, dan menarik
>    persetujuan sebelum laporan final diterbitkan.
> 6. Selama uji saya hanya memakai **akun & data fiktif** yang disediakan.
>
> ☐ Saya setuju mengikuti uji ☐ Saya setuju direkam (layar & suara)
>
> Nama: ____________________ Tanda tangan: __________ Tanggal: __________ Kode peserta: ______
>
> Fasilitator: ______________ Tanda tangan: __________

## 9. Penanganan Data (UU 27/2022 PDP)

| Aspek            | Ketentuan                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dasar pemrosesan | Persetujuan eksplisit peserta (Pasal 20 ayat 2 huruf a)                                                                         |
| Minimalisasi     | Hanya data di §8 butir 2; tidak meminta NIDN/NIP; akun uji fiktif                                                               |
| Pseudonimisasi   | Kode peserta `A01…D05`; tabel pemetaan kode ↔ nama disimpan terpisah, hanya oleh koordinator LPM, dihapus setelah laporan final |
| Penyimpanan      | Folder institusi terenkripsi (bukan perangkat pribadi/WhatsApp); akses: fasilitator, pencatat, analis                           |
| Retensi          | Rekaman ≤ 6 bulan setelah laporan; data agregat & kutipan anonim boleh disimpan permanen                                        |
| Data produksi    | Dilarang; bila peserta tak sengaja membuka SPMI produksi, hentikan rekaman bagian tersebut                                      |
| Insiden          | Kebocoran rekaman ditangani sesuai [legal/INSIDEN-DATA.md](../../legal/INSIDEN-DATA.md)                                         |
| RoPA             | Tambahkan aktivitas "Uji kegunaan SPMI" ke [legal/RoPA.md](../../legal/RoPA.md) sebelum sesi pertama (⏳ pemilik dokumen legal) |

## 10. Lembar Observasi (per tugas)

| Kode peserta | Tugas | Mulai | Selesai | Durasi | Sukses (Y/T) | Kesalahan kritis | Kesalahan non-kritis | Bantuan? | SEQ | Catatan / kutipan |
| ------------ | ----- | ----- | ------- | ------ | ------------ | ---------------- | -------------------- | -------- | --- | ----------------- |
|              |       |       |         |        |              |                  |                      |          |     |                   |

## 11. Jadwal (usulan)

| Minggu | Kegiatan                                                             |
| ------ | -------------------------------------------------------------------- |
| M1     | Siapkan lingkungan & seed data; rekrut peserta; tambahkan RoPA       |
| M2     | Pilot (2 sesi), revisi skenario                                      |
| M3–M4  | Sesi resmi kelompok A & D (13 sesi), B & C (9–11 sesi)               |
| M5     | Analisis, laporan (format ISO/IEC 25066), presentasi ke LPM          |
| M6+    | Perbaikan, evaluasi ulang ringkas (5 peserta kelompok A) & SUS ulang |

Disarankan dilaksanakan **sebelum siklus AMI berikutnya dibuka** agar perbaikan HE-01/HE-02/HE-08 dapat dinikmati auditee.

## 12. Kriteria Penerimaan Hasil

- Tugas kritis: sukses ≥ 90% (gabungan) dan 0 kesalahan kritis.
- SUS rata-rata tiap kelompok **≥ 68**; target **≥ 75**.
- Tidak ada masalah UT severity 4; masalah severity 3 memiliki rencana perbaikan bertanggal.
- Hasil dicatat sebagai bukti KNF-17 (diusulkan) di [../29119-PENGUJIAN/TRACEABILITY.md](../29119-PENGUJIAN/TRACEABILITY.md).
