<!--
Judul PR WAJIB mengikuti Conventional Commits, mis.:
  feat(audit): tambah filter siklus pada laporan
  fix(auth): perbaiki redirect setelah logout
Lihat CONTRIBUTING.md.
-->

## Ringkasan

<!-- Apa yang diubah dan mengapa? Tautkan issue terkait. -->

Closes #

## Jenis perubahan

- [ ] `feat` — fitur baru
- [ ] `fix` — perbaikan bug
- [ ] `refactor` / `perf` — tanpa perubahan perilaku / peningkatan performa
- [ ] `docs` / `test` / `build` / `ci` / `chore`
- [ ] **BREAKING CHANGE** (butuh migrasi / mengubah perilaku yang ada)

## Cara menguji

<!-- Langkah verifikasi manual + uji otomatis yang ditambahkan. -->

1.
2.

## Checklist

- [ ] `npm run ci` lulus lokal (lint, format:check, typecheck, test)
- [ ] Uji unit/E2E ditambahkan atau diperbarui untuk perubahan perilaku
- [ ] Perubahan skema Prisma disertai catatan migrasi (`prisma db push` / data)
- [ ] Tidak ada secret, kredensial, atau data pribadi di kode / log / tangkapan layar
- [ ] Input pengguna divalidasi di server; otorisasi peran dicek di server action/route
- [ ] UI: dapat dioperasikan dengan keyboard, label form jelas, kontras memadai, tanpa scroll horizontal di 320px
- [ ] Dokumentasi / `CHANGELOG.md` diperbarui bila relevan

## Tangkapan layar (UI)

<!-- Sebelum / sesudah, desktop & ponsel. Samarkan data pribadi. -->
