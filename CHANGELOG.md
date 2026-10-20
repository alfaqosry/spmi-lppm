# Changelog

Semua perubahan penting pada proyek ini dicatat di berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/),
dan proyek ini menganut [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

## [1.2.3] - 2026-10-20

### Security

- Audit lanjutan atas kode cakupan standar (C-1…C-8, `LAPORAN_KEAMANAN.md`): ganti nama standar tidak lagi
  mereset cakupan; butir wajib ⊆ cakupan standar (server); auditee hanya menerima butir yang berlaku (server-side);
  nama standar unik per cakupan dengan row lock; kategori divalidasi & kanonis.
- Visibilitas butir _fail-closed_ untuk cakupan tak dikenal.
- Ubah kategori / hapus unit ditolak bila melanggar cakupan atau menyisakan instrumen yatim.

### Fixed

- Akun tidak dapat dinonaktifkan dari form ubah akun (TC-ROL-12).
- Pesan galat bisnis kini tampil di produksi (galat dikembalikan sebagai nilai — `runAction`).
- PDF analitik mengikuti siklus yang dipilih (HE-07).
- Aksesibilitas: grafik Recharts tidak fokus di dalam `aria-hidden`; struktur `<dl>` profil.

### Added

- Suite E2E alur bisnis seluruh peran (80 test, `npm run test:e2e:flows`, hanya ke localhost).
- Typecheck kode uji (`tsconfig.test.json`).
- Deploy: migrasi SQL manual `prisma/sql/` otomatis — gladi pada salinan backup + perbandingan jumlah baris,
  catatan di `shared/sql-migrations.json`, deteksi baseline.
- Aturan kualitas data DQ-39…DQ-41 (cakupan standar). Dokumen ISO diperbarui.

## [1.2.2] - 2026-10-20

### Added

- Cakupan standar (semua unit / kategori / unit tertentu) pada `audit_standards` (alfaqosry, `e7095b2`).

### Changed

- Migrasi skema manual `prisma/sql/2026-10-20-cakupan-standar.sql`: `prisma db push` 6.19 menghasilkan
  `DROP FOREIGN KEY` ganda untuk perubahan ini. Diuji pada salinan produksi: jumlah baris 12 tabel
  identik, `migrate diff` kosong setelah migrasi. Tanpa `DROP TABLE`/`DROP COLUMN`/`DELETE`.
- Akun demo dihapus dari halaman login (alfaqosry, `12ade39`).

## [1.2.1] - 2026-10-17

### Changed

- Menggabungkan pemulihan data & akun demo (commit `cc0ac0b`) sebagai fitur **khusus pengembangan lokal**:
  `prisma/seed-demo.ts` (`npm run db:seed:demo`, wajib `SEED_DEMO=true`, ditolak bila `NODE_ENV=production`);
  kotak akun demo di halaman login hanya tampil saat development. `npm run db:seed` tetap seed produksi.

## [1.2.0] - 2026-10-17

### Added

- Penerapan standar ISO/IEC (`docs/iso/`): 25010/25023, 25012 + kamus data, 9241 (usabilitas),
  29119 (pengujian: 130 test case, keterlacakan 61 kebutuhan), 12207 + rencana pemeliharaan,
  27001 SoA (93 kontrol), 27034 (STRIDE, risk register), 27701, 9001, 42001 (N/A), ISO 8601/639/3166.
- Cek kualitas data harian (`src/lib/data-quality.ts`, 38 aturan hanya-baca).
- Metadata `locale` (ISO 639-1/3166-1, zona waktu) + `Content-Language: id` di `/api/health` & `/api/me/export`.
- CodeQL (SAST) di GitHub Actions.
- Ops: watchdog Docker/DB/aplikasi tiap 5 menit (SYSTEM), Docker Desktop autostart tanpa login,
  rotasi log harian dengan retensi 90 hari.

### Changed (usabilitas, ISO 9241 — temuan tingkat 3)

- Batas waktu pengisian tampil di dashboard unit & `/audit` (HE-01).
- Butir "Perlu Revisi" selalu terlihat + filter (HE-02).
- Hapus standar/siklus/unit menjelaskan dampak + konfirmasi ketik nama (HE-03/04/05);
  siklus aktif ditolak dihapus di server.
- Ekspor PDF dengan status proses & pesan galat ramah (HE-06).
- Peringatan isian belum disimpan; form tidak lagi direset saat simpan gagal (HE-08).
- Konfirmasi & umpan balik saat mengaktifkan siklus (HE-11).

## [1.1.3] - 2026-10-17

### Changed

- Performa mobile: blob dekoratif `blur-3xl` diganti `radial-gradient`; `backdrop-filter`
  (efek kaca) hanya di layar lebar dengan pointer presisi.

## [1.1.2] - 2026-10-17

### Fixed

- Ops: dump/restore DB lewat `scripts/deploy/lib-db.ps1` (kredensial dari env kontainer, `docker cp`);
  rollback otomatis kini tetap mengaktifkan rilis sebelumnya walau restore DB gagal, dan hanya
  mencabut pemeliharaan setelah smoke test lulus.
- Ops: folder `logs` tidak lagi dikunci ACL (PM2 gagal start dengan `EPERM`, insiden 17 Okt 2026).
- Runbook: tugas terjadwal & troubleshooting disesuaikan dengan implementasi.

## [1.1.1] - 2026-10-17

### Fixed

- Metadata halaman selalu di `<head>` (`htmlLimitedBots`), bukan di-stream ke `<body>`.
- Teks minimum 12px (Lighthouse legible font) dan target sentuh daftar isi halaman legal.
- CSP `upgrade-insecure-requests` hanya bila `APP_URL` HTTPS (uji lokal WebKit).
- Smoke test: `X-Powered-By` kosong dari ARR tidak dianggap kebocoran; ACL backups/logs.

## [1.1.0] - 2026-10-17

### Security

- Audit keamanan lanjutan (18 temuan baru, lihat `LAPORAN_KEAMANAN.md` §17 Okt 2026), antara lain:
  eskalasi `lpm_admin` → superadmin, IDOR berkas bukti (`existingFile`), unggahan dapat diakses
  publik, OAuth tanpa `state`, IP klien dapat dipalsukan, sesi tidak dapat dicabut.
- Sesi JWT dapat dicabut (`session_version`): logout, ganti/reset sandi, ubah peran/nonaktif.
- RBAC + validasi input di setiap Server Action dan route; mode pemeliharaan ditegakkan di server.
- Penyimpanan unggahan privat (`UPLOAD_DIR`) disajikan lewat `/api/files/*` terautentikasi.
- CSP berbasis nonce (`src/proxy.ts`), HSTS, COOP, rate limit endpoint sensitif, log disamarkan.
- Override `deepmerge-ts` 8.0.2 → `npm audit --omit=dev` 0 kerentanan.

### Added

- Privasi (UU 27/2022 PDP): halaman Kebijakan Privasi & Syarat Ketentuan, persetujuan tercatat
  (`consented_at`, `consent_version`), ekspor data pribadi `GET /api/me/export`, retensi log otomatis.
- `GET /api/health` untuk smoke test.
- Aksesibilitas WCAG 2.1 AA: skip link, landmark, dialog dengan focus trap, kontras, aria-live,
  reduced motion; halaman 404/error/loading; dialog konfirmasi untuk aksi destruktif.
- SEO: metadata per halaman, Open Graph, `robots.txt`, `sitemap.xml`, manifest & ikon.
- Deploy produksi IIS + PM2: `scripts/deploy/*` (rilis atomik, backup, maintenance, smoke test,
  rollback otomatis), backup harian & retensi data via Task Scheduler.
- Dokumentasi `docs/` (perancangan, API, deployment, pengguna, pengujian, standar, ADR, legal).

### Added

- Standar kode: ESLint flat config (`eslint-config-next` core-web-vitals + TypeScript +
  `jsx-a11y` recommended), Prettier, `.editorconfig`, `.gitattributes`.
- Git hook `commit-msg` (validasi Conventional Commits) dan `pre-commit`
  (Prettier + ESLint pada berkas yang di-stage); pasang dengan `npm run hooks:install`.
- Uji unit Vitest untuk helper `src/lib` (validasi unggahan & magic bytes, skema URL,
  kebijakan kata sandi, pembatas laju, IP klien, penyamaran log, sesi, pengaturan, dll).
- Uji E2E Playwright (Chromium, Firefox, WebKit, Pixel 7, iPhone 14) dengan pemindaian
  aksesibilitas axe-core (WCAG 2.0 A/AA, 2.1 AA).
- GitHub Actions: workflow CI (lint, format, typecheck, test, audit, build) dan E2E
  (manual + terjadwal), template PR & issue, Dependabot.
- `CONTRIBUTING.md` (Git Flow, Conventional Commits, SemVer, cara menjalankan pemeriksaan).

### Changed

- Skrip `lint` kini memakai ESLint CLI (`next lint` dihapus pada Next.js 16).

## [1.0.0]

- Rilis awal Sistem Informasi SPMI.

[Unreleased]: https://github.com/Puskom-UP/lpm-new/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/Puskom-UP/lpm-new/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/Puskom-UP/lpm-new/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/Puskom-UP/lpm-new/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Puskom-UP/lpm-new/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Puskom-UP/lpm-new/releases/tag/v1.0.0
