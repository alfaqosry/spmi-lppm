import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import {
  CONTACT_EMAIL,
  CONTROLLER_UNIT,
  INSTITUTION,
  INSTITUTION_ADDRESS,
  LEGAL_DATE,
  LEGAL_VERSION,
} from "@/components/legal/site";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan Privasi Sistem Informasi SPMI Universitas Pahlawan Tuanku Tambusai sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
  alternates: { canonical: "/kebijakan-privasi" },
  openGraph: { url: "/kebijakan-privasi", type: "article" },
};

const TOC = [
  { id: "pengendali", label: "Identitas Pengendali Data" },
  { id: "data", label: "Data Pribadi yang Dikumpulkan" },
  { id: "tujuan", label: "Tujuan Pemrosesan" },
  { id: "dasar-hukum", label: "Dasar Hukum Pemrosesan" },
  { id: "pihak-ketiga", label: "Pihak Ketiga & Pemroses Data" },
  { id: "retensi", label: "Masa Retensi" },
  { id: "hak", label: "Hak Anda sebagai Subjek Data" },
  { id: "keamanan", label: "Keamanan Data" },
  { id: "cookie", label: "Cookie" },
  { id: "perubahan", label: "Perubahan Kebijakan" },
  { id: "kontak", label: "Kontak" },
];

export default function KebijakanPrivasiPage() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-300">
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <LegalPage
      title="Kebijakan Privasi"
      toc={TOC}
      intro={
        <p>
          Kebijakan ini menjelaskan bagaimana {INSTITUTION} memperoleh,
          menggunakan, menyimpan, dan melindungi data pribadi Anda ketika
          menggunakan Sistem Informasi Sistem Penjaminan Mutu Internal (SPMI),
          sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data
          Pribadi (UU PDP).
        </p>
      }
    >
      <section id="pengendali" aria-labelledby="h-pengendali">
        <h2 id="h-pengendali">1. Identitas Pengendali Data</h2>
        <p>
          Pengendali data pribadi adalah <strong>{INSTITUTION}</strong>,{" "}
          {INSTITUTION_ADDRESS}, yang dalam pengelolaan sistem ini dilaksanakan
          oleh <strong>{CONTROLLER_UNIT}</strong>. Kontak: {mail}.
        </p>
      </section>

      <section id="data" aria-labelledby="h-data">
        <h2 id="h-data">2. Data Pribadi yang Dikumpulkan</h2>
        <ul>
          <li>
            <strong>Identitas akun:</strong> nama lengkap, alamat email
            institusi, NIDN/NIP atau username SSO, serta peran pengguna.
          </li>
          <li>
            <strong>Penempatan kerja:</strong> unit/program studi tempat Anda
            ditugaskan dan jabatan pada unit tersebut (kepala/anggota).
          </li>
          <li>
            <strong>Data audit:</strong> jawaban instrumen audit, alasan,
            rencana tindak lanjut, catatan verifikasi, dan berkas/tautan bukti
            yang Anda unggah.
          </li>
          <li>
            <strong>Data teknis & log:</strong> waktu masuk, alamat IP, jenis
            peramban/perangkat (user-agent), dan log aktivitas (audit trail) di
            dalam sistem.
          </li>
        </ul>
        <p>
          Sistem ini tidak mengumpulkan data pribadi yang bersifat spesifik
          (Pasal 4 ayat (2) UU PDP).
        </p>
      </section>

      <section id="tujuan" aria-labelledby="h-tujuan">
        <h2 id="h-tujuan">3. Tujuan Pemrosesan</h2>
        <ul>
          <li>Autentikasi dan pengelolaan hak akses pengguna.</li>
          <li>
            Pelaksanaan siklus SPMI: penetapan, pelaksanaan, evaluasi (audit
            mutu internal), pengendalian, dan peningkatan standar.
          </li>
          <li>
            Penyusunan laporan audit dan bahan akreditasi institusi maupun
            program studi.
          </li>
          <li>
            Keamanan sistem: pencegahan akses tidak sah, deteksi penyalahgunaan,
            dan penelusuran insiden.
          </li>
        </ul>
        <p>
          Data tidak digunakan untuk pemasaran, profiling komersial, atau dijual
          kepada pihak mana pun.
        </p>
      </section>

      <section id="dasar-hukum" aria-labelledby="h-dasar">
        <h2 id="h-dasar">4. Dasar Hukum Pemrosesan</h2>
        <p>Sesuai Pasal 20 ayat (2) UU PDP, pemrosesan didasarkan pada:</p>
        <ul>
          <li>
            <strong>Pemenuhan kewajiban hukum</strong> pengendali (huruf c) —
            kewajiban perguruan tinggi menyelenggarakan SPMI berdasarkan UU No.
            12 Tahun 2012 tentang Pendidikan Tinggi dan peraturan menteri
            tentang standar nasional pendidikan tinggi;
          </li>
          <li>
            <strong>Pelaksanaan tugas</strong> dalam rangka kepentingan
            umum/pelayanan publik pendidikan tinggi (huruf e); dan
          </li>
          <li>
            <strong>Kepentingan yang sah</strong> (huruf f) — keamanan sistem
            dan pencatatan log.
          </li>
        </ul>
        <p>
          Persetujuan yang Anda berikan saat pertama kali masuk merupakan
          konfirmasi bahwa Anda telah membaca dan memahami kebijakan ini.
        </p>
      </section>

      <section id="pihak-ketiga" aria-labelledby="h-pihak">
        <h2 id="h-pihak">5. Pihak Ketiga &amp; Pemroses Data</h2>
        <ul>
          <li>
            <strong>SSO Universitas Pahlawan</strong> (layanan internal) — untuk
            autentikasi; sistem menerima identitas dasar Anda (nama, email,
            username/NIDN/NIP).
          </li>
          <li>
            <strong>Cloudflare, Inc.</strong> — jaringan pengiriman konten dan
            perlindungan keamanan (DNS, proxy, mitigasi serangan). Lalu lintas,
            termasuk alamat IP, melewati infrastruktur Cloudflare, yang dapat
            berada di luar wilayah Indonesia, dengan perlindungan yang setara
            sesuai Pasal 56 UU PDP.
          </li>
        </ul>
        <p>
          Data hanya diungkapkan kepada pimpinan universitas, LPM, auditor
          internal, dan asesor akreditasi sejauh diperlukan, atau kepada
          otoritas berwenang bila diwajibkan oleh peraturan perundang-undangan.
        </p>
      </section>

      <section id="retensi" aria-labelledby="h-retensi">
        <h2 id="h-retensi">6. Masa Retensi</h2>
        <ul>
          <li>
            Data akun: selama Anda aktif sebagai sivitas yang terlibat dalam
            SPMI.
          </li>
          <li>
            Data audit &amp; bukti: selama diperlukan untuk siklus akreditasi
            dan arsip mutu institusi.
          </li>
          <li>Log login: secara bawaan 90 hari, kemudian dihapus otomatis.</li>
          <li>
            Log aktivitas: sesuai masa simpan yang ditetapkan administrator
            (bawaan 365 hari).
          </li>
        </ul>
        <p>
          Setelah masa retensi berakhir, data dihapus atau dianonimkan sehingga
          tidak lagi dapat mengidentifikasi Anda.
        </p>
      </section>

      <section id="hak" aria-labelledby="h-hak">
        <h2 id="h-hak">7. Hak Anda sebagai Subjek Data</h2>
        <p>Sesuai Pasal 5–13 UU PDP, Anda berhak untuk:</p>
        <ul>
          <li>
            <strong>Mendapatkan informasi</strong> tentang pemrosesan data Anda
            (kebijakan ini).
          </li>
          <li>
            <strong>Mengakses</strong> dan memperoleh salinan data — gunakan
            tombol “Unduh data saya (JSON)” pada halaman Profil.
          </li>
          <li>
            <strong>Memperbaiki</strong> data yang tidak akurat — melalui Admin
            LPM atau SSO.
          </li>
          <li>
            <strong>Memindahkan</strong> data (portabilitas) dalam format yang
            dapat dibaca mesin (JSON).
          </li>
          <li>
            <strong>Mengakhiri pemrosesan dan meminta penghapusan</strong> data,
            dengan tetap memperhatikan kewajiban arsip institusi.
          </li>
          <li>
            <strong>Menarik persetujuan</strong> dan mengajukan keberatan atas
            pemrosesan.
          </li>
        </ul>
        <p>
          Ajukan permintaan melalui email {mail} dari alamat email institusi
          Anda. Kami akan memverifikasi identitas dan menanggapi dalam jangka
          waktu yang ditetapkan UU PDP.
        </p>
      </section>

      <section id="keamanan" aria-labelledby="h-keamanan">
        <h2 id="h-keamanan">8. Keamanan Data</h2>
        <ul>
          <li>Koneksi terenkripsi HTTPS (TLS) dan HSTS.</li>
          <li>
            Kata sandi disimpan sebagai hash bcrypt; sesi menggunakan cookie
            aman (HttpOnly, Secure).
          </li>
          <li>
            Kontrol akses berbasis peran; berkas bukti hanya dapat diakses
            pengguna berwenang.
          </li>
          <li>
            Pembatasan percobaan masuk, pencatatan log, dan pencadangan berkala.
          </li>
        </ul>
        <p>
          Bila terjadi kegagalan pelindungan data pribadi, kami akan
          memberitahukan Anda dan lembaga berwenang paling lambat 3 × 24 jam
          sesuai Pasal 46 UU PDP.
        </p>
      </section>

      <section id="cookie" aria-labelledby="h-cookie">
        <h2 id="h-cookie">9. Cookie</h2>
        <p>
          Sistem hanya memakai cookie yang sangat diperlukan: cookie sesi login
          dan cookie preferensi tema (terang/gelap). Tidak ada cookie iklan atau
          pelacak pihak ketiga.
        </p>
      </section>

      <section id="perubahan" aria-labelledby="h-perubahan">
        <h2 id="h-perubahan">10. Perubahan Kebijakan</h2>
        <p>
          Kebijakan ini dapat diperbarui. Perubahan material akan diberitahukan
          dan Anda akan diminta menyetujui ulang saat masuk. Versi berlaku:{" "}
          {LEGAL_VERSION}, {LEGAL_DATE}.
        </p>
      </section>

      <section id="kontak" aria-labelledby="h-kontak">
        <h2 id="h-kontak">11. Kontak</h2>
        <p>
          {CONTROLLER_UNIT} — {INSTITUTION}
          <br />
          {INSTITUTION_ADDRESS}
          <br />
          Email: {mail}
        </p>
      </section>
    </LegalPage>
  );
}
