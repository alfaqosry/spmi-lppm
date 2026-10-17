# ISO/IEC 27034 — Keamanan Aplikasi SPMI

Penerapan ISO/IEC 27034-1:2011 (+ Amd 1:2014) _Application security — Overview and concepts_ dan ISO/IEC 27034-3
(_Application security management process_) pada **Sistem Informasi SPMI — LPM Universitas Pahlawan Tuanku Tambusai**.

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3         | Dokumen Internal |

Dokumen pendamping: [THREAT-MODEL-STRIDE](THREAT-MODEL-STRIDE.md) (analisis ancaman) · [RISK-REGISTER](RISK-REGISTER.md)
(risiko) · [27001-SOA](27001-SOA.md) (kontrol organisasi) · [LAPORAN_KEAMANAN.md](../../LAPORAN_KEAMANAN.md) (hasil audit).

## 1. Kerangka: ONF, ANF, dan ASMP

### 1.1 Organization Normative Framework (ONF)

ONF adalah kumpulan acuan yang berlaku untuk semua aplikasi organisasi. Universitas belum memiliki ONF formal (⏳);
untuk SPMI, ONF **de facto** disusun dari:

| Komponen ONF (27034-1 §8.1)           | Isi untuk SPMI                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konteks bisnis                        | Penjaminan mutu internal (UU 12/2012, Permendikbudristek 53/2023); siklus AMI dengan tenggat                                                         |
| Konteks regulasi                      | UU 27/2022 PDP, UU ITE, PP 71/2019 ([legal/CHECKLIST-KEPATUHAN](../legal/CHECKLIST-KEPATUHAN.md))                                                    |
| Repositori spesifikasi aplikasi       | [01-PERANCANGAN](../01-PERANCANGAN.md), [ADR](../adr/)                                                                                               |
| Konteks teknologi                     | Next.js 16, Prisma 6, MySQL 8, Windows Server + IIS ARR + PM2, Cloudflare                                                                            |
| Peran, tanggung jawab, kualifikasi    | [RENCANA-PEMELIHARAAN §1](RENCANA-PEMELIHARAAN.md#1-ruang-lingkup-dan-peran) (⏳ penunjukan formal)                                                  |
| Pustaka Application Security Control  | §3 dokumen ini; acuan OWASP ASVS 4.0 L2, OWASP Top 10 2021, Mozilla Web Security Guidelines                                                          |
| Proses terkait keamanan aplikasi      | [12207-SIKLUS-HIDUP](12207-SIKLUS-HIDUP.md), manajemen perubahan ([RENCANA-PEMELIHARAAN §4](RENCANA-PEMELIHARAAN.md#4-prosedur-manajemen-perubahan)) |
| Model referensi siklus hidup aplikasi | Git Flow → CI → deploy bergerbang → operasi → pemeliharaan → disposal                                                                                |

### 1.2 Application Normative Framework (ANF) SPMI

ANF = subset ONF yang dipilih untuk SPMI berdasarkan analisis risiko. Komponen ANF SPMI: daftar ASC di §3, tingkat
kepercayaan target di §2, standar engineering ([07](../07-STANDAR-ENGINEERING.md)), checklist PR ([07 §6](../07-STANDAR-ENGINEERING.md#6-keamanan-wajib-per-pr)),
dan prosedur deploy ([04](../04-DEPLOYMENT-IIS.md)).

### 1.3 Application Security Management Process (ASMP)

| Langkah ASMP (27034-1 §8.3)                   | Penerapan SPMI                                                                                 | Artefak                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Menetapkan kebutuhan & lingkungan aplikasi | Lingkup, aktor, data, topologi                                                                 | [01](../01-PERANCANGAN.md), [legal/RoPA](../legal/RoPA.md), [04](../04-DEPLOYMENT-IIS.md) |
| 2. Menilai risiko keamanan aplikasi           | STRIDE per elemen DFD → register risiko                                                        | [THREAT-MODEL-STRIDE](THREAT-MODEL-STRIDE.md), [RISK-REGISTER](RISK-REGISTER.md)          |
| 3. Membuat & memelihara ANF                   | Pemilihan ASC & tingkat kepercayaan; diperbarui pada analisis dampak setiap perubahan          | §2–3 dokumen ini                                                                          |
| 4. Menyediakan & mengoperasikan aplikasi      | ASC diimplementasikan di kode; deploy via `deploy-production.ps1`; operasi via tugas terjadwal | `src/`, `scripts/deploy/`                                                                 |
| 5. Mengaudit keamanan aplikasi                | Pengukuran ASC (§4): test, CodeQL, `npm audit`, smoke test, audit manual                       | `tests/`, `.github/workflows/`, `LAPORAN_KEAMANAN.md`                                     |

## 2. Tingkat Kepercayaan Target (Targeted Level of Trust)

| Aspek                 | Penilaian                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Kerahasiaan           | **Tinggi** — bukti audit dapat memuat data pribadi pihak ketiga (RoPA A-5)                                  |
| Integritas            | **Tinggi** — hasil AMI dipakai untuk akreditasi; verifikasi LPM harus dapat dipercaya                       |
| Ketersediaan          | **Sedang** — tenggat siklus AMI; tidak ada layanan darurat publik                                           |
| Target                | Setara **OWASP ASVS 4.0 Level 2** untuk seluruh aplikasi; kontrol L3 untuk otorisasi berkas bukti dan sesi  |
| Capaian (17 Okt 2026) | ASC §3 terpasang & terverifikasi otomatis; tingkat kepercayaan **belum divalidasi pihak independen** (R-06) |

## 3. Pustaka Application Security Controls (ASC) SPMI

Setiap ASC memiliki: tujuan, implementasi (lokasi kode), dan **pengukuran/verifikasi** (27034-1 §8.1.2.6 — ASC terdiri
atas aktivitas keamanan + aktivitas verifikasi). ASVS = bab OWASP ASVS 4.0 yang dipenuhi.

| ID     | Kontrol                                   | Implementasi (bukti di kode)                                                                                                                                                                                      | Verifikasi                                                                      | ASVS               |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| ASC-01 | Penyimpanan & verifikasi kata sandi       | bcrypt cost 10; bcrypt tiruan untuk email tak terdaftar (anti-enumerasi) — `hashPassword`/`verifyPassword` di `src/lib/auth.ts`                                                                                   | `tests/unit/auth.test.ts`                                                       | V2.4, V2.2         |
| ASC-02 | Kebijakan kata sandi                      | Min. 8, maks. 72 byte, huruf + angka, ≠ email; berlaku di semua titik — `validatePassword` di `src/lib/password.ts`                                                                                               | `tests/unit/password.test.ts`                                                   | V2.1               |
| ASC-03 | Pembatasan laju                           | Fixed window in-memory; login 5×/menit email+IP & 30×/menit IP, SSO 20, ekspor 10, unggah 30, unduh 120, ekspor data 5, ganti sandi 5 — `src/lib/ratelimit.ts` (`LIMITS_RL`)                                      | `tests/unit/ratelimit.test.ts`                                                  | V2.2.1, V11.1.4    |
| ASC-04 | Sesi aman & dapat dicabut                 | JWT HS256 (`sub`+`sv` saja), `iss`/`aud`, cookie `__Host-` httpOnly Secure SameSite=Lax, masa `security.sessionDays`; `session_version` naik saat logout/ganti sandi/ubah peran/nonaktif — `src/lib/auth.ts`      | `tests/unit/auth.test.ts` ("token sesi (JWT)")                                  | V3                 |
| ASC-05 | Rahasia sesi fail-closed                  | `AUTH_SECRET` wajib ≥ 32 karakter di produksi; tanpa fallback — `src/lib/auth.ts`                                                                                                                                 | Review; troubleshooting [04 §11](../04-DEPLOYMENT-IIS.md#11-troubleshooting)    | V6.4, V14.1        |
| ASC-06 | SSO OAuth 2.0 aman                        | Authorization Code + `state` 256-bit sekali pakai, `timingSafeEqual`, Redirect URI dari pengaturan, tanpa open redirect, galat berkode, cookie token paket dihapus — `src/app/api/sso/[...sso]/route.ts`          | `tests/unit/sso.test.ts`; E2E `tests/e2e/auth.spec.ts`                          | V3.5, V3.4         |
| ASC-07 | Pemetaan peran SSO                        | Klaim role SSO tidak dipercaya; akun baru `pengunjung`; `sso.adminEmails` → `lpm_admin` — `resolveLocalRole` di `src/lib/sso.ts`                                                                                  | `tests/unit/sso.test.ts`                                                        | V4.1               |
| ASC-08 | Otorisasi RBAC di server                  | `requireUser/Access/Lpm/LpmAdmin/Superadmin/UnitMember` di baris pertama setiap Server Action & route; `canReadUnit`; proxy tidak mengotorisasi — `src/lib/guards.ts`                                             | `tests/unit/guards.test.ts` (matriks otorisasi peran)                           | V4.1–V4.2          |
| ASC-09 | Anti-eskalasi & anti-IDOR                 | Admin LPM tak dapat memberi/mengubah superadmin (B-1); kepemilikan berkas bukti divalidasi (B-2); pertanyaan harus dari siklus yang sama — `src/lib/actions/units.ts`, `responses.ts`                             | `tests/unit/guards.test.ts`; review                                             | V4.2.1             |
| ASC-10 | Mode pemeliharaan ditegakkan server       | `assertNotMaintenance` di guard — non-superadmin ditolak walau memanggil action langsung — `src/lib/guards.ts`                                                                                                    | `tests/unit/guards.test.ts`                                                     | V4.1.1             |
| ASC-11 | Validasi input terpusat                   | Whitelist field & enum, `parseId`, batas panjang `LIMITS`, `cleanText` (karakter kontrol), `dateField` ketat, `emailField` — `src/lib/validate.ts`                                                                | `tests/unit/validate.test.ts`                                                   | V5.1               |
| ASC-12 | Validasi URL tautan                       | Hanya `http(s)`, tolak kredensial di URL — `isSafeHttpUrl` di `src/lib/errors.ts`                                                                                                                                 | `tests/unit/errors.test.ts`                                                     | V5.1.4             |
| ASC-13 | Keamanan unggahan                         | Whitelist folder (`UPLOAD_FOLDERS`) & ekstensi, magic bytes, tolak PDF `/JavaScript` `/Launch`, gambar tanpa SVG, ≤ 10 MB/2 MB, nama acak, path tervalidasi — `src/lib/upload.ts`                                 | `tests/unit/upload.test.ts`                                                     | V12.1–V12.5        |
| ASC-14 | Penyimpanan & unduhan berkas terotorisasi | `UPLOAD_DIR` di luar web root; `GET /api/files/*` sesi + otorisasi per berkas, `nosniff`, `Content-Disposition`, `private, no-store`, CORP — `src/app/api/files/[...path]/route.ts`, ADR-0006                     | Review; checklist UAT [06 §4.7](../06-PENGUJIAN.md)                             | V12.4–V12.5        |
| ASC-15 | Content Security Policy                   | Nonce per permintaan, `script-src` tanpa `unsafe-inline`, hash skrip tema, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'` — `src/proxy.ts`; `/api/*` `default-src 'none'` — `next.config.ts` | `scripts/deploy/smoke-test.ps1` (header CSP)                                    | V14.4.3            |
| ASC-16 | Header keamanan                           | HSTS 2 tahun, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, `poweredByHeader: false` — `next.config.ts`                                                                               | `smoke-test.ps1` (HSTS, XFO, XCTO, Referrer, Permissions, tanpa `X-Powered-By`) | V14.4              |
| ASC-17 | Proteksi CSRF                             | Pemeriksaan Origin Server Actions + `allowedOrigins`; SameSite=Lax; tidak ada GET yang memutasi — `next.config.ts`, ADR-0004                                                                                      | Review                                                                          | V4.2.2, V13.2.3    |
| ASC-18 | Penanganan error aman                     | `AppError`/`fail`/`toActionError`/`jsonError`: pesan generik Bahasa Indonesia, detail hanya di log server — `src/lib/errors.ts`                                                                                   | `tests/unit/errors.test.ts`                                                     | V7.4               |
| ASC-19 | Pencatatan keamanan                       | `recordLogin` (sukses/gagal, metode, IP, UA), `recordActivity` (aksi sensitif), best-effort — `src/lib/logs.ts`                                                                                                   | `tests/unit/logs.test.ts`                                                       | V7.1–V7.2          |
| ASC-20 | Penyamaran data di log                    | `maskEmail`, `maskPhone`, `maskToken`, `redactText`, `logError`/`logWarn` — `src/lib/redact.ts`                                                                                                                   | `tests/unit/redact.test.ts`                                                     | V7.1.1, V8.3       |
| ASC-21 | IP klien tepercaya                        | `CF-Connecting-IP` hanya dari hop Cloudflare; `TRUST_PROXY`, `TRUSTED_PROXY_CIDRS` — `src/lib/net.ts`                                                                                                             | `tests/unit/net.test.ts`                                                        | V7.1, V11          |
| ASC-22 | Kerahasiaan pengaturan                    | Secret (`sso.clientSecret`) disamarkan ke UI, placeholder tidak menimpa nilai — `getSettingsForAdmin`/`saveSettings` di `src/lib/settings.ts`                                                                     | `tests/unit/settings.test.ts`                                                   | V6.4, V8.1         |
| ASC-23 | Sanitasi ekspor PDF                       | `pdfText()` membuang karakter kontrol/bidi override, membatasi panjang; hanya PDF (tanpa CSV/XLSX → formula injection N/A) — `src/lib/report/data.ts`                                                             | Review                                                                          | V5.3               |
| ASC-24 | Privasi sejak desain                      | Consent berversi, ekspor data subjek, retensi otomatis, minimisasi data ke klien — `src/lib/privacy.ts`, `src/app/api/me/export/route.ts`                                                                         | `tests/unit/privacy.test.ts`                                                    | V8.3               |
| ASC-25 | Integritas waktu bisnis                   | Batas siklus & format eksplisit `Asia/Jakarta`, tak bergantung TZ server (B-13) — `src/lib/cycles.ts`, `src/lib/format.ts`                                                                                        | `tests/unit/cycles.test.ts`, `format.test.ts`                                   | V11.1              |
| ASC-26 | Health check tanpa kebocoran              | `GET /api/health` hanya `{status, db, version, locale}`, `no-store`, timeout 3 dtk — `src/app/api/health/route.ts`                                                                                                | `smoke-test.ps1` (`"db":"ok"`)                                                  | V14.3              |
| ASC-27 | SAST                                      | CodeQL `javascript-typescript`, kueri `security-extended`, push/PR `main`/`develop` + mingguan — `.github/workflows/codeql.yml`                                                                                   | Tab Security → Code scanning                                                    | V1.1 (proses SDLC) |
| ASC-28 | SCA (analisis komposisi perangkat lunak)  | `npm audit --omit=dev --audit-level=high` (job `audit`), Dependabot npm mingguan & Actions bulanan, `overrides` — `.github/workflows/ci.yml`, `.github/dependabot.yml`                                            | Hasil job CI; PR Dependabot                                                     | V14.2              |
| ASC-29 | Build & deploy terkendali                 | Worktree bersih dari tag; gerbang lint/format/typecheck/test; rilis immutable; backup → maintenance → `db push` aman → junction atomik → smoke test → rollback — `scripts/deploy/deploy-production.ps1`           | Log `deploy-<ts>.log`; rollback teruji 17 Okt 2026                              | V14.1              |
| ASC-30 | Isolasi jaringan layanan internal         | Node `HOSTNAME=127.0.0.1`; MySQL `127.0.0.1:33063` — `deploy/ecosystem.config.cjs`, `deploy/docker-compose.db.yml`                                                                                                | `netstat`/review konfigurasi                                                    | V14.1              |
| ASC-31 | Backup & pemulihan                        | Dump harian + mirror unggahan + salinan D:, dump/restore via `docker cp` tanpa sandi di CLI — `scripts/deploy/backup.ps1`, `lib-db.ps1`                                                                           | Uji restore 17 Okt 2026 ke DB sementara                                         | —                  |

## 4. Verifikasi & Audit Keamanan Aplikasi

| Aktivitas                            | Frekuensi                                | Alat / bukti                                                            |
| ------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------- |
| Uji unit (termasuk regresi keamanan) | Setiap commit (hook) & PR (CI)           | `npm run test:coverage` — Vitest (`tests/unit/`)                        |
| SAST                                 | Push/PR + mingguan (Senin)               | CodeQL (`.github/workflows/codeql.yml`)                                 |
| SCA                                  | PR + mingguan                            | `npm audit` (CI), Dependabot                                            |
| Lint keamanan/kualitas               | Setiap commit & PR                       | ESLint (Next core-web-vitals, TypeScript, jsx-a11y), `tsc --noEmit`     |
| E2E & aksesibilitas                  | Manual + terjadwal harian                | Playwright + axe (`.github/workflows/e2e.yml`)                          |
| Verifikasi header pasca-deploy       | Setiap deploy                            | `scripts/deploy/smoke-test.ps1`                                         |
| Audit kode manual                    | Sebelum rilis MAJOR / perubahan sensitif | `LAPORAN_KEAMANAN.md` (16 & 17 Okt 2026: 11 + 18 temuan, semua ditutup) |
| Uji penetrasi independen             | ⏳ sebelum pemakaian luas, lalu tahunan  | Belum dilakukan (R-06)                                                  |
| DAST                                 | ⏳ usulan                                | OWASP ZAP baseline terhadap staging (setelah staging tersedia, R-22)    |

## 5. Ketidaksesuaian & Kontrol yang Diterima

| No  | Butir                                                  | Alasan / perlakuan                                              | Risiko |
| --- | ------------------------------------------------------ | --------------------------------------------------------------- | ------ |
| 1   | ASC-03 in-memory, tidak global bila di-scale           | Diterima selama satu instance PM2                               | R-01   |
| 2   | ASC-15 `style-src 'unsafe-inline'`                     | Atribut style framer-motion/recharts tidak dapat diberi nonce   | R-10   |
| 3   | Tidak ada MFA untuk login lokal                        | Rencana TOTP untuk akun berhak tinggi / wajibkan SSO            | R-13   |
| 4   | Client Secret SSO disimpan plaintext di `app_settings` | Disamarkan ke UI; ikut dump backup → enkripsi backup            | R-19   |
| 5   | GitHub Actions dipin ke tag mayor (bukan SHA)          | Dependabot Actions bulanan; rencana pin SHA                     | R-15   |
| 6   | CSP mengizinkan `static.cloudflareinsights.com`        | Beacon Cloudflare Web Analytics; tinjau bila analitik dimatikan | R-11   |

## 6. Catatan OWASP MASVS

**N/A** — SPMI tidak memiliki aplikasi mobile (Android/iOS); akses dari ponsel melalui browser web responsif
(diuji Playwright profil Pixel 7 & iPhone 14). **Pemicu:** bila aplikasi mobile native/hibrida dibangun, terapkan
OWASP MASVS L1 (minimal) atau L2 (bila menyimpan data pribadi/bukti di perangkat) dan uji dengan MASTG.
Lihat juga [27701-PRIVASI §6](27701-PRIVASI.md#6-owasp-masvs--tidak-berlaku).
