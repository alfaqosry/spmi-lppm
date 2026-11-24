"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BarisGrafik,
  BarisNilai,
  OpsiJawaban,
  SemesterApi,
  SemesterPayload,
  TabelPayload,
} from "@/lib/monev-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  Building2,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Download,
  GraduationCap,
  Loader2,
  MessageSquare,
  Trophy,
  Users,
} from "lucide-react";
import { ChartPanel } from "@/components/charts/chart-panel";
import { unduhCsv } from "@/lib/csv";
import { PrioritasPerbaikan, AspekTerendah } from "./StatsTable";
import { DosenDetailModal } from "./dosen-detail-modal";

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const trunc = (s: string, n = 30) =>
  typeof s === "string" && s.length > n
    ? `${s.slice(0, n - 1)}…`
    : String(s ?? "");

const SCORE: Record<string, number> = {
  "Sangat Baik": 5,
  Baik: 4,
  "Cukup Baik": 3,
  Cukup: 3,
  "Kurang Baik": 2,
  Kurang: 2,
  "Sangat Kurang": 1,
};

const predikatBadge: Record<string, string> = {
  "Sangat Baik": "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  Baik: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  "Cukup Baik": "border-amber-400/30 bg-amber-500/15 text-amber-300",
  Cukup: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  Kurang: "border-rose-400/30 bg-rose-500/15 text-rose-300",
  "Sangat Kurang": "border-rose-400/30 bg-rose-500/15 text-rose-300",
};

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#94a3b8"];

const tooltipStyle = {
  backgroundColor: "var(--modal-bg)",
  border: "1px solid rgba(129,140,248,0.25)",
  borderRadius: "0.75rem",
  fontSize: "12px",
  color: "var(--body-color)",
};

const GRID = "color-mix(in oklab, var(--color-slate-500) 18%, transparent)";
const TICK = { fill: "var(--color-slate-500)", fontSize: 11 } as const;
const LEGEND = { fontSize: 11, color: "var(--color-slate-500)" } as const;

/**
 * Ambang predikat menurut data layanan kuesioner: nilai 5.00 = "Sangat Baik",
 * 4.00–4.99 = "Baik", di bawah 4.00 = "Cukup". Ditampilkan sebagai legenda agar
 * pembaca tahu mengapa hampir semua entitas berpredikat sama.
 */
const _AMBANG_PREDIKAT = [
  { label: "Sangat Baik", min: 5, cls: "bg-emerald-400" },
  { label: "Baik", min: 4, cls: "bg-indigo-400" },
  { label: "Cukup", min: 0, cls: "bg-amber-400" },
] as const;

/**
 * Rentang sumbu Y yang mengikuti sebaran nilai.
 *
 * Skala tetap 0–5 membuat seluruh batang tampak sama panjang karena nilai
 * nyata hanya bergerak di 4.0–4.6 (bahkan 4.25–4.31 untuk unit layanan).
 * Rentang dipersempit ke sekitar data, tetapi tidak pernah melebar dari 0–5.
 */
function domainNilai(nilai: number[]): [number, number] {
  const bersih = nilai.filter((v) => Number.isFinite(v) && v > 0);
  if (bersih.length === 0) return [0, 5];
  const min = Math.min(...bersih);
  const max = Math.max(...bersih);
  // Beri ruang agar batang tertinggi tidak menempel ke tepi atas.
  const bawah = Math.max(0, Math.floor((min - 0.15) * 10) / 10);
  const atas = Math.min(5, Math.ceil((max + 0.1) * 10) / 10);
  // Bila sebarannya terlalu sempit, tetap tampilkan rentang yang terbaca.
  if (atas - bawah < 0.5) {
    return [Math.max(0, atas - 0.6), Math.min(5, bawah + 0.6)];
  }
  return [bawah, atas];
}

/** Keterangan singkat tiap instrumen: siapa menilai siapa. */
const _INSTRUMEN = {
  dosen: { label: "Mahasiswa → Dosen", singkat: "Dosen", warna: "#6366f1" },
  mhsProdi: { label: "Mahasiswa → Prodi", singkat: "Prodi", warna: "#8b5cf6" },
  mhsUnit: { label: "Mahasiswa → Unit", singkat: "Unit", warna: "#10b981" },
  dosenProdi: {
    label: "Dosen → Prodi",
    singkat: "Prodi (dosen)",
    warna: "#f59e0b",
  },
} as const;

export type KunciInstrumen = keyof typeof _INSTRUMEN;

/* ------------------------------------------------------------------ */
/* Sub-komponen                                                        */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "indigo",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  accent?: "indigo" | "emerald" | "amber" | "sky" | "violet";
}) {
  const tone: Record<string, string> = {
    indigo: "border-indigo-400/25 bg-indigo-500/15 text-indigo-300",
    emerald: "border-emerald-400/25 bg-emerald-500/15 text-emerald-300",
    amber: "border-amber-400/25 bg-amber-500/15 text-amber-300",
    sky: "border-sky-400/25 bg-sky-500/15 text-sky-300",
    violet: "border-violet-400/25 bg-violet-500/15 text-violet-300",
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone[accent]}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-semibold leading-tight text-white">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

function Predikat({ value }: { value?: string }) {
  const cls =
    predikatBadge[value ?? ""] ??
    "border-slate-600/40 bg-slate-700/30 text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {value ?? "-"}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3 mt-8 flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 text-indigo-400" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
    </div>
  );
}

function RankingTable({
  rows,
  labelKey,
  subKey,
  emptyText = "Belum ada data.",
  onRowClick,
  sorotNilai,
}: {
  rows: Record<string, unknown>[];
  labelKey: string;
  subKey?: string;
  emptyText?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  /** Baris dengan nilai ini diberi penanda "terendah". */
  sorotNilai?: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-xs text-slate-400">
        {emptyText}
      </div>
    );
  }

  // Batang nilai dipetakan ke rentang data, bukan 0–5, supaya selisih kecil
  // (mis. 4.25 vs 4.31 antar unit) tetap terlihat.
  const nilaiSemua = rows.map((r) => num(r.nilai)).filter((v) => v > 0);
  const bawah = nilaiSemua.length ? Math.min(...nilaiSemua) : 0;
  const atas = nilaiSemua.length ? Math.max(...nilaiSemua) : 5;
  const lebar = (v: number) =>
    atas === bawah ? 100 : 35 + ((v - bawah) / (atas - bawah)) * 65;

  return (
    <div className="card overflow-hidden">
      <div className="max-h-[460px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-800/80 backdrop-blur">
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="w-10 px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Nama</th>
              {subKey && (
                <th className="px-3 py-2.5 font-medium">Keterangan</th>
              )}
              <th className="w-40 px-3 py-2.5 font-medium">Nilai</th>
              <th className="w-32 px-3 py-2.5 font-medium">Predikat</th>
              {onRowClick && (
                <th className="w-8 px-2 py-2.5">
                  <span className="sr-only">Detail</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const nilai = num(r.nilai);
              const terendah =
                sorotNilai != null && Math.abs(nilai - sorotNilai) < 0.005;
              return (
                <tr
                  key={`${r[labelKey]}-${i}`}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                  className={`border-t border-slate-700/40 transition-colors hover:bg-indigo-500/5 ${
                    terendah ? "bg-amber-500/[0.06]" : ""
                  } ${
                    onRowClick
                      ? "cursor-pointer focus-visible:bg-indigo-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-400"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-200">
                    {String(r[labelKey] ?? "")}
                    {terendah && (
                      <span className="ml-2 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                        terendah
                      </span>
                    )}
                  </td>
                  {subKey && (
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {trunc(String(r[subKey] ?? ""), 44)}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700/60">
                        <div
                          className={`h-full rounded-full ${
                            terendah ? "bg-amber-400" : "bg-indigo-400"
                          }`}
                          style={{ width: `${lebar(nilai)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-slate-300">
                        {nilai.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Predikat
                      value={
                        r.predikat == null ? undefined : String(r.predikat)
                      }
                    />
                  </td>
                  {onRowClick && (
                    <td className="px-2 py-2 text-slate-500">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Satu blok peringkat: judul, kontrol urutan (tertinggi/terendah), tombol
 * ekspor CSV, dan tabel. Data tidak lagi dipotong 10 baris — seluruh entitas
 * tersedia karena nilai terendah justru yang paling perlu dilihat LPM.
 */
export function PeringkatInstrumen({
  icon: Icon,
  title,
  description,
  rows,
  labelKey,
  namaBerkas,
  emptyText,
  onRowClick,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  rows: BarisNilai[];
  labelKey: string;
  namaBerkas: string;
  emptyText?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}) {
  const [terendahDulu, setTerendahDulu] = useState(false);
  const [tampilSemua, setTampilSemua] = useState(false);

  const urut = useMemo(() => {
    const arr = [...rows].sort((a, b) => num(b.nilai) - num(a.nilai));
    return terendahDulu ? arr.reverse() : arr;
  }, [rows, terendahDulu]);

  const nilaiMinimum = useMemo(() => {
    const v = rows.map((r) => num(r.nilai)).filter((x) => x > 0);
    return v.length ? Math.min(...v) : undefined;
  }, [rows]);

  const tampil = tampilSemua ? urut : urut.slice(0, 10);

  return (
    <div className="space-y-2">
      <div className="mb-3 mt-8 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 text-indigo-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTerendahDulu((v) => !v)}
            aria-pressed={terendahDulu}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/30 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {terendahDulu ? (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ArrowUpNarrowWide className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {terendahDulu ? "Terendah dulu" : "Tertinggi dulu"}
          </button>
          <button
            type="button"
            onClick={() =>
              unduhCsv(
                `${namaBerkas}`,
                ["Peringkat", "Nama", "Nilai", "Predikat"],
                urut.map((r, i) => [
                  i + 1,
                  String(r[labelKey] ?? ""),
                  num(r.nilai).toFixed(2),
                  String(r.predikat ?? ""),
                ])
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/30 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            CSV
          </button>
        </div>
      </div>

      <RankingTable
        rows={tampil as unknown as Record<string, unknown>[]}
        labelKey={labelKey}
        emptyText={emptyText}
        onRowClick={onRowClick}
        sorotNilai={nilaiMinimum}
      />

      {rows.length > 10 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setTampilSemua((v) => !v)}
            className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {tampilSemua
              ? "Tampilkan 10 teratas"
              : `Tampilkan semua (${rows.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

export type MonevBundle = {
  tabdosen: TabelPayload | null;
  tabmhs: TabelPayload | null;
  tabmhspro: TabelPayload | null;
  tabmhsunit: TabelPayload | null;
};

export function MonevStats({
  semester,
  initialIdSmt,
  initialBundle,
  syncPanel,
  sumberAwal,
}: {
  semester: SemesterPayload | null;
  initialIdSmt: string;
  initialBundle: MonevBundle;
  syncPanel?: React.ReactNode;
  sumberAwal?: "lokal" | "eksternal";
}) {
  const [showAllDosen, setShowAllDosen] = useState(false);
  const [detail, setDetail] = useState<{
    idptk: string;
    nama: string;
    nilai: number;
  } | null>(null);

  const semesters = list<SemesterApi>(semester?.data);

  const [idSmt, setIdSmt] = useState(initialIdSmt);
  /**
   * Hasil muat untuk semester yang dipilih pengguna. Disimpan bersama idSmt-nya
   * supaya data semester sebelumnya tidak sempat tampil saat berganti semester,
   * dan agar data awal dari server bisa dipakai langsung tanpa setState di effect.
   */
  const [hasil, setHasil] = useState<{
    idSmt: string;
    bundle: MonevBundle;
    sumber: "lokal" | "eksternal" | null;
    error: string | null;
  } | null>(null);

  const pakaiHasil = hasil?.idSmt === idSmt;
  const bundle: MonevBundle = pakaiHasil ? hasil.bundle : initialBundle;
  const sumber = pakaiHasil ? hasil.sumber : (sumberAwal ?? null);
  const fetchError = pakaiHasil ? hasil.error : null;
  // Semester awal sudah dimuat server; semester lain baru dianggap selesai
  // memuat ketika hasilnya tersedia.
  const loading = idSmt !== initialIdSmt && !pakaiHasil;

  useEffect(() => {
    if (idSmt === initialIdSmt) return;

    let alive = true;

    // Satu permintaan: server memilih database lokal lebih dulu, lalu
    // jatuh ke layanan kuesioner bila semester itu belum disinkronkan.
    fetch(`/api/monev/bundle?id_smt=${encodeURIComponent(idSmt)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!alive) return;
        if (!res) {
          setHasil({
            idSmt,
            bundle: {
              tabdosen: null,
              tabmhs: null,
              tabmhspro: null,
              tabmhsunit: null,
            },
            sumber: null,
            error: "Gagal memuat data semester ini.",
          });
          return;
        }
        const { tabdosen, tabmhs, tabmhspro, tabmhsunit } = res;
        const kosong = !tabdosen && !tabmhs && !tabmhspro && !tabmhsunit;
        setHasil({
          idSmt,
          bundle: { tabdosen, tabmhs, tabmhspro, tabmhsunit },
          sumber: res.sumber ?? null,
          error: kosong
            ? "Data semester ini belum tersedia pada layanan kuesioner."
            : null,
        });
      })
      .catch(() => {
        if (!alive) return;
        setHasil({
          idSmt,
          bundle: {
            tabdosen: null,
            tabmhs: null,
            tabmhspro: null,
            tabmhsunit: null,
          },
          sumber: null,
          error: "Gagal menghubungi server.",
        });
      });

    return () => {
      alive = false;
    };
  }, [idSmt, initialIdSmt]);

  const { tabdosen, tabmhs, tabmhspro, tabmhsunit } = bundle;

  const data = useMemo(() => {
    const semesterList = list<SemesterApi>(semester?.data);
    const aktif =
      semesterList.find((s) => String(s?.id_smt) === idSmt) ??
      semesterList.find((s) => s?.aktif) ??
      semesterList[0] ??
      undefined;

    const dosenProdi = [...list<BarisNilai>(tabdosen?.prodi)].sort(
      (a, b) => num(b.nilai) - num(a.nilai)
    );
    const mhsProdi = [...list<BarisNilai>(tabmhspro?.prodi)].sort(
      (a, b) => num(b.nilai) - num(a.nilai)
    );
    const mhsUnit = [...list<BarisNilai>(tabmhsunit?.unit)].sort(
      (a, b) => num(b.nilai) - num(a.nilai)
    );
    const dosen = [...list<BarisNilai>(tabmhs?.dosen)].sort(
      (a, b) => num(b.nilai) - num(a.nilai)
    );

    // Tren jumlah jawaban per semester. Semester yang instrumennya belum ada
    // diberi `null` (bukan 0) supaya garis terputus, tidak seolah kolaps.
    const trenJawaban = [...semesterList]
      .reverse()
      .map((s) => {
        const [tahun = "", namaSmt = ""] = String(s.nama ?? "").split(" ");
        const short = tahun.includes("/")
          ? `${tahun.slice(2, 4)}/${tahun.slice(7, 9)} ${namaSmt}`
          : String(s.nama ?? "");
        const unit = num(s.jumlah_jawaban_unit);
        const pro = num(s.jumlah_jawaban_pro);
        const dos = num(s.jumlah_jawaban_dosen);
        return {
          name: short.trim(),
          Unit: unit > 0 ? unit : null,
          Prodi: pro > 0 ? pro : null,
          Dosen: dos > 0 ? dos : null,
        };
      })
      .filter((t) => t.Unit != null || t.Prodi != null || t.Dosen != null);

    // Distribusi pilihan jawaban mahasiswa (agregat seluruh pertanyaan)
    const distMap = new Map<string, number>();
    list<BarisGrafik>(tabmhs?.grafik).forEach((q) => {
      list<OpsiJawaban>(q?.jawaban).forEach((a) => {
        const pilihan = a.pilihan ?? "-";
        distMap.set(pilihan, (distMap.get(pilihan) ?? 0) + num(a.jlh));
      });
    });
    const distribusi = [...distMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (SCORE[b.name] ?? 0) - (SCORE[a.name] ?? 0));

    /**
     * Skor rata-rata per pertanyaan dari SELURUH instrumen.
     *
     * Sebelumnya hanya kuesioner mahasiswa→dosen (57 dari 145 pertanyaan),
     * sehingga temuan terendah pada instrumen prodi/unit/dosen tidak pernah
     * bisa muncul sebagai prioritas perbaikan.
     */
    const skorPertanyaan: {
      name: string;
      skor: number;
      instrumen: KunciInstrumen;
      jumlahJawaban: number;
    }[] = [];
    const sumberGrafik: [KunciInstrumen, BarisGrafik[]][] = [
      ["dosen", list<BarisGrafik>(tabmhs?.grafik)],
      ["mhsProdi", list<BarisGrafik>(tabmhspro?.grafik)],
      ["mhsUnit", list<BarisGrafik>(tabmhsunit?.grafik)],
      ["dosenProdi", list<BarisGrafik>(tabdosen?.grafik)],
    ];
    for (const [kunci, grafik] of sumberGrafik) {
      for (const q of grafik) {
        let total = 0;
        let bobot = 0;
        list<OpsiJawaban>(q?.jawaban).forEach((a) => {
          const s = SCORE[a.pilihan ?? ""] ?? 0;
          total += s * num(a.jlh);
          bobot += num(a.jlh);
        });
        if (!bobot) continue;
        skorPertanyaan.push({
          name: trunc(q?.pertanyaan ?? "-", 52),
          skor: total / bobot,
          instrumen: kunci,
          jumlahJawaban: bobot,
        });
      }
    }
    skorPertanyaan.sort((a, b) => a.skor - b.skor);

    /**
     * Aspek/kategori per entitas. Data ini sudah tersimpan sejak sinkronisasi
     * tetapi belum pernah ditampilkan; padahal inilah lapisan yang paling
     * actionable ("aspek mana yang rendah di prodi mana").
     */
    const aspek: {
      entitas: string;
      aspek: string;
      nilai: number;
      predikat: string;
      instrumen: KunciInstrumen;
    }[] = [];
    const sumberKategori: [KunciInstrumen, BarisNilai[]][] = [
      ["dosenProdi", list<BarisNilai>(tabdosen?.kategori)],
      ["mhsProdi", list<BarisNilai>(tabmhspro?.kategori)],
      ["mhsUnit", list<BarisNilai>(tabmhsunit?.kategori)],
    ];
    for (const [kunci, baris] of sumberKategori) {
      for (const k of baris) {
        const nama =
          (k.nm_kdp as string | undefined) ??
          (k.nm_kmp as string | undefined) ??
          "";
        if (!nama) continue;
        aspek.push({
          entitas: String(k.nm_lemb ?? ""),
          aspek: String(nama),
          nilai: num(k.nilai),
          predikat: String(k.predikat ?? ""),
          instrumen: kunci,
        });
      }
    }
    aspek.sort((a, b) => a.nilai - b.nilai);

    const totalPertanyaan =
      num(tabmhs?.meta?.jumlah_pertanyaan) +
      num(tabdosen?.meta?.jumlah_pertanyaan) +
      num(tabmhspro?.meta?.jumlah_pertanyaan) +
      num(tabmhsunit?.meta?.jumlah_pertanyaan);

    return {
      aktif,
      dosenProdi,
      mhsProdi,
      mhsUnit,
      dosen,
      trenJawaban,
      distribusi,
      skorPertanyaan,
      aspek,
      totalPertanyaan,
      jumlahDosenDinilai: num(tabmhs?.meta?.jumlah_dosen),
      jumlahProdiDosen: num(tabdosen?.meta?.jumlah_prodi),
      jumlahProdiMhs: num(tabmhspro?.meta?.jumlah_prodi),
      jumlahUnit: num(tabmhsunit?.meta?.jumlah_unit),
    };
  }, [semester, tabdosen, tabmhs, tabmhspro, tabmhsunit, idSmt]);

  const { aktif } = data;

  const topMhsProdi = data.mhsProdi.slice(0, 10).map((p) => ({
    name: trunc(String(p.nm_lemb ?? ""), 26),
    nilai: num(p.nilai),
  }));
  const topDosenProdi = data.dosenProdi.slice(0, 10).map((p) => ({
    name: trunc(String(p.nm_lemb ?? ""), 26),
    nilai: num(p.nilai),
  }));
  const unitChart = data.mhsUnit.map((u) => ({
    name: trunc(String(u.nm_lemb ?? ""), 22),
    nilai: num(u.nilai),
  }));

  // Rentang sumbu mengikuti data agar perbedaan kecil tetap terbaca.
  const domainMhsProdi = domainNilai(topMhsProdi.map((p) => p.nilai));
  const domainDosenProdi = domainNilai(topDosenProdi.map((p) => p.nilai));
  const domainUnit = domainNilai(unitChart.map((u) => u.nilai));

  const adaData =
    data.mhsProdi.length > 0 ||
    data.mhsUnit.length > 0 ||
    data.dosenProdi.length > 0 ||
    data.dosen.length > 0 ||
    data.distribusi.length > 0;

  const opsiSemester = semesters
    .map((s) => {
      // Flag `tersedia` dari layanan bisa bernilai true walau belum ada satu
      // pun jawaban (mis. semester yang baru dibuka). Ketersediaan dihitung
      // dari jumlah jawaban agar label tidak menjanjikan data yang tidak ada.
      const jumlah =
        num(s?.jumlah_jawaban_unit) +
        num(s?.jumlah_jawaban_pro) +
        num(s?.jumlah_jawaban_dosen);
      return {
        id: String(s?.id_smt ?? ""),
        nama: String(s?.nama ?? s?.id_smt ?? ""),
        aktif: Boolean(s?.aktif),
        jumlah,
        tersedia: jumlah > 0,
      };
    })
    .filter((s) => s.id);

  const semesterTerpilih = opsiSemester.find((s) => s.id === idSmt);
  const semesterTanpaData = opsiSemester.filter((s) => !s.tersedia).length;

  return (
    <div className="space-y-6">
      {/* ---------------- Filter ---------------- */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-semester"
            className="text-[11px] font-medium uppercase tracking-wide text-slate-500"
          >
            Filter Semester
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="filter-semester"
              value={idSmt}
              onChange={(e) => setIdSmt(e.target.value)}
              className="input-base w-full min-w-[220px] sm:w-auto"
            >
              {opsiSemester.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                  {s.aktif ? " — aktif" : s.tersedia ? "" : " — belum ada data"}
                </option>
              ))}
            </select>
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
                Memuat…
              </span>
            )}
          </div>
          {semesterTerpilih && (
            <p className="text-xs text-slate-400">
              {semesterTerpilih.aktif
                ? "Semester aktif saat ini."
                : semesterTerpilih.tersedia
                  ? "Menampilkan data semester terpilih."
                  : "Belum ada jawaban kuesioner pada semester ini."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="rounded-full border border-slate-600/40 bg-slate-700/20 px-2.5 py-1">
            {opsiSemester.length - semesterTanpaData} semester berisi data
          </span>
          {sumber && (
            <span
              title={
                sumber === "lokal"
                  ? "Dibaca dari snapshot database (hasil sinkronisasi)"
                  : "Diambil langsung dari layanan kuesioner"
              }
              className={
                sumber === "lokal"
                  ? "rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
                  : "rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-sky-300"
              }
            >
              {sumber === "lokal" ? "database lokal" : "layanan kuesioner"}
            </span>
          )}
          {aktif?.date_start && (
            <span className="rounded-full border border-slate-600/40 bg-slate-700/20 px-2.5 py-1">
              {String(aktif.date_start).slice(0, 10)} –{" "}
              {String(aktif.date_end).slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      {syncPanel}

      {fetchError && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          {fetchError}
        </div>
      )}

      {!loading && !adaData && (
        <div className="card flex flex-col items-center gap-1.5 p-8 text-center">
          <p className="text-sm font-medium text-slate-200">
            Belum ada data jawaban pada semester ini
          </p>
          <p className="text-xs text-slate-400">
            {aktif?.nama ?? idSmt} tidak memiliki jawaban kuesioner. Pilih
            semester lain pada filter di atas.
          </p>
        </div>
      )}

      {adaData && (
        <>
          {/* ---------------- KPI ---------------- */}
          <div
            aria-busy={loading}
            className={`grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${
              loading ? "pointer-events-none opacity-50" : "opacity-100"
            }`}
          >
            <KpiCard
              icon={CalendarRange}
              label="Semester Terpilih"
              value={aktif?.nama ?? "-"}
              hint={
                aktif
                  ? `${String(aktif.date_start ?? "").slice(0, 10)} – ${String(
                      aktif.date_end ?? ""
                    ).slice(0, 10)}`
                  : undefined
              }
              accent="violet"
            />
            <KpiCard
              icon={MessageSquare}
              label="Jawaban Mahasiswa"
              value={fmt(
                num(aktif?.jumlah_jawaban_unit) + num(aktif?.jumlah_jawaban_pro)
              )}
              hint={`${fmt(num(aktif?.jumlah_jawaban_pro))} prodi · ${fmt(
                num(aktif?.jumlah_jawaban_unit)
              )} unit`}
              accent="indigo"
            />
            <KpiCard
              icon={Users}
              label="Jawaban Dosen"
              value={fmt(num(aktif?.jumlah_jawaban_dosen))}
              hint="Kuesioner dosen"
              accent="emerald"
            />
            <KpiCard
              icon={GraduationCap}
              label="Dosen Dinilai"
              value={fmt(data.jumlahDosenDinilai)}
              hint={`${data.jumlahProdiDosen} prodi`}
              accent="sky"
            />
            <KpiCard
              icon={Building2}
              label="Unit Layanan"
              value={fmt(data.jumlahUnit)}
              hint={`${data.jumlahProdiMhs} prodi terpantau`}
              accent="amber"
            />
            <KpiCard
              icon={ClipboardList}
              label="Total Pertanyaan"
              value={fmt(data.totalPertanyaan)}
              hint="4 instrumen kuesioner"
              accent="indigo"
            />
          </div>

          {/* ---------------- Grafik ---------------- */}
          <div
            aria-busy={loading}
            className={`grid gap-4 transition-opacity lg:grid-cols-2 ${
              loading ? "pointer-events-none opacity-50" : "opacity-100"
            }`}
          >
            <ChartPanel
              title="Tren Jawaban Mahasiswa"
              subtitle="Prodi dan unit layanan — skala terpisah dari dosen"
              valueLabel="Jumlah jawaban"
              height="h-72"
              rows={data.trenJawaban.map((t) => ({
                label: t.name,
                value: `${t.Prodi == null ? "–" : fmt(t.Prodi)} prodi · ${
                  t.Unit == null ? "–" : fmt(t.Unit)
                } unit`,
              }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.trenJawaban}
                  margin={{ top: 8, right: 12, left: -6, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) =>
                      v == null ? "belum ada data" : fmt(Number(v))
                    }
                  />
                  <Legend wrapperStyle={LEGEND} />
                  <Line
                    type="monotone"
                    dataKey="Unit"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Prodi"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Tren Jawaban Dosen"
              subtitle="Kuesioner dosen — perhatikan skalanya berbeda"
              valueLabel="Jumlah jawaban"
              height="h-72"
              rows={data.trenJawaban.map((t) => ({
                label: t.name,
                value: t.Dosen == null ? "–" : fmt(t.Dosen),
              }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.trenJawaban}
                  margin={{ top: 8, right: 12, left: -6, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) =>
                      v == null ? "belum ada data" : fmt(Number(v))
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="Dosen"
                    name="Jawaban dosen"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Distribusi Jawaban Mahasiswa"
              subtitle="Agregat seluruh pertanyaan kuesioner"
              valueLabel="Jumlah jawaban"
              height="h-72"
              rows={data.distribusi.map((d) => ({
                label: d.name,
                value: fmt(d.value),
              }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.distribusi}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={94}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.distribusi.map((d, i) => (
                      <Cell
                        key={d.name}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) => fmt(Number(v))}
                  />
                  <Legend wrapperStyle={LEGEND} />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Nilai per Prodi — Mahasiswa"
              subtitle={`10 prodi tertinggi · sumbu dimulai dari ${domainMhsProdi[0].toFixed(1)}`}
              valueLabel="Nilai"
              height="h-72"
              rows={topMhsProdi.map((p) => ({
                label: p.name,
                value: p.nilai.toFixed(2),
              }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topMhsProdi}
                  margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    domain={domainMhsProdi}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) => Number(v).toFixed(2)}
                    cursor={{ fill: "rgba(129,140,248,0.08)" }}
                  />
                  <Bar
                    dataKey="nilai"
                    name="Nilai"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Nilai per Unit Layanan"
              subtitle={`Rata-rata kepuasan mahasiswa · sumbu dimulai dari ${domainUnit[0].toFixed(1)}`}
              valueLabel="Nilai"
              height="h-72"
              rows={unitChart.map((u) => ({
                label: u.name,
                value: u.nilai.toFixed(2),
              }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={unitChart}
                  margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={64}
                  />
                  <YAxis
                    domain={domainUnit}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) => Number(v).toFixed(2)}
                    cursor={{ fill: "rgba(16,185,129,0.08)" }}
                  />
                  <Bar
                    dataKey="nilai"
                    name="Nilai"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Nilai per Prodi — Dosen"
              subtitle={`10 prodi tertinggi (kuesioner dosen) · sumbu dimulai dari ${domainDosenProdi[0].toFixed(1)}`}
              valueLabel="Nilai"
              height="h-72"
              rows={topDosenProdi.map((p) => ({
                label: p.name,
                value: p.nilai.toFixed(2),
              }))}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDosenProdi}
                  margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    domain={domainDosenProdi}
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: unknown) => Number(v).toFixed(2)}
                    cursor={{ fill: "rgba(245,158,11,0.08)" }}
                  />
                  <Bar
                    dataKey="nilai"
                    name="Nilai"
                    fill="#f59e0b"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <div className="lg:col-span-2">
              <PrioritasPerbaikan
                butir={data.skorPertanyaan}
                judul="Prioritas Perbaikan Lintas Instrumen"
              />
            </div>

            <div className="lg:col-span-2">
              <AspekTerendah
                aspek={data.aspek}
                judul="Aspek dengan Nilai Terendah"
              />
            </div>
          </div>

          {/* ---------------- Tabel ---------------- */}
          <SectionTitle
            icon={Trophy}
            title="Peringkat Prodi — Kuesioner Mahasiswa"
            description={`${data.mhsProdi.length} prodi terurut berdasarkan nilai`}
          />
          <RankingTable rows={data.mhsProdi} labelKey="nm_lemb" />

          <SectionTitle
            icon={BarChart3}
            title="Peringkat Prodi — Kuesioner Dosen"
            description={`${data.dosenProdi.length} prodi terurut berdasarkan nilai`}
          />
          <RankingTable rows={data.dosenProdi} labelKey="nm_lemb" />

          <SectionTitle
            icon={Building2}
            title="Peringkat Unit Layanan"
            description="Kepuasan mahasiswa terhadap unit layanan"
          />
          <RankingTable rows={data.mhsUnit} labelKey="nm_lemb" />

          <SectionTitle
            icon={GraduationCap}
            title="Dosen dengan Nilai Tertinggi"
            description={`${data.dosen.length} dosen dinilai pada semester aktif`}
          />
          <RankingTable
            rows={data.dosen}
            labelKey="nm_ptk"
            emptyText="Belum ada data dosen."
            onRowClick={(r) =>
              setDetail({
                idptk: String(r.id_ptk ?? ""),
                nama: String(r.nm_ptk ?? "-"),
                nilai: num(r.nilai),
              })
            }
          />
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Klik salah satu baris dosen untuk melihat rincian jawaban per
            pertanyaan.
          </p>
          {data.dosen.length > 10 && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAllDosen((v) => !v)}
                className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
              >
                {showAllDosen
                  ? "Tampilkan 10 teratas"
                  : `Tampilkan semua (${data.dosen.length})`}
              </button>
            </div>
          )}
        </>
      )}

      {detail && (
        <DosenDetailModal
          idptk={detail.idptk}
          nama={detail.nama}
          nilai={detail.nilai}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
