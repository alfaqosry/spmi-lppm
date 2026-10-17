# Changelog

Semua perubahan penting pada proyek ini dicatat di berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/),
dan proyek ini menganut [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

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

[Unreleased]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Puskom-UP/lpm-new/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Puskom-UP/lpm-new/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Puskom-UP/lpm-new/releases/tag/v1.0.0
