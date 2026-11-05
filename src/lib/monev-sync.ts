import { prisma } from "@/lib/prisma";
import { fetchExternal } from "@/app/api/wsstatistik/utils";
import type {
  BarisGrafik,
  BarisNilai,
  OpsiJawaban,
  SemesterApi,
  SemesterPayload,
  TabelPayload,
} from "@/lib/monev-types";

/**
 * Layanan sinkronisasi data kuesioner (wsstatistik) ke database lokal.
 *
 * Alasan data disimpan: dashboard monev sebelumnya bergantung penuh pada
 * layanan eksternal. Bila kuesioner.universitaspahlawan.ac.id lambat/mati,
 * halaman ikut kosong. Dengan snapshot lokal, dashboard tetap tampil dan
 * tombol "Sinkronkan" dipakai untuk memperbarui datanya.
 */

export const SUMBER = {
  dosenProdi: "dosen_prodi",
  mhsProdi: "mhs_prodi",
  mhsUnit: "mhs_unit",
  dosen: "dosen",
} as const;

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown, max: number): string {
  const s = v == null ? "" : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

/** Ambil daftar semester dari layanan eksternal dan simpan (upsert). */
export async function syncSemester(): Promise<number> {
  const raw = await fetchExternal<SemesterPayload>("semester");
  const rows = arr<SemesterApi>(raw?.data);
  if (!rows.length) {
    throw new Error("Layanan semester tidak mengembalikan data.");
  }

  for (const s of rows) {
    const idSmt = String(s.id_smt ?? "").trim();
    if (!idSmt) continue;
    const payload = {
      nama: str(s.nama ?? idSmt, 60),
      aktif: Boolean(s.aktif),
      tersedia: Boolean(s.tersedia),
      tersediaPro: Boolean(s.tersedia_pro),
      tersediaUnit: Boolean(s.tersedia_unit),
      tersediaDosen: Boolean(s.tersedia_dosen),
      jumlahJawabanPro: num(s.jumlah_jawaban_pro),
      jumlahJawabanUnit: num(s.jumlah_jawaban_unit),
      jumlahJawabanDosen: num(s.jumlah_jawaban_dosen),
      dateStart: toDate(s.date_start),
      dateEnd: toDate(s.date_end),
      syncedAt: new Date(),
    };
    await prisma.monevSemester.upsert({
      where: { idSmt },
      update: payload,
      create: { idSmt, ...payload },
    });
  }
  return rows.length;
}

/**
 * Simpan satu semester: 4 endpoint ditarik paralel, lalu seluruh baris
 * semester tersebut diganti dalam satu transaksi agar tidak ada data separuh.
 */
export async function syncSemesterData(idSmt: string): Promise<number> {
  const [tabdosen, tabmhs, tabmhspro, tabmhsunit] = await Promise.all([
    fetchExternal<TabelPayload>("tabdosen", { id_smt: idSmt }),
    fetchExternal<TabelPayload>("tabmhs", { id_smt: idSmt }),
    fetchExternal<TabelPayload>("tabmhspro", { id_smt: idSmt }),
    fetchExternal<TabelPayload>("tabmhsunit", { id_smt: idSmt }),
  ]);

  if (!tabdosen && !tabmhs && !tabmhspro && !tabmhsunit) {
    throw new Error(`Semester ${idSmt} tidak mengembalikan data apa pun.`);
  }

  const ringkasan: {
    idSmt: string;
    sumber: string;
    entitasId: string;
    entitasNama: string;
    nilai: number;
    predikat: string | null;
    urutan: number;
  }[] = [];
  const kategori: {
    idSmt: string;
    sumber: string;
    entitasId: string;
    entitasNama: string;
    indukId: string | null;
    indukNama: string | null;
    kategoriId: number | null;
    kategoriNama: string;
    nilai: number;
    predikat: string | null;
  }[] = [];
  const jawaban: {
    idSmt: string;
    sumber: string;
    kelompokId: number | null;
    kelompokNama: string | null;
    pertanyaanId: number;
    pertanyaan: string;
    opsi: string | null;
    jawabanId: number | null;
    pilihan: string;
    jumlah: number;
  }[] = [];

  /** Prodi/unit/dosen: daftar nilai akhir + predikat. */
  const pushRingkasan = (
    sumber: string,
    list: BarisNilai[],
    idKey: string,
    namaKey: string
  ) => {
    list.forEach((row, i) => {
      const entitasId = String(row?.[idKey] ?? "").trim();
      if (!entitasId) return;
      ringkasan.push({
        idSmt,
        sumber,
        entitasId,
        entitasNama: str(row?.[namaKey] ?? entitasId, 200),
        nilai: num(row?.nilai),
        predikat: row?.predikat ? str(row.predikat, 40) : null,
        urutan: i,
      });
    });
  };

  /** Kategori/aspek per entitas. */
  const pushKategori = (
    sumber: string,
    list: BarisNilai[],
    idKey: string,
    namaKey: string,
    idKatKey: string,
    namaKatKey: string
  ) => {
    list.forEach((row) => {
      const entitasId = String(row?.[idKey] ?? "").trim();
      const kategoriNama = str(row?.[namaKatKey] ?? "", 300);
      if (!entitasId || !kategoriNama) return;
      kategori.push({
        idSmt,
        sumber,
        entitasId,
        entitasNama: str(row?.[namaKey] ?? entitasId, 200),
        indukId: null,
        indukNama: null,
        kategoriId: row?.[idKatKey] == null ? null : num(row[idKatKey]),
        kategoriNama,
        nilai: num(row?.nilai),
        predikat: row?.predikat ? str(row.predikat, 40) : null,
      });
    });
  };

  /** Distribusi jawaban per pertanyaan (sumber grafik). */
  const pushGrafik = (
    sumber: string,
    list: BarisGrafik[],
    katIdKey: string | null,
    katNamaKey: string
  ) => {
    list.forEach((q) => {
      const pertanyaanId = num(q?.id_pertanyaan);
      const pertanyaan = str(q?.pertanyaan ?? "-", 500);
      arr<OpsiJawaban>(q?.jawaban).forEach((a) => {
        jawaban.push({
          idSmt,
          sumber,
          kelompokId:
            katIdKey && q?.[katIdKey] != null ? num(q[katIdKey]) : null,
          kelompokNama: q?.[katNamaKey] ? str(q[katNamaKey], 300) : null,
          pertanyaanId,
          pertanyaan,
          opsi: null,
          jawabanId: a?.id_jawaban == null ? null : num(a.id_jawaban),
          pilihan: str(a?.pilihan ?? "-", 60),
          jumlah: num(a?.jlh),
        });
      });
    });
  };

  // --- tabdosen: penilaian dosen terhadap prodi (kategori = id_kdp/nm_kdp)
  pushRingkasan(SUMBER.dosenProdi, arr(tabdosen?.prodi), "id_sms", "nm_lemb");
  pushKategori(
    SUMBER.dosenProdi,
    arr(tabdosen?.kategori),
    "id_sms",
    "nm_lemb",
    "id_kdp",
    "nm_kdp"
  );
  pushGrafik(SUMBER.dosenProdi, arr(tabdosen?.grafik), "id_kdp", "nm_kdp");

  // --- tabmhs: penilaian mahasiswa terhadap dosen (kategori = nm_kmd, tanpa id)
  pushRingkasan(SUMBER.dosen, arr(tabmhs?.dosen), "id_ptk", "nm_ptk");
  pushGrafik(SUMBER.dosen, arr(tabmhs?.grafik), null, "nm_kmd");

  // --- tabmhspro: mahasiswa terhadap prodi (kategori = id_kmp/nm_kmp)
  pushRingkasan(SUMBER.mhsProdi, arr(tabmhspro?.prodi), "id_sms", "nm_lemb");
  pushKategori(
    SUMBER.mhsProdi,
    arr(tabmhspro?.kategori),
    "id_sms",
    "nm_lemb",
    "id_kmp",
    "nm_kmp"
  );
  pushGrafik(SUMBER.mhsProdi, arr(tabmhspro?.grafik), "id_kmp", "nm_kmp");

  // --- tabmhsunit: mahasiswa terhadap unit layanan (kategori = id_kmp/nm_kmp)
  pushRingkasan(SUMBER.mhsUnit, arr(tabmhsunit?.unit), "id_sms", "nm_lemb");
  pushKategori(
    SUMBER.mhsUnit,
    arr(tabmhsunit?.kategori),
    "id_sms",
    "nm_lemb",
    "id_kmp",
    "nm_kmp"
  );
  pushGrafik(SUMBER.mhsUnit, arr(tabmhsunit?.grafik), "id_kmp", "nm_kmp");

  const total = ringkasan.length + kategori.length + jawaban.length;

  // Ganti total per semester agar data lama tidak menumpuk saat nilai berubah.
  await prisma.$transaction(
    async (tx) => {
      await tx.monevJawaban.deleteMany({ where: { idSmt } });
      await tx.monevKategori.deleteMany({ where: { idSmt } });
      await tx.monevRingkasan.deleteMany({ where: { idSmt } });

      if (ringkasan.length)
        await tx.monevRingkasan.createMany({ data: ringkasan });
      if (kategori.length)
        await tx.monevKategori.createMany({ data: kategori });
      if (jawaban.length) await tx.monevJawaban.createMany({ data: jawaban });
    },
    { timeout: 30_000 }
  );

  return total;
}

/** Semester yang punya jawaban — hanya ini yang perlu ditarik detailnya. */
export async function daftarSemesterTersedia(): Promise<string[]> {
  const rows = await prisma.monevSemester.findMany({
    where: {
      OR: [
        { tersedia: true },
        { tersediaPro: true },
        { tersediaUnit: true },
        { tersediaDosen: true },
      ],
    },
    orderBy: { idSmt: "desc" },
    select: { idSmt: true },
  });
  return rows.map((r) => r.idSmt);
}
