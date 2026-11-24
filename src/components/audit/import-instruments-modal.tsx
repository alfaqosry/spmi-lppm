"use client";

import {
  useActionState,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  importInstrumentsExcel,
  type ImportActionState,
  type RowFailure,
  type RowSuccess,
} from "@/lib/actions/instruments-import";
import type { UnitOption } from "@/lib/scope";

type PreviewRow = {
  scope: string;
  target: string;
  standard: string;
  question: string;
};

type ClientPreview = {
  fileName: string;
  fileSize: string;
  totalRows: number;
  standardsCount: number;
  questionsCount: number;
  scopeBreakdown: { all: number; category: number; unit: number };
  sampleRows: PreviewRow[];
  clientErrors: string[];
};

export function ImportInstrumentsModal({
  open,
  onClose,
  cycleId,
  cycleName,
  units: _units = [],
}: {
  open: boolean;
  onClose: () => void;
  cycleId: number;
  cycleName: string;
  units?: UnitOption[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ClientPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [resultTab, setResultTab] = useState<"all" | "success" | "failed">(
    "all"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<
    ImportActionState,
    FormData
  >(importInstrumentsExcel, undefined);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setParsing(false);
    setResultTab("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFileForPreview = async (selectedFile: File) => {
    setFile(selectedFile);
    setParsing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const sheetName =
        workbook.SheetNames.find(
          (s) =>
            s.toLowerCase() === "template instrumen" ||
            s.toLowerCase().includes("instrumen")
        ) ?? workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        setPreview({
          fileName: selectedFile.name,
          fileSize: `${(selectedFile.size / 1024).toFixed(1)} KB`,
          totalRows: 0,
          standardsCount: 0,
          questionsCount: 0,
          scopeBreakdown: { all: 0, category: 0, unit: 0 },
          sampleRows: [],
          clientErrors: [
            "Lembar kerja instrumen tidak ditemukan dalam berkas.",
          ],
        });
        setParsing(false);
        return;
      }

      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];

      let headerIdx = -1;
      let colScope = -1;
      let colTarget = -1;
      let colStandard = -1;
      let colQuestion = -1;

      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;

        let hasStd = false;
        let hasQ = false;

        row.forEach((cell, idx) => {
          const t = String(cell ?? "")
            .trim()
            .toLowerCase();
          if (/target/.test(t)) colTarget = idx;
          else if (/cakupan|scope/.test(t)) colScope = idx;
          else if (
            /nama.*standar|standar|standard/.test(t) &&
            !/urutan|order/.test(t)
          ) {
            colStandard = idx;
            hasStd = true;
          } else if (
            /pertanyaan|butir|question|indikator/.test(t) &&
            !/urutan|order/.test(t)
          ) {
            colQuestion = idx;
            hasQ = true;
          }
        });

        if (hasStd && hasQ) {
          headerIdx = r;
          break;
        }
      }

      const clientErrors: string[] = [];
      if (headerIdx === -1 || colStandard === -1 || colQuestion === -1) {
        clientErrors.push(
          'Kolom wajib "Nama Standar" dan "Pertanyaan / Butir Instrumen" tidak terdeteksi pada header.'
        );
      }

      const standardsSet = new Set<string>();
      let questionsCount = 0;
      const breakdown = { all: 0, category: 0, unit: 0 };
      const sampleRows: PreviewRow[] = [];

      let currentScope = "Semua Unit";
      let currentTarget = "";
      let currentStd = "";

      for (let r = headerIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;

        const s = colScope >= 0 ? String(row[colScope] ?? "").trim() : "";
        const t = colTarget >= 0 ? String(row[colTarget] ?? "").trim() : "";
        const std =
          colStandard >= 0 ? String(row[colStandard] ?? "").trim() : "";
        const q = colQuestion >= 0 ? String(row[colQuestion] ?? "").trim() : "";

        if (!s && !t && !std && !q) continue;

        if (s) {
          currentScope = s;
          currentTarget = t;
        }
        if (std) currentStd = std;

        if (currentStd) standardsSet.add(currentStd.toLowerCase());
        if (q) {
          questionsCount++;

          const scNorm = currentScope.toLowerCase();
          if (scNorm.includes("kategori")) breakdown.category++;
          else if (scNorm.includes("unit") && !scNorm.includes("semua"))
            breakdown.unit++;
          else breakdown.all++;

          if (sampleRows.length < 5) {
            sampleRows.push({
              scope: currentScope,
              target: currentTarget,
              standard: currentStd,
              question: q,
            });
          }
        }
      }

      setPreview({
        fileName: selectedFile.name,
        fileSize: `${(selectedFile.size / 1024).toFixed(1)} KB`,
        totalRows: rawRows.length - (headerIdx + 1),
        standardsCount: standardsSet.size,
        questionsCount,
        scopeBreakdown: breakdown,
        sampleRows,
        clientErrors,
      });
    } catch {
      setPreview({
        fileName: selectedFile.name,
        fileSize: `${(selectedFile.size / 1024).toFixed(1)} KB`,
        totalRows: 0,
        standardsCount: 0,
        questionsCount: 0,
        scopeBreakdown: { all: 0, category: 0, unit: 0 },
        sampleRows: [],
        clientErrors: [
          "Gagal membaca berkas Excel. Pastikan berkas tidak rusak atau terenkripsi.",
        ],
      });
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFileForPreview(f);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFileForPreview(f);
  };

  // Gabungkan dan filter baris untuk tabel laporan detail hasil import
  const summary = state?.summary;
  const filteredRows: Array<
    ({ type: "success" } & RowSuccess) | ({ type: "failed" } & RowFailure)
  > = [];

  if (summary) {
    if (resultTab === "all" || resultTab === "success") {
      summary.successRows.forEach((r) =>
        filteredRows.push({ type: "success", ...r })
      );
    }
    if (resultTab === "all" || resultTab === "failed") {
      summary.failedRows.forEach((r) =>
        filteredRows.push({ type: "failed", ...r })
      );
    }
    filteredRows.sort((a, b) => a.rowNumber - b.rowNumber);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Standar & Pertanyaan dari Excel"
      size="xl"
      icon={<FileSpreadsheet className="h-5 w-5 text-indigo-300" />}
      description={
        <span>
          Tambahkan standar dan butir pertanyaan audit secara massal untuk
          siklus <strong className="text-white">{cycleName}</strong>.
        </span>
      }
    >
      {summary ? (
        <div className="space-y-4 py-2">
          {/* Banner Status */}
          {summary.failedCount === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-400" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-300">
                  Seluruh Baris Berhasil Diinput!
                </h3>
                <p className="mt-0.5 text-xs text-emerald-200/80">
                  Total {summary.successCount} baris telah berhasil diproses ke
                  database tanpa kesalahan.
                </p>
              </div>
            </div>
          ) : summary.successCount > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
              <AlertTriangle className="h-7 w-7 shrink-0 text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold text-amber-300">
                  Import Selesai dengan Beberapa Catatan
                </h3>
                <p className="mt-0.5 text-xs text-amber-200/80">
                  {summary.successCount} baris berhasil disimpan, namun terdapat{" "}
                  {summary.failedCount} baris yang gagal diinput karena
                  kesalahan format atau referensi.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
              <XCircle className="h-7 w-7 shrink-0 text-rose-400" />
              <div>
                <h3 className="text-sm font-semibold text-rose-300">
                  Seluruh Baris Gagal Diinput
                </h3>
                <p className="mt-0.5 text-xs text-rose-200/80">
                  Semua {summary.failedCount} baris tidak dapat diproses.
                  Silakan periksa daftar kesalahan di bawah, perbaiki berkas,
                  dan coba lagi.
                </p>
              </div>
            </div>
          )}

          {/* Kartu Statistik */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-3 text-center">
              <p className="text-xs text-slate-400">Baris Berhasil</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                {summary.successCount}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                +{summary.questionsCreated} baru • {summary.questionsSkipped}{" "}
                duplikat
              </p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs text-slate-400">Baris Gagal</p>
              <p
                className={`mt-1 text-xl font-bold ${summary.failedCount > 0 ? "text-rose-400" : "text-slate-400"}`}
              >
                {summary.failedCount}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {summary.failedCount > 0
                  ? "Perlu perbaikan"
                  : "Nihil kesalahan"}
              </p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs text-slate-400">Standar Baru</p>
              <p className="mt-1 text-xl font-bold text-indigo-300">
                +{summary.standardsCreated}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {summary.standardsReused} standar lama terpakai
              </p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs text-slate-400">Total Baris</p>
              <p className="mt-1 text-xl font-bold text-white">
                {summary.totalRows}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Baris data di Excel
              </p>
            </div>
          </div>

          {/* Tab Filter Rincian */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-400/10 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setResultTab("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  resultTab === "all"
                    ? "bg-indigo-500/20 text-indigo-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Semua Baris ({summary.totalRows})
              </button>
              <button
                type="button"
                onClick={() => setResultTab("success")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  resultTab === "success"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Berhasil ({summary.successCount})
              </button>
              <button
                type="button"
                onClick={() => setResultTab("failed")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  resultTab === "failed"
                    ? "bg-rose-500/20 text-rose-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Gagal ({summary.failedCount})
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              Menampilkan {filteredRows.length} dari {summary.totalRows} baris
            </span>
          </div>

          {/* Tabel Rincian Baris */}
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-700/60">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">Baris</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Cakupan</th>
                  <th className="px-3 py-2 font-semibold">Standar</th>
                  <th className="px-3 py-2 font-semibold">
                    Pertanyaan / Keterangan Kesalahan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 bg-slate-900/40">
                {filteredRows.map((row, idx) => {
                  const isFail = row.type === "failed";
                  return (
                    <tr
                      key={idx}
                      className={
                        isFail
                          ? "bg-rose-500/[0.06] hover:bg-rose-500/[0.12]"
                          : "hover:bg-slate-700/30"
                      }
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-slate-300">
                        #{row.rowNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {isFail ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            <XCircle className="h-3 w-3" /> Gagal
                          </span>
                        ) : row.status === "created" ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Berhasil
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <AlertCircle className="h-3 w-3" /> Duplikat
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-indigo-300">
                        {isFail ? "—" : row.scopeLabel}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 font-semibold text-white">
                        {row.standardName}
                      </td>
                      <td className="px-3 py-2">
                        {isFail ? (
                          <div className="flex items-start gap-1 text-rose-300 font-medium">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                            <span>{row.reason}</span>
                          </div>
                        ) : (
                          <span className="line-clamp-2 text-slate-300">
                            {row.questionText}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tombol Aksi Bawah */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {summary.failedCount > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Unggah Berkas Baru /
                Ulangi
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-xs font-semibold text-white shadow hover:opacity-90"
            >
              Selesai &amp; Tutup
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 py-2">
          {/* Langkah 1: Download Template */}
          <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  <Download className="h-3.5 w-3.5" /> Langkah 1: Unduh Format
                  Excel Resmi
                </h4>
                <p className="mt-1 text-xs text-slate-300">
                  Gunakan template Excel resmi yang sudah dilengkapi contoh
                  pengisian dan daftar referensi kategori serta unit terdaftar
                  di sistem.
                </p>
              </div>
              <a
                href="/api/audit/template-excel"
                download="Template_Import_Standar_Pertanyaan_SPMI.xlsx"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3.5 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/30 hover:text-white"
              >
                <Download className="h-4 w-4" />
                Unduh Template (.xlsx)
              </a>
            </div>
          </div>

          {/* Form Upload */}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="cycleId" value={cycleId} />

            {/* Langkah 2: Unggah Berkas */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <FileUp className="h-3.5 w-3.5 text-indigo-300" /> Langkah 2:
                Pilih Berkas Excel Yang Telah Diisi
              </h4>

              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
                  dragActive
                    ? "border-indigo-400 bg-indigo-500/15"
                    : file
                      ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                      : "border-slate-600/40 bg-slate-500/[0.03] hover:border-indigo-400/40 hover:bg-slate-500/[0.06]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
                  {parsing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
                  ) : file ? (
                    <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <UploadCloud className="h-6 w-6" />
                  )}
                </div>

                <div className="mt-3">
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB • Klik atau seret
                        file lain untuk mengganti
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        Klik untuk memilih berkas atau seret berkas ke sini
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Mendukung .xlsx, .xls, atau .csv (Maksimal 10 MB)
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Preview Parsing Klien */}
            {preview && (
              <div className="rounded-xl border border-indigo-400/20 bg-slate-500/[0.06] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-300" />{" "}
                    Ringkasan Isi Berkas
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-indigo-400/25 bg-indigo-500/15 px-2 py-0.5 font-medium text-indigo-200">
                      {preview.standardsCount} Standar Terdeteksi
                    </span>
                    <span className="rounded-md border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-200">
                      {preview.questionsCount} Butir Pertanyaan
                    </span>
                  </div>
                </div>

                {/* Cakupan breakdown */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Cakupan butir:</span>
                  <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                    Semua Unit: {preview.scopeBreakdown.all}
                  </span>
                  <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                    Per Kategori: {preview.scopeBreakdown.category}
                  </span>
                  <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                    Unit Tertentu: {preview.scopeBreakdown.unit}
                  </span>
                </div>

                {/* Sampel preview tabel */}
                {preview.sampleRows.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400">
                        <tr>
                          <th className="px-2.5 py-1.5">Cakupan</th>
                          <th className="px-2.5 py-1.5">Target</th>
                          <th className="px-2.5 py-1.5">Standar</th>
                          <th className="px-2.5 py-1.5">Pertanyaan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {preview.sampleRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-700/30">
                            <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-indigo-300">
                              {r.scope || "Semua Unit"}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-400">
                              {r.target || "—"}
                            </td>
                            <td className="max-w-[150px] truncate px-2.5 py-1.5 font-semibold text-white">
                              {r.standard}
                            </td>
                            <td className="max-w-[280px] truncate px-2.5 py-1.5 text-slate-300">
                              {r.question}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {preview.clientErrors.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300">
                        Peringatan Berkas:
                      </p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-200/90">
                        {preview.clientErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error dari Server Action jika tidak ada summary */}
            {state?.error && !summary && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-300">{state.error}</p>
                  {state.rowErrors && state.rowErrors.length > 0 && (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-rose-200/90">
                      {state.rowErrors.map((re, idx) => (
                        <li key={idx}>{re}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="rounded-xl border border-slate-600/50 bg-slate-500/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-500/20 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  !file || isPending || (preview?.clientErrors.length ?? 0) > 0
                }
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-xs font-semibold text-white shadow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses Import...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Proses &amp; Simpan Instrumen
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
