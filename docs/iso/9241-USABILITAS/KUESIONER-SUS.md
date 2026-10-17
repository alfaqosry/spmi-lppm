# Kuesioner SUS & SEQ — SPMI

Instrumen kepuasan untuk [RENCANA-UJI-USABILITAS](RENCANA-UJI-USABILITAS.md). **SUS** (System Usability Scale,
Brooke 1996) — 10 butir standar; terjemahan mengacu pada adaptasi Bahasa Indonesia yang telah divalidasi
(Sharfina & Santoso, 2016) dengan penyesuaian kata "sistem". **SEQ** (Single Ease Question, Sauro) — 1 butir setelah
setiap tugas. Jangan mengubah urutan atau kalimat butir SUS agar skor dapat dibandingkan.

---

## 1. Lembar SUS (cetak — 1 halaman)

**Kode peserta:** ________ **Kelompok:** ☐ A Auditee ☐ B LPM ☐ C Superadmin ☐ D Pengunjung **Tanggal:** ____________

Petunjuk: Beri tanda **✓** pada satu kotak di setiap baris sesuai pengalaman Anda menggunakan **Sistem Informasi SPMI**
hari ini. Jawab segera; jangan terlalu lama memikirkan satu butir. Bila tidak yakin, pilih **3**.

| No  | Pernyataan                                                                         | 1 Sangat tidak setuju | 2 Tidak setuju | 3 Netral | 4 Setuju | 5 Sangat setuju |
| --- | ---------------------------------------------------------------------------------- | :-------------------: | :------------: | :------: | :------: | :-------------: |
| 1   | Saya berpikir akan menggunakan sistem ini lagi.                                    |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 2   | Saya merasa sistem ini rumit untuk digunakan.                                      |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 3   | Saya merasa sistem ini mudah digunakan.                                            |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 4   | Saya membutuhkan bantuan dari orang teknis untuk dapat menggunakan sistem ini.     |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 5   | Saya merasa fitur-fitur sistem ini berjalan dengan semestinya (terintegrasi baik). |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 6   | Saya merasa ada banyak hal yang tidak konsisten pada sistem ini.                   |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 7   | Saya merasa orang lain akan memahami cara menggunakan sistem ini dengan cepat.     |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 8   | Saya merasa sistem ini membingungkan.                                              |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 9   | Saya merasa tidak ada hambatan dalam menggunakan sistem ini.                       |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |
| 10  | Saya perlu membiasakan diri terlebih dahulu sebelum menggunakan sistem ini.        |           ☐           |       ☐        |    ☐     |    ☐     |        ☐        |

Komentar (opsional): ____________________________________________________________________________

> Butir di atas mengikuti adaptasi Sharfina & Santoso (2016). Bila tim memilih terjemahan harfiah Brooke, gunakan
> **satu** versi secara konsisten di seluruh sesi dan catat versinya di laporan.

## 2. Rumus Penilaian

Untuk setiap peserta (_r_ᵢ = jawaban butir _i_, 1–5):

- Butir **ganjil** (1, 3, 5, 7, 9 — positif): kontribusi = _r_ᵢ − 1
- Butir **genap** (2, 4, 6, 8, 10 — negatif): kontribusi = 5 − _r_ᵢ
- **Skor SUS = (Σ kontribusi) × 2,5** → rentang 0–100

Contoh: jawaban 4,2,4,1,4,2,5,2,4,2 → ganjil (3+3+3+4+3)=16, genap (3+4+3+3+3)=16 → (16+16)×2,5 = **80,0**.

Butir kosong: bila ≤ 1 butir kosong, isi dengan 3 (netral) dan catat; bila > 1, keluarkan lembar dari analisis.

Formula spreadsheet (jawaban di B2:K2):
`=((B2-1)+(5-C2)+(D2-1)+(5-E2)+(F2-1)+(5-G2)+(H2-1)+(5-I2)+(J2-1)+(5-K2))*2.5`

### Interpretasi

| Skor SUS  | Kategori (Bangor dkk., 2009) | Grade (Sauro-Lewis) | Penerimaan     | Sasaran SPMI            |
| --------- | ---------------------------- | ------------------- | -------------- | ----------------------- |
| ≥ 85      | Excellent                    | A+                  | Acceptable     |                         |
| 80,3–84,9 | Good+ / Excellent            | A                   | Acceptable     |                         |
| 75–80,2   | Good                         | B/A−                | Acceptable     | **Target ≥ 75**         |
| 68–74,9   | OK / Good                    | C                   | Marginal-high  | **Batas minimum ≥ 68**  |
| 51–67,9   | OK                           | D                   | Marginal-low   | Gagal — perbaikan wajib |
| < 51      | Poor                         | F                   | Not acceptable | Gagal                   |

Laporkan **rata-rata, median, simpangan baku, dan interval kepercayaan 90%** per kelompok (sampel kecil → gunakan
_t_-distribution). Jangan melaporkan skor per butir sebagai persentase.

## 3. SEQ — Setelah Setiap Tugas

Dibacakan/diberikan segera setelah peserta menyelesaikan (atau menyerah pada) satu tugas.

**Kode peserta:** ________ **Tugas:** ________

| Pertanyaan                                                                          | 1 Sangat sulit |  2  |  3  |  4  |  5  |  6  | 7 Sangat mudah |
| ----------------------------------------------------------------------------------- | :------------: | :-: | :-: | :-: | :-: | :-: | :------------: |
| **Q1.** Secara keseluruhan, seberapa sulit atau mudah tugas ini untuk diselesaikan? |       ☐        |  ☐  |  ☐  |  ☐  |  ☐  |  ☐  |       ☐        |

Pertanyaan pendamping (opsional, jawaban singkat — tidak diskor):

- **Q2.** Apa yang paling menyulitkan pada tugas ini? __________________________________
- **Q3.** Seberapa yakin Anda bahwa tugas ini berhasil? ☐ Yakin ☐ Ragu ☐ Tidak yakin
- **Q4.** (Khusus T04/T06) Apakah Anda tahu batas waktu pengisian siklus ini? ☐ Ya, tanggal ______ ☐ Tidak tahu

Sasaran: rata-rata SEQ ≥ 5,5 per tugas (≥ 5,0 batas minimum); SEQ ≤ 4 pada > 30% peserta = masalah prioritas.

## 4. Templat Hasil

### 4.1 Rekap SUS per Peserta

| Kode | Kelompok | B1  | B2  | B3  | B4  | B5  | B6  | B7  | B8  | B9  | B10 | Skor SUS | Catatan |
| ---- | -------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | -------- | ------- |
| A01  | A        |     |     |     |     |     |     |     |     |     |     |          |         |
| A02  | A        |     |     |     |     |     |     |     |     |     |     |          |         |
| …    |          |     |     |     |     |     |     |     |     |     |     |          |         |
| B01  | B        |     |     |     |     |     |     |     |     |     |     |          |         |

### 4.2 Ringkasan per Kelompok

| Kelompok     | n   | Rata-rata | Median | SB  | IK 90% | Kategori | Memenuhi ≥ 68 | Memenuhi ≥ 75 |
| ------------ | --- | --------- | ------ | --- | ------ | -------- | ------------- | ------------- |
| A Auditee    |     |           |        |     |        |          | ☐             | ☐             |
| B LPM        |     |           |        |     |        |          | ☐             | ☐             |
| C Superadmin |     |           |        |     |        |          | ☐             | ☐             |
| D Pengunjung |     |           |        |     |        |          | ☐             | ☐             |
| **Gabungan** |     |           |        |     |        |          | ☐             | ☐             |

### 4.3 Rekap SEQ & Kinerja Tugas

| Tugas | n   | Sukses (%) | Median waktu | Target waktu | Rata-rata SEQ | Kesalahan kritis | Temuan terkait (HE-/UT-) |
| ----- | --- | ---------- | ------------ | ------------ | ------------- | ---------------- | ------------------------ |
| T01   |     |            |              | ≤ 45 dtk     |               |                  |                          |
| T02   |     |            |              | ≤ 30 dtk     |               |                  |                          |
| T04   |     |            |              | ≤ 90 dtk     |               |                  |                          |
| T05   |     |            |              | ≤ 60 dtk     |               |                  |                          |
| T06   |     |            |              | ≤ 2 mnt      |               |                  |                          |
| T09a  |     |            |              | ≤ 45 dtk     |               |                  |                          |
| T09b  |     |            |              | ≤ 90 dtk     |               |                  |                          |
| T12a  |     |            |              | ≤ 60 dtk     |               |                  |                          |
| T13   |     |            |              | ≤ 2 mnt      |               |                  |                          |
| T15   |     |            |              | ≤ 2 mnt      |               |                  |                          |

Status hasil: ⏳ **belum ada data** (uji belum dilaksanakan).
