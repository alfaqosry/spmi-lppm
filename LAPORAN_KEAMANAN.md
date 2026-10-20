# Laporan Audit Keamanan — SPMI LPM

Tanggal: 2026-10-16
Ruang lingkup: seluruh server actions, route handler, autentikasi, unggahan file, konfigurasi.

Skala: **Kritis / Tinggi / Sedang / Rendah**

---

## Ringkasan Temuan

| #   | Tingkat    | Temuan                                                                                              | Lokasi                                              | Status     |
| --- | ---------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------- |
| 1   | **Tinggi** | Path traversal + penulisan file sembarang lewat parameter `folder`/`type` pada unggahan             | `src/lib/upload.ts`, `src/lib/actions/documents.ts` | Diperbaiki |
| 2   | **Tinggi** | Tidak ada validasi tipe file → bisa unggah HTML/SVG/JS ke `/public` (Stored XSS)                    | `src/lib/upload.ts`                                 | Diperbaiki |
| 3   | **Tinggi** | `AUTH_SECRET` punya fallback hardcoded → pemalsuan JWT / bypass autentikasi bila env kosong         | `src/lib/auth.ts`                                   | Diperbaiki |
| 4   | **Sedang** | Pesan error Prisma bocor ke klien (`e.message`) di hampir semua action                              | `src/lib/actions/*.ts`                              | Diperbaiki |
| 5   | **Sedang** | `type` dokumen tidak divalidasi terhadap enum                                                       | `src/lib/actions/documents.ts`                      | Diperbaiki |
| 6   | **Sedang** | Tidak ada security header (CSP, X-Frame-Options, nosniff, HSTS)                                     | `next.config.ts`                                    | Diperbaiki |
| 7   | **Sedang** | Tidak ada pembatasan percobaan login (brute force)                                                  | `src/lib/actions/auth.ts`                           | Diperbaiki |
| 8   | **Sedang** | Peran dari SSO dipercaya apa adanya (`role` → `lpm_admin`)                                          | `src/lib/sso.ts`                                    | Diperbaiki |
| 9   | **Rendah** | Tautan bukti/dokumen tidak divalidasi skemanya (`javascript:` sudah diblok React 19, `data:` belum) | `responses.ts`, `documents.ts`                      | Diperbaiki |
| 10  | **Rendah** | Kebijakan kata sandi lemah (min 6 karakter akun baru)                                               | `units.ts`                                          | Diperbaiki |
| 11  | **Rendah** | Cookie sesi tanpa prefix `__Host-` / bergantung `NODE_ENV`                                          | `src/lib/auth.ts`                                   | Diperbaiki |

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

---

# Audit Lanjutan — 17 Oktober 2026

Acuan: standar perangkat lunak institusi (OWASP Top 10 2021 / ASVS L2, UU 27/2022 PDP).
Topologi produksi: Cloudflare → IIS ARR → Next.js standalone (PM2, 127.0.0.1:3002), satu instance.

## A. Verifikasi 11 temuan sebelumnya

| #   | Temuan                  | Hasil verifikasi                                                                                                                                                        | Status                |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Path traversal unggahan | Whitelist folder bertahan; nama berkas kini 100% acak & path divalidasi ulang saat dibaca                                                                               | Bertahan + diperkuat  |
| 2   | Stored XSS via unggahan | Whitelist ekstensi + magic bytes bertahan. **Celah sisa:** berkas tetap disajikan langsung dari `/public` dan dapat diakses tanpa login                                 | Diperbaiki (B-3)      |
| 3   | Fallback AUTH_SECRET    | Bertahan (fail-closed di produksi); secret kini dimuat lazy                                                                                                             | Bertahan              |
| 4   | Kebocoran pesan error   | Bertahan untuk action, **tetapi** handler SSO bawaan paket mengirim `err.message` (termasuk isi respons token endpoint) ke klien; log konsol memuat objek error lengkap | Diperbaiki (B-4, B-9) |
| 5   | Validasi enum `type`    | Bertahan; validasi kini menyeluruh di semua action                                                                                                                      | Bertahan              |
| 6   | Security header         | Ada, tetapi CSP memakai `'unsafe-inline'` dan tanpa COOP                                                                                                                | Diperkuat (C)         |
| 7   | Brute force login       | Hanya per IP (8×/5 mnt) dan IP diambil dari hop **pertama** `X-Forwarded-For` (dapat dipalsukan → limiter dapat di-bypass)                                              | Diperbaiki (B-5)      |
| 8   | Kepercayaan peran SSO   | Bertahan                                                                                                                                                                | Bertahan              |
| 9   | Skema tautan            | Bertahan; kini juga menolak URL berkredensial (`user:pass@`)                                                                                                            | Bertahan              |
| 10  | Kebijakan kata sandi    | Hanya panjang ≥ 8; tanpa syarat huruf+angka; seed tidak memakai kebijakan yang sama                                                                                     | Diperbaiki            |
| 11  | Cookie sesi             | Bertahan; JWT kini tanpa data pribadi                                                                                                                                   | Bertahan + diperkuat  |

## B. Temuan baru

| #    | Tingkat    | Temuan                                                                                                                                                                                                               | Lokasi                                        | Status                                                              |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| B-1  | **Tinggi** | Eskalasi hak: `lpm_admin` dapat membuat akun `superadmin` dan mereset kata sandi/menonaktifkan/menghapus akun Superadmin (`role` tidak divalidasi)                                                                   | `actions/units.ts`                            | Diperbaiki                                                          |
| B-2  | **Tinggi** | IDOR bukti: `existingFile` dari klien diterima apa adanya → auditee dapat menautkan berkas bukti unit lain ke jawabannya lalu mengunduhnya; jawaban juga dapat disimpan untuk pertanyaan dari siklus lain            | `actions/responses.ts`                        | Diperbaiki                                                          |
| B-3  | **Tinggi** | Berkas bukti/dokumen disajikan publik dari `/public/uploads` tanpa autentikasi                                                                                                                                       | `upload.ts`                                   | Diperbaiki — penyimpanan privat `UPLOAD_DIR` + route terautentikasi |
| B-4  | **Tinggi** | SSO tanpa parameter `state` (login CSRF); callback menerima POST; error upstream bocor ke klien; token akses & refresh SSO disimpan di cookie base64 tanpa enkripsi & tanpa `Secure` (typo `NODE_NODE_ENV` di paket) | `api/sso`, paket `@alfaqosry/sso-client-next` | Diperbaiki — alur OAuth ditulis ulang, token tidak disimpan         |
| B-5  | **Sedang** | IP klien dari hop pertama XFF (dapat dipalsukan) → bypass rate limit & log palsu                                                                                                                                     | `actions/auth.ts`, `actions/settings.ts`      | Diperbaiki — `src/lib/net.ts`                                       |
| B-6  | **Sedang** | Tidak ada revokasi sesi: logout hanya menghapus cookie; ganti kata sandi / nonaktif / ubah peran tidak membatalkan token yang sudah terbit (berlaku hingga 7 hari)                                                   | `auth.ts`                                     | Diperbaiki — `sessionVersion`                                       |
| B-7  | **Sedang** | Akun SSO nonaktif tetap diberi cookie sesi & tercatat "Login SSO berhasil"; logout SSO tidak mengakhiri sesi aplikasi                                                                                                | `api/sso`                                     | Diperbaiki                                                          |
| B-8  | **Sedang** | Mode pemeliharaan hanya di layout — Server Action tetap dapat dipanggil langsung (POST) oleh non-superadmin; login tetap terbuka                                                                                     | semua action                                  | Diperbaiki — `src/lib/guards.ts`                                    |
| B-9  | **Sedang** | Data pribadi di log: email utuh di log login & detail aktivitas, email di `console.warn` SSO, objek error Prisma lengkap di konsol                                                                                   | `logs.ts`, `sso.ts`, `errors.ts`              | Diperbaiki — `src/lib/redact.ts`                                    |
| B-10 | **Sedang** | Validasi input minim: panjang tak dibatasi, ID tak divalidasi, `scopeType` bebas, standar dari siklus lain dapat dipakai, bulk tanpa batas                                                                           | `actions/*.ts`                                | Diperbaiki — `src/lib/validate.ts`                                  |
| B-11 | **Sedang** | Ekspor laporan per unit hanya untuk LPM, tanpa rate limit; tanpa sesi → 403                                                                                                                                          | `api/export`                                  | Diperbaiki — auditee boleh unduh unit sendiri; 401/403/429          |
| B-12 | **Rendah** | `purgeLoginLogs` dengan retensi 0 menghapus SELURUH log; `clearActivityLogs` tidak meninggalkan jejak                                                                                                                | `actions/settings.ts`                         | Diperbaiki                                                          |
| B-13 | **Rendah** | Batas siklus & format tanggal bergantung TZ server (bila UTC, siklus tertutup 07:00 WIB keesokan hari)                                                                                                               | `cycles.ts`, `format.ts`                      | Diperbaiki — eksplisit Asia/Jakarta                                 |
| B-14 | **Rendah** | `"use server"` mengekspor konstanta non-fungsi (`SECRET_KEYS`)                                                                                                                                                       | `actions/settings.ts`                         | Diperbaiki                                                          |
| B-15 | **Rendah** | Teks pengguna (karakter kontrol/bidi override, sangat panjang) dapat merusak tata letak PDF                                                                                                                          | `report/data.ts`                              | Diperbaiki — `pdfText()`                                            |
| B-16 | **Rendah** | Berkas bukti tertinggal di disk saat jawaban diganti / siklus, unit, standar, butir, dokumen dihapus                                                                                                                 | actions                                       | Diperbaiki (best-effort)                                            |
| B-17 | **Rendah** | `revalidatePath("/laporan")` menunjuk route yang tidak ada                                                                                                                                                           | `actions/units.ts`                            | Diperbaiki (`/analitik`)                                            |
| B-18 | **Info**   | Waktu respons login berbeda untuk email tak terdaftar (enumerasi via timing)                                                                                                                                         | `auth.ts`                                     | Diperbaiki — bcrypt tiruan                                          |

## C. Rincian perbaikan

- **Sesi (ASVS V3):** JWT hanya berisi `sub` + `sv` (versi sesi); `iss`/`aud` diverifikasi; algoritma dikunci HS256. `getCurrentUser()` membandingkan `sv` dengan `users.session_version` pada query yang memang sudah berjalan (tanpa biaya tambahan; di-memoize per request). Versi dinaikkan saat logout, ganti kata sandi (sesi perangkat ini diterbitkan ulang), reset kata sandi / ubah peran / nonaktif oleh admin, dan perubahan keanggotaan yang mengubah peran. Hapus akun → token ditolak. Catatan: logout mengakhiri sesi akun di **semua** perangkat; setelah deploy seluruh token lama tidak valid (login ulang sekali).
- **Login:** 5×/menit per email+IP (pengaturan hanya boleh memperketat), plus 30×/menit per IP; pesan & waktu respons seragam; saat pemeliharaan hanya superadmin.
- **Rate limit:** in-memory (`src/lib/ratelimit.ts`) — efektif karena PM2 `instances: 1`; wajib diganti Redis/DB bila di-scale. Diterapkan pada login, redirect/callback SSO (20/mnt/IP), ekspor PDF (10/mnt/pengguna), unggahan (30/mnt), unduhan berkas (120/mnt), ekspor data pribadi (5/mnt), ganti kata sandi (5/mnt).
- **IP klien:** `clientIpFromHeaders()` — `CF-Connecting-IP` dipercaya hanya bila hop terakhir XFF (ditambahkan IIS ARR) berada pada rentang IP Cloudflare; selain itu hop terakhir XFF. Env `TRUST_PROXY`, `TRUSTED_PROXY_CIDRS`.
- **RBAC:** `src/lib/guards.ts` dipanggil di baris pertama setiap action & route; proxy sengaja tidak melakukan otorisasi (sesuai panduan Next.js 16).
- **Unggahan:** disimpan di `UPLOAD_DIR` (default `<cwd>/storage/uploads`), nama acak; PDF ≤10 MB (`%PDF-`, tolak `/JavaScript` & `/Launch`) atau gambar branding ≤2 MB (magic bytes, tanpa SVG). Disajikan via `GET /api/files/<folder>/<nama>`; URL lama `/uploads/...` di DB di-rewrite (`beforeFiles`) ke route tersebut sehingga berkas lama di `public/uploads` tidak lagi tersaji langsung (tetap dibaca sebagai fallback). Header `nosniff`, `Content-Disposition`, `Cache-Control: private, no-store`, CORP `same-origin`.
- **SSO:** `state` acak 256-bit di cookie `__Host-spmi_sso_state` (httpOnly, Secure, SameSite=Lax, 10 menit, sekali pakai, dibandingkan constant-time); Redirect URI hanya dari pengaturan (https & berakhiran `/api/sso/callback` di produksi); URL absolut dari `APP_URL`/pengaturan, bukan header Host; tujuan pasca-login tetap (tidak ada `next`/`callbackUrl` → tidak ada open redirect); galat → `/login?sso_error=<kode>` tanpa detail upstream; cookie `sso_session`/`sso_access_token` lama dihapus; secret SSO disamarkan di UI dan tidak pernah dilog.
- **Header:** CSP per permintaan dengan **nonce** di `src/proxy.ts` (tanpa `'unsafe-inline'` di `script-src`; skrip anti-kedip tema via hash SHA-256; Cloudflare Insights diizinkan). `style-src 'unsafe-inline'` tetap diperlukan untuk atribut style (framer-motion/recharts) yang tidak dapat diberi nonce. HSTS 2 tahun (tanpa `preload`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP same-origin, CSP `default-src 'none'` untuk `/api/*` (kecuali `/api/files`), `serverActions.allowedOrigins` = host publik.
- **Privasi (UU PDP):** kolom `consented_at`/`consent_version`, `CONSENT_VERSION`, `needsConsent()`, action `recordConsent()`; `GET /api/me/export` (JSON UTF-8, ISO 8601 +07:00, tanpa hash kata sandi); `purgeExpiredData()` (log login > `log.loginRetentionDays`, log aktivitas > `log.activityRetentionDays`, default 365) — dijalankan tugas terjadwal + jaring pengaman maks. 1×/jam saat login. Email di log login disamarkan.
- **Lain-lain:** `GET /api/health` (`{status, db, version}`, publik, tanpa detail); tidak ditemukan endpoint debug/mode uji; tidak ada ekspor CSV/XLSX (formula injection N/A).

## D. Dependensi (`npm audit --omit=dev`, 17 Okt 2026)

3 temuan **high**, semuanya rantai `prisma` → `@prisma/config` → `deepmerge-ts < 8.0.0` (GHSA-ggr8-5vv4-36mx, stack exhaustion saat merge objek rekursif). Hanya tooling CLI Prisma (membaca konfigurasi lokal), tidak terjangkau input pengguna saat runtime. Perbaikan resmi memerlukan upgrade mayor ke Prisma 7 (`prisma` + `@prisma/client`) — dijadwalkan terpisah. Risiko residual: **Rendah**.

## E. Risiko residual / tindak lanjut

1. Rate limit in-memory: ganti ke Redis/DB bila lebih dari satu instance.
2. Paket `@alfaqosry/sso-client-next` 1.0.0 kini hanya dipakai sebagai klien HTTP; laporkan ke pengelola (state, typo `NODE_NODE_ENV`, kebocoran error, penyimpanan token).
3. Penautan akun SSO berdasarkan email mengasumsikan email dari SSO UP terverifikasi institusi.
4. Cloudflare: nonaktifkan Rocket Loader & Email Obfuscation (menyisipkan skrip inline tanpa nonce yang akan diblokir CSP).
5. Halaman `/kebijakan-privasi` dan banner persetujuan disediakan tim UI memakai `recordConsent()`.

---

# Audit Lanjutan — 20 Oktober 2026 (fitur "cakupan standar")

Lingkup: `git diff v1.2.1 HEAD -- src prisma tsconfig.json` (commit e7095b2, 12ade39) — kolom `scope_type`/`scope_category`/`scope_unit_id` pada `audit_standards`, penghapusan unique `(cycle_id, name)`, `tsconfig.json` mengecualikan `tests` & `playwright.config.ts` — beserta kode yang berinteraksi (`actions/questions.ts`, `scope.ts`, halaman `/audit`, `audit-workspace.tsx`, `actions/responses.ts`, `progress.ts`, `report/data.ts`, analitik, dasbor).

## A. Temuan

| ID  | Tingkat    | Temuan                                                                                                                                                                                                                                                                   | Status                                                     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| C-1 | **Tinggi** | `updateStandard` selalu menimpa cakupan dari FormData; form ubah-nama di UI hanya mengirim `id`+`name`, sehingga `parseScope` jatuh ke default `"all"` → setiap ubah nama standar khusus unit/kategori diam-diam menjadikannya standar umum (integritas instrumen audit) | Diperbaiki — cakupan hanya diubah bila `scopeType` dikirim |
| C-2 | **Sedang** | Tidak ada aturan konsistensi cakupan standar vs butir: butir unit B dapat ditempel ke standar unit A (atau butir umum ke standar unit) — nama standar unit A bocor ke unit B (tampilan auditee, PDF per unit), pengelompokan admin tidak konsisten                       | Diperbaiki — `isScopeWithin()` ditegakkan di server        |
| C-3 | **Sedang** | Halaman `/audit` (auditee) mengirim SELURUH butir siklus (termasuk butir khusus unit/kategori lain) dan seluruh daftar unit ke payload RSC; penyaringan hanya di klien                                                                                                   | Diperbaiki — filter sisi server                            |
| C-4 | **Sedang** | `updateStandard` tidak mengecek duplikat nama pada cakupan baru (create mengecek), tidak memverifikasi standar ada (galat Prisma generik), dan dapat mengubah cakupan walau butirnya jadi di luar cakupan                                                                | Diperbaiki                                                 |
| C-5 | **Rendah** | Unique index `(cycle_id, name)` dihapus → cek duplikat + perhitungan `order` rentan race (dua permintaan bersamaan menghasilkan standar kembar)                                                                                                                          | Diperbaiki — kunci baris `FOR UPDATE` dalam transaksi      |
| C-6 | **Rendah** | `scopeCategory` tidak divalidasi terhadap kategori yang dikenal (string bebas → butir/standar "yatim" tak terlihat siapa pun; beda huruf besar/kecil tidak cocok dengan perbandingan `===`)                                                                              | Diperbaiki — whitelist + ejaan kanonis                     |
| C-7 | **Rendah** | `tsconfig.json` mengecualikan `tests` & `playwright.config.ts` → kode uji tidak lagi diperiksa tipe                                                                                                                                                                      | Diperbaiki — `tsconfig.test.json`                          |
| C-8 | Info       | RBAC tidak berubah dan benar: semua action standar/butir memakai `requireLpm()` (termasuk penegakan mode pemeliharaan); log aktivitas tercatat                                                                                                                           | OK — log kini menyertakan cakupan                          |

## B. Aturan bisnis yang ditegakkan

Cakupan butir harus **sama dengan atau lebih sempit** daripada cakupan standar induknya (`src/lib/scope.ts` → `isScopeWithin`):

- standar `all` → butir `all` / `category` / `unit` apa pun (kompatibel dengan data lama: semua standar hasil migrasi bercakupan `all`);
- standar `category` C → butir `category` C atau `unit` yang berkategori C;
- standar `unit` U → butir `unit` U saja;
- jenis cakupan tidak dikenal / referensi kosong (unit terhapus → `SET NULL`) → ditolak (fail-closed).

Dengan invarian ini, visibilitas cukup ditentukan oleh cakupan **butir** (`isQuestionForUnit`) yang sudah dipakai konsisten oleh `saveResponse`, `recalcUnitProgress`, laporan PDF per unit, analitik & dasbor — standar unit A tidak pernah muncul pada unit B karena standar hanya tampil melalui butirnya, dan total progres hanya menghitung butir yang berlaku.

## C. Rincian perbaikan

- `src/lib/actions/questions.ts`
  - `parseScope()` (tidak diekspor — di berkas `"use server"` setiap ekspor async menjadi endpoint): whitelist `isScopeType`; kategori wajib ada di `CATEGORIES` atau kategori unit yang ada, disimpan dengan ejaan kanonis; unit wajib ada; pesan galat menyebut "standar"/"pertanyaan" sesuai konteks.
  - `createStandard`: transaksi + `SELECT … FROM audit_cycles … FOR UPDATE` (siklus wajib ada) → cek duplikat nama per cakupan & `order` berurutan tanpa race.
  - `updateStandard`: cakupan dipertahankan bila `scopeType` tidak dikirim; standar wajib ada; kunci siklus + standar; duplikat nama dicek pada cakupan tujuan (tanpa dirinya); perubahan cakupan **ditolak** bila ada butir yang berada di luar cakupan baru (tidak ada kaskade diam-diam).
  - `createQuestion`, `createQuestionsBulk`, `updateQuestion`: standar dikunci (`FOR UPDATE`), wajib satu siklus, dan cakupan butir wajib di dalam cakupan standar; `updateQuestion` mempertahankan cakupan lama bila `scopeType` tidak dikirim dan memvalidasi standar lama maupun baru.
  - Log aktivitas `standard.create`/`standard.update` mencatat cakupan (`scope=unit:5`, dsb.).
- `src/lib/scope.ts`: `SCOPE_TYPES`, `isScopeType`, `sameScope`, `isScopeWithin`.
- `src/app/(dashboard)/audit/page.tsx`: auditee hanya menerima butir yang berlaku untuk unit penempatannya dan hanya unit miliknya (minimisasi data).
- `tsconfig.test.json` (extends root; `src`, `tests/**`, `playwright.config.ts`, `vitest.config.mts`); `npm run typecheck` = `tsc --noEmit && tsc --noEmit -p tsconfig.test.json`. Root `tsconfig.json` tetap mengecualikan uji agar `next build` tidak memeriksa kode uji. Saat diperiksa, kode uji tidak memiliki galat tipe (kemungkinan pengecualian dibuat sebagai jalan pintas untuk `next build`); sekarang galat tipe di uji kembali menggagalkan gerbang CI/deploy.
- Uji baru: `tests/unit/questions-actions.test.ts` (RBAC, pemeliharaan, whitelist, kategori/unit tak dikenal, IDOR siklus, konsistensi cakupan, duplikat per cakupan, pertahanan cakupan saat ubah nama, penguncian); `tests/unit/scope.test.ts` diperluas untuk `isScopeWithin`/`sameScope`/`isScopeType`.

## D. Risiko residual

1. **Perubahan kategori unit** (`actions/units.ts`) dapat melanggar invarian untuk butir `unit` X di bawah standar `category` C bila X dipindah ke kategori lain: butir tetap terlihat oleh X (sesuai cakupan butir) beserta nama standar kategori C. Dampak rendah (nama standar); disarankan pemeriksaan pada `data-quality.ts` dan/atau validasi saat ubah kategori unit.
2. Tanpa unique index di DB, keunikan nama per cakupan hanya dijaga aplikasi (kunci `FOR UPDATE`); penyisipan langsung ke DB/skrip seed dapat membuat duplikat. Unique index atas `(cycle_id, name, scope_type, scope_category, scope_unit_id)` tidak andal karena kolom nullable (NULL ≠ NULL di MySQL).
3. Dropdown "Standar" pada form ubah butir menampilkan semua standar siklus; pilihan yang tidak kompatibel ditolak server dengan pesan jelas (UX, bukan keamanan).
4. LPM tetap dapat mengubah standar/butir pada siklus nonaktif (perilaku sama seperti sebelumnya; untuk arsip/verifikasi).
