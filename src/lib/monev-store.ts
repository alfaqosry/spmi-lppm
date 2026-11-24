import { prisma } from "@/lib/prisma";
import { SUMBER } from "@/lib/monev-sync";
import type { GrafikApi, KategoriApi, TabelBundle } from "@/lib/monev-types";

/**
 * Membaca snapshot monev dari database dan menyusunnya kembali menjadi bentuk
 * yang sama persis dengan respons layanan wsstatistik. Dengan begitu komponen
 * dashboard (MonevStats) dapat memakai data lokal tanpa perubahan apa pun.
 */

type BarisJawaban = {
  kelompokId: number | null;
  kelompokNama: string | null;
  pertanyaanId: number;
  pertanyaan: string;
  jawabanId: number | null;
  pilihan: string;
  jumlah: number;
};

/** Susun ulang baris jawaban menjadi struktur `grafik[].jawaban[]`. */
function keGrafik(
  rows: BarisJawaban[],
  idKatKey: string | null,
  namaKatKey: string
): GrafikApi[] {
  const map = new Map<string, GrafikApi>();

  for (const r of rows) {
    const key = `${r.kelompokId ?? ""}|${r.pertanyaanId}|${r.pertanyaan}`;
    let item = map.get(key);
    if (!item) {
      item = {
        id_pertanyaan: r.pertanyaanId,
        pertanyaan: r.pertanyaan,
        jawaban: [],
      };
      if (idKatKey) item[idKatKey] = r.kelompokId ?? 0;
      item[namaKatKey] = r.kelompokNama ?? "";
      map.set(key, item);
    }
    item.jawaban.push({
      id_jawaban: r.jawabanId ?? 0,
      pilihan: r.pilihan,
      jlh: r.jumlah,
    });
  }

  return [...map.values()];
}

export type MonevBundleLokal = {
  tabdosen: TabelBundle;
  tabmhs: TabelBundle;
  tabmhspro: TabelBundle;
  tabmhsunit: TabelBundle;
};

/** Ambil seluruh data satu semester dari database dalam format API. */
export async function bacaBundleDariDb(
  idSmt: string
): Promise<MonevBundleLokal> {
  const [ringkasan, kategori, jawaban, semester] = await Promise.all([
    prisma.monevRingkasan.findMany({
      where: { idSmt },
      orderBy: [{ sumber: "asc" }, { urutan: "asc" }],
    }),
    prisma.monevKategori.findMany({ where: { idSmt } }),
    prisma.monevJawaban.findMany({ where: { idSmt } }),
    prisma.monevSemester.findUnique({ where: { idSmt } }),
  ]);

  if (!ringkasan.length && !kategori.length && !jawaban.length) {
    return { tabdosen: null, tabmhs: null, tabmhspro: null, tabmhsunit: null };
  }

  const metaDasar = {
    id_smt: idSmt,
    semester: semester?.nama ?? idSmt,
    cached: true,
    generated_at: (semester?.syncedAt ?? new Date()).toISOString(),
  };

  const ambilRingkasan = (sumber: string) =>
    ringkasan
      .filter((r) => r.sumber === sumber)
      .map((r) => ({
        nilai: r.nilai,
        predikat: r.predikat ?? "",
        entitasId: r.entitasId,
        entitasNama: r.entitasNama,
      }));

  const ambilKategori = (sumber: string, idField = "id_kmp"): KategoriApi[] =>
    kategori
      .filter((k) => k.sumber === sumber)
      .map((k) => ({
        id_sms: k.entitasId,
        nm_lemb: k.entitasNama,
        [idField]: k.kategoriId ?? 0,
        [idField === "id_kdp" ? "nm_kdp" : "nm_kmp"]: k.kategoriNama,
        nilai: k.nilai,
        predikat: k.predikat ?? "",
      }));

  const jawabanSumber = (sumber: string) =>
    jawaban
      .filter((j) => j.sumber === sumber)
      .map<BarisJawaban>((j) => ({
        kelompokId: j.kelompokId,
        kelompokNama: j.kelompokNama,
        pertanyaanId: j.pertanyaanId,
        pertanyaan: j.pertanyaan,
        jawabanId: j.jawabanId,
        pilihan: j.pilihan,
        jumlah: j.jumlah,
      }));

  // --- tabdosen: prodi dinilai dosen, kategori id_kdp/nm_kdp
  const dosenProdi = ambilRingkasan(SUMBER.dosenProdi).map((r) => ({
    id_sms: r.entitasId,
    nm_lemb: r.entitasNama,
    nilai: r.nilai,
    predikat: r.predikat,
  }));
  const dosenProdiGrafik = keGrafik(
    jawabanSumber(SUMBER.dosenProdi),
    "id_kdp",
    "nm_kdp"
  );
  const tabdosen = dosenProdi.length
    ? {
        success: true,
        meta: {
          ...metaDasar,
          jumlah_prodi: dosenProdi.length,
          jumlah_kategori: new Set(
            ambilKategori(SUMBER.dosenProdi, "id_kdp").map((k) => k.id_kdp)
          ).size,
          jumlah_pertanyaan: new Set(
            dosenProdiGrafik.map((g) => g.id_pertanyaan)
          ).size,
          jumlah_baris: dosenProdiGrafik.length,
        },
        prodi: dosenProdi,
        kategori: ambilKategori(SUMBER.dosenProdi, "id_kdp"),
        grafik: dosenProdiGrafik,
      }
    : null;

  // --- tabmhs: dosen dinilai mahasiswa, kategori hanya nama (nm_kmd)
  const dosen = ambilRingkasan(SUMBER.dosen).map((r) => ({
    id_ptk: r.entitasId,
    nm_ptk: r.entitasNama,
    nilai: r.nilai,
    predikat: r.predikat,
  }));
  const dosenGrafik = keGrafik(jawabanSumber(SUMBER.dosen), null, "nm_kmd");
  const tabmhs = dosen.length
    ? {
        success: true,
        meta: {
          ...metaDasar,
          jumlah_dosen: dosen.length,
          jumlah_pertanyaan: new Set(dosenGrafik.map((g) => g.id_pertanyaan))
            .size,
          jumlah_baris: dosenGrafik.length,
        },
        dosen,
        grafik: dosenGrafik,
      }
    : null;

  // --- tabmhspro: prodi dinilai mahasiswa
  const mhsProdi = ambilRingkasan(SUMBER.mhsProdi).map((r) => ({
    id_sms: r.entitasId,
    nm_lemb: r.entitasNama,
    nilai: r.nilai,
    predikat: r.predikat,
  }));
  const mhsProdiGrafik = keGrafik(
    jawabanSumber(SUMBER.mhsProdi),
    "id_kmp",
    "nm_kmp"
  );
  const tabmhspro = mhsProdi.length
    ? {
        success: true,
        meta: {
          ...metaDasar,
          jumlah_prodi: mhsProdi.length,
          jumlah_kategori: new Set(
            ambilKategori(SUMBER.mhsProdi).map((k) => k.id_kmp)
          ).size,
          jumlah_pertanyaan: new Set(mhsProdiGrafik.map((g) => g.id_pertanyaan))
            .size,
          jumlah_baris: mhsProdiGrafik.length,
        },
        prodi: mhsProdi,
        kategori: ambilKategori(SUMBER.mhsProdi),
        grafik: mhsProdiGrafik,
      }
    : null;

  // --- tabmhsunit: unit layanan dinilai mahasiswa
  const mhsUnit = ambilRingkasan(SUMBER.mhsUnit).map((r) => ({
    id_sms: r.entitasId,
    nm_lemb: r.entitasNama,
    nilai: r.nilai,
    predikat: r.predikat,
  }));
  const mhsUnitGrafik = keGrafik(
    jawabanSumber(SUMBER.mhsUnit),
    "id_kmp",
    "nm_kmp"
  );
  const tabmhsunit = mhsUnit.length
    ? {
        success: true,
        meta: {
          ...metaDasar,
          jumlah_unit: mhsUnit.length,
          jumlah_kategori: new Set(
            ambilKategori(SUMBER.mhsUnit).map((k) => k.id_kmp)
          ).size,
          jumlah_pertanyaan: new Set(mhsUnitGrafik.map((g) => g.id_pertanyaan))
            .size,
          jumlah_baris: mhsUnitGrafik.length,
        },
        unit: mhsUnit,
        kategori: ambilKategori(SUMBER.mhsUnit),
        grafik: mhsUnitGrafik,
      }
    : null;

  return { tabdosen, tabmhs, tabmhspro, tabmhsunit };
}

/** Semester dari database, dibungkus seperti respons API `semester`. */
export async function bacaSemesterDariDb() {
  const rows = await prisma.monevSemester.findMany({
    orderBy: { idSmt: "desc" },
  });

  if (!rows.length) return null;

  return {
    success: true,
    data: rows.map((r) => ({
      id_smt: r.idSmt,
      nama: r.nama,
      aktif: r.aktif,
      tersedia: r.tersedia,
      tersedia_pro: r.tersediaPro,
      tersedia_unit: r.tersediaUnit,
      tersedia_dosen: r.tersediaDosen,
      jumlah_jawaban_pro: r.jumlahJawabanPro,
      jumlah_jawaban_unit: r.jumlahJawabanUnit,
      jumlah_jawaban_dosen: r.jumlahJawabanDosen,
      date_start: r.dateStart ? r.dateStart.toISOString() : null,
      date_end: r.dateEnd ? r.dateEnd.toISOString() : null,
    })),
  };
}

export type TrenNilaiTitik = {
  id_smt: string;
  nama: string;
  /** Rata-rata nilai prodi menurut mahasiswa (kuesioner mahasiswa → prodi). */
  mhs_prodi: number | null;
  /** Rata-rata nilai unit layanan menurut mahasiswa. */
  mhs_unit: number | null;
  /** Rata-rata nilai prodi menurut dosen. */
  dosen_prodi: number | null;
  /** Rata-rata nilai dosen menurut mahasiswa. */
  dosen: number | null;
};

/**
 * Tren nilai rata-rata per instrumen lintas semester.
 *
 * Hanya semester yang pernah disinkronkan yang punya baris ringkasan, jadi
 * panjang deret bisa berbeda antar instrumen. Nilai `null` berarti instrumen
 * tersebut belum punya data pada semester itu (bukan nol) — pembeda penting
 * agar grafik tidak menggambar penurunan palsu ke 0.
 */
export async function trenNilaiDariDb(): Promise<TrenNilaiTitik[]> {
  const [semester, agregat] = await Promise.all([
    prisma.monevSemester.findMany({ orderBy: { idSmt: "asc" } }),
    prisma.monevRingkasan.groupBy({
      by: ["idSmt", "sumber"],
      _avg: { nilai: true },
      _count: { nilai: true },
    }),
  ]);

  const peta = new Map<string, Record<string, number>>();
  for (const a of agregat) {
    const baris = peta.get(a.idSmt) ?? {};
    if (a._avg.nilai != null) baris[a.sumber] = a._avg.nilai;
    peta.set(a.idSmt, baris);
  }

  return semester.map((s) => {
    const v = peta.get(s.idSmt) ?? {};
    return {
      id_smt: s.idSmt,
      nama: s.nama,
      mhs_prodi: v[SUMBER.mhsProdi] ?? null,
      mhs_unit: v[SUMBER.mhsUnit] ?? null,
      dosen_prodi: v[SUMBER.dosenProdi] ?? null,
      dosen: v[SUMBER.dosen] ?? null,
    };
  });
}

/** Statistik ringkas untuk kartu status sinkronisasi. */
export async function statistikLokal() {
  const [semester, ringkasan, jawaban, terakhir] = await Promise.all([
    prisma.monevSemester.count(),
    prisma.monevRingkasan.count(),
    prisma.monevJawaban.count(),
    prisma.monevSyncRun.findFirst({
      where: { status: { in: ["sukses", "gagal"] } },
      orderBy: { mulai: "desc" },
    }),
  ]);

  return {
    jumlahSemester: semester,
    jumlahRingkasan: ringkasan,
    jumlahJawaban: jawaban,
    terakhir: terakhir
      ? {
          status: terakhir.status,
          mulai: terakhir.mulai.toISOString(),
          selesai: terakhir.selesai ? terakhir.selesai.toISOString() : null,
          pesan: terakhir.pesan,
          olehNama: terakhir.olehNama,
          jumlahBaris: terakhir.jumlahBaris,
          mode: terakhir.mode,
        }
      : null,
  };
}
