# Pemeriksaan Keamanan — SPMI LPM

Tanggal pemeriksaan: 25 November 2026
Metode: telaah dokumen `LAPORAN_KEAMANAN.md` (audit 16–20 Okt 2026), spot-check kode sumber, dan `npm audit --omit=dev`.
Sifat: **bukan pentest penuh**. Tidak ada pengujian runtime, fuzzing, atau uji penetrasi terhadap server produksi.

Skala: **Kritis / Tinggi / Sedang / Rendah / Info**

---

## 1. Ringkasan Status

Audit sebelumnya (Okt 2026) mencatat 11 temuan awal + 18 temuan lanjutan (B-1…B-18) + 8 temuan cakupan standar (C-1…C-8). Menurut dokumen, **semuanya sudah diperbaiki** kecuali risiko residual yang memang direncanakan.

Spot-check pada kode saat ini mengonfirmasi kontrol utama masih ada:

| Kontrol                                   | Bukti di kode                                                | Status    |
| ----------------------------------------- | ------------------------------------------------------------ | --------- |
| Security header (HSTS, XFO, nosniff)      | `next.config.ts:24-40`                                       | Terpasang |
| CSP berbasis nonce per permintaan         | `src/proxy.ts:71-74`                                         | Terpasang |
| `AUTH_SECRET` gagal-tertutup              | `src/lib/auth.ts:31-42` (wajib di produksi)                  | Terpasang |
| Guard RBAC di server action               | `src/lib/guards.ts`, dipakai di 9/14 berkas `actions/*`      | Terpasang |
| Rate limit, redaksi log, validasi         | `src/lib/ratelimit.ts`, `redact.ts`, `validate.ts`, `net.ts` | Ada       |
| `.env` / `.env.production` tak masuk repo | `.gitignore:7,9`; `git check-ignore` mengonfirmasi           | Aman      |

---

## 2. Temuan Baru (belum tercatat di laporan lama)

Semua berasal dari `npm audit` per 25 Nov 2026.

### 2.1 SheetJS `xlsx` 0.18.5 — Prototype Pollution + ReDoS (TINGGI, belum ada perbaikan)

- **Lokasi:** `src/lib/actions/instruments-import.ts:126` (`XLSX.read`), `src/components/audit/import-instruments-modal.tsx:97`, `src/lib/excel-template.ts`.
- **Dampak:** berkas Excel/CSV yang dibuka dengan `XLSX.read` dapat memicu prototype pollution dan ReDoS di sisi server saat impor instrumen.
- **Mitigasi yang sudah ada:** aksi memerlukan `requireLpm()` dan membatasi ukuran berkas 10 MB (`instruments-import.ts:108-121`). Jadi hanya pengguna berwenang yang dapat memicunya.
- **Risiko residual:** **Sedang–Tinggi** (butuh akun LPM; namun file berbahaya bisa berasal dari pihak ketiga yang mengirim template).
- **Rekomendasi:** ganti `xlsx` dengan pustaka yang aktif dipelihara (mis. `exceljs`) atau versi SheetJS resmi terbaru dari CDN resmi (npm `xlsx` sudah usang), atau isolasi parsing di proses/sandbox terpisah. Jalankan juga impor hanya dari sumber tepercaya.

### 2.2 Next.js 16 — 7 advisory (SEDANG, perbaikan tersedia)

Termasuk kebocoran cache lintas pengguna/root-param, eksposur cookie HttpOnly pada Edge route, dan injeksi respons lintas klien pada Next.js self-hosted.

- **Status:** `fixAvailable: true`. Perlu pembaruan patch Next.js.
- **Rekomendasi:** `npm audit fix` (non-breaking) atau naikkan `next` ke patch terbaru dalam major 16, lalu uji ulang.

### 2.3 Prisma CLI `deepmerge-ts`/`effect` (TINGGI, hanya tooling)

Sama seperti laporan lama: rantai `prisma` → `@prisma/config` → `deepmerge-ts`/`effect`. Hanya tooling CLI (membaca konfigurasi lokal), tidak terjangkau input pengguna saat runtime. **Risiko residual: Rendah.** Perbaikan butuh upgrade mayor Prisma 7.

---

## 3. Risiko Residual yang Masih Berlaku (dari laporan lama)

1. **Rate limit in-memory** (`src/lib/ratelimit.ts`) — hanya efektif selama PM2 `instances: 1`. Wajib Redis/DB bila di-scale.
2. **Cakupan standar vs perubahan kategori unit** — butir `unit` dapat tetap terlihat dengan nama standar kategori lama bila kategori unit dipindah (dampak rendah, integritas data).
3. **Keunikan nama standar per cakupan** hanya dijaga aplikasi (`FOR UPDATE`), bukan unique index DB.
4. **Penautan akun SSO berbasis email** mengasumsikan email SSO institusi terverifikasi.
5. **Cloudflare Rocket Loader / Email Obfuscation** harus nonaktif agar tidak menyisipkan skrip inline tanpa nonce (akan diblok CSP).
6. **`style-src 'unsafe-inline'`** masih diperlukan untuk atribut style framer-motion/recharts — keterbatasan CSP yang diterima.

---

## 4. Rekomendasi Berprioritas

| Prioritas | Tindakan                                                                  | Alasan                                |
| --------- | ------------------------------------------------------------------------- | ------------------------------------- |
| 1         | Ganti/isolasi `xlsx`, atau batasi impor ke admin tepercaya + verifikasi   | Prototype pollution/ReDoS tanpa patch |
| 2         | Perbarui Next.js ke patch 16 terbaru                                      | 7 advisory, perbaikan tersedia        |
| 3         | Siapkan Redis/DB untuk rate limit sebelum scale-out                       | Limiter in-memory bisa di-bypass      |
| 4         | Jadwalkan upgrade Prisma 7                                                | Menutup advisory tooling              |
| 5         | Audit berkala `npm audit` di CI + nonaktifkan Rocket Loader di Cloudflare | Pencegahan regresi & CSP              |

---

## 5. Batasan Pemeriksaan

- Tidak ada pengujian runtime terhadap aplikasi berjalan atau server produksi.
- Tidak ada uji otorisasi per-endpoint secara menyeluruh; hanya spot-check keberadaan guard.
- Tidak ada pengujian unggahan berkas berbahaya secara langsung.
- Angka `npm audit` bergantung pada registry npm saat pemeriksaan dan dapat berubah.
- Klaim "Diperbaiki" pada laporan lama **tidak diverifikasi satu per satu**; yang diperiksa hanya kontrol utama di atas.

---

## 6. Kesimpulan

Postur keamanan aplikasi secara umum **baik**: header keamanan, CSP nonce, sesi ber-versi, RBAC server-side, unggahan privat, dan penanganan rahasia sudah tertangani. Dua hal yang perlu ditindaklanjuti segera adalah **pustaka `xlsx` yang rentan tanpa patch** dan **pembaruan Next.js**. Sisanya adalah risiko residual yang sudah diketahui dan terkelola.
