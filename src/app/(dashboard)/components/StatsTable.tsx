import { useMemo } from "react";
import { unduhCsv } from "@/lib/csv";
import { Download } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const trunc = (s: string, n = 30) =>
  typeof s === "string" && s.length > n
    ? `${s.slice(0, n - 1)}…`
    : String(s ?? "");

/**
 * Tabel prioritas perbaikan lintas instrumen.
 * `butir` adalah daftar pertanyaan dengan skor terendah serta info instrumen.
 */
export function PrioritasPerbaikan({
  butir,
  judul = "Prioritas Perbaikan",
}: {
  butir: {
    name: string;
    skor: number;
    instrumen?: string;
    jumlahJawaban?: number;
  }[];
  judul?: string;
}) {
  const rows = useMemo(() => {
    return butir.slice(0, 12).map((b, i) => ({
      no: i + 1,
      pertanyaan: trunc(b.name, 80),
      skor: b.skor.toFixed(2),
      instrumen: b.instrumen ?? "-",
      jawaban: b.jumlahJawaban != null ? fmt(b.jumlahJawaban) : "-",
    }));
  }, [butir]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{judul}</h2>
        <button
          type="button"
          onClick={() =>
            unduhCsv(
              "prioritas_perbaikan",
              ["No", "Pertanyaan", "Skor", "Instrumen", "Jawaban"],
              rows.map((r) => [
                r.no,
                r.pertanyaan,
                r.skor,
                r.instrumen,
                r.jawaban,
              ])
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/30 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          CSV
        </button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-800/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-2 py-1 font-medium">#</th>
              <th className="px-2 py-1 font-medium">Pertanyaan</th>
              <th className="px-2 py-1 font-medium">Skor</th>
              <th className="px-2 py-1 font-medium">Instrumen</th>
              <th className="px-2 py-1 font-medium">Jawaban</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.no}
                className="border-t border-slate-700/40 hover:bg-indigo-500/5"
              >
                <td className="px-2 py-1 text-xs text-slate-500">{r.no}</td>
                <td className="px-2 py-1 text-slate-200">{r.pertanyaan}</td>
                <td className="px-2 py-1 text-slate-200">{r.skor}</td>
                <td className="px-2 py-1 text-slate-200">{r.instrumen}</td>
                <td className="px-2 py-1 text-slate-200">{r.jawaban}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Tabel aspek dengan nilai terendah.
 */
export function AspekTerendah({
  aspek,
  judul = "Aspek Terendah",
}: {
  aspek: {
    entitas: string;
    aspek: string;
    nilai: number;
    predikat: string;
    instrumen?: string;
  }[];
  judul?: string;
}) {
  const rows = useMemo(() => {
    return aspek.slice(0, 12).map((a, i) => ({
      no: i + 1,
      entitas: trunc(a.entitas, 30),
      aspek: trunc(a.aspek, 30),
      nilai: a.nilai.toFixed(2),
      predikat: a.predikat,
      instrumen: a.instrumen ?? "-",
    }));
  }, [aspek]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{judul}</h2>
        <button
          type="button"
          onClick={() =>
            unduhCsv(
              "aspek_terendah",
              ["No", "Entitas", "Aspek", "Nilai", "Predikat", "Instrumen"],
              rows.map((r) => [
                r.no,
                r.entitas,
                r.aspek,
                r.nilai,
                r.predikat,
                r.instrumen,
              ])
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/30 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          CSV
        </button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-800/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-2 py-1 font-medium">#</th>
              <th className="px-2 py-1 font-medium">Entitas</th>
              <th className="px-2 py-1 font-medium">Aspek</th>
              <th className="px-2 py-1 font-medium">Nilai</th>
              <th className="px-2 py-1 font-medium">Predikat</th>
              <th className="px-2 py-1 font-medium">Instrumen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.no}
                className="border-t border-slate-700/40 hover:bg-indigo-500/5"
              >
                <td className="px-2 py-1 text-xs text-slate-500">{r.no}</td>
                <td className="px-2 py-1 text-slate-200">{r.entitas}</td>
                <td className="px-2 py-1 text-slate-200">{r.aspek}</td>
                <td className="px-2 py-1 text-slate-200">{r.nilai}</td>
                <td className="px-2 py-1 text-slate-200">{r.predikat}</td>
                <td className="px-2 py-1 text-slate-200">{r.instrumen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
