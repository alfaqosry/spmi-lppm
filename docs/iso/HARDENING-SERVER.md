# Catatan Pengamanan Server (Hardening) — Windows Server Produksi

Server: Windows Server 2025 yang menjalankan SPMI dan aplikasi lain (IIS, Docker Desktop, PM2).
Dokumen ini mencatat perubahan pengamanan tingkat server beserta buktinya
(ISO/IEC 27001:2022 A.8.9 manajemen konfigurasi, A.8.15 pencatatan log, A.8.20 keamanan jaringan, A.8.7 anti-malware).

## Riwayat perubahan

| Tanggal     | Perubahan                                                                                                                                                                                             | Alasan & bukti                                                                                                                                                                                                                                       | Kontrol 27001 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 20 Okt 2026 | Microsoft Defender real-time, behavior monitoring & IOAV **diaktifkan**; pengecualian hanya disk virtual Docker (`E:\DockerDesktop\wsl\disk\docker_data.vhdx`, `E:\DockerDesktop\wsl\main\ext4.vhdx`) | Sebelumnya dimatikan lewat preferensi lokal. CPU tetap normal; seluruh situs 200 setelah perubahan.                                                                                                                                                  | A.8.7         |
| 22 Okt 2026 | Aturan firewall **`SPMI-SEC Blokir SMB brute force dari 191.101.190.128`** (TCP 445/139 inbound, semua profil)                                                                                        | 20 login NTLM gagal/jam ke akun Administrator (workstation `EUROSTOP-PC`, `XS156236110181`), akun terkunci tiap ±10 menit; 0 login sukses dari IP itu dalam 7 hari. IP tersebut juga gateway lalu lintas web, sehingga hanya port SMB yang diblokir. | A.8.20        |
| 23 Okt 2026 | Aturan **`Windows Remote Management (HTTP-In)`** (semua profil) dibatasi ke `LocalSubnet`                                                                                                             | WinRM menerima autentikasi NTLM; tidak boleh dapat dijangkau dari internet. Tidak ada sesi WinRM aktif saat perubahan.                                                                                                                               | A.8.20, A.8.5 |
| 23 Okt 2026 | Aturan **`Port 3306`** (MySQL80) dibatasi ke `LocalSubnet` (tidak dinonaktifkan)                                                                                                                      | Database tidak boleh terbuka ke internet. Tidak ada koneksi luar aktif; aplikasi lokal memakai loopback (tidak terpengaruh firewall). Server LAN 192.168.1.0/24 tetap dapat mengakses.                                                               | A.8.20        |
| 23 Okt 2026 | Log **Security** Windows diperbesar dari 20 MB menjadi **2 GB** (circular)                                                                                                                            | Log hanya menampung ±48 menit karena ±30.000 event 4798/jam dari `WmiPrvSE.exe` (enumerasi grup oleh program pemantau WMI) — bukti insiden 22 Okt sudah tertimpa. 2 GB ≈ 5 hari pada laju ini.                                                       | A.8.15        |

## Verifikasi setelah perubahan (23 Okt 2026)

- 10 situs di server merespons 200 (SPMI, SSO, Tiket KR, Penjaminan Mutu, LPPM, Kerjasama, JDIH, SIMOKA, Satpam, Kebun Raya).
- MySQL80 (127.0.0.1:3306) dan WinRM lokal tetap dapat diakses.
- Akun Administrator aktif; 0 login gagal dalam jendela log yang tersedia.

## Tindak lanjut yang disarankan (di luar server / butuh keputusan)

1. Tutup di firewall jaringan/hosting: Portainer (18000, 19000, 19443), web Docker langsung (8090, 8091 — harus lewat IIS/Cloudflare),
   Simple TCP Services (7, 9, 13, 17, 19 — nonaktifkan fitur Windows "Simple TCPIP services"), port SMB/RPC dari internet.
2. Telusuri program yang memicu kueri WMI enumerasi grup (event 4798) lalu kurangi frekuensinya.
3. Teruskan log Security ke penyimpanan terpusat (SIEM/syslog) agar retensi ≥ 90 hari (A.8.15, A.8.16).
4. Nama akun admin bawaan dan MFA untuk akses administratif (A.8.5) — lihat [RISK-REGISTER](RISK-REGISTER.md) R-13.
