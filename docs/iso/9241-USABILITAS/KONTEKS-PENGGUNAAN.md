# Konteks Penggunaan SPMI (ISO 9241-11 §5, ISO 9241-210 §7.2)

Konteks penggunaan = **pengguna, tujuan & tugas, sumber daya (peralatan), dan lingkungan**. Kegunaan
SPMI hanya bermakna bila diukur pada konteks ini. Sumber: [01-PERANCANGAN §2 & §7](../../01-PERANCANGAN.md#2-aktor-dan-peran),
[05-PANDUAN-PENGGUNA](../../05-PANDUAN-PENGGUNA.md), `src/components/layout/nav-items.ts`, halaman di `src/app/(dashboard)/**`.

## 1. Kelompok Pengguna

| Peran (`Role`)   | Label UI          | Perkiraan jumlah\* | Karakteristik                                                                                                      | Frekuensi pemakaian                                        |
| ---------------- | ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `superadmin`     | Superadmin        | 1–3                | Staf Puskom/TI; literasi teknis tinggi; paham SSO, log, keamanan                                                   | Jarang (konfigurasi awal, insiden, pemeliharaan)           |
| `lpm_admin`      | Admin LPM         | 2–4                | Pengelola LPM; literasi digital menengah–tinggi; menyiapkan siklus, unit, akun, Ketua LPM, laporan akreditasi      | Intensif di awal & akhir siklus; mingguan selama siklus    |
| `lpm_member`     | Anggota LPM       | 5–15               | Auditor internal (dosen bersertifikat AMI); memahami standar mutu; literasi digital beragam                        | Intensif menjelang batas waktu (verifikasi), lalu jarang   |
| `auditee_head`   | Kepala Unit       | 30–60              | Kaprodi, kepala biro/pusat; sibuk, multitugas, sering **rangkap jabatan**; bertanggung jawab atas kelengkapan unit | 1–2 kali per siklus, sesi panjang; kembali saat ada revisi |
| `auditee_member` | Anggota Unit      | 60–200             | Dosen/tendik pelaksana pengisian & pengunggah bukti; literasi digital beragam                                      | Beberapa sesi per siklus, sering dari ponsel               |
| `pengunjung`     | Pengunjung (Tamu) | tak terbatas       | Siapa pun yang login SSO pertama kali; belum punya peran                                                           | Sekali (lalu menunggu akses dari LPM)                      |

\* Perkiraan berdasarkan jumlah unit (Program Studi, Wakil Rektor, Pusat, Perpustakaan, Biro, Lembaga — `UNIT_CATEGORIES`
di `src/components/units/unit-manager.tsx`); **perlu dikonfirmasi LPM**.

Karakteristik umum: penutur Bahasa Indonesia (UI sepenuhnya Indonesia, `lang="id"`); usia ±25–60 tahun; sebagian
memakai kacamata baca/zoom; pengguna pembaca layar belum teridentifikasi tetapi didukung (WCAG 2.1 AA, KNF-09).

## 2. Tujuan dan Tugas Utama per Peran

| Kode | Tugas                                                          | Peran                    | Kekritisan | Rute / komponen                                                    |
| ---- | -------------------------------------------------------------- | ------------------------ | ---------- | ------------------------------------------------------------------ |
| T01  | Masuk via SSO UP atau email + kata sandi                       | semua                    | Tinggi     | `/login` — `src/components/auth/login-form.tsx`                    |
| T02  | Menyetujui Kebijakan Privasi (pertama kali / versi baru)       | semua                    | Tinggi     | `src/components/legal/consent-dialog.tsx`                          |
| T03  | Meminta akses (pengunjung)                                     | pengunjung               | Sedang     | `/no-access` — tautan `mailto:`                                    |
| T04  | Menjawab butir audit Ya + unggah bukti PDF / tautan            | auditee                  | Tinggi     | `/audit` — `AuditeeAuditWorkspace`, `ResponseForm`                 |
| T05  | Menjawab butir audit Tidak + alasan                            | auditee                  | Tinggi     | `/audit` — `ResponseForm`                                          |
| T06  | Menemukan butir "Perlu Revisi", memperbaiki / mengisi RTL      | auditee                  | Tinggi     | `/audit` — kotak RTL di `ResponseForm`                             |
| T07  | Memantau progres & mengunduh laporan unit                      | auditee                  | Sedang     | `/dashboard` (Dashboard Unit)                                      |
| T08  | Membaca dokumen Penetapan/Evaluasi                             | semua kecuali pengunjung | Sedang     | `/penetapan`, `/evaluasi` — `document-manager.tsx`                 |
| T09  | Memverifikasi jawaban (Sesuai / Minta Revisi + catatan)        | LPM                      | Tinggi     | `/audit` tab "Panel Verifikasi LPM" — `VerifikasiTab`, `VerifyRow` |
| T10  | Menyusun standar & butir pertanyaan dengan cakupan             | LPM                      | Tinggi     | `/audit` tab "Instrumen & Pertanyaan" — `InstrumenPanel`           |
| T11  | Mengunggah dokumen Penetapan/Evaluasi                          | LPM                      | Sedang     | `DocForm`                                                          |
| T12  | Melihat analitik & mengekspor laporan PDF (keseluruhan / unit) | LPM (+auditee unit)      | Tinggi     | `/analitik`, `GET /api/export`                                     |
| T13  | Membuat/mengaktifkan/menonaktifkan siklus                      | Admin LPM                | Tinggi     | `/siklus` — `cycle-manager.tsx`                                    |
| T14  | Mengelola unit audit                                           | Admin LPM                | Sedang     | `/unit` — `unit-manager.tsx`                                       |
| T15  | Membuat akun, menempatkan pada unit, menunjuk Ketua LPM        | Admin LPM                | Tinggi     | `/role-penempatan` — `account-manager.tsx`                         |
| T16  | Mengatur identitas, SSO, log, keamanan, pemeliharaan           | Superadmin               | Sedang     | `/pengaturan` — `settings-manager.tsx`                             |
| T17  | Mengubah kata sandi, mengunduh data pribadi                    | semua kecuali pengunjung | Rendah     | `/profil`, `GET /api/me/export`                                    |

## 3. Peralatan (Sumber Daya Teknis)

| Perangkat                       | Perkiraan pangsa\* | Peran dominan                  | Implikasi desain                                                          | Dukungan saat ini                                                                               |
| ------------------------------- | ------------------ | ------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Desktop kantor (Windows, 1080p) | 45%                | Admin LPM, Anggota LPM, tendik | Tabel lebar, banyak tab, unggah berkas dari folder jaringan               | Layout sidebar 268 px (`lg:`), tabel `min-w-[760px]` dengan scroll                              |
| Laptop pribadi (13–14")         | 30%                | Kepala Unit, auditor           | Layar sedang; Wi-Fi kampus                                                | Sama dengan desktop                                                                             |
| Ponsel Android/iOS (≥ 360 px)   | 25%                | Anggota Unit, Kepala Unit      | Unggah bukti dari galeri/Drive, jaringan seluler tak stabil, layar sentuh | Drawer menu, target sentuh ≥ 44 px (`pointer: coarse`), tanpa scroll horizontal di 320 px (E2E) |

Peramban: Chrome/Edge, Firefox, Safari (diuji Playwright 5 profil, `playwright.config.ts`). Teknologi bantu:
zoom 200% (E2E reflow), pembaca layar (NVDA/VoiceOver — belum diuji manual). \* Perkiraan, ganti dengan data
log `user_agent` di `login_logs` setelah 1 siklus berjalan.

## 4. Lingkungan

| Aspek      | Kondisi                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fisik      | Ruang kerja kantor/prodi (bising sedang, banyak interupsi); rumah; sela kegiatan mengajar (ponsel)                                                   |
| Jaringan   | Wi-Fi kampus & seluler 4G; latensi Cloudflare → IIS → Node; unggahan PDF hingga 10 MB sensitif terhadap koneksi lambat                               |
| Waktu      | Beban puncak **menjelang `end_date` siklus** (batas tutup 23:59:59 WIB, AB-02); verifikasi LPM menumpuk setelahnya                                   |
| Organisasi | AMI bersifat wajib dan berdampak akreditasi → tekanan tinggi; komunikasi revisi lewat catatan LPM; akses diberikan LPM manual (`/no-access` → email) |
| Sosial     | Kepala Unit mendelegasikan pengisian ke anggota; satu akun dapat menjadi anggota beberapa unit (rangkap jabatan, AB-13)                              |
| Regulasi   | UU 27/2022 PDP (persetujuan, hak subjek data — [legal/RoPA](../../legal/RoPA.md)); jejak audit (log login/aktivitas)                                 |

## 5. Sasaran Kegunaan Terukur

Sasaran mengikuti tiga dimensi ISO 9241-11. Diukur dalam uji moderasi ([RENCANA-UJI-USABILITAS](RENCANA-UJI-USABILITAS.md)),
lalu dipantau di produksi bila memungkinkan (log aktivitas, keluhan email LPM).

### 5.1 Efektivitas

| Metrik                                     | Target                                                                     | Cara ukur                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Tingkat keberhasilan tugas (tanpa bantuan) | **≥ 90%** per tugas kritis (T01, T02, T04–T06, T09, T12, T13, T15)         | Kriteria sukses per skenario; berhasil dengan bantuan = gagal  |
| Kesalahan kritis                           | **0** (mis. menghapus siklus/standar yang salah, mengekspor siklus keliru) | Observasi moderator                                            |
| Kesalahan non-kritis                       | ≤ 1 per tugas rata-rata                                                    | Observasi (salah klik, pesan validasi muncul, kembali-langkah) |
| Kelengkapan pengisian unit per siklus      | ≥ 95% unit berstatus `selesai` saat `end_date`                             | Data `unit_progress` (indikator produksi)                      |

### 5.2 Efisiensi (time-on-task, pengguna yang sudah dilatih singkat)

| Tugas | Deskripsi                                                                       | Target waktu (median) | Batas gagal |
| ----- | ------------------------------------------------------------------------------- | --------------------- | ----------- |
| T01   | Login SSO dari `/login` sampai dashboard (tanpa waktu ketik di SSO UP > 30 dtk) | ≤ 45 dtk              | > 3 mnt     |
| T02   | Menyetujui Kebijakan Privasi (tanpa membaca kebijakan lengkap)                  | ≤ 30 dtk              | > 2 mnt     |
| T04   | Menjawab 1 butir **Ya** + unggah PDF 2 MB                                       | ≤ 90 dtk              | > 5 mnt     |
| T05   | Menjawab 1 butir **Tidak** + alasan 1 kalimat                                   | ≤ 60 dtk              | > 3 mnt     |
| T06   | Menemukan 1 butir "Perlu Revisi" dan menyimpan RTL                              | ≤ 2 mnt               | > 6 mnt     |
| T09a  | Memverifikasi 1 butir sebagai Sesuai                                            | ≤ 45 dtk              | > 3 mnt     |
| T09b  | Meminta revisi 1 butir dengan catatan                                           | ≤ 90 dtk              | > 4 mnt     |
| T10   | Menambah 1 standar dan 3 butir untuk kategori "Biro"                            | ≤ 4 mnt               | > 10 mnt    |
| T12a  | Mengunduh laporan PDF keseluruhan untuk siklus **non-aktif** tertentu           | ≤ 60 dtk              | > 4 mnt     |
| T12b  | Mengunduh laporan PDF satu unit                                                 | ≤ 45 dtk              | > 3 mnt     |
| T13   | Membuat siklus baru dan menjadikannya aktif                                     | ≤ 2 mnt               | > 6 mnt     |
| T14   | Menambah satu unit                                                              | ≤ 60 dtk              | > 4 mnt     |
| T15   | Menempatkan akun Pengunjung hasil SSO sebagai Kepala Unit                       | ≤ 2 mnt               | > 6 mnt     |
| T16   | Mengaktifkan mode pemeliharaan dengan pesan                                     | ≤ 60 dtk              | > 4 mnt     |

Efisiensi relatif: waktu peserta ÷ waktu ahli (pengembang) ≤ 2,5×.

### 5.3 Kepuasan

| Metrik                                    | Batas minimum                 | Target                             | Instrumen                            |
| ----------------------------------------- | ----------------------------- | ---------------------------------- | ------------------------------------ |
| SUS (System Usability Scale) per kelompok | **≥ 68** (rata-rata industri) | **≥ 75** (baik)                    | [KUESIONER-SUS](KUESIONER-SUS.md) §1 |
| SEQ (Single Ease Question) per tugas      | ≥ 5,0 / 7                     | ≥ 5,5 / 7                          | [KUESIONER-SUS](KUESIONER-SUS.md) §3 |
| Keluhan kegunaan ke email LPM per siklus  | —                             | turun ≥ 50% dari siklus sebelumnya | Rekap LPM                            |

### 5.4 Aksesibilitas (pendukung kegunaan, ISO 9241-171 / WCAG 2.1 AA)

| Metrik                                                   | Target | Status v1.1.3                                                                |
| -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Pelanggaran axe serious/critical                         | 0      | ✅ 0 pada halaman publik (`tests/e2e/a11y.spec.ts`); ⏳ dashboard butuh akun |
| Lighthouse Accessibility                                 | ≥ 95   | ✅ 100                                                                       |
| Semua tugas T01–T17 dapat dilakukan dengan keyboard saja | 100%   | ⏳ belum diuji manual (hanya login di E2E)                                   |

> Usulan: masukkan §5 sebagai kebutuhan non-fungsional **KNF-17 (Kegunaan)** di
> [01-PERANCANGAN §4](../../01-PERANCANGAN.md#4-kebutuhan-non-fungsional); ditelusuri di
> [../29119-PENGUJIAN/TRACEABILITY.md](../29119-PENGUJIAN/TRACEABILITY.md).
