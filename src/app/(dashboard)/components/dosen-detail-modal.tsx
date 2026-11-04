"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UserRound, X } from "lucide-react";

type Responden = {
  nm_ptk: string;
  nm_kmd: string;
  pertanyaan: string;
  nilai: string;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const predikatOf = (n: number) => {
  if (n >= 4.5) return { label: "Sangat Baik", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" };
  if (n >= 3.5) return { label: "Baik", cls: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300" };
  if (n >= 2.5) return { label: "Cukup Baik", cls: "border-amber-400/30 bg-amber-500/15 text-amber-300" };
  if (n >= 1.5) return { label: "Kurang", cls: "border-rose-400/30 bg-rose-500/15 text-rose-300" };
  return { label: "Sangat Kurang", cls: "border-rose-400/30 bg-rose-500/15 text-rose-300" };
};

export function DosenDetailModal({
  idptk,
  nama,
  nilai,
  onClose,
}: {
  idptk: string;
  nama: string;
  nilai?: number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Responden[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    fetch(`/api/wsstatistik/responden?idptk=${encodeURIComponent(idptk)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((d) => {
        if (!alive) return;
        setRows(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (alive) setError("Gagal memuat detail jawaban dosen.");
      });
    return () => {
      alive = false;
    };
  }, [idptk]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, Responden[]>();
    (rows ?? []).forEach((r) => {
      const key = r.nm_kmd || "Lainnya";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    return [...map.entries()].map(([kategori, items]) => {
      const avg = items.length
        ? items.reduce((s, it) => s + num(it.nilai), 0) / items.length
        : 0;
      return { kategori, items, avg };
    });
  }, [rows]);

  const overall = useMemo(() => {
    if (!rows?.length) return num(nilai);
    return rows.reduce((s, r) => s + num(r.nilai), 0) / rows.length;
  }, [rows, nilai]);

  const pred = predikatOf(overall);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dosen-detail-title"
      onClick={onClose}
    >
      <div
        className="surface-modal flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-indigo-400/20 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-700/50 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="dosen-detail-title"
              className="truncate text-base font-semibold text-white"
            >
              {nama}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              NIDN/NIDK: {idptk} · {rows ? `${rows.length} butir penilaian` : "memuat…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-lg font-semibold leading-none text-white">
                {overall.toFixed(2)}
              </p>
              <span
                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${pred.cls}`}
              >
                {pred.label}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail dosen"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/50 text-slate-400 transition-colors hover:bg-slate-700/40 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          {!rows && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" aria-hidden="true" />
              <p className="text-xs">Memuat detail jawaban…</p>
            </div>
          )}

          {rows && rows.length === 0 && !error && (
            <p className="py-10 text-center text-sm text-slate-400">
              Belum ada jawaban untuk dosen ini.
            </p>
          )}

          <div className="space-y-5">
            {grouped.map((g) => {
              const gp = predikatOf(g.avg);
              return (
                <section key={g.kategori}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {g.kategori}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs font-medium text-slate-300">
                        rata-rata {g.avg.toFixed(2)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${gp.cls}`}
                      >
                        {gp.label}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {g.items.map((it, i) => {
                      const v = num(it.nilai);
                      return (
                        <li
                          key={`${it.pertanyaan}-${i}`}
                          className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs leading-relaxed text-slate-300">
                              {it.pertanyaan}
                            </p>
                            <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-100">
                              {v.toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-700/60">
                            <div
                              className="h-full rounded-full bg-indigo-400"
                              style={{ width: `${Math.min(100, (v / 5) * 100)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
