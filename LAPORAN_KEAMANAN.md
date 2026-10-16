# Laporan Audit Keamanan — SPMI LPM

Tanggal: 2026-10-16
Ruang lingkup: seluruh server actions, route handler, autentikasi, unggahan file, konfigurasi.

Skala: **Kritis / Tinggi / Sedang / Rendah**

---

## Ringkasan Temuan

| # | Tingkat | Temuan | Lokasi | Status |
|---|---------|--------|--------|--------|
| 1 | **Tinggi** | Path traversal + penulisan file sembarang lewat parameter `folder`/`type` pada unggahan | `src/lib/upload.ts`, `src/lib/actions/documents.ts` | Diperbaiki |
| 2 | **Tinggi** | Tidak ada validasi tipe file → bisa unggah HTML/SVG/JS ke `/public` (Stored XSS) | `src/lib/upload.ts` | Diperbaiki |
| 3 | **Tinggi** | `AUTH_SECRET` punya fallback hardcoded → pemalsuan JWT / bypass autentikasi bila env kosong | `src/lib/auth.ts` | Diperbaiki |
| 4 | **Sedang** | Pesan error Prisma bocor ke klien (`e.message`) di hampir semua action | `src/lib/actions/*.ts` | Diperbaiki |
| 5 | **Sedang** | `type` dokumen tidak divalidasi terhadap enum | `src/lib/actions/documents.ts` | Diperbaiki |
| 6 | **Sedang** | Tidak ada security header (CSP, X-Frame-Options, nosniff, HSTS) | `next.config.ts` | Diperbaiki |
| 7 | **Sedang** | Tidak ada pembatasan percobaan login (brute force) | `src/lib/actions/auth.ts` | Diperbaiki |
| 8 | **Sedang** | Peran dari SSO dipercaya apa adanya (`role` → `lpm_admin`) | `src/lib/sso.ts` | Diperbaiki |
| 9 | **Rendah** | Tautan bukti/dokumen tidak divalidasi skemanya (`javascript:` sudah diblok React 19, `data:` belum) | `responses.ts`, `documents.ts` | Diperbaiki |
| 10 | **Rendah** | Kebijakan kata sandi lemah (min 6 karakter akun baru) | `units.ts` | Diperbaiki |
| 11 | **Rendah** | Cookie sesi tanpa prefix `__Host-` / bergantung `NODE_ENV` | `src/lib/auth.ts` | Diperbaiki |

---

## Detail

### 1. Path Traversal + Arbitrary File Write (TINGGI)
`createDocument` mengambil `type` mentah dari form lalu meneruskannya ke
`saveUpload(file, type)`. Di `saveUpload`, nilai itu dipakai apa adanya pada
`path.join(process.cwd(), "public", "uploads", folder)`.
Dengan `type="../../../../tmp/evil"`, file tertulis di luar folder unggahan.
**Dampak:** penulisan file sembarang (dalam batas izin proses), berpotensi RCE bila
menimpa file yang dieksekusi.

### 2. Stored XSS via Unggahan (TINGGI)
Tidak ada pemeriksaan ekstensi/MIME. File `.html`, `.svg`, `.js` yang diunggah
disajikan dari `/public` pada origin aplikasi → eksekusi JavaScript di sesi korban.
Fungsi `isProbablyPdf` ada tetapi **tidak pernah dipakai**.

### 3. Fallback AUTH_SECRET (TINGGI)
`SECRET = encode(process.env.AUTH_SECRET || "lpm-spmi-dev-secret-change-me")`.
Bila env hilang di produksi, token sesi dapat dipalsukan siapa pun yang tahu nilai
default tersebut → **bypass autentikasi penuh**.

### 4. Kebocoran Pesan Error (SEDANG)
Semua action memakai `e.message` sebagai respons. Error Prisma membocorkan nama
model/field/kueri → membantu pemetaan internal.

### 5. Validasi Enum `type` (SEDANG)
`type` hanya di-cast `as DocumentType` tanpa validasi → nilai sembarang masuk DB
dan `revalidatePath`.

### 6. Security Header (SEDANG)
Tidak ada CSP/X-Frame-Options/nosniff/HSTS → clickjacking, MIME sniffing.

### 7. Brute Force Login (SEDANG)
Tidak ada pembatas percobaan; `loginAction` bisa dipecah kata sandi tanpa hambatan.

### 8. Kepercayaan Peran SSO (SEDANG — diperbaiki)
`resolveLocalRole` kini **tidak** mempercayai klaim `role` dari SSO. Hanya email
pada `SSO_ADMIN_EMAILS` yang menjadi `lpm_admin`. Klaim admin tanpa whitelist
email ditolak (jadi `pengunjung`) + dicatat ke log. Pemetaan berbasis role SSO
hanya aktif bila env `SSO_TRUST_ROLE=true` diset eksplisit.

### 9. Skema Tautan (RENDAH)
`href` tautan bukti/dokumen tidak divalidasi. React 19 sudah memblokir
`javascript:`; `data:` masih lolos → divalidasi ke `http(s)` saja.

### 10. Kebijakan Kata Sandi (RENDAH)
Akun baru min 6 karakter (ubah mandiri min 8). Dinaikkan menjadi min 8.

### 11. Cookie Sesi (RENDAH — diperbaiki)
Cookie sesi memakai prefix `__Host-` di produksi (memaksa Secure, path=/, tanpa
Domain) + `secure: true`. Cookie lama (tanpa prefix) ikut dihapus saat logout.

---

## Perbaikan yang Diterapkan
1. `src/lib/upload.ts`: whitelist folder, whitelist ekstensi, tolak ekstensi aktif
   (html/svg/js/xml/php/…), verifikasi signature PDF.
2. `src/lib/actions/documents.ts`: validasi enum `type` + validasi skema `link`.
3. `src/lib/auth.ts`: wajib `AUTH_SECRET` di produksi (fallback dev + peringatan).
4. `src/lib/errors.ts`: `AppError` + `toActionError` → pesan generik + log server.
5. Semua action: ganti `e.message` dengan `toActionError`.
6. `next.config.ts`: security header (CSP, X-Frame-Options, nosniff, HSTS, dst).
7. `src/lib/ratelimit.ts`: pembatas percobaan login (in-memory).
8. `responses.ts`: validasi skema `evidenceLink`.
9. `units.ts`: panjang minimal kata sandi 8.
