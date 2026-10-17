# ADR-0004: Sesi JWT di Cookie `httpOnly`

- **Status:** Diterima
- **Tanggal:** 2026-10-17

## Konteks

Aplikasi berjalan sebagai satu proses Node.js (PM2 fork) dan membutuhkan sesi untuk login lokal maupun SSO.
Tidak tersedia Redis. Peran dan penempatan pengguna dapat diubah Admin LPM kapan saja dan harus berlaku segera;
akun yang dinonaktifkan harus langsung kehilangan akses.

Alternatif: sesi di tabel DB, NextAuth/Auth.js, JWT stateless di cookie.

## Keputusan

- Sesi berupa **JWT HS256** ditandatangani `AUTH_SECRET` (pustaka `jose`), disimpan di cookie
  `__Host-lpm_session` (produksi) / `lpm_session` (dev) dengan `httpOnly`, `Secure` (produksi), `SameSite=Lax`, `Path=/`
  (`src/lib/auth.ts`).
- Masa berlaku = `security.sessionDays` (default 7 hari, diatur superadmin).
- `AUTH_SECRET` **wajib ≥ 32 karakter** di produksi; tanpa itu server menolak start (tidak ada fallback diam-diam).
- Payload JWT hanya dipakai untuk menemukan pengguna: **`getCurrentUser()` membaca ulang pengguna dari DB setiap
  permintaan** (peran, unit, status aktif terbaru). Akun nonaktif dianggap tidak login.
- Revokasi: kolom `users.session_version` dinaikkan saat logout, ganti kata sandi, atau ubah peran/status;
  token berversi lama ditolak. Rotasi `AUTH_SECRET` mencabut **semua** sesi.

## Konsekuensi

**Positif**

- Tanpa penyimpanan sesi tambahan; cocok untuk satu instance dan tetap dapat diskalakan horizontal.
- Prefiks `__Host-` mencegah _cookie tossing_ dari subdomain dan memaksa HTTPS.
- Perubahan hak akses berlaku pada permintaan berikutnya.

**Negatif / risiko**

- Satu kueri DB tambahan per permintaan (dapat diterima untuk skala SPMI).
- Cookie `Secure` mengharuskan HTTPS ujung-ke-ujung; build produksi via HTTP membuat login gagal
  (lihat [04-DEPLOYMENT-IIS.md §11](../04-DEPLOYMENT-IIS.md#11-troubleshooting)).
- Kebocoran `AUTH_SECRET` memungkinkan pemalsuan sesi → simpan hanya di `shared\.env` (ACL Administrators/SYSTEM) dan rotasi bila dicurigai bocor.
- `SameSite=Lax` + pemeriksaan Origin pada Server Actions menjadi pertahanan CSRF; jangan menambah endpoint GET yang mengubah data.
