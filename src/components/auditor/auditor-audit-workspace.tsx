"use client";

import React, { useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  CircleDashed,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  ClipboardList,
  Lock,
  FileDown,
  AlertTriangle,
  Paperclip,
  X,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { saveAuditorFinding } from "@/lib/actions/auditor-responses";
import { finalizeAudit } from "@/lib/actions/auditor-finalize";
import type {
  QuestionRow,
  ResponseRow,
} from "@/components/audit/audit-workspace";

/* ======================================================================== */
/*  TYPES                                                                    */
/* ======================================================================== */

type Assignment = {
  unitId: number;
  role: string;
  unit: { id: number; name: string; category: string };
};

export type FindingRow = {
  id?: number;
  cycleId: number;
  unitId: number;
  auditQuestionId: number;
  temuan: string;
  akarMasalah: string;
  rencanaTL: string;
  efektivitasTL: string;
};

export type AuditorSignatureInfo = {
  auditor1: { name: string; role: string } | null;
  auditor2: { name: string; role: string } | null;
  lpmHead: { name: string } | null;
};

type LocalFinding = {
  temuan: string;
  akarMasalah: string;
  rencanaTL: string;
  efektivitasTL: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
};

/* ======================================================================== */
/*  MODAL BUKTI UNIT                                                        */
/* ======================================================================== */

function EvidenceModal({
  questionText,
  evidenceFile,
  evidenceLink,
  onClose,
}: {
  questionText: string;
  evidenceFile: string | null;
  evidenceLink: string | null;
  onClose: () => void;
}) {
  const hasEvidence = evidenceFile || evidenceLink;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl"
        style={{ background: "var(--modal-bg)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 shrink-0 text-indigo-400" />
            <h3
              className="font-semibold text-sm"
              style={{ color: "var(--body-color)" }}
            >
              Bukti dari Unit
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Pertanyaan */}
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
            {questionText}
          </p>

          {!hasEvidence ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-slate-500/5 px-4 py-3 text-xs text-slate-400">
              <CircleDashed className="w-4 h-4 shrink-0" />
              Unit belum mengunggah bukti apapun.
            </div>
          ) : (
            <div className="space-y-3">
              {/* File bukti */}
              {evidenceFile && (
                <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    File Bukti
                  </p>
                  <a
                    href={`/api/files/${evidenceFile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {evidenceFile.split("/").pop() ?? evidenceFile}
                  </a>
                </div>
              )}

              {/* Link bukti */}
              {evidenceLink && (
                <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5" />
                    Tautan Bukti
                  </p>
                  <a
                    href={evidenceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                    {evidenceLink}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function EvidenceButton({
  evidenceFile,
  evidenceLink,
  onClick,
}: {
  evidenceFile: string | null;
  evidenceLink: string | null;
  onClick: () => void;
}) {
  const hasEvidence = evidenceFile || evidenceLink;
  return (
    <button
      type="button"
      onClick={onClick}
      title={hasEvidence ? "Lihat bukti dari unit" : "Belum ada bukti"}
      className={[
        "inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
        hasEvidence
          ? "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25"
          : "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20",
      ].join(" ")}
    >
      <Paperclip className="w-3.5 h-3.5" />
    </button>
  );
}

/* ======================================================================== */
/*  BADGE STATUS JAWABAN UNIT                                                */
/* ======================================================================== */

function AnswerBadge({ answer }: { answer: "ya" | "tidak" | null }) {
  if (answer === null)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
        <CircleDashed className="h-3 w-3 shrink-0" />
        Belum Diisi
      </span>
    );
  if (answer === "ya")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        Ada
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400 whitespace-nowrap">
      <XCircle className="h-3 w-3 shrink-0" />
      Tidak Ada
    </span>
  );
}

/* ======================================================================== */
/*  EXPORT PDF (client-side, lazy import)                                   */
/* ======================================================================== */

async function exportPdf(params: {
  cycleName: string;
  unit: { name: string; category: string };
  signature: AuditorSignatureInfo;
  questions: QuestionRow[];
  responses: ResponseRow[];
  findings: FindingRow[];
}) {
  const { buildAuditorFindingPdf } =
    await import("@/lib/report/pdf-auditor-finding");

  // Susun standar + pertanyaan
  const standardMap = new Map<
    number,
    { no: number; name: string; questions: QuestionRow[] }
  >();
  const standardOrder: number[] = [];
  for (const q of params.questions) {
    if (!standardMap.has(q.standardId)) {
      standardMap.set(q.standardId, {
        no: standardOrder.length + 1,
        name: q.standardName,
        questions: [],
      });
      standardOrder.push(q.standardId);
    }
    standardMap.get(q.standardId)!.questions.push(q);
  }

  let qNo = 0;
  const standards = standardOrder.map((sid) => {
    const std = standardMap.get(sid)!;
    return {
      no: std.no,
      name: std.name,
      questions: std.questions.map((q) => {
        qNo++;
        const resp = params.responses.find((r) => r.auditQuestionId === q.id);
        const finding = params.findings.find((f) => f.auditQuestionId === q.id);
        return {
          no: qNo,
          text: q.questionText,
          unitAnswer: resp?.answer ?? null,
          temuan: finding?.temuan ?? "",
          akarMasalah: finding?.akarMasalah ?? "",
          rencanaTL: finding?.rencanaTL ?? "",
          efektivitasTL: finding?.efektivitasTL ?? "",
        };
      }),
    };
  });

  const bytes = buildAuditorFindingPdf({
    cycleName: params.cycleName,
    unit: params.unit,
    generatedAt: new Date(),
    auditor1: params.signature.auditor1,
    auditor2: params.signature.auditor2,
    lpmHead: params.signature.lpmHead,
    standards,
  });

  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Lembar-Temuan-${params.unit.name.replace(/\s+/g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ======================================================================== */
/*  UNIT SECTION                                                             */
/* ======================================================================== */

function UnitSection({
  cycleId,
  cycleName,
  unit,
  role,
  questions,
  responses,
  findings: initialFindings,
  finalized: initialFinalized,
  signature,
  isLpmView = false,
}: {
  cycleId: number;
  cycleName: string;
  unit: { id: number; name: string; category: string };
  role: string;
  questions: QuestionRow[];
  responses: ResponseRow[];
  findings: FindingRow[];
  finalized: boolean;
  signature: AuditorSignatureInfo;
  isLpmView?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [finalized, setFinalized] = useState(initialFinalized);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pdfFindings, setPdfFindings] = useState<FindingRow[]>(initialFindings);

  // State modal bukti
  const [evidenceModal, setEvidenceModal] = useState<{
    questionText: string;
    evidenceFile: string | null;
    evidenceLink: string | null;
  } | null>(null);

  const key = (questionId: number) => `${unit.id}-${questionId}`;

  const [locals, setLocals] = useState<Record<string, LocalFinding>>(() => {
    const map: Record<string, LocalFinding> = {};
    for (const q of questions) {
      const existing = initialFindings.find(
        (f) => f.auditQuestionId === q.id && f.unitId === unit.id
      );
      map[key(q.id)] = {
        temuan: existing?.temuan ?? "",
        akarMasalah: existing?.akarMasalah ?? "",
        rencanaTL: existing?.rencanaTL ?? "",
        efektivitasTL: existing?.efektivitasTL ?? "",
        dirty: false,
        saving: false,
        saved: false,
      };
    }
    return map;
  });

  const setField = useCallback(
    (
      questionId: number,
      field: keyof Omit<LocalFinding, "dirty" | "saving" | "saved">,
      value: string
    ) => {
      setLocals((prev) => ({
        ...prev,
        [key(questionId)]: {
          ...prev[key(questionId)],
          [field]: value,
          dirty: true,
          saved: false,
        },
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unit.id]
  );

  const handleSave = useCallback(
    async (questionId: number) => {
      const local = locals[key(questionId)];
      if (!local) return;
      setLocals((prev) => ({
        ...prev,
        [key(questionId)]: { ...prev[key(questionId)], saving: true },
      }));
      const fd = new FormData();
      fd.set("cycleId", String(cycleId));
      fd.set("unitId", String(unit.id));
      fd.set("auditQuestionId", String(questionId));
      fd.set("temuan", local.temuan);
      fd.set("akarMasalah", local.akarMasalah);
      fd.set("rencanaTL", local.rencanaTL);
      fd.set("efektivitasTL", local.efektivitasTL);

      const result = await saveAuditorFinding({ ok: false }, fd);
      setLocals((prev) => ({
        ...prev,
        [key(questionId)]: {
          ...prev[key(questionId)],
          saving: false,
          dirty: result.ok ? false : prev[key(questionId)].dirty,
          saved: result.ok,
        },
      }));
      if (!result.ok) {
        setGlobalError(result.error ?? "Gagal menyimpan.");
      } else {
        setGlobalError(null);
        // Update snapshot PDF
        setPdfFindings((prev) => {
          const next = prev.filter(
            (f) => !(f.auditQuestionId === questionId && f.unitId === unit.id)
          );
          next.push({
            cycleId,
            unitId: unit.id,
            auditQuestionId: questionId,
            temuan: local.temuan,
            akarMasalah: local.akarMasalah,
            rencanaTL: local.rencanaTL,
            efektivitasTL: local.efektivitasTL,
          });
          return next;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locals, cycleId, unit.id]
  );

  const handleFinalize = async () => {
    if (
      !confirm(
        `Finalisasi audit untuk unit "${unit.name}"?\n\nSetelah difinalisasi, Anda tidak dapat mengubah temuan lagi.`
      )
    )
      return;
    setFinalizing(true);
    setFinalizeError(null);
    const fd = new FormData();
    fd.set("cycleId", String(cycleId));
    fd.set("unitId", String(unit.id));
    const result = await finalizeAudit({ ok: false }, fd);
    setFinalizing(false);
    if (!result.ok) {
      setFinalizeError(result.error ?? "Gagal memfinalisasi.");
    } else {
      setFinalized(true);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPdf({
        cycleName,
        unit,
        signature,
        questions,
        responses,
        findings: pdfFindings,
      });
    } finally {
      setExporting(false);
    }
  };

  const filled = questions.filter((q) => {
    const l = locals[key(q.id)];
    return l && (l.temuan || l.akarMasalah || l.rencanaTL || l.efektivitasTL);
  }).length;

  const hasDirty = Object.values(locals).some((l) => l.dirty);

  const standardGroups = React.useMemo(() => {
    const groups: {
      standardId: number;
      standardName: string;
      questions: QuestionRow[];
    }[] = [];
    const seen = new Map<number, number>();
    for (const q of questions) {
      const idx = seen.get(q.standardId);
      if (idx === undefined) {
        seen.set(q.standardId, groups.length);
        groups.push({
          standardId: q.standardId,
          standardName: q.standardName,
          questions: [q],
        });
      } else {
        groups[idx].questions.push(q);
      }
    }
    return groups;
  }, [questions]);

  const statusLabel = finalized
    ? "Selesai"
    : filled === questions.length && questions.length > 0
      ? "Lengkap"
      : filled > 0
        ? "Sebagian"
        : "Belum";

  const statusClass = finalized
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
    : filled === questions.length && questions.length > 0
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : filled > 0
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-[var(--border)] bg-slate-500/10 text-slate-400";

  return (
    <div
      className={`card overflow-hidden ${finalized ? "ring-1 ring-emerald-500/30" : ""}`}
    >
      {/* ── Header unit ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        {/* Kiri: toggle + info */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-xs font-bold text-on-accent">
              {unit.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--body-color)" }}
            >
              {unit.name}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {unit.category} ·{" "}
              {role === "lead" ? "Ketua Tim Auditor" : "Anggota Tim Auditor"} ·{" "}
              {filled}/{questions.length} diisi
            </p>
          </div>
          <div className="shrink-0 ml-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {/* Kanan: badge + tombol aksi */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusClass}`}
          >
            {finalized && <Lock className="inline w-2.5 h-2.5 mr-1 -mt-px" />}
            {statusLabel}
          </span>

          {/* Tombol Finalisasi — hanya untuk auditor, bukan LPM */}
          {!finalized && !isLpmView && (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizing || hasDirty}
              title={
                hasDirty
                  ? "Simpan semua perubahan sebelum finalisasi"
                  : "Finalisasi audit unit ini"
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                         bg-gradient-to-r from-amber-500 to-orange-500 text-on-accent shadow-sm
                         hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {finalizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              {finalizing ? "Memfinalisasi..." : "Finalisasi"}
            </button>
          )}

          {/* Tombol Export PDF — auditor: setelah finalisasi | LPM: selalu tampil */}
          {(finalized || isLpmView) && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              title="Unduh lembar temuan sebagai PDF"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                         bg-gradient-to-r from-indigo-500 to-violet-500 text-on-accent shadow-sm
                         hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              {exporting ? "Mengekspor..." : "Export PDF"}
            </button>
          )}
        </div>
      </div>

      {/* Error finalisasi */}
      {finalizeError && (
        <div className="mx-4 mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {finalizeError}
        </div>
      )}

      {/* Banner sudah difinalisasi */}
      {finalized && (
        <div className="mx-4 mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-2.5 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Audit unit ini telah difinalisasi. Klik <strong>
            Export PDF
          </strong>{" "}
          untuk mengunduh lembar temuan dengan tanda tangan.
        </div>
      )}

      {expanded && (
        <div>
          {/* Error simpan */}
          {globalError && (
            <div className="mx-4 mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400">
              {globalError}
            </div>
          )}

          {/* hasDirty warning sebelum finalisasi */}
          {hasDirty && !finalized && (
            <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Ada perubahan yang belum disimpan. Simpan semua baris sebelum
              finalisasi.
            </div>
          )}

          {/* ── Desktop table ── */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  style={{ background: "rgba(99,102,241,0.06)" }}
                >
                  <th className="px-4 py-3 text-left w-44 border-b border-[var(--border)]">
                    Standar
                  </th>
                  <th className="px-4 py-3 text-left border-b border-[var(--border)]">
                    Pertanyaan
                  </th>
                  <th className="px-4 py-3 text-center w-28 border-b border-[var(--border)]">
                    Ada / Tidak
                  </th>
                  <th className="px-3 py-3 text-center w-12 border-b border-[var(--border)]">
                    Bukti
                  </th>
                  <th className="px-4 py-3 text-left w-40 border-b border-[var(--border)]">
                    Temuan
                  </th>
                  <th className="px-4 py-3 text-left w-40 border-b border-[var(--border)]">
                    Akar Masalah
                  </th>
                  <th className="px-4 py-3 text-left w-40 border-b border-[var(--border)]">
                    Rencana Tindak Lanjut
                  </th>
                  <th className="px-4 py-3 text-left w-40 border-b border-[var(--border)]">
                    Efektivitas Tindak Lanjut
                  </th>
                  {!finalized && (
                    <th className="px-3 py-3 text-center w-14 border-b border-[var(--border)]" />
                  )}
                </tr>
              </thead>
              <tbody>
                {standardGroups.map((group, groupIdx) =>
                  group.questions.map((q, qi) => {
                    const response = responses.find(
                      (r) => r.auditQuestionId === q.id && r.unitId === unit.id
                    );
                    const local = locals[key(q.id)];
                    if (!local) return null;

                    const standardNo = groupIdx + 1;
                    const questionNo =
                      standardGroups
                        .slice(0, groupIdx)
                        .reduce((sum, g) => sum + g.questions.length, 0) +
                      qi +
                      1;
                    const isFirstInGroup = qi === 0;

                    return (
                      <tr
                        key={q.id}
                        className="border-b border-[var(--border)] hover:bg-indigo-500/[0.03] align-top transition-colors"
                      >
                        {/* Standar — kolom paling kiri, rowspan */}
                        {isFirstInGroup && (
                          <td
                            rowSpan={group.questions.length}
                            className="px-4 py-3 align-middle border-r border-[var(--border)] leading-snug w-44"
                          >
                            <div className="flex items-start gap-1.5">
                              <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 tabular-nums">
                                {standardNo}
                              </span>
                              <span className="text-xs font-semibold text-indigo-400 leading-snug">
                                {group.standardName}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Pertanyaan */}
                        <td
                          className="px-4 py-3 text-xs leading-relaxed"
                          style={{ color: "var(--body-color)" }}
                        >
                          <span className="flex items-start gap-2">
                            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-slate-500/15 flex items-center justify-center text-[10px] font-bold text-slate-400 tabular-nums">
                              {questionNo}
                            </span>
                            <span>{q.questionText}</span>
                          </span>
                        </td>

                        {/* Ada / Tidak */}
                        <td className="px-4 py-3 text-center align-middle">
                          <AnswerBadge answer={response?.answer ?? null} />
                        </td>

                        {/* Bukti dari unit — tombol buka modal */}
                        <td className="px-3 py-3 text-center align-middle">
                          <EvidenceButton
                            evidenceFile={response?.evidenceFile ?? null}
                            evidenceLink={response?.evidenceLink ?? null}
                            onClick={() =>
                              setEvidenceModal({
                                questionText: q.questionText,
                                evidenceFile: response?.evidenceFile ?? null,
                                evidenceLink: response?.evidenceLink ?? null,
                              })
                            }
                          />
                        </td>

                        {/* Input kolom — read-only jika sudah finalisasi */}
                        {(
                          [
                            "temuan",
                            "akarMasalah",
                            "rencanaTL",
                            "efektivitasTL",
                          ] as const
                        ).map((field) => (
                          <td key={field} className="px-3 py-3">
                            {finalized ? (
                              <p className="text-xs leading-relaxed text-slate-400 min-h-[40px]">
                                {local[field] || (
                                  <span className="italic text-slate-500">
                                    —
                                  </span>
                                )}
                              </p>
                            ) : (
                              <textarea
                                className="input-base w-full text-xs resize-none min-h-[64px]"
                                placeholder={
                                  field === "temuan"
                                    ? "Uraian temuan..."
                                    : field === "akarMasalah"
                                      ? "Akar masalah..."
                                      : field === "rencanaTL"
                                        ? "Rencana tindak lanjut..."
                                        : "Efektivitas tindak lanjut..."
                                }
                                value={local[field]}
                                onChange={(e) =>
                                  setField(q.id, field, e.target.value)
                                }
                              />
                            )}
                          </td>
                        ))}

                        {/* Tombol simpan — hanya jika belum finalisasi */}
                        {!finalized && (
                          <td className="px-3 py-3 text-center align-middle">
                            {local.dirty ? (
                              <button
                                type="button"
                                onClick={() => handleSave(q.id)}
                                disabled={local.saving}
                                title="Simpan perubahan"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-on-accent shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                {local.saving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : local.saved ? (
                              <span title="Tersimpan">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs select-none">
                                —
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="lg:hidden p-4 space-y-4">
            {standardGroups.map((group, groupIdx) =>
              group.questions.map((q, qi) => {
                const response = responses.find(
                  (r) => r.auditQuestionId === q.id && r.unitId === unit.id
                );
                const local = locals[key(q.id)];
                if (!local) return null;

                const standardNo = groupIdx + 1;
                const questionNo =
                  standardGroups
                    .slice(0, groupIdx)
                    .reduce((sum, g) => sum + g.questions.length, 0) +
                  qi +
                  1;

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-[var(--border)] p-4 space-y-3"
                    style={{ background: "rgba(99,102,241,0.04)" }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-slate-500/15 flex items-center justify-center text-[10px] font-bold text-slate-400 tabular-nums">
                        {questionNo}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-indigo-400 mb-0.5">
                          {standardNo}. {q.standardName}
                        </p>
                        <p
                          className="text-sm leading-relaxed"
                          style={{ color: "var(--body-color)" }}
                        >
                          {q.questionText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        Jawaban unit:
                      </span>
                      <AnswerBadge answer={response?.answer ?? null} />
                      <EvidenceButton
                        evidenceFile={response?.evidenceFile ?? null}
                        evidenceLink={response?.evidenceLink ?? null}
                        onClick={() =>
                          setEvidenceModal({
                            questionText: q.questionText,
                            evidenceFile: response?.evidenceFile ?? null,
                            evidenceLink: response?.evidenceLink ?? null,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        {
                          field: "temuan" as const,
                          label: "Temuan",
                          placeholder: "Uraian temuan...",
                        },
                        {
                          field: "akarMasalah" as const,
                          label: "Akar Masalah",
                          placeholder: "Akar masalah...",
                        },
                        {
                          field: "rencanaTL" as const,
                          label: "Rencana Tindak Lanjut",
                          placeholder: "Rencana tindak lanjut...",
                        },
                        {
                          field: "efektivitasTL" as const,
                          label: "Efektivitas Tindak Lanjut",
                          placeholder: "Efektivitas tindak lanjut...",
                        },
                      ].map(({ field, label, placeholder }) => (
                        <label key={field} className="block">
                          <span className="block mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {label}
                          </span>
                          {finalized ? (
                            <p className="text-xs text-slate-400 min-h-[40px]">
                              {local[field] || (
                                <span className="italic text-slate-500">—</span>
                              )}
                            </p>
                          ) : (
                            <textarea
                              className="input-base w-full text-sm resize-none min-h-[56px]"
                              placeholder={placeholder}
                              value={local[field]}
                              onChange={(e) =>
                                setField(q.id, field, e.target.value)
                              }
                            />
                          )}
                        </label>
                      ))}
                    </div>

                    {!finalized && (
                      <div className="flex items-center gap-2 pt-1">
                        {local.dirty && (
                          <button
                            type="button"
                            onClick={() => handleSave(q.id)}
                            disabled={local.saving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-on-accent shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {local.saving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            {local.saving ? "Menyimpan..." : "Simpan"}
                          </button>
                        )}
                        {local.saved && !local.dirty && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal bukti */}
      {evidenceModal && (
        <EvidenceModal
          questionText={evidenceModal.questionText}
          evidenceFile={evidenceModal.evidenceFile}
          evidenceLink={evidenceModal.evidenceLink}
          onClose={() => setEvidenceModal(null)}
        />
      )}
    </div>
  );
}

/* ======================================================================== */
/*  MAIN WORKSPACE                                                           */
/* ======================================================================== */

export function AuditorAuditWorkspace({
  cycleId,
  cycleName,
  assignments,
  questions,
  responses,
  findings,
  finalizedUnitIds,
  signatureByUnit,
  auditorId: _auditorId,
  isLpmView = false,
}: {
  cycleId: number;
  cycleName: string;
  unitCategory?: string;
  assignments: Assignment[];
  questions: QuestionRow[];
  responses: ResponseRow[];
  findings: FindingRow[];
  finalizedUnitIds: number[];
  signatureByUnit: Record<number, AuditorSignatureInfo>;
  auditorId: number;
  isLpmView?: boolean;
}) {
  const totalQ = questions.length * assignments.length;
  const filledCount = findings.filter(
    (f) => f.temuan || f.akarMasalah || f.rencanaTL || f.efektivitasTL
  ).length;
  const finalizedCount = finalizedUnitIds.length;
  const pct = totalQ > 0 ? Math.round((filledCount / totalQ) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Summary card ── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
              <ClipboardList className="w-5 h-5 text-on-accent" />
            </div>
            <div>
              <h2
                className="font-bold text-base"
                style={{ color: "var(--body-color)" }}
              >
                Lembar Temuan Audit
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Siklus:{" "}
                <span className="font-semibold text-indigo-400">
                  {cycleName}
                </span>
                {" · "}
                {assignments.length} unit ditugaskan
                {" · "}
                {filledCount}/{totalQ} pertanyaan diisi
                {finalizedCount > 0 && (
                  <span className="ml-1 text-emerald-400 font-semibold">
                    · {finalizedCount}/{assignments.length} unit difinalisasi
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:min-w-[180px]">
            <div
              className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className="text-sm font-bold tabular-nums w-10 text-right"
              style={{ color: "var(--body-color)" }}
            >
              {pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Legenda badge */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-slate-400">
        <span className="font-medium">Keterangan jawaban unit:</span>
        <AnswerBadge answer="ya" />
        <AnswerBadge answer="tidak" />
        <AnswerBadge answer={null} />
      </div>

      {/* ── Unit sections ── */}
      {assignments.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">
          Anda belum ditugaskan ke unit mana pun pada siklus ini.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((asg) => (
            <UnitSection
              key={asg.unitId}
              cycleId={cycleId}
              cycleName={cycleName}
              unit={asg.unit}
              role={asg.role}
              questions={questions}
              responses={responses.filter((r) => r.unitId === asg.unitId)}
              findings={findings.filter((f) => f.unitId === asg.unitId)}
              finalized={finalizedUnitIds.includes(asg.unitId)}
              signature={
                signatureByUnit[asg.unitId] ?? {
                  auditor1: null,
                  auditor2: null,
                  lpmHead: null,
                }
              }
              isLpmView={isLpmView}
            />
          ))}
        </div>
      )}
    </div>
  );
}
