"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  Database,
  History,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { sinkronkanMonev, type SyncState } from "@/lib/actions/monev-sync";

type Statistik = {
  jumlahSemester: number;
  jumlahRingkasan: number;
  jumlahJawaban: number;
  terakhir: {
    status: string;
    mulai: string;
    selesai: string | null;
    pesan: string | null;
    olehNama: string | null;
    jumlahBaris: number;
    mode: string;
  } | null;
};

function waktuRelatif(iso: string): string {
  const lalu = Date.now() - new Date(iso).getTime();
  const menit = Math.floor(lalu / 60_000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

/** Tombol submit yang tahu status pending dari form induknya. */
function TombolSubmit({ mode }: { mode: "semester" | "semua" }) {
  const { pending } = useFormStatus();
  const utama = mode === "semester";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        utama
          ? "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-on-accent shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          : "inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#334155] px-3.5 py-2 text-sm font-medium text-on-accent shadow-sm transition hover:bg-[#475569] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : utama ? (
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      ) : (
        <CloudDownload className="h-4 w-4" aria-hidden="true" />
      )}
      {pending
        ? "Menyinkronkan…"
        : utama
          ? "Sinkronkan Semester Ini"
          : "Sinkronkan Semua"}
    </button>
  );
}

export function MonevSyncPanel({
  idSmt,
  semesterNama,
  statistik,
  bisaSinkron,
}: {
  idSmt: string;
  semesterNama: string;
  statistik: Statistik;
  bisaSinkron: boolean;
}) {
  const [state, action] = useActionState<SyncState, FormData>(
    sinkronkanMonev,
    undefined
  );
  // Notifikasi disembunyikan dengan menyimpan referensi state yang ditutup.
  // Cara ini menghindari setState di dalam effect: setiap hasil sinkron baru
  // menghasilkan objek state baru, sehingga notifikasi tampil lagi otomatis.
  const [tutupUntuk, setTutupUntuk] = useState<SyncState>(undefined);
  const pesanTutup = state != null && tutupUntuk === state;
  const router = useRouter();

  // Segarkan data server (statistik panel + badge sumber) setelah sinkron berhasil.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const terakhir = statistik.terakhir;
  const belumAdaData = statistik.jumlahRingkasan === 0;

  return (
    <div className="card mb-6 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-white">
              Data Tersimpan Lokal
            </h2>
            {belumAdaData && (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                Belum ada data
              </span>
            )}
          </div>

          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-400">Semester</dt>
              <dd className="font-semibold text-slate-100">
                {statistik.jumlahSemester}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-400">Baris peringkat</dt>
              <dd className="font-semibold text-slate-100">
                {statistik.jumlahRingkasan.toLocaleString("id-ID")}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-400">Baris jawaban</dt>
              <dd className="font-semibold text-slate-100">
                {statistik.jumlahJawaban.toLocaleString("id-ID")}
              </dd>
            </div>
          </dl>

          {terakhir && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Sinkron terakhir{" "}
                <span className="text-slate-300">
                  {terakhir.selesai ? waktuRelatif(terakhir.selesai) : "—"}
                </span>
                {terakhir.olehNama ? ` oleh ${terakhir.olehNama}` : ""}
              </span>
              <span
                className={
                  terakhir.status === "sukses"
                    ? "rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                    : "rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300"
                }
              >
                {terakhir.status === "sukses" ? "sukses" : "gagal"}
              </span>
            </p>
          )}
        </div>

        {bisaSinkron ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <form action={action}>
              <input type="hidden" name="mode" value="semester" />
              <input type="hidden" name="id_smt" value={idSmt} />
              <TombolSubmit mode="semester" />
            </form>
            <form action={action}>
              <input type="hidden" name="mode" value="semua" />
              <TombolSubmit mode="semua" />
            </form>
          </div>
        ) : (
          <p className="shrink-0 text-xs text-slate-400">
            Hanya Admin LPM yang dapat menyinkronkan data.
          </p>
        )}
      </div>

      {/* Notifikasi hasil */}
      {state && !pesanTutup && (
        <div
          role="status"
          aria-live="polite"
          className={
            state.ok
              ? "mt-4 flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200"
              : "mt-4 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200"
          }
        >
          {state.ok ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {state.ok ? state.pesan : state.error}
            </p>
            {state.ok && state.jumlahBaris != null && (
              <p className="mt-0.5 text-xs opacity-80">
                {state.jumlahSemester ?? 0} semester ·{" "}
                {state.jumlahBaris.toLocaleString("id-ID")} baris tersimpan
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTutupUntuk(state)}
            aria-label="Tutup notifikasi"
            className="rounded p-1 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {belumAdaData && (
        <p className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
          Dashboard masih menampilkan data langsung dari layanan kuesioner. Klik{" "}
          <span className="font-medium text-slate-200">
            Sinkronkan Semester Ini
          </span>{" "}
          untuk menyimpan data {semesterNama} ke database agar tetap tampil saat
          layanan eksternal tidak dapat diakses.
        </p>
      )}
    </div>
  );
}
