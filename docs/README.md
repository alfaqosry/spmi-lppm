# Dokumentasi Teknis SPMI

**SPMI — Sistem Penjaminan Mutu Internal**, Lembaga Penjaminan Mutu (LPM) Universitas Pahlawan Tuanku Tambusai
Produksi: <https://spmi.universitaspahlawan.ac.id> · Stack: Next.js 16 (App Router + Server Actions), Prisma + MySQL 8,
SSO UP (OAuth 2.0), PM2 + IIS ARR di belakang Cloudflare (Windows Server).

Dokumentasi ini dikelola sebagai _docs-as-code_: berupa Markdown di repositori, diagram Mermaid, ditinjau lewat PR
bersama perubahan kode terkait (lihat [07-STANDAR-ENGINEERING.md](07-STANDAR-ENGINEERING.md)).

## Daftar Dokumen

| Dokumen                                                  | Isi                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-PERANCANGAN.md](01-PERANCANGAN.md)                   | Kebutuhan fungsional & non-fungsional, aktor/peran, arsitektur, ERD, use case, diagram sekuens, aturan bisnis                                              |
| [02-PANDUAN-PENGEMBANGAN.md](02-PANDUAN-PENGEMBANGAN.md) | Setup lokal, struktur folder, Git Flow, Conventional Commits, SemVer, skrip lint/test/e2e                                                                  |
| [03-API.md](03-API.md)                                   | Endpoint HTTP internal (`/api/sso/*`, `/api/export`, `/api/health`, `/api/me/export`, `/api/files/*`), Server Actions, alasan OpenAPI N/A, kebijakan versi |
| [04-DEPLOYMENT-IIS.md](04-DEPLOYMENT-IIS.md)             | Runbook produksi: prasyarat, direktori, env, deploy/rollback/smoke test, SSL, SSO, tugas terjadwal, pemantauan, troubleshooting                            |
| [05-PANDUAN-PENGGUNA.md](05-PANDUAN-PENGGUNA.md)         | Langkah praktis per peran (pengunjung, auditee, anggota LPM, admin LPM, superadmin)                                                                        |
| [06-PENGUJIAN.md](06-PENGUJIAN.md)                       | Strategi pengujian (Vitest, Playwright, axe), cara menjalankan, checklist UAT per modul                                                                    |
| [07-STANDAR-ENGINEERING.md](07-STANDAR-ENGINEERING.md)   | Konvensi penamaan, bahasa, pola lapisan, penanganan error, checklist keamanan PR, aksesibilitas, format tanggal                                            |
| [09-DAFTAR-STANDAR.md](09-DAFTAR-STANDAR.md)             | Checklist 20 kategori standar pengembangan (keamanan, privasi, a11y, performa, CI/CD, operasional) beserta bukti, status, dan backlog                      |
| [iso/README.md](iso/README.md)                           | Penerapan standar ISO/IEC (25010, 25012, 9241, 29119, 12207, 27001/27002, 27034, 27701, 8601/639/3166, 9001, 42001) beserta status dan dokumennya          |

### Architecture Decision Records

| ADR                                                  | Keputusan                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| [0001](adr/0001-nextjs-app-router-server-actions.md) | Next.js App Router dengan Server Actions sebagai antarmuka utama                 |
| [0002](adr/0002-prisma-mysql.md)                     | Prisma ORM + MySQL 8, sinkronisasi skema `prisma db push`                        |
| [0003](adr/0003-sso-up-oauth2.md)                    | SSO UP via OAuth 2.0 (`@alfaqosry/sso-client-next`), peran tetap dikelola lokal  |
| [0004](adr/0004-jwt-cookie-session.md)               | Sesi JWT HS256 di cookie `__Host-` httpOnly, dibaca ulang dari DB per permintaan |
| [0005](adr/0005-iis-arr-pm2-deployment.md)           | Deployment IIS ARR + PM2 dengan rilis atomik dan rollback otomatis               |
| [0006](adr/0006-private-upload-storage.md)           | Penyimpanan unggahan privat di luar `public/` dengan unduhan terotorisasi        |

### Kepatuhan & Legal (UU 27/2022 PDP)

| Dokumen                                                      | Isi                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [legal/RoPA.md](legal/RoPA.md)                               | Catatan aktivitas pemrosesan: tujuan, subjek, data, dasar hukum, penerima, retensi, keamanan |
| [legal/INSIDEN-DATA.md](legal/INSIDEN-DATA.md)               | Prosedur respons insiden & notifikasi tertulis 3×24 jam (Pasal 46) beserta templat           |
| [legal/CHECKLIST-KEPATUHAN.md](legal/CHECKLIST-KEPATUHAN.md) | Status kepatuhan: Pejabat PDP, pendaftaran PSE, hak subjek data, kontrol keamanan            |

Dokumen terkait di root repositori: `README.md` (ringkasan proyek), `LAPORAN_KEAMANAN.md` (audit keamanan 2026-10-16),
`implementation_plan.md` (rencana awal — sebagian sudah tidak sesuai, mis. Next.js 14 dan paket SSO `@webkampus/*`).

## Temuan Terbuka

Ketidaksesuaian/celah yang ditemukan saat penyusunan dokumentasi (2026-10-17) dan **belum** tertutup pada kode
yang diperiksa. Hapus baris ketika sudah diperbaiki.

| No  | Temuan                                                                                                                                                                                                                                                                                                                | Lokasi                                | Dampak                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| 1   | Alur OAuth tidak memakai parameter `state` (paket SSO v1.0.0)                                                                                                                                                                                                                                                         | `@alfaqosry/sso-client-next/next`     | Login CSRF (korban dapat dimasukkan ke akun penyerang)                |
| 2   | Akun **nonaktif** yang login via SSO tetap diberi cookie sesi dan dicatat "Login SSO berhasil" (akses tetap ditolak oleh `getCurrentUser`)                                                                                                                                                                            | `src/app/api/sso/[...sso]/route.ts`   | Log menyesatkan; seharusnya ditolak dan dicatat gagal                 |
| 3   | Cookie `sso_session` (token + userinfo base64) tidak pernah `Secure` (typo `NODE_NODE_ENV` di paket) dan tidak dipakai aplikasi                                                                                                                                                                                       | paket SSO                             | Token akses SSO tersimpan di browser tanpa perlu                      |
| 4   | Error callback SSO dikembalikan sebagai JSON mentah berbahasa Inggris, dapat memuat respons server SSO                                                                                                                                                                                                                | paket SSO                             | Kebocoran detail, UX buruk (seharusnya redirect `/login?sso_error=…`) |
| 5   | `/api/sso/logout` tidak menghapus sesi aplikasi, lalu redirect ke `/dashboard`                                                                                                                                                                                                                                        | paket SSO + `route.ts`                | Pengguna mengira sudah keluar                                         |
| 6   | `revalidatePath("/laporan")` merujuk rute yang tidak ada                                                                                                                                                                                                                                                              | `src/lib/actions/units.ts`            | Kode mati                                                             |
| 7   | Variabel URL aplikasi: setup menulis `APP_URL`, sementara standar menyebut `NEXT_PUBLIC_APP_URL`; keduanya belum dibaca kode                                                                                                                                                                                          | `scripts/deploy/setup-production.ps1` | Perlu satu nama baku                                                  |
| 8   | Lokasi backup skrip `E:\www\spmi-prod\backups` (disk yang sama), bukan `E:\backup\spmi`; backup pra-deploy hanya DB + `.env`                                                                                                                                                                                          | `scripts/deploy/*.ps1`                | Perlu salinan off-host                                                |
| 9   | `README.md` root usang: struktur menyebut `api/auth/sso/` (aktual `api/sso/[...sso]`); unggahan disebut di `public/uploads/` (kini `UPLOAD_DIR`); SSO role `admin`/`lpm` disebut memberi `lpm_admin` (kini hanya bila `SSO_TRUST_ROLE=true`); Redirect URI hanya contoh localhost; tabel skrip belum memuat lint/test | `README.md`                           | Dokumentasi menyesatkan                                               |
| 10  | Node.js 20 sudah EOL (30-04-2026); server dev memakai v20.19.0, image Docker `node:22-slim`                                                                                                                                                                                                                           | lingkungan                            | Samakan ke Node 22 LTS                                                |
| 11  | Proyek belum memakai `prisma migrate` (hanya `db push`)                                                                                                                                                                                                                                                               | `prisma/`                             | Perubahan skema tidak berversi                                        |
| 12  | Berkas fisik bukti tidak ikut terhapus saat jawaban/standar/siklus/unit dihapus (hapus dokumen sudah memanggil `deleteUpload`)                                                                                                                                                                                        | `src/lib/actions/*`                   | Data pribadi tertinggal melewati retensi                              |
