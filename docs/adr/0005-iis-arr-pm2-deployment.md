# ADR-0005: Deployment di Windows Server dengan IIS ARR + PM2

- **Status:** Diterima
- **Tanggal:** 2026-10-17

## Konteks

Server produksi universitas adalah **Windows Server** yang sudah melayani situs lain melalui **IIS** di port 80/443,
dengan DNS dan proteksi di **Cloudflare**. Next.js membutuhkan proses Node.js yang berjalan terus. Deploy harus dapat
dilakukan oleh satu administrator, dengan downtime minimal dan kemampuan kembali ke versi sebelumnya.

Alternatif: iisnode (tidak lagi dipelihara), Docker penuh untuk aplikasi, Nginx for Windows, layanan Windows via NSSM, PM2.

## Keputusan

- **IIS 10 + URL Rewrite + ARR** sebagai reverse proxy (site `spmi.universitaspahlawan.ac.id`, `deploy/iis/web.config`)
  meneruskan ke `http://127.0.0.1:3002` dan menyetel `X-Forwarded-Proto`; batas unggahan IIS 20 MB.
- **PM2** (app `spmi`, mode fork, 1 instance, `max_memory_restart` 768M, `deploy/ecosystem.config.cjs`) menjalankan
  `server.js` hasil `output: "standalone"` dari `E:\www\spmi-prod\current`, membaca `shared\.env`, `TZ=Asia/Jakarta`.
- **Rilis atomik**: setiap deploy membangun di `git worktree` terpisah, merakit `releases\<timestamp>`, lalu
  memindahkan junction `current`. Data persisten di `shared\` (`.env`, `storage\uploads`, `public-uploads`).
- **Gerbang** `scripts/deploy/deploy-production.ps1`: test → build → backup DB → maintenance IIS (503) → `prisma db push`
  → switch + `pm2 startOrReload` → smoke test `/api/health` → rollback otomatis (restore DB + junction lama) bila gagal.
- **TLS**: Cloudflare _Full (strict)_ + sertifikat di IIS (win-acme/Let's Encrypt atau Cloudflare Origin Certificate).
- MySQL dalam container Docker `spmi-db` di loopback (ADR-0002).

## Konsekuensi

**Positif**

- Memanfaatkan IIS yang sudah ada tanpa mengganggu situs lain; TLS & header dikelola terpusat.
- Rollback cepat (pindah junction) dan otomatis bila smoke test gagal.
- Node tidak terekspos ke jaringan (hanya `127.0.0.1`).

**Negatif / risiko**

- Satu instance: pembatas laju login in-memory valid, tetapi ada jeda singkat saat reload (ditutup halaman pemeliharaan).
- ARR membutuhkan pengaturan khusus (_proxy enabled_, _preserveHostHeader_, `allowedServerVariables`, `responseBufferLimit`);
  salah konfigurasi menyebabkan 502 atau redirect ke alamat internal.
- Rantai proxy (Cloudflare → IIS) mengharuskan penentuan IP klien yang hati-hati (`src/lib/net.ts`, `TRUST_PROXY`)
  dan pembatasan firewall origin ke IP Cloudflare.
- PM2 di Windows perlu mekanisme start-on-boot (`pm2 save` + layanan/Task Scheduler).
- Ketergantungan pada skrip PowerShell; perubahan skrip wajib diuji pada jendela pemeliharaan.
