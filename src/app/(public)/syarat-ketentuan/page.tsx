import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import {
  CONTACT_EMAIL,
  CONTROLLER_UNIT,
  INSTITUTION,
} from "@/components/legal/site";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat dan Ketentuan penggunaan Sistem Informasi SPMI Universitas Pahlawan Tuanku Tambusai.",
  alternates: { canonical: "/syarat-ketentuan" },
  openGraph: { url: "/syarat-ketentuan", type: "article" },
};

const TOC = [
  { id: "ruang-lingkup", label: "Ruang Lingkup" },
  { id: "akun", label: "Akun & Akses" },
  { id: "kewajiban", label: "Kewajiban Pengguna" },
  { id: "larangan", label: "Larangan" },
  { id: "konten", label: "Konten & Berkas Bukti" },
  { id: "privasi", label: "Privasi" },
  { id: "ketersediaan", label: "Ketersediaan Layanan" },
  { id: "sanksi", label: "Sanksi" },
  { id: "hukum", label: "Hukum yang Berlaku" },
  { id: "kontak", label: "Kontak" },
];

export default function SyaratKetentuanPage() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-300">
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <LegalPage
      title="Syarat & Ketentuan Penggunaan"
      toc={TOC}
      intro={
        <p>
          Dengan masuk dan menggunakan Sistem Informasi SPMI, Anda menyetujui
          syarat dan ketentuan berikut. Sistem ini dikelola oleh{" "}
          {CONTROLLER_UNIT} {INSTITUTION}.
        </p>
      }
    >
      <section id="ruang-lingkup" aria-labelledby="h-lingkup">
        <h2 id="h-lingkup">1. Ruang Lingkup</h2>
        <p>
          Sistem digunakan khusus untuk pelaksanaan Sistem Penjaminan Mutu
          Internal: pengelolaan siklus audit, instrumen, jawaban dan bukti unit,
          verifikasi LPM, serta pelaporan.
        </p>
      </section>

      <section id="akun" aria-labelledby="h-akun">
        <h2 id="h-akun">2. Akun &amp; Akses</h2>
        <ul>
          <li>
            Akses hanya diberikan kepada sivitas akademika yang ditetapkan LPM.
          </li>
          <li>
            Akun bersifat pribadi dan tidak boleh dipinjamkan atau dibagikan.
          </li>
          <li>
            Anda bertanggung jawab menjaga kerahasiaan kata sandi/sesi SSO Anda
            dan segera melapor bila terjadi penyalahgunaan.
          </li>
          <li>
            LPM dapat mengubah peran, menonaktifkan, atau mencabut akses sesuai
            kebutuhan penugasan.
          </li>
        </ul>
      </section>

      <section id="kewajiban" aria-labelledby="h-kewajiban">
        <h2 id="h-kewajiban">3. Kewajiban Pengguna</h2>
        <ul>
          <li>
            Mengisi jawaban audit secara jujur, akurat, dan dapat
            dipertanggungjawabkan.
          </li>
          <li>
            Mengunggah bukti yang sah dan relevan, serta tidak memuat data
            pribadi pihak lain melebihi keperluan audit.
          </li>
          <li>
            Menindaklanjuti catatan verifikasi dan rencana tindak lanjut sesuai
            tenggat siklus.
          </li>
        </ul>
      </section>

      <section id="larangan" aria-labelledby="h-larangan">
        <h2 id="h-larangan">4. Larangan</h2>
        <ul>
          <li>Memalsukan data atau dokumen bukti.</li>
          <li>
            Mengakses atau mencoba mengakses data di luar kewenangan peran Anda.
          </li>
          <li>
            Mengunggah berkas berbahaya (malware) atau konten yang melanggar
            hukum.
          </li>
          <li>
            Melakukan uji penetrasi, pemindaian otomatis, atau mengganggu
            kinerja sistem tanpa izin tertulis LPM.
          </li>
        </ul>
      </section>

      <section id="konten" aria-labelledby="h-konten">
        <h2 id="h-konten">5. Konten &amp; Berkas Bukti</h2>
        <p>
          Berkas yang diunggah menjadi bagian dari arsip mutu institusi dan
          dapat digunakan untuk keperluan audit internal, evaluasi, dan
          akreditasi.
        </p>
      </section>

      <section id="privasi" aria-labelledby="h-privasi">
        <h2 id="h-privasi">6. Privasi</h2>
        <p>
          Pemrosesan data pribadi diatur dalam{" "}
          <Link href="/kebijakan-privasi" className="text-indigo-300">
            Kebijakan Privasi
          </Link>{" "}
          yang merupakan bagian tidak terpisahkan dari syarat ini.
        </p>
      </section>

      <section id="ketersediaan" aria-labelledby="h-ketersediaan">
        <h2 id="h-ketersediaan">7. Ketersediaan Layanan</h2>
        <p>
          Sistem dapat sementara tidak tersedia karena pemeliharaan atau
          gangguan teknis. LPM akan berupaya memberikan pemberitahuan sebelumnya
          untuk pemeliharaan terjadwal.
        </p>
      </section>

      <section id="sanksi" aria-labelledby="h-sanksi">
        <h2 id="h-sanksi">8. Sanksi</h2>
        <p>
          Pelanggaran dapat mengakibatkan penonaktifan akun dan diproses sesuai
          peraturan kepegawaian/akademik universitas serta peraturan
          perundang-undangan.
        </p>
      </section>

      <section id="hukum" aria-labelledby="h-hukum">
        <h2 id="h-hukum">9. Hukum yang Berlaku</h2>
        <p>
          Syarat ini tunduk pada hukum Republik Indonesia, termasuk UU No. 11
          Tahun 2008 tentang Informasi dan Transaksi Elektronik beserta
          perubahannya dan UU No. 27 Tahun 2022 tentang Pelindungan Data
          Pribadi.
        </p>
      </section>

      <section id="kontak" aria-labelledby="h-kontak">
        <h2 id="h-kontak">10. Kontak</h2>
        <p>Pertanyaan mengenai syarat ini dapat disampaikan ke {mail}.</p>
      </section>
    </LegalPage>
  );
}
