# Panduan Kontribusi — Sistem Informasi SPMI

Terima kasih telah berkontribusi. Dokumen ini merangkum aturan kerja tim;
detail arsitektur & setup lengkap ada di [`docs/02-PANDUAN-PENGEMBANGAN.md`](docs/02-PANDUAN-PENGEMBANGAN.md).

## 1. Persiapan sekali jalan

```bash
npm ci                    # pasang dependensi (postinstall: prisma generate)
npm run hooks:install     # aktifkan git hook (commit-msg & pre-commit)
npx playwright install    # (opsional) browser untuk uji E2E
```

`hooks:install` menjalankan `git config core.hooksPath scripts/hooks`. Hook berupa skrip
`sh` biasa sehingga berjalan di Git for Windows (Git Bash), Linux, dan macOS.

- **commit-msg** — menolak pesan commit yang tidak sesuai Conventional Commits.
- **pre-commit** — menjalankan `prettier --check` dan `eslint` **hanya pada berkas yang di-stage**.

Hook dapat dilewati dalam keadaan darurat dengan `git commit --no-verify`, tetapi CI tetap
menjalankan pemeriksaan yang sama.

## 2. Alur branch (Git Flow)

| Branch           | Dibuat dari | Merge ke           | Kegunaan                                       |
| ---------------- | ----------- | ------------------ | ---------------------------------------------- |
| `main`           | —           | —                  | Produksi. Setiap merge = rilis bertag `vX.Y.Z` |
| `develop`        | `main`      | —                  | Integrasi untuk rilis berikutnya               |
| `feature/<nama>` | `develop`   | `develop`          | Fitur baru, mis. `feature/ekspor-excel`        |
| `fix/<nama>`     | `develop`   | `develop`          | Perbaikan bug non-darurat                      |
| `release/X.Y.Z`  | `develop`   | `main` + `develop` | Stabilisasi rilis, bump versi, CHANGELOG       |
| `hotfix/X.Y.Z`   | `main`      | `main` + `develop` | Perbaikan darurat produksi                     |

Aturan:

1. Tidak ada push langsung ke `main` / `develop` — selalu lewat Pull Request.
2. PR minimal 1 reviewer dan workflow **CI** wajib hijau.
3. PR kecil & fokus; isi template PR (langkah uji, tangkapan layar UI, checklist keamanan).
4. Merge ke `main` hanya dari `release/*` atau `hotfix/*` (gunakan _merge commit_).

## 3. Conventional Commits

```
<type>(<scope>)!: <deskripsi singkat, imperatif, huruf kecil>

[body opsional — alasan perubahan]

[footer opsional — BREAKING CHANGE: ..., Closes #123]
```

| Type       | Kapan dipakai                              | Efek versi |
| ---------- | ------------------------------------------ | ---------- |
| `feat`     | Fitur baru bagi pengguna                   | MINOR      |
| `fix`      | Perbaikan bug                              | PATCH      |
| `perf`     | Peningkatan performa                       | PATCH      |
| `refactor` | Perubahan kode tanpa mengubah perilaku     | —          |
| `docs`     | Dokumentasi saja                           | —          |
| `style`    | Format/whitespace (tanpa perubahan logika) | —          |
| `test`     | Menambah/memperbaiki uji                   | —          |
| `build`    | Dependensi, Docker, sistem build           | —          |
| `ci`       | Workflow GitHub Actions                    | —          |
| `chore`    | Pemeliharaan lain                          | —          |
| `revert`   | Membatalkan commit sebelumnya              | —          |

- `scope` opsional, huruf kecil: `audit`, `auth`, `siklus`, `unit`, `pengaturan`, `ui`, `deps`, ...
- Tanda `!` (atau footer `BREAKING CHANGE:`) menandai perubahan yang tidak kompatibel → **MAJOR**.
- Pesan otomatis Git (`Merge ...`, `Revert "..."`, `fixup!`, `squash!`) tetap diterima.

Contoh:

```
feat(audit): tambah filter siklus pada laporan unit
fix(auth): cegah redirect terbuka setelah login
docs: perbarui panduan deployment IIS
refactor(upload)!: pindahkan penyimpanan berkas ke storage privat
```

## 4. Versi & rilis (SemVer)

Versi mengikuti [Semantic Versioning](https://semver.org/lang/id/) `MAJOR.MINOR.PATCH`.

1. Buat `release/X.Y.Z` dari `develop`.
2. Perbarui `version` di `package.json` (`npm version X.Y.Z --no-git-tag-version`) dan
   pindahkan entri `Unreleased` di [`CHANGELOG.md`](CHANGELOG.md) ke bagian versi baru.
3. Merge ke `main`, lalu beri tag beranotasi: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push --tags`.
4. Merge balik ke `develop`.

## 5. Menjalankan pemeriksaan

| Perintah                | Isi                                                                |
| ----------------------- | ------------------------------------------------------------------ |
| `npm run lint`          | ESLint (flat config: Next core-web-vitals + TypeScript + jsx-a11y) |
| `npm run lint:fix`      | ESLint dengan perbaikan otomatis                                   |
| `npm run format`        | Prettier — format seluruh repo                                     |
| `npm run format:check`  | Prettier — cek saja (dipakai CI)                                   |
| `npm run typecheck`     | `tsc --noEmit` (aplikasi) + `tsc -p tsconfig.test.json` (kode uji) |
| `npm test`              | Uji unit Vitest (`tests/unit`)                                     |
| `npm run test:coverage` | Uji unit + laporan cakupan (`coverage/`)                           |
| `npm run test:e2e`      | Playwright E2E (chromium, firefox, webkit, Pixel 7, iPhone 14)     |
| `npm run test:a11y`     | Hanya pemindaian aksesibilitas axe-core (tag `@a11y`, WCAG 2.1 AA) |
| `npm run audit`         | `npm audit` dependensi produksi (level high ke atas)               |
| `npm run ci`            | lint + format:check + typecheck + test — **jalankan sebelum push** |

> Catatan: `next lint` sudah dihapus pada Next.js 16; gunakan `npm run lint` (ESLint CLI).

### Uji E2E

E2E dijalankan terhadap instance **lokal/staging** — jangan pernah terhadap produksi.

```bash
# Server sudah berjalan (npm run dev / npm run start) di port 3002:
npm run test:e2e -- --project=chromium

# Biarkan Playwright menjalankan `npm run start` (butuh `npm run build` lebih dulu):
E2E_START_SERVER=1 npm run test:e2e

# URL lain + alur login (akun uji, bukan akun produksi):
E2E_BASE_URL=http://localhost:3002 E2E_EMAIL=admin@contoh.test E2E_PASSWORD=... npm run test:e2e
```

Laporan HTML tersimpan di `playwright-report/` (`npx playwright show-report`).

## 6. CI (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) — setiap push/PR ke `main` & `develop`:
  lint, format check, typecheck, unit test + coverage, `npm audit` (prod), dan `next build`.
- **E2E** (`.github/workflows/e2e.yml`) — manual (_Run workflow_) & terjadwal tiap malam:
  MySQL service → `prisma db push` → seed → build → start → Playwright + axe.

## 7. Standar kode singkat

- TypeScript strict; hindari `any` — gunakan tipe sempit / `unknown` + narrowing.
- Validasi semua input di server (`src/lib/validate.ts`), cek otorisasi peran di setiap
  server action / route handler, jangan kirim pesan error mentah ke klien (`toActionError`).
- Jangan menulis data pribadi/secret ke log (`src/lib/redact.ts`).
- UI: label untuk setiap input, dapat dioperasikan keyboard, kontras cukup,
  tanpa scroll horizontal pada lebar 320px.
- Tambahkan/perbarui uji untuk setiap perubahan perilaku.
