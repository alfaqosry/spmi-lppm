# ADR-0003: Integrasi SSO UP melalui OAuth 2.0 (`@alfaqosry/sso-client-next`)

- **Status:** Diterima
- **Tanggal:** 2026-10-17

## Konteks

Sivitas Universitas Pahlawan sudah memiliki akun di **SSO UP** (`https://sso-v2.universitaspahlawan.ac.id`).
Aplikasi Webkampus lain (mis. LPPM) memakai paket klien `@alfaqosry/sso-client-next`. LPM juga membutuhkan
akun lokal (email + kata sandi) bagi pengguna tanpa akun SSO dan untuk akses darurat bila SSO tidak tersedia.
Peran SPMI (Admin LPM, Kepala Unit, dst.) tidak dikelola oleh SSO.

## Keputusan

1. Memakai **OAuth 2.0 Authorization Code Flow** melalui `createSSORouteHandlers` dari `@alfaqosry/sso-client-next/next`,
   dipasang sebagai catch-all `src/app/api/sso/[...sso]/route.ts` (`/redirect`, `/callback`, `/logout`).
2. SSO hanya sebagai **penyedia identitas**; setelah callback dibuat **sesi aplikasi sendiri** (ADR-0004) sehingga RBAC lokal berlaku.
3. Pencocokan akun: `username` (NIDN/NIM/NIP) → `email` → `sso_id`. Akun baru dibuat **otomatis sebagai `pengunjung`**.
4. **Klaim `role` dari SSO tidak dipercaya.** Hanya email pada daftar `sso.adminEmails` yang menjadi `lpm_admin`;
   pemetaan berbasis role SSO hanya bila `SSO_TRUST_ROLE=true` (`resolveLocalRole`, `src/lib/sso.ts`).
5. Konfigurasi (URL, Client ID/Secret, Redirect URI, scope, prompt) disimpan di `app_settings` dan diatur superadmin
   lewat UI; variabel `SSO_*` di `.env` menjadi _fallback_. Client Secret tidak pernah dikirim ke klien.
6. Login lokal tetap tersedia berdampingan.

## Konsekuensi

**Positif**

- Pengguna memakai kredensial kampus; SPMI tidak menyimpan kata sandi SSO mereka.
- Pemberian hak akses tetap di tangan LPM (_least privilege_ untuk akun baru).
- Kredensial SSO dapat dirotasi tanpa deploy ulang.

**Negatif / risiko**

- Paket v1.0.0 **tidak mengirim/memvalidasi parameter `state`** OAuth → rentan _login CSRF_. Perlu dibungkus
  (buat `state` acak di cookie `httpOnly`, validasi di callback) atau diperbaiki di paket.
- Paket menyimpan token & userinfo di cookie `sso_session` (base64, tidak terenkripsi) dan `sso_access_token`;
  atribut `Secure` pada `sso_session` tidak pernah aktif karena salah ketik `NODE_NODE_ENV` di paket. SPMI tidak memakai
  cookie ini — sebaiknya dihapus segera setelah callback.
- Error callback dikembalikan sebagai JSON mentah (bahasa Inggris; untuk `500` dapat memuat respons server SSO).
- `/api/sso/logout` hanya menghapus cookie SSO, bukan sesi aplikasi (logout UI memakai `logoutAction`).
- Ketergantungan pada ketersediaan SSO UP; mitigasi: login lokal untuk akun LPM.
- Redirect URI harus didaftarkan persis per lingkungan (lokal `http://localhost:3002/api/sso/callback`,
  produksi `https://spmi.universitaspahlawan.ac.id/api/sso/callback`).
