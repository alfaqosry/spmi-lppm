# 03 — Antarmuka HTTP (API)

## 1. Ringkasan

SPMI **tidak menyediakan REST API publik**. Antarmuka utama antara browser dan server adalah
**Server Actions** Next.js (`src/lib/actions/*.ts`) yang dipanggil oleh form React. Selain itu terdapat
sejumlah kecil **Route Handler internal** di `src/app/api/**` untuk kebutuhan yang tidak cocok dengan
Server Actions: alur redirect OAuth, unduhan berkas biner (PDF), dan pemantauan.

| Endpoint            | Metode | Autentikasi                                                             | Status implementasi                       |
| ------------------- | ------ | ----------------------------------------------------------------------- | ----------------------------------------- |
| `/api/sso/redirect` | GET    | Publik                                                                  | Ada — `src/app/api/sso/[...sso]/route.ts` |
| `/api/sso/callback` | GET    | Publik (OAuth `code`)                                                   | Ada                                       |
| `/api/sso/logout`   | GET    | Publik                                                                  | Ada                                       |
| `/api/export`       | GET    | Sesi; keseluruhan: LPM/superadmin, per unit: LPM atau anggota unit tsb. | Ada — `src/app/api/export/route.ts`       |
| `/api/health`       | GET    | Publik                                                                  | Sedang ditambahkan                        |
| `/api/me/export`    | GET    | Sesi (semua peran)                                                      | Sedang ditambahkan                        |
| `/api/files/*`      | GET    | Sesi + otorisasi per berkas                                             | Sedang ditambahkan                        |

> Endpoint berlabel _sedang ditambahkan_ didokumentasikan sesuai kontrak yang direncanakan.
> Verifikasi ulang terhadap implementasi final sebelum rilis.

## 2. Konvensi Umum

- **Basis URL produksi:** `https://spmi.universitaspahlawan.ac.id`
- **Autentikasi:** cookie sesi `__Host-lpm_session` (produksi) / `lpm_session` (pengembangan), JWT HS256,
  `httpOnly`, `SameSite=Lax`. Tidak ada token Bearer / API key. Lihat [ADR-0004](adr/0004-jwt-cookie-session.md).
- **Otorisasi:** peran dibaca ulang dari database setiap permintaan (`getCurrentUser`, `src/lib/auth.ts`).
  Akun nonaktif diperlakukan sebagai tidak login.
- **Format error (Route Handler):** JSON dengan satu properti `error` berisi pesan aman berbahasa Indonesia:

  ```json
  { "error": "Akses ditolak" }
  ```

  Detail teknis tidak pernah dikirim ke klien (dicatat di log server).

- **Cache:** respons berisi data pribadi/laporan memakai `Cache-Control: no-store`.
- **Header keamanan** (CSP, HSTS, X-Frame-Options, nosniff) diterapkan ke semua rute oleh `next.config.ts`.

## 3. Endpoint SSO — `/api/sso/*`

Diimplementasikan dengan `createSSORouteHandlers` dari paket `@alfaqosry/sso-client-next/next`,
dibungkus `src/app/api/sso/[...sso]/route.ts`. Konfigurasi dibaca dari `getSsoRuntimeConfig()`
(`src/lib/sso.ts`; DB `app_settings` menimpa variabel `SSO_*`). Metode GET dan POST diterima.

### 3.1 `GET /api/sso/redirect`

Memulai OAuth 2.0 Authorization Code Flow.

| Kondisi                                   | Respons                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SSO nonaktif atau Client ID/Secret kosong | `307` → `/login?sso_error=konfigurasi`                                                               |
| Normal                                    | `307` → `{sso.url}/oauth/authorize?client_id=…&redirect_uri=…&response_type=code&scope=…[&prompt=…]` |

### 3.2 `GET /api/sso/callback?code=…`

Menukar `code` menjadi token, mengambil `userinfo`, menyinkronkan akun lokal (lihat
[01-PERANCANGAN.md §8.2](01-PERANCANGAN.md#82-login-sso-up)), lalu membuat sesi aplikasi.

| Kondisi                      | Respons                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Sukses                       | `307` → `/dashboard` + `Set-Cookie` sesi aplikasi, `sso_session`, `sso_access_token` |
| Parameter `error` dari SSO   | `400` `{ "error": "SSO authorization denied: <kode>" }`                              |
| Tanpa `code`                 | `400` `{ "error": "Missing authorization code in query parameters" }`                |
| Gagal tukar token / userinfo | `500` `{ "error": "<pesan dari pustaka>" }`                                          |
| SSO belum dikonfigurasi      | `307` → `/login?sso_error=konfigurasi`                                               |

> Catatan: pesan error `400/500` di atas berasal dari pustaka pihak ketiga (bahasa Inggris, dan untuk `500`
> dapat memuat teks respons server SSO). Lihat daftar temuan di [README](README.md#temuan-terbuka).

### 3.3 `GET /api/sso/logout`

Menghapus cookie `sso_session` dan `sso_access_token`, lalu `307` → `/dashboard`.
**Tidak** menghapus cookie sesi aplikasi. Logout pengguna dari UI memakai Server Action `logoutAction`
(`src/lib/actions/auth.ts`), yang menghapus cookie sesi aplikasi **dan** cookie SSO lalu redirect ke `/login`.

## 4. Ekspor Laporan PDF — `GET /api/export`

Sumber: `src/app/api/export/route.ts`, data `src/lib/report/data.ts`, render `src/lib/report/pdf.ts`
(keseluruhan) dan `src/lib/report/pdf-unit.ts` (per unit).

| Parameter query | Wajib | Keterangan                                                                                                          |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `cycleId`       | Ya    | ID siklus audit                                                                                                     |
| `unitId`        | Tidak | Bila diisi → laporan per unit (tabel observasi: No, Standar, Pertanyaan, Hasil Observasi, Y\*, T\*, Catatan Khusus) |

Contoh: `GET /api/export?cycleId=3` · `GET /api/export?cycleId=3&unitId=12`

Otorisasi:

- **Laporan keseluruhan** (tanpa `unitId`): hanya `lpm_admin`, `lpm_member`, `superadmin`.
- **Laporan per unit**: pengguna LPM untuk semua unit; Kepala/Anggota Unit **hanya** untuk unit tempat ia ditempatkan
  (`canReadUnit`, `src/lib/guards.ts`). `pengunjung` selalu ditolak.
- Dibatasi **10 permintaan/menit per pengguna** (`LIMITS_RL.export`, `src/lib/ratelimit.ts`).
- Setiap ekspor dicatat di log aktivitas (`report.export` / `report.export_unit`).

| Status | Kondisi                                                        | Badan                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | Sukses                                                         | `application/pdf`, `Content-Disposition: attachment; filename="Laporan_Audit_SPMI_<siklus>.pdf"` atau `"Laporan_Unit_<unit>_<siklus>.pdf"`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` |
| `400`  | `cycleId` kosong/tidak valid, atau `unitId` tidak valid        | `{ "error": "cycleId wajib diisi." }` / `{ "error": "unitId tidak valid." }`                                                                                                                                      |
| `401`  | Tanpa sesi valid                                               | `{ "error": "Sesi tidak valid. Silakan masuk kembali." }`                                                                                                                                                         |
| `403`  | Pengunjung; auditee meminta laporan keseluruhan atau unit lain | `{ "error": "Akses ditolak." }`                                                                                                                                                                                   |
| `404`  | Siklus (atau unit) tidak ditemukan                             | `{ "error": "Siklus tidak ditemukan." }` / `{ "error": "Siklus atau unit tidak ditemukan." }`                                                                                                                     |
| `429`  | Melebihi batas laju                                            | `{ "error": "..." }` + header `Retry-After`                                                                                                                                                                       |
| `500`  | Gagal membuat PDF                                              | `{ "error": "Gagal membuat laporan. Silakan coba lagi." }` (detail di log server)                                                                                                                                 |
| `503`  | Mode pemeliharaan aktif (selain superadmin)                    | `{ "error": "Sistem sedang dalam pemeliharaan." }`                                                                                                                                                                |

Semua respons error dibentuk `jsonError()` (`src/lib/errors.ts`): `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`.

## 5. Pemeriksaan Kesehatan — `GET /api/health` _(sedang ditambahkan)_

Dipakai oleh `scripts/deploy/smoke-test.ps1` dan pemantauan eksternal. Tidak memerlukan autentikasi
dan tidak boleh membocorkan detail konfigurasi.

| Status | Kondisi                   | Badan                                                      |
| ------ | ------------------------- | ---------------------------------------------------------- |
| `200`  | Aplikasi & database sehat | `{ "status": "ok", "db": "ok", "version": "1.0.0" }`       |
| `503`  | Database tidak terjangkau | `{ "status": "error", "db": "error", "version": "1.0.0" }` |

`version` diambil dari `package.json`. Header `Cache-Control: no-store`.

## 6. Ekspor Data Pribadi — `GET /api/me/export` _(sedang ditambahkan)_

Memenuhi hak subjek data untuk memperoleh salinan data pribadinya (UU 27/2022 Pasal 7 dan 13).

| Status | Kondisi          | Badan                                                                                                                                                                                                                        |
| ------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | Login            | `application/json` (lampiran `attachment`): profil akun (tanpa hash kata sandi), penempatan unit, riwayat login milik pengguna, aktivitas milik pengguna, jawaban/verifikasi yang dibuat pengguna; `Cache-Control: no-store` |
| `401`  | Tanpa sesi valid | `{ "error": "..." }`                                                                                                                                                                                                         |

## 7. Unduhan Berkas — `GET /api/files/*` _(sedang ditambahkan)_

Menggantikan penyajian langsung dari `public/uploads/` agar bukti audit dan dokumen hanya dapat diunduh
oleh pengguna berwenang. Lihat [ADR-0006](adr/0006-private-upload-storage.md).

| Status | Kondisi                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | Berkas ditemukan dan pengguna berwenang. `Content-Type: application/pdf`, `X-Content-Type-Options: nosniff`, `Content-Disposition` aman, `Cache-Control: private, no-store` |
| `401`  | Tanpa sesi valid                                                                                                                                                            |
| `403`  | Sesi valid tetapi tidak berhak (mis. auditee meminta bukti unit lain)                                                                                                       |
| `404`  | Berkas tidak ada atau path tidak valid (path traversal ditolak sebagai 404)                                                                                                 |

Aturan otorisasi yang diharapkan: bukti (`bukti/`) → pengguna LPM/superadmin atau anggota unit pemilik
jawaban; dokumen Penetapan/Evaluasi → semua pengguna selain `pengunjung`. Aset branding (logo/favicon)
tetap publik.

## 8. Server Actions (antarmuka utama)

Server Actions bukan API publik: ID action di-_hash_ per build, hanya dapat dipanggil dari origin yang
sama (Next.js memeriksa header `Origin`), dan kontraknya dapat berubah setiap rilis. Seluruh action
mengembalikan `{ ok?: boolean; error?: string }` dengan pesan aman (`toActionError`).

| Modul (berkas) | Action                                                                                                                                                     | Peran yang diizinkan                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `auth.ts`      | `loginAction`, `logoutAction`                                                                                                                              | publik / login                            |
| `profile.ts`   | `changePasswordAction`                                                                                                                                     | login                                     |
| `cycles.ts`    | `createCycle`, `updateCycle`, `setActiveCycle`, `deactivateCycle`, `deleteCycle`                                                                           | `lpm_admin`, `superadmin`                 |
| `units.ts`     | `createUnit`, `updateUnit`, `deleteUnit`, `createAccount`, `updateAccount`, `deleteAccount`, `assignMember`, `removeMember`, `setLpmHead`, `unsetLpmHead`  | `lpm_admin`, `superadmin`                 |
| `documents.ts` | `createDocument`, `deleteDocument`                                                                                                                         | LPM + `superadmin`                        |
| `questions.ts` | `createStandard`, `updateStandard`, `deleteStandard`, `createQuestion`, `createQuestionsBulk`, `updateQuestion`, `deleteQuestion`                          | LPM + `superadmin`                        |
| `responses.ts` | `saveResponse`, `saveRtl`                                                                                                                                  | pengguna yang ditempatkan di unit terkait |
| `responses.ts` | `verifyResponse`                                                                                                                                           | LPM + `superadmin`                        |
| `settings.ts`  | `saveGeneralSettings`, `uploadBranding`, `clearBranding`, `testSsoConnection`, `purgeLoginLogs`, `clearActivityLogs`, `clearLoginLogs`, `createSuperadmin` | `superadmin`                              |

## 9. OpenAPI — Tidak Berlaku (N/A)

Spesifikasi OpenAPI **tidak disusun** karena:

1. Tidak ada konsumen eksternal; seluruh klien adalah antarmuka web SPMI sendiri.
2. Server Actions tidak memiliki URL/kontrak stabil sehingga tidak dapat dideskripsikan secara bermakna dengan OpenAPI.
3. Route Handler yang ada bersifat internal (redirect OAuth, unduhan biner, health check) dan telah dirinci di dokumen ini.

Keputusan ini ditinjau ulang bila ada kebutuhan integrasi (mis. sinkronisasi dengan SIAKAD, Monev, atau aplikasi LPPM).

## 10. Kebijakan Versi & Deprecation (bila API publik diperkenalkan)

1. Semua endpoint publik berada di bawah prefiks **`/api/v1/`**; rute internal yang ada tidak dipindahkan.
2. Kontrak didefinisikan dengan **OpenAPI 3.1** di `docs/openapi/v1.yaml` dan divalidasi di CI.
3. Autentikasi memakai token terpisah (OAuth2 client credentials atau API key per klien), **bukan** cookie sesi.
4. Perubahan kompatibel (field baru opsional, endpoint baru) → tetap `v1`. Perubahan tidak kompatibel → `v2`.
5. Versi lama didukung minimal **6 bulan** setelah versi baru rilis; selama itu respons membawa header
   `Deprecation: true`, `Sunset: <tanggal RFC 9110>`, dan `Link: <…/v2/…>; rel="successor-version"`.
6. Format error publik mengikuti RFC 9457 (`application/problem+json`).
7. Pembatasan laju per klien dan pencatatan akses wajib untuk semua endpoint publik.
