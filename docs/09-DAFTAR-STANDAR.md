# 09 · Daftar Standar Pengembangan Perangkat Lunak — SPMI

Penerapan **Daftar Standar Pengembangan Perangkat Lunak** (acuan: dokumen 09 Sistem Tiketing & POS
Kebun Raya) pada **Sistem Informasi SPMI — LPM Universitas Pahlawan Tuanku Tambusai**
(`https://spmi.universitaspahlawan.ac.id`).

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3         | Dokumen Internal |
| 1.1           | 20 Oktober 2026 | v1.2.2         | Dokumen Internal |

Keterangan: ✅ terpenuhi · ⚠️ terpenuhi sebagian (lihat catatan) · ⏳ menunggu tindakan di luar kode
(keputusan/akses/perangkat) · ❌ belum terpenuhi · N/A tidak berlaku untuk SPMI.

## Ringkasan

| No  | Kategori                         | Acuan utama                                  | Status SPMI                                                            |
| --- | -------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Keamanan aplikasi                | OWASP Top 10 (2021), ASVS 4.0 L2             | ✅ audit internal + perbaikan + test regresi; ⏳ audit pihak ketiga    |
| 2   | Privasi & kepatuhan hukum        | UU 27/2022 PDP, UU ITE, PP 71/2019           | ✅ dokumen & fitur; ⏳ Pejabat PDP, PSE, tinjauan Bagian Hukum         |
| 3   | Kebijakan toko aplikasi          | Google Play, App Store                       | N/A — tidak ada aplikasi mobile                                        |
| 4   | UI/UX                            | Nielsen 10 Heuristics                        | ✅                                                                     |
| 5   | Aksesibilitas                    | WCAG 2.1 AA                                  | ✅ Lighthouse A11y 100; axe 0 pelanggaran (halaman publik)             |
| 6   | Performa web                     | Core Web Vitals, anggaran performa           | ⚠️ Desktop 96–97; mobile 66–77 (lihat §6)                              |
| 7   | Performa & kualitas mobile       | Android Vitals                               | N/A — tidak ada aplikasi mobile                                        |
| 8   | SEO & metadata                   | Google Search Essentials, Open Graph         | ✅ Lighthouse SEO 100                                                  |
| 9   | Standar penulisan kode           | ESLint + Prettier + TypeScript               | ✅ dicek hook & CI                                                     |
| 10  | Arsitektur perangkat lunak       | Layered (Page → Server Action → lib), ADR    | ✅ terdokumentasi                                                      |
| 11  | Manajemen repositori             | Git Flow, Conventional Commits, SemVer       | ✅; ⏳ push ke GitHub & proteksi branch                                |
| 12  | Pengujian                        | Unit, E2E lintas browser, a11y               | ✅ 402 unit (v1.2.2 + perbaikan, 20 Okt 2026) + 108 E2E lulus (v1.1.3) |
| 13  | CI/CD                            | GitHub Actions, deploy bergerbang + rollback | ✅ deploy; ⏳ CI aktif setelah push                                    |
| 14  | Manajemen lingkungan             | 12-Factor (Config), Dev/Staging/Prod         | ⚠️ Dev + Prod; ⏳ staging belum ada                                    |
| 15  | Kompatibilitas browser/perangkat | Chrome, Edge, Firefox, Safari, 320 px        | ✅ Playwright 5 profil; ⏳ uji iOS perangkat asli                      |
| 16  | Arsitektur API                   | REST, RFC 9110                               | N/A — tidak ada API publik; endpoint internal mengikuti format seragam |
| 17  | Dokumentasi API                  | OpenAPI 3.1                                  | N/A — endpoint internal didokumentasikan di [03-API](03-API.md)        |
| 18  | Struktur data                    | ISO 8601, UTF-8                              | ✅                                                                     |
| 19  | Operasional & deployment         | Backup, rollback, smoke test, SSL, log       | ✅; ⏳ salinan backup di luar server                                   |
| 20  | Dokumentasi proyek               | Docs-as-code                                 | ✅ Markdown; ⏳ build PDF siap cetak                                   |

> Penerapan standar **ISO/IEC** (25010, 25012, 9241, 29119, 12207, 27001/27002, 27034, 27701, 8601/639/3166, 9001, 42001): lihat [iso/README.md](iso/README.md).

## 1. Keamanan Aplikasi

**Acuan:** OWASP Top 10 (2021), OWASP ASVS 4.0 Level 2, Mozilla Web Security Guidelines.

| Kriteria                                                         | Cara verifikasi              | Penerapan (SPMI)                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [x] Hash kata sandi, sesi baru saat login, batas percobaan login | Review, unit test            | bcrypt; JWT diterbitkan ulang setiap login; 5×/menit per email+IP dan 30×/menit per IP (`src/lib/ratelimit.ts`)                                    |
| [x] Kebijakan kata sandi minimum                                 | Unit test `password`         | Min. 8, maks. 72 byte, huruf + angka, tidak sama dengan email — di semua titik (akun, profil, superadmin, seed)                                    |
| [x] Sesi kedaluwarsa & dapat dicabut                             | Unit test `auth`             | Masa sesi diatur Pengaturan (1–30 hari); `session_version` naik saat logout, ganti/reset sandi, ubah peran/nonaktif                                |
| [x] Otorisasi berbasis peran di setiap aksi (anti-IDOR)          | Unit test `guards`           | `requireUser/requireLpm/requireSuperadmin/requireUnitMember` di baris pertama setiap Server Action & route; superadmin hanya oleh superadmin       |
| [x] Validasi input di server, tanpa mass assignment              | Review, unit test `validate` | Whitelist field, enum & ID divalidasi, batas panjang (`src/lib/validate.ts`)                                                                       |
| [x] Pencegahan SQL Injection & XSS                               | Review                       | Prisma (parameter binding); React escaping; tautan dibatasi `http(s)`                                                                              |
| [x] CSRF                                                         | Review                       | Server Actions (cek Origin, `allowedOrigins`); cookie `SameSite`; OAuth `state` 256-bit untuk SSO                                                  |
| [x] Unggah berkas aman                                           | Unit test `upload`           | PDF ≤ 10 MB, cek magic bytes, tolak PDF `/JavaScript` `/Launch`, nama acak, penyimpanan privat `UPLOAD_DIR`, unduh via `/api/files/*` berotorisasi |
| [x] Header keamanan                                              | `smoke-test.ps1`             | CSP berbasis nonce (`src/proxy.ts`), HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP                                     |
| [x] Rate limiting endpoint sensitif                              | Unit test                    | Login, SSO, ekspor PDF, unggah, unduh berkas, ekspor data pribadi, ganti sandi                                                                     |
| [x] Mode uji/debug tidak aktif di produksi                       | Review                       | Tidak ada endpoint debug; `AUTH_SECRET` wajib (fail-closed); mode pemeliharaan ditegakkan di server                                                |
| [x] Tidak ada rahasia di repositori                              | `.gitignore`                 | `.env`, `storage/` diabaikan; rahasia produksi di `E:\www\spmi-prod\shared` (ACL Administrators + SYSTEM)                                          |
| [x] Audit dependensi                                             | `npm run audit` (CI)         | `npm audit --omit=dev`: **0 kerentanan** (override `deepmerge-ts` 8.0.2)                                                                           |
| [x] Log tanpa data pribadi/rahasia                               | Unit test `redact`, `logs`   | Email disamarkan (`a***@domain`), token/secret dibersihkan; nilai pengaturan tidak dicatat                                                         |
| [x] IP klien tidak dapat dipalsukan                              | Unit test `net`              | `CF-Connecting-IP` hanya dipercaya bila hop terakhir dari rentang IP Cloudflare                                                                    |
| [x] Ekspor aman                                                  | Review                       | Hanya PDF (tidak ada CSV/XLSX); teks pengguna disanitasi `pdfText()`                                                                               |
| [x] Audit keamanan sebelum rilis                                 | `LAPORAN_KEAMANAN.md`        | Audit 16 Okt (11 temuan) + 17 Okt 2026 (18 temuan B-1…B-18, a.l. eskalasi superadmin, IDOR bukti, unggahan publik) → semua ditutup                 |
| [ ] Audit oleh pihak independen                                  | Laporan audit                | ⏳ Audit di atas bersifat internal; disarankan uji penetrasi pihak ketiga sebelum pemakaian luas                                                   |

## 2. Privasi & Kepatuhan Hukum (Indonesia)

**Acuan:** UU 27/2022 PDP; UU ITE; PP 71/2019 PSTE.

| Kriteria                                     | Penerapan (SPMI)                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [x] Kebijakan Privasi publik                 | `/kebijakan-privasi` (pengendali, data, tujuan, dasar hukum, pihak ketiga, retensi, hak, kontak) |
| [x] Syarat & Ketentuan                       | `/syarat-ketentuan` (Kebijakan Refund N/A — tidak ada transaksi)                                 |
| [x] Persetujuan tercatat (waktu + versi)     | Dialog persetujuan setelah login; `users.consented_at`, `users.consent_version`                  |
| [x] Hak akses & portabilitas                 | Profil → "Unduh data saya (JSON)" → `GET /api/me/export`                                         |
| [x] Hak penghapusan                          | Permintaan via email LPM (akun dikelola institusi); tertulis di Kebijakan Privasi & Profil       |
| [x] Retensi otomatis                         | Task `\SPMI\SPMI Retensi Data` 02:00 → `privacy-purge` (log login/aktivitas sesuai Pengaturan)   |
| [x] Penyamaran data pribadi                  | Log dan konsol menyamarkan email/telepon/token                                                   |
| [x] Tanpa pelacak pihak ketiga               | Hanya cookie esensial; font di-host sendiri; tidak ada analitik pihak ketiga di kode             |
| [x] RoPA & prosedur insiden 3×24 jam         | [legal/RoPA.md](legal/RoPA.md), [legal/INSIDEN-DATA.md](legal/INSIDEN-DATA.md)                   |
| [ ] Penunjukan Pejabat PDP                   | ⏳ Keputusan institusi                                                                           |
| [ ] Pendaftaran PSE (bila diwajibkan)        | ⏳ Perlu konfirmasi Bagian Hukum — [legal/CHECKLIST-KEPATUHAN.md](legal/CHECKLIST-KEPATUHAN.md)  |
| [ ] Tinjauan Bagian Hukum atas dokumen legal | ⏳ Teks Kebijakan Privasi/S&K (rujukan pasal, masa retensi) perlu disahkan                       |

## 3. Kebijakan Toko Aplikasi

N/A — SPMI hanya aplikasi web responsif; tidak ada aplikasi Android/iOS.

## 4. UI/UX

| Kriteria                                        | Penerapan (SPMI)                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [x] Desain konsisten                            | Palet & komponen bersama (`src/components/ui/primitives.tsx`), font Plus Jakarta Sans self-hosted     |
| [x] Responsif tanpa scroll horizontal di 320 px | E2E `login.spec.ts` (320 px) di 5 profil browser                                                      |
| [x] Status sistem jelas                         | `loading.tsx` skeleton, empty state, `error.tsx` + "Coba lagi", pesan aria-live                       |
| [x] Validasi formulir inline Bahasa Indonesia   | Komponen `Field` (pesan per field)                                                                    |
| [x] Target sentuh ≥ 44 px                       | Aturan `pointer: coarse` di `globals.css`                                                             |
| [x] Konfirmasi aksi berisiko                    | `ConfirmAction` (alertdialog) untuk hapus unit/akun/standar/butir/dokumen, nonaktif siklus, purge log |
| [x] Halaman error ramah                         | `not-found.tsx` (404), `error.tsx`, `global-error.tsx`, `/no-access` (403), halaman pemeliharaan 503  |

## 5. Aksesibilitas

**Acuan:** WCAG 2.1 Level AA.

| Kriteria                                   | Penerapan (SPMI)                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| [x] Struktur semantik                      | `lang="id"`, skip link, landmark, satu `h1` per halaman                             |
| [x] Input berlabel, tombol ikon bernama    | `Field` (label implisit), `aria-label` pada tombol ikon                             |
| [x] Kontras ≥ 4.5:1                        | Token warna kedua tema diperbaiki; Lighthouse Accessibility **100**                 |
| [x] Navigasi keyboard + fokus terlihat     | Modal dengan focus trap + Esc + kembali fokus; E2E urutan Tab                       |
| [x] Konten dinamis diumumkan               | `aria-live` pada umpan balik aksi, error field, progres                             |
| [x] `prefers-reduced-motion`, zoom 200%    | `MotionConfig reducedMotion="user"` + CSS; E2E reflow 200%                          |
| [x] Uji a11y otomatis                      | `npm run test:a11y` (axe WCAG 2.0 A/AA + 2.1 AA): 0 pelanggaran di 5 profil browser |
| [ ] Pemindaian axe halaman dashboard di CI | ⏳ Butuh akun uji pada workflow `e2e.yml` (`E2E_EMAIL`/`E2E_PASSWORD`)              |

## 6. Performa Web

**Acuan:** Google Core Web Vitals; anggaran performa. Diukur 17 Okt 2026 dengan Lighthouse 12.8 di server
produksi (benchmarkIndex CPU ±1100–1300, lebih lambat dari mesin acuan Lighthouse).

| Kriteria                       | Target                   | Hasil (SPMI)                                                                                                             |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [x] LCP                        | < 2,5 dtk                | Desktop 0,8–0,9 dtk; mobile 2,4–2,6 dtk di origin, 3,3–3,4 dtk via Cloudflare                                            |
| [ ] TBT (proksi INP)           | < 200 ms                 | Desktop 100–130 ms ✅; mobile 780–1.400 ms ❌ (hidrasi React/runtime Next + skrip Cloudflare ±700 ms)                    |
| [x] CLS                        | < 0,1                    | 0                                                                                                                        |
| [ ] Anggaran JS / CSS          | JS ≤ 150 KB gz, CSS ≤ 30 | JS pihak pertama ±160 KB gz (react-dom 73 + runtime Next 37) ⚠️; CSS 13 KB ✅                                            |
| [x] Aset ber-hash & cache lama | Cache-Control immutable  | `/_next/static/*` ber-hash, immutable                                                                                    |
| [x] Tanpa CDN pihak ketiga     | —                        | Semua aset lokal; font self-hosted                                                                                       |
| [ ] Skor Lighthouse            | Perf ≥ 90, A11y/SEO ≥ 95 | Desktop Perf 96–97 ✅; **mobile Perf 66–77 ❌**; A11y 100 ✅; SEO 100 ✅; Best Practices 82 (100 tanpa skrip Cloudflare) |

Tindak lanjut performa mobile:

1. Cloudflare (di luar kode): matikan **Bot Fight Mode / JavaScript Detections** dan **Web Analytics
   auto-inject** untuk host ini — skrip `/cdn-cgi/challenge-platform` memakan ±700 ms CPU dan menurunkan
   Best Practices (API usang). Matikan juga **Rocket Loader** & **Email Obfuscation** (bertabrakan dengan CSP nonce).
2. Ukur ulang via PageSpeed Insights (mesin acuan Google) — kuota anonim habis saat pengukuran.
3. Bila masih < 90: pecah hidrasi halaman publik (komponen klien lebih sedikit di root layout) — catat sebagai backlog.

## 7. Performa & Kualitas Mobile

N/A — tidak ada aplikasi mobile.

## 8. SEO & Metadata

- [x] `<title>` (template `%s · SPMI Universitas Pahlawan`) & meta description unik; canonical (`metadataBase` dari Pengaturan/`APP_URL`)
- [x] Metadata selalu di `<head>` (`htmlLimitedBots: /.*/`)
- [x] Open Graph & Twitter Card
- [x] `robots.txt` (blokir `/api` & dashboard) dan `sitemap.xml` (halaman publik saja)
- [x] `noindex` untuk seluruh halaman dashboard & `/no-access`; halaman pemeliharaan `noindex`
- [x] Favicon/`icon.svg`, `apple-icon`, web manifest

**Hasil:** Lighthouse SEO **100** (login, kebijakan-privasi, syarat-ketentuan).

## 9. Standar Penulisan Kode

| Kriteria                              | Alat & perintah                                                    | Penerapan (SPMI)                                  |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| [x] Format otomatis                   | `npm run format` (Prettier)                                        | `.prettierrc.json`, `.prettierignore`             |
| [x] Lint statis tanpa error           | `npm run lint` (ESLint flat, Next + jsx-a11y), `npm run typecheck` | 0 error, 0 peringatan                             |
| [x] Gagal CI bila tidak sesuai        | `.github/workflows/ci.yml`                                         | lint, format:check, typecheck, test, audit, build |
| [x] Hook lokal                        | `scripts/hooks/pre-commit`                                         | Prettier + ESLint pada berkas staged              |
| [x] `.editorconfig` & normalisasi EOL | `.editorconfig`, `.gitattributes`                                  | LF; CRLF untuk `.ps1`                             |
| [x] Konvensi penamaan & bahasa        | [07-STANDAR-ENGINEERING](07-STANDAR-ENGINEERING.md)                | —                                                 |

## 10. Arsitektur Perangkat Lunak

- [x] Lapisan: Page (Server Component) → Server Action (otorisasi + validasi) → `src/lib` → Prisma
- [x] Kesalahan seragam & aman (`src/lib/errors.ts`, pesan Bahasa Indonesia, tanpa detail internal)
- [x] Keputusan arsitektur sebagai ADR: [adr/0001–0006](adr/)
- [x] Diagram arsitektur, ERD, use case, sequence: [01-PERANCANGAN](01-PERANCANGAN.md)

## 11. Manajemen Repositori

| Kriteria                                 | Penerapan (SPMI)                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| [x] Repositori terpusat & privat         | `github.com/Puskom-UP/lpm-new` (private)                                  |
| [x] Alur branch Git Flow                 | `main` (produksi), `develop` (integrasi); rilis via merge `--no-ff` + tag |
| [x] Conventional Commits divalidasi hook | `scripts/hooks/commit-msg` (`npm run hooks:install`)                      |
| [x] Pre-commit cek format/lint           | `scripts/hooks/pre-commit`                                                |
| [x] Tag SemVer                           | `v1.0.0`, `v1.1.0` … `v1.2.2`; [CHANGELOG](../CHANGELOG.md)               |
| [x] Template PR & issue, CONTRIBUTING    | `.github/`, `CONTRIBUTING.md`                                             |
| [ ] Push branch & tag ke GitHub          | ⏳ Belum di-push (menunggu persetujuan)                                   |
| [ ] Proteksi branch di server Git        | ⏳ Konvensi tim (GitHub Free tidak mendukung untuk repo privat)           |

## 12. Pengujian

| Jenis                                 | Alat                      | Hasil (SPMI)                                                                                                                     |
| ------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [x] Unit                              | Vitest                    | **402 test / 23 berkas lulus** (20 Okt 2026; v1.1.3: 287/17) — termasuk `questions-actions`, `data-quality` (41 aturan), `scope` |
| [x] End-to-End lintas browser         | Playwright                | **108 lulus**, 27 dilewati (butuh akun) — Chromium, Firefox, WebKit, Pixel 7, iPhone 14                                          |
| [x] Alur login nyata di produksi      | Playwright `auth.spec.ts` | 4/4 lulus (HTTPS produksi, 17 Okt 2026)                                                                                          |
| [x] Aksesibilitas otomatis            | axe-core                  | 0 pelanggaran (login, login+error, 320 px, 404, halaman legal)                                                                   |
| [x] Test regresi temuan keamanan      | Vitest                    | upload/IDOR/IP/sesi/redaksi/guard tercakup                                                                                       |
| [x] Data uji terisolasi dari produksi | MySQL sekali-pakai        | E2E memakai kontainer DB terpisah; tidak ada data uji di produksi                                                                |
| [x] Checklist UAT                     | Dokumen                   | [06-PENGUJIAN](06-PENGUJIAN.md)                                                                                                  |

## 13. CI/CD

- [x] CI saat push/PR: lint, format, typecheck, unit test, `npm audit`, build (`.github/workflows/ci.yml`) — ⏳ aktif setelah push
- [x] E2E sebagai workflow terpisah (manual + terjadwal; `.github/workflows/e2e.yml`)
- [x] Deploy produksi melalui skrip: worktree bersih → **gerbang test** → build standalone → **backup** → **maintenance 503** → `prisma db push` → aktivasi rilis atomik (junction) → PM2 → **smoke test** → **rollback otomatis** bila gagal
- [x] Perubahan skema yang tidak dapat ditangani `db push`: SQL manual ber-versi `prisma/sql/`, digladikan pada salinan produksi (jumlah baris 12 tabel identik, `migrate diff` kosong) dan diterapkan **sebelum** skrip deploy — [RENCANA-PEMELIHARAAN §4.1](iso/RENCANA-PEMELIHARAAN.md#41-prosedur-wajib-perubahan-skema-basis-data), [04 §5.1](04-DEPLOYMENT-IIS.md#51-perubahan-skema-basis-data-migrasi-manual) (⏳ belum diotomasi di skrip deploy)
- [x] Log deploy & backup bertanggal (`E:\www\spmi-prod\logs\deploy-<ts>.log`)

**Penerapan:** `scripts/deploy/deploy-production.ps1`, `rollback.ps1`, `smoke-test.ps1`, `lib-db.ps1`.
Rollback otomatis telah teruji pada insiden nyata 17 Okt 2026 dan diperkuat di v1.1.2.

## 14. Manajemen Lingkungan

| Kriteria                                  | Development                                                           | Staging | Production                                                             |
| ----------------------------------------- | --------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| [x] Lingkungan terpisah (kode, DB, kunci) | Lokal (`docker-compose`)                                              | —       | IIS site 67, DB `spmi-db` 127.0.0.1:33063                              |
| [x] Konfigurasi via env, bukan kode       | `.env`                                                                | —       | `shared\.env` (di luar rilis)                                          |
| [x] Debug mati di luar development        | `next dev`                                                            | —       | `NODE_ENV=production`                                                  |
| [x] Data demo hanya non-produksi          | `SEED_DEMO=true npm run db:seed:demo` (`prisma/seed-demo.ts`, v1.2.1) | —       | Ditolak bila `NODE_ENV=production`; `npm run db:seed` = akun awal saja |
| [ ] Lingkungan staging                    | —                                                                     | ⏳      | —                                                                      |

## 15. Kompatibilitas Browser & Platform

| Platform                 | Cara verifikasi           | Hasil                        |
| ------------------------ | ------------------------- | ---------------------------- |
| [x] Chrome & Edge        | Playwright Chromium       | Lulus                        |
| [x] Firefox              | Playwright Firefox        | Lulus                        |
| [x] Safari (WebKit)      | Playwright WebKit         | Lulus                        |
| [x] Android              | Playwright Pixel 7        | Lulus                        |
| [ ] iOS perangkat asli   | iPhone 14 (emulasi) lulus | ⏳ Uji di perangkat iOS asli |
| [x] Ukuran layar 320 px+ | E2E                       | Lulus                        |

## 16–17. Arsitektur & Dokumentasi API

N/A — SPMI tidak menyediakan API publik; antarmuka utama adalah Server Actions. Endpoint internal
(`/api/sso/*`, `/api/export`, `/api/files/*`, `/api/health`, `/api/me/export`) memakai kode status
tepat (200/307/401/403/404/405/429/503), pesan Bahasa Indonesia tanpa detail internal, dan
didokumentasikan di [03-API](03-API.md) beserta kebijakan versi `/api/v1` bila kelak ada API publik.

## 18. Struktur Data

| Kriteria                       | Penerapan (SPMI)                                              |
| ------------------------------ | ------------------------------------------------------------- |
| [x] Waktu ISO 8601 dengan zona | Ekspor JSON `2026-10-17T10:39:00+07:00` (`toIsoJakarta`)      |
| [x] Tanggal ISO 8601           | `toIsoDate`; input tanggal divalidasi (tolak 2025-02-31)      |
| [x] Teks UTF-8                 | MySQL `utf8mb4_unicode_ci`, JSON UTF-8                        |
| [x] Zona waktu eksplisit       | `Asia/Jakarta` di lapisan aplikasi; DB menyimpan UTC (Prisma) |
| N/A Uang                       | Tidak ada data moneter                                        |

## 19. Operasional & Deployment

- [x] HTTPS wajib, sertifikat Let's Encrypt otomatis diperbarui (win-acme, berikutnya 11 Des 2026) + Cloudflare
- [x] Backup DB sebelum setiap deploy; backup harian 01:30 (DB + unggahan) dengan salinan ke disk D:
- [x] Uji restore dilakukan (17 Okt 2026, ke DB sementara)
- [x] Smoke test pasca-deploy (upstream + publik)
- [x] Penjadwal tugas: backup harian, retensi data, PM2 Resurrect, win-acme
- [x] Mode pemeliharaan saat deploy (503 + `Retry-After`)
- [x] Log aplikasi dengan penyamaran data pribadi
- [x] Runbook produksi & troubleshooting: [04-DEPLOYMENT-IIS](04-DEPLOYMENT-IIS.md)
- [ ] Salinan backup di luar server (NAS/cloud) ⏳

## 20. Dokumentasi Proyek

- [x] Perancangan (kebutuhan, arsitektur, ERD, use case, sequence, aturan bisnis) — [01](01-PERANCANGAN.md)
- [x] Panduan pengembangan, API, deployment, pengguna, pengujian, standar engineering — [02](02-PANDUAN-PENGEMBANGAN.md)–[07](07-STANDAR-ENGINEERING.md)
- [x] Dokumen legal & kepatuhan — [legal/](legal/)
- [x] Format Markdown (sumber) — diagram Mermaid
- [ ] PDF siap cetak dibangun otomatis ⏳ backlog

## Backlog & Tindakan di Luar Kode

| No  | Tindakan                                                                                                                       | Pemilik                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1   | Daftarkan Redirect URI `https://spmi.universitaspahlawan.ac.id/api/sso/callback` di SSO UP, isi Client ID/Secret di Pengaturan | Admin SSO / Superadmin   |
| 2   | Ganti kata sandi 2 akun awal, hapus `E:\www\spmi-prod\shared\akun-awal.txt`                                                    | Superadmin               |
| 3   | Setelan Cloudflare: matikan Bot Fight Mode JS Detections, Rocket Loader, Email Obfuscation                                     | Admin Cloudflare         |
| 4   | Push `main`, `develop` & tag ke GitHub (mengaktifkan CI)                                                                       | Tim pengembang           |
| 5   | Pejabat PDP, konfirmasi PSE, tinjauan Bagian Hukum                                                                             | Institusi / Bagian Hukum |
| 6   | Salinan backup di luar server                                                                                                  | Puskom                   |
| 7   | Staging, uji iOS perangkat asli, audit pihak ketiga, build PDF dokumentasi                                                     | Tim pengembang           |
| 8   | Optimasi performa mobile hingga ≥ 90 (§6)                                                                                      | Tim pengembang           |

Disetujui oleh: ………………………………… Tanggal: ……………………
