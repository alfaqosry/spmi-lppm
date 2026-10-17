# ADR-0006: Penyimpanan Unggahan Privat di Luar `public/`

- **Status:** Diterima (implementasi sedang berlangsung)
- **Tanggal:** 2026-10-17

## Konteks

Versi awal menyimpan bukti audit dan dokumen di `public/uploads/<folder>/` (`src/lib/upload.ts`) sehingga setiap berkas
dapat diunduh **tanpa login** oleh siapa pun yang mengetahui URL-nya. Nama berkas memuat timestamp + potongan UUID,
tetapi URL dapat bocor lewat riwayat browser, log proxy, atau penerusan tautan. Bukti audit dapat memuat data pribadi
(nama, NIDN, SK, data mahasiswa) sehingga termasuk cakupan UU 27/2022 (PDP). Selain itu `public/` berada di dalam folder
rilis yang diganti setiap deploy.

Pengamanan yang sudah ada tetap dipertahankan: whitelist folder (`bukti`, `penetapan`, `evaluasi`, `branding`),
whitelist ekstensi (PDF; gambar tanpa SVG untuk branding), verifikasi _magic bytes_, batas ukuran 10 MB / 2 MB,
nama berkas acak, dan pemeriksaan bahwa path tetap di dalam root unggahan.

## Keputusan

1. Berkas **privat** (bukti, penetapan, evaluasi) disimpan di **`UPLOAD_DIR`** di luar web root —
   produksi: `E:\www\spmi-prod\shared\storage\uploads` (ACL terbatas, tidak terganti saat deploy).
2. Berkas privat hanya disajikan melalui **`GET /api/files/*`** yang memeriksa sesi dan otorisasi per berkas
   (bukti: LPM/superadmin atau anggota unit pemilik jawaban; dokumen: pengguna selain `pengunjung`), dengan
   `Content-Type` tetap, `X-Content-Type-Options: nosniff`, `Content-Disposition` aman, dan `Cache-Control: private, no-store`.
   Indeks `documents.file_path` dan `audit_responses.evidence_file` mendukung pencarian otorisasi.
3. Aset **publik** (logo, favicon, gambar OG) tetap di `public/uploads/branding` yang di-junction ke
   `shared\public-uploads` agar bertahan antar rilis.
4. Berkas lama di `public/uploads/{bukti,penetapan,evaluasi}` dimigrasikan ke `UPLOAD_DIR` dan path di DB diperbarui.
5. Backup harian me-_mirror_ kedua lokasi (`scripts/deploy/backup.ps1`).

## Konsekuensi

**Positif**

- Bukti audit tidak dapat diakses publik; akses dapat dibatasi per unit.
- Berkas bertahan antar rilis; rollback aplikasi tidak menghapus unggahan.
- Header unduhan yang konsisten mencegah eksekusi konten (stored XSS) walau validasi unggah terlewati.

**Negatif / risiko**

- Unduhan melewati Node.js (bukan disajikan statis oleh IIS) — beban kecil untuk volume SPMI.
- Perlu migrasi berkas lama dan pembaruan tautan di UI (`audit-workspace.tsx`, `document-manager.tsx`).
- Hapus dokumen sudah menghapus berkas fisiknya (`deleteUpload`), tetapi penghapusan jawaban/standar/siklus/unit belum → perlu pembersihan berkas yatim
  sesuai retensi [legal/RoPA.md](../legal/RoPA.md).
- Penyimpanan objek (S3/MinIO) dapat dipertimbangkan bila volume tumbuh; antarmuka `saveUpload` tetap.
