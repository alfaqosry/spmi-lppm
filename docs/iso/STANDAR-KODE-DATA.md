# Standar Kode Data — ISO 8601 · ISO 639-1 · ISO 3166-1 · ISO 4217

Penerapan standar representasi data internasional pada **Sistem Informasi SPMI — LPM Universitas Pahlawan
Tuanku Tambusai** (`https://spmi.universitaspahlawan.ac.id`).

| Versi dokumen | Tanggal         | Versi aplikasi | Klasifikasi      |
| ------------- | --------------- | -------------- | ---------------- |
| 1.0           | 17 Oktober 2026 | v1.1.3+        | Dokumen Internal |

Terkait: [07-STANDAR-ENGINEERING §8](../07-STANDAR-ENGINEERING.md#8-tanggal-waktu-dan-angka),
[09-DAFTAR-STANDAR §18](../09-DAFTAR-STANDAR.md#18-struktur-data), [03-API](../03-API.md).

## 1. Ringkasan

| Standar                        | Ruang lingkup   | Nilai di SPMI                                      | Status                                        |
| ------------------------------ | --------------- | -------------------------------------------------- | --------------------------------------------- |
| **ISO 8601-1:2019**            | Tanggal & waktu | `2026-10-17T10:39:00.000+07:00`, `2026-10-17`      | ✅ semua pertukaran data (JSON, nama berkas)  |
| **IANA Time Zone Database**    | Zona waktu      | `Asia/Jakarta` (WIB, UTC+07:00, tanpa DST)         | ✅                                            |
| **ISO 639-1:2002**             | Kode bahasa     | `id` (Bahasa Indonesia)                            | ✅ `<html lang="id">`, `Content-Language: id` |
| **BCP 47 (RFC 5646)**          | Tag lokal       | `id-ID` (format tampilan `Intl`), `id_ID` (OG)     | ✅                                            |
| **ISO 3166-1 alpha-2**         | Kode negara     | `ID` (Indonesia)                                   | ✅ metadata `locale.country`                  |
| **ISO 4217**                   | Kode mata uang  | —                                                  | **N/A** — tidak ada data moneter              |
| **Unicode / UTF-8 (RFC 3629)** | Pengodean teks  | MySQL `utf8mb4` / `utf8mb4_unicode_ci`, JSON UTF-8 | ✅                                            |

## 2. ISO 8601 — Tanggal dan Waktu

| Lapisan                       | Aturan                                                                                                               | Bukti                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Penyimpanan                   | `DATETIME` disimpan **UTC** oleh Prisma; kontainer DB `TZ: UTC`; kolom tanggal siklus bertipe `DATE`                 | `prisma/schema.prisma`, `deploy/docker-compose.db.yml`                                 |
| Pertukaran (JSON API, ekspor) | ISO 8601 **lengkap dengan offset** `+07:00` (format diperluas, presisi milidetik)                                    | `toIsoJakarta()` & `toIsoDate()` di `src/lib/format.ts`; dipakai `buildMyDataExport()` |
| Tanggal saja                  | `YYYY-MM-DD`; input divalidasi ketat (tanggal tak valid seperti `2025-02-31` ditolak)                                | `dateField()` di `src/lib/validate.ts`                                                 |
| Nama berkas                   | `data-saya-spmi-2026-10-17.json` (ekspor data pribadi)                                                               | `src/app/api/me/export/route.ts`                                                       |
| Log operasional               | `Get-Date -Format o` (ISO 8601 round-trip) pada `backup.log`; `toISOString()` (UTC, `Z`) pada `privacy-purge.log`    | `scripts/deploy/backup.ps1`, `scripts/privacy-purge.ts`                                |
| Stempel rilis/backup          | `yyyyMMdd-HHmmss` (format **dasar** ISO 8601 tanpa pemisah `T`, waktu lokal server) — dipakai sebagai nama direktori | `scripts/deploy/deploy-production.ps1`, `backup.ps1`                                   |
| Tampilan ke pengguna          | **Bukan** ISO 8601 — `Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta" })`, mis. `17 Okt 2026`                | `formatDate()`, `formatDateTime()` di `src/lib/format.ts`                              |
| Batas waktu bisnis            | Siklus terbuka sampai akhir hari `end_date` WIB, tidak bergantung TZ server                                          | `src/lib/cycles.ts` (perbaikan B-13, `LAPORAN_KEAMANAN.md`)                            |
| Zona proses                   | `TZ=Asia/Jakarta` di PM2; `APP_TIMEZONE`; sinkronisasi jam server via NTP Windows (`time.windows.com`)               | `deploy/ecosystem.config.cjs`, `w32tm /query /status`                                  |

Catatan: stempel `yyyyMMdd-HHmmss` adalah representasi ISO 8601 _basic format_ yang dipotong (tanpa `T` dan offset).
Ini disengaja agar aman sebagai nama direktori Windows; zona waktu implisit = WIB (zona server).

## 3. ISO 639-1, BCP 47, ISO 3166-1 — Bahasa, Lokal, Negara

| Titik                   | Nilai                  | Bukti                                                                                      |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| Atribut dokumen HTML    | `lang="id"`            | `src/app/layout.tsx`, `src/app/global-error.tsx`                                           |
| Open Graph              | `locale: "id_ID"`      | `src/app/layout.tsx` (format OG memakai garis bawah)                                       |
| Format angka/tanggal    | `id-ID`                | `src/lib/format.ts`                                                                        |
| Header respons API      | `Content-Language: id` | `src/app/api/health/route.ts`, `src/app/api/me/export/route.ts`                            |
| Metadata JSON eksplisit | objek `locale` (§4)    | `LOCALE_METADATA` di `src/lib/privacy.ts`                                                  |
| Pesan galat/validasi    | Bahasa Indonesia baku  | `src/lib/errors.ts`, `src/lib/validate.ts`; [07 §2](../07-STANDAR-ENGINEERING.md#2-bahasa) |

SPMI bersifat **eka-bahasa** (Indonesia). Tidak ada negosiasi `Accept-Language`; bila kelak ditambah bahasa lain
(mis. `en`), gunakan tag BCP 47 (`en`, `en-US`) dan setel `Content-Language` sesuai bahasa respons.

## 4. Metadata `locale` pada API

Mulai v1.1.3+ (`[Unreleased]`), dua endpoint JSON menyertakan objek berikut dan header `Content-Language: id`:

- `GET /api/health` → field tingkat atas `locale` (field lama `status`, `db`, `version` tidak berubah;
  `smoke-test.ps1` tetap memeriksa `"db":"ok"`).
- `GET /api/me/export` → field tingkat atas `locale` (di samping `meta`, `profile`, …; `meta.formatVersion` tetap `1`
  karena penambahan field bersifat kompatibel ke belakang).

```json
{
  "locale": {
    "language": "id",
    "locale": "id-ID",
    "country": "ID",
    "timezone": "Asia/Jakarta",
    "utcOffset": "+07:00",
    "dateFormat": "ISO 8601",
    "currency": null,
    "currencyNote": "SPMI tidak memproses data moneter; kode mata uang ISO 4217 tidak berlaku (N/A)."
  }
}
```

| Field          | Standar            | Arti                                                                      |
| -------------- | ------------------ | ------------------------------------------------------------------------- |
| `language`     | ISO 639-1          | Bahasa konten respons                                                     |
| `locale`       | BCP 47             | Lokal format tampilan                                                     |
| `country`      | ISO 3166-1 alpha-2 | Negara yurisdiksi data (Indonesia; relevan UU 27/2022 PDP)                |
| `timezone`     | IANA tz            | Zona waktu acuan seluruh timestamp (`APP_TIME_ZONE`, `src/lib/format.ts`) |
| `utcOffset`    | ISO 8601 (offset)  | Offset tetap WIB (Indonesia tidak memakai DST)                            |
| `dateFormat`   | —                  | Seluruh timestamp dalam respons memakai ISO 8601                          |
| `currency`     | ISO 4217           | `null` — tidak berlaku                                                    |
| `currencyNote` | —                  | Penjelasan N/A                                                            |

Sumber tunggal: `LOCALE_METADATA` dan `CONTENT_LANGUAGE` di `src/lib/privacy.ts`.

## 5. ISO 4217 — Mata Uang (N/A)

SPMI tidak menyimpan, menghitung, atau menampilkan nilai moneter (tidak ada transaksi, tarif, atau anggaran;
Kebijakan Refund juga N/A di `/syarat-ketentuan`). **Kondisi pemicu:** bila kelak ditambahkan data anggaran
RTL/biaya, simpan nilai sebagai bilangan bulat satuan terkecil (`DECIMAL(18,2)` atau integer sen) **bersama**
kode ISO 4217 (`IDR`), tampilkan dengan `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" })`,
dan perbarui objek `locale.currency` menjadi `"IDR"`.

## 6. Daftar Periksa untuk Kontributor

- [ ] Timestamp baru di JSON/ekspor memakai `toIsoJakarta()` (bukan `toLocaleString`/string bebas).
- [ ] Tanggal tampilan memakai `formatDate()`/`formatDateTime()` (lokal `id-ID`, zona `Asia/Jakarta`).
- [ ] Endpoint JSON baru menyetel `Content-Type: application/json; charset=utf-8` dan `Content-Language: id`.
- [ ] Tidak menambah kode negara/bahasa sebagai teks bebas — pakai kode ISO di atas.
