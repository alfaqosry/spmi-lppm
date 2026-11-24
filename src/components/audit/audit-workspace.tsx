"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  Link2,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ActionFeedback,
  Field,
  SubmitButton,
  useCloseOnSuccess,
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
} from "@/components/ui/form";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import {
  CATEGORIES,
  UMUM_SLUG,
  groupByStandard,
  isQuestionForUnit,
  type Question,
  type Standard,
  type UnitOption,
} from "@/lib/scope";
import {
  createQuestion,
  createQuestionsBulk,
  createStandard,
  deleteQuestion,
  deleteStandard,
  updateQuestion,
  updateStandard,
  type ActionState as QState,
} from "@/lib/actions/questions";
import { createUnit } from "@/lib/actions/units";
import {
  saveResponse,
  saveRtl,
  verifyResponse,
  type ActionState as RespState,
} from "@/lib/actions/responses";
import { STATUS_LABEL, STATUS_STYLE, percent } from "@/lib/format";
import {
  isResponseDirty,
  standardDeleteImpact,
  type StandardDeleteImpact,
} from "@/components/audit/audit-helpers";
import { DeleteStandardButton } from "@/components/audit/delete-standard-button";
import { ImportInstrumentsModal } from "@/components/audit/import-instruments-modal";

export type { Question, UnitOption };

export type StandardRow = Standard;

export type ResponseRow = {
  id: number;
  auditQuestionId: number;
  unitId: number;
  unitName: string;
  unitCategory: string;
  questionText: string;
  answer: "ya" | "tidak" | null;
  evidenceFile: string | null;
  evidenceLink: string | null;
  reason: string | null;
  status: "pending" | "verified" | "revision";
  lpmNotes: string | null;
  rtl: string | null;
  targetDate: string | null;
  verifierName: string | null;
};

export type QuestionRow = Question;

/* ======================================================================== */
/*  ADMIN WORKSPACE                                                         */
/* ======================================================================== */

export function AdminAuditWorkspace({
  cycleId,
  cycleName,
  questions,
  standards,
  responses,
  units,
}: {
  cycleId: number;
  cycleName: string;
  questions: QuestionRow[];
  standards: StandardRow[];
  responses: ResponseRow[];
  units: UnitOption[];
}) {
  const [tab, setTab] = useState<"instrumen" | "verifikasi">("instrumen");

  const TABS = [
    {
      key: "instrumen" as const,
      label: "Instrumen & Pertanyaan",
      icon: ListChecks,
    },
    {
      key: "verifikasi" as const,
      label: "Panel Verifikasi LPM",
      icon: ShieldCheck,
    },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Bagian audit"
        className="mb-4 inline-flex max-w-full flex-wrap rounded-xl border border-indigo-400/15 bg-slate-500/10 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
              tab === t.key
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-on-accent shadow"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "instrumen" && (
          <InstrumenPanel
            cycleId={cycleId}
            cycleName={cycleName}
            questions={questions}
            standards={standards}
            responses={responses}
            units={units}
          />
        )}
        {tab === "verifikasi" && (
          <VerifikasiTab
            responses={responses}
            questions={questions}
            units={units}
            cycleName={cycleName}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------- Daftar kategori → detail kategori ---------------- */

type CategoryBucket = {
  key: string;
  label: string;
  count: number;
  isUmum: boolean;
};

function InstrumenPanel({
  cycleId,
  cycleName,
  questions,
  standards,
  responses,
  units,
}: {
  cycleId: number;
  cycleName: string;
  questions: QuestionRow[];
  standards: StandardRow[];
  responses: ResponseRow[];
  units: UnitOption[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) set.add(u.category);
    for (const q of questions) if (q.scopeCategory) set.add(q.scopeCategory);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [units, questions]);

  const buckets: CategoryBucket[] = useMemo(() => {
    const umumCount = questions.filter((q) => q.scopeType === "all").length;
    const list: CategoryBucket[] = [
      {
        key: UMUM_SLUG,
        label: "Umum (Semua Unit)",
        count: umumCount,
        isUmum: true,
      },
    ];
    for (const c of categories) {
      const count = questions.filter(
        (q) => q.scopeType === "category" && q.scopeCategory === c
      ).length;
      list.push({
        key: c,
        label: c,
        count,
        isUmum: false,
      });
    }
    return list;
  }, [categories, questions]);

  if (selected === null) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Pilih kategori unit untuk mengelola standar dan butir pertanyaan
            auditnya.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/20 hover:text-white"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Import Excel
            </button>
            <span className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
              {standards.length} standar • {questions.length} butir pertanyaan
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map((b) => {
            const unitCount = b.isUmum
              ? units.length
              : units.filter((u) => u.category === b.key).length;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setSelected(b.key)}
                className="card group flex items-start gap-3 p-4 text-left transition hover:border-indigo-400/40 hover:bg-slate-500/[0.06]"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    b.isUmum
                      ? "border-slate-500/30 bg-slate-500/10 text-slate-300"
                      : "border-indigo-400/25 bg-indigo-500/15 text-indigo-300"
                  }`}
                >
                  {b.isUmum ? (
                    <Globe className="h-5 w-5" />
                  ) : (
                    <Layers className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {b.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {b.count} pertanyaan •{" "}
                    {b.isUmum ? `${unitCount} unit` : `${unitCount} unit`}
                  </p>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 -rotate-90 text-slate-500 transition group-hover:text-indigo-300" />
              </button>
            );
          })}
        </div>

        <ImportInstrumentsModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          cycleId={cycleId}
          cycleName={cycleName}
          units={units}
        />
      </div>
    );
  }

  return (
    <>
      <CategoryDetail
        cycleId={cycleId}
        cycleName={cycleName}
        categoryKey={selected}
        questions={questions}
        standards={standards}
        responses={responses}
        units={units}
        onBack={() => setSelected(null)}
        onOpenImport={() => setImportOpen(true)}
      />
      <ImportInstrumentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        cycleId={cycleId}
        cycleName={cycleName}
        units={units}
      />
    </>
  );
}

function CategoryDetail({
  cycleId,
  cycleName,
  categoryKey,
  questions,
  standards,
  responses,
  units,
  onBack,
  onOpenImport,
}: {
  cycleId: number;
  cycleName: string;
  categoryKey: string;
  questions: QuestionRow[];
  standards: StandardRow[];
  responses: ResponseRow[];
  units: UnitOption[];
  onBack: () => void;
  onOpenImport?: () => void;
}) {
  const isUmum = categoryKey === UMUM_SLUG;
  const categoryUnits = useMemo(
    () => units.filter((u) => u.category === categoryKey),
    [units, categoryKey]
  );

  // Tab aktif: "__all__" (semua unit kategori) atau id unit tertentu.
  const [activeTab, setActiveTab] = useState<string>(
    isUmum ? UMUM_SLUG : "__all__"
  );
  const [addingUnit, setAddingUnit] = useState(false);

  const tabs = isUmum
    ? [{ key: UMUM_SLUG, label: "Umum (Semua Unit)" }]
    : [
        { key: "__all__", label: `Semua ${categoryKey}` },
        ...categoryUnits.map((u) => ({ key: String(u.id), label: u.name })),
      ];

  const shownQuestions = useMemo(() => {
    if (isUmum) return questions.filter((q) => q.scopeType === "all");
    if (activeTab === "__all__")
      return questions.filter(
        (q) => q.scopeType === "category" && q.scopeCategory === categoryKey
      );
    const unitId = Number(activeTab);
    return questions.filter(
      (q) => q.scopeType === "unit" && q.scopeUnitId === unitId
    );
  }, [questions, isUmum, activeTab, categoryKey]);

  const shownStandards = useMemo(() => {
    if (isUmum) return standards.filter((s) => s.scopeType === "all");
    if (activeTab === "__all__")
      return standards.filter(
        (s) => s.scopeType === "category" && s.scopeCategory === categoryKey
      );
    const unitId = Number(activeTab);
    return standards.filter(
      (s) => s.scopeType === "unit" && s.scopeUnitId === unitId
    );
  }, [standards, isUmum, activeTab, categoryKey]);

  // Kelompokkan butir pada tab ini berdasarkan standar induknya.
  const groups = useMemo(() => {
    const present = groupByStandard(shownQuestions);
    // Sertakan standar yang belum punya butir di tab ini agar tetap bisa diisi.
    const presentIds = new Set(present.map((g) => g.standardId));
    const empty: typeof present = shownStandards
      .filter((s) => !presentIds.has(s.id))
      .map((s) => ({
        standardId: s.id,
        standardName: s.name,
        order: s.order,
        questions: [],
      }));
    return [...present, ...empty].sort(
      (a, b) =>
        a.order - b.order || a.standardName.localeCompare(b.standardName)
    );
  }, [shownQuestions, shownStandards]);

  // Cakupan yang dipakai saat menambah pertanyaan di tab ini.
  const scope = isUmum
    ? { scopeType: "all" as const, scopeCategory: "", scopeUnitId: "" }
    : activeTab === "__all__"
      ? {
          scopeType: "category" as const,
          scopeCategory: categoryKey,
          scopeUnitId: "",
        }
      : {
          scopeType: "unit" as const,
          scopeCategory: "",
          scopeUnitId: activeTab,
        };

  const unitNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of units) m.set(u.id, u.name);
    return m;
  }, [units]);

  const activeLabel =
    tabs.find((t) => t.key === activeTab)?.label ?? categoryKey;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-indigo-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar kategori
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
            {isUmum ? (
              <Globe className="h-5 w-5" />
            ) : (
              <Layers className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {isUmum ? "Umum (Semua Unit)" : categoryKey}
            </h2>
            <p className="text-xs text-slate-400">
              {isUmum
                ? "Standar & pertanyaan yang harus dijawab oleh seluruh unit."
                : `${categoryUnits.length} unit dalam kategori ini`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-2 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/20 hover:text-white"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Import Excel
            </button>
          )}
          {!isUmum && (
            <button
              type="button"
              onClick={() => setAddingUnit(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Unit
            </button>
          )}
        </div>
      </div>

      {/* Tab per unit */}
      <div
        role="group"
        aria-label="Cakupan pertanyaan"
        className="mb-4 flex flex-wrap items-center gap-2 border-b border-indigo-400/10 pb-3"
      >
        {tabs.map((t) => {
          const count =
            t.key === UMUM_SLUG
              ? questions.filter((q) => q.scopeType === "all").length
              : t.key === "__all__"
                ? questions.filter(
                    (q) =>
                      q.scopeType === "category" &&
                      q.scopeCategory === categoryKey
                  ).length
                : questions.filter(
                    (q) =>
                      q.scopeType === "unit" && q.scopeUnitId === Number(t.key)
                  ).length;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex min-h-9 max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                activeTab === t.key
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                  : "border-slate-600/40 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
              }`}
            >
              {t.key === "__all__" && <Layers className="h-3.5 w-3.5" />}
              {t.key !== "__all__" && t.key !== UMUM_SLUG && (
                <Building2 className="h-3.5 w-3.5" />
              )}
              <span className="max-w-[180px] truncate">{t.label}</span>
              <span className="rounded-full bg-slate-700/60 px-1.5 py-0.5 text-xs font-bold text-slate-300">
                {count}
                <span className="sr-only"> pertanyaan</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tambah Standar (inline, tanpa modal) */}
      <div className="card mb-4 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Plus className="h-3.5 w-3.5 text-indigo-300" /> Tambah Standar Baru
        </p>
        <InlineStandardForm cycleId={cycleId} scope={scope} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">
          Daftar Standar &amp; Butir Pertanyaan — {activeLabel}
        </h3>
        <span className="text-xs text-slate-400">
          {groups.reduce((a, g) => a + g.questions.length, 0)} butir •{" "}
          {groups.filter((g) => g.questions.length > 0).length} standar terpakai
        </span>
      </div>

      {/* Standar sebagai pengelompok; butir pertanyaan di bawahnya */}
      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="card p-6 text-center text-xs text-slate-500">
            Belum ada standar pada siklus ini. Tambahkan standar terlebih dahulu
            di atas.
          </div>
        )}
        {groups.map((g) => (
          <StandardBlock
            key={g.standardId}
            standardId={g.standardId}
            standardName={g.standardName}
            questions={g.questions}
            cycleId={cycleId}
            cycleName={cycleName}
            impact={standardDeleteImpact(
              g.standardId,
              questions,
              responses,
              unitNameById
            )}
            scope={scope}
            standards={standards}
            units={units}
            unitNameById={unitNameById}
            showScopeBadge={isUmum || activeTab === "__all__"}
          />
        ))}
      </div>

      {!isUmum && (
        <AddUnitDialog
          open={addingUnit}
          onClose={() => setAddingUnit(false)}
          category={categoryKey}
        />
      )}
    </div>
  );
}

/** Blok satu standar: header + daftar butir + form tambah butir inline. */
function StandardBlock({
  standardId,
  standardName,
  questions,
  cycleId,
  cycleName,
  impact,
  scope,
  standards,
  units,
  unitNameById,
  showScopeBadge,
}: {
  standardId: number;
  standardName: string;
  questions: QuestionRow[];
  cycleId: number;
  cycleName: string;
  impact: StandardDeleteImpact;
  scope: { scopeType: string; scopeCategory: string; scopeUnitId: string };
  standards: StandardRow[];
  units: UnitOption[];
  unitNameById: Map<number, string>;
  showScopeBadge: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [openQuestions, setOpenQuestions] = useState(false);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-400/10 bg-slate-500/[0.05] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
            <FileText className="h-3.5 w-3.5" />
          </span>
          {editing ? (
            <InlineStandardForm
              cycleId={cycleId}
              standard={{ id: standardId, name: standardName }}
              onDone={() => setEditing(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpenQuestions(true)}
              className="group min-w-0 rounded-lg text-left"
              aria-label={`Kelola butir pertanyaan standar ${standardName}`}
            >
              <p className="truncate text-sm font-semibold text-white group-hover:text-indigo-300">
                {standardName}
              </p>
              <p className="flex items-center gap-1 text-xs text-slate-400">
                {questions.length} butir pertanyaan
                <span
                  aria-hidden="true"
                  className="text-indigo-300 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  • klik untuk kelola
                </span>
              </p>
            </button>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-indigo-300"
              aria-label={`Ubah standar ${standardName}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <DeleteStandardButton
              standardName={standardName}
              cycleName={cycleName}
              impact={impact}
              action={() => deleteStandard(standardId)}
            />
          </div>
        )}
      </div>

      <ul className="divide-y divide-slate-500/15">
        {questions.map((q, idx) => (
          <QuestionItem
            key={q.id}
            question={q}
            index={idx + 1}
            cycleId={cycleId}
            standards={standards}
            units={units}
            unitNameById={unitNameById}
            showScopeBadge={showScopeBadge}
          />
        ))}
        {questions.length === 0 && (
          <li className="px-4 py-4 text-center text-xs text-slate-500">
            Belum ada butir pertanyaan pada standar ini.
          </li>
        )}
      </ul>

      <div className="border-t border-indigo-400/10 bg-slate-500/[0.04] px-4 py-3">
        <button
          type="button"
          onClick={() => setOpenQuestions(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-400/30 bg-indigo-500/[0.06] px-4 py-2.5 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/15"
        >
          <Plus className="h-4 w-4" /> Kelola / Tambah Butir Pertanyaan
        </button>
      </div>

      <StandardQuestionsDialog
        open={openQuestions}
        onClose={() => setOpenQuestions(false)}
        cycleId={cycleId}
        standardId={standardId}
        standardName={standardName}
        questions={questions}
        scope={scope}
        standards={standards}
        units={units}
        unitNameById={unitNameById}
        showScopeBadge={showScopeBadge}
      />
    </div>
  );
}

/* ------------------ Modal kelola butir pertanyaan per standar ------------- */

function StandardQuestionsDialog({
  open,
  onClose,
  cycleId,
  standardId,
  standardName,
  questions,
  scope,
  standards,
  units,
  unitNameById,
  showScopeBadge,
}: {
  open: boolean;
  onClose: () => void;
  cycleId: number;
  standardId: number;
  standardName: string;
  questions: QuestionRow[];
  scope: { scopeType: string; scopeCategory: string; scopeUnitId: string };
  standards: StandardRow[];
  units: UnitOption[];
  unitNameById: Map<number, string>;
  showScopeBadge: boolean;
}) {
  const [pending, setPending] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction] = useActionState<QState, FormData>(
    createQuestionsBulk,
    undefined
  );

  // Setelah berhasil simpan: kosongkan daftar butir baru (derivasi saat render,
  // pola "menyimpan info dari render sebelumnya" — tanpa efek beruntun).
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) {
      setPending([]);
      setDraft("");
    }
  }

  const addDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setPending((prev) => [...prev, text]);
    setDraft("");
    draftRef.current?.focus();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Butir Pertanyaan"
      icon={<FileText className="h-4 w-4" />}
      description={
        <>
          Standar: <span className="text-slate-200">{standardName}</span>
        </>
      }
    >
      <div className="space-y-4">
        {/* 1. Tambah butir baru ke daftar */}
        <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Plus className="h-3.5 w-3.5 text-indigo-300" /> Tambah Butir Baru
          </p>
          <textarea
            ref={draftRef}
            aria-label="Teks butir pertanyaan baru"
            aria-describedby="draft-hint"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                addDraft();
              }
            }}
            rows={2}
            placeholder="Tulis butir pertanyaan, lalu klik Tambah…"
            className="input-base resize-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span id="draft-hint" className="text-xs text-slate-500">
              Tekan Ctrl+Enter untuk menambah cepat.
            </span>
            <button
              type="button"
              onClick={addDraft}
              disabled={!draft.trim()}
              className={BTN_PRIMARY}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Tambah ke Daftar
            </button>
          </div>
        </div>

        {/* 2. Daftar butir baru (belum disimpan) */}
        <div>
          <p
            className="mb-2 text-xs font-semibold text-slate-300"
            aria-live="polite"
          >
            Butir Baru ({pending.length})
          </p>
          {pending.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-600/40 px-3 py-3 text-center text-xs text-slate-500">
              Belum ada butir baru. Butir yang ditambahkan akan muncul di sini
              sebelum disimpan.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((text, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-indigo-400/15 bg-slate-500/[0.06] px-3 py-2"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-600/50 bg-slate-800/50 text-xs font-semibold text-slate-300">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-xs text-slate-200">
                    {text}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setPending((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-rose-300"
                    aria-label={`Hapus butir baru nomor ${i + 1} dari daftar`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Daftar butir yang sudah tersimpan */}
        <div className="border-t border-indigo-400/10 pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-300">
            Butir Tersimpan pada Standar Ini ({questions.length})
          </p>
          {questions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-600/40 px-3 py-3 text-center text-xs text-slate-500">
              Belum ada butir tersimpan pada cakupan ini.
            </p>
          ) : (
            <ul className="space-y-2">
              {questions.map((q, idx) =>
                editingId === q.id ? (
                  <li
                    key={q.id}
                    className="rounded-xl border border-indigo-400/20 bg-slate-500/[0.06] p-3"
                  >
                    <InlineQuestionForm
                      cycleId={cycleId}
                      question={q}
                      standards={standards}
                      units={units}
                      onDone={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={q.id}
                    className="flex items-start gap-2 rounded-xl border border-slate-600/30 bg-slate-500/[0.04] px-3 py-2"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-600/50 bg-slate-800/50 text-xs font-semibold text-slate-300">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-200">{q.questionText}</p>
                      {showScopeBadge && (
                        <div className="mt-1">
                          <ScopeBadge
                            question={q}
                            unitNameById={unitNameById}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(q.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-indigo-300"
                        aria-label={`Ubah pertanyaan nomor ${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <ConfirmAction
                        action={() => deleteQuestion(q.id)}
                        title="Hapus pertanyaan?"
                        message={
                          <>
                            Butir “{q.questionText}” beserta jawaban unit
                            terkait akan dihapus permanen.
                          </>
                        }
                        triggerLabel={`Hapus pertanyaan nomor ${idx + 1}`}
                        trigger={
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        }
                        triggerClassName="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-rose-300"
                      />
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>
      </div>

      {/* 4. Tombol Simpan (bulk) */}
      <form
        action={formAction}
        className="mt-5 space-y-3 border-t border-indigo-400/10 pt-4"
      >
        <input type="hidden" name="cycleId" value={cycleId} />
        <input type="hidden" name="standardId" value={standardId} />
        <input type="hidden" name="scopeType" value={scope.scopeType} />
        <input type="hidden" name="scopeCategory" value={scope.scopeCategory} />
        <input type="hidden" name="scopeUnitId" value={scope.scopeUnitId} />
        <input type="hidden" name="startOrder" value={questions.length + 1} />
        <input type="hidden" name="texts" value={JSON.stringify(pending)} />
        <ActionFeedback state={state} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Tutup
          </button>
          <SubmitButton
            label={`Simpan${pending.length > 0 ? ` (${pending.length})` : ""}`}
            icon={<Save className="h-4 w-4" />}
            disabled={pending.length === 0}
          />
        </div>
      </form>
    </Modal>
  );
}

/** Form inline untuk membuat/mengubah standar. */
function InlineStandardForm({
  cycleId,
  scope,
  standard,
  onDone,
}: {
  cycleId: number;
  scope?: { scopeType: string; scopeCategory: string; scopeUnitId: string };
  standard?: { id: number; name: string };
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<QState, FormData>(
    standard ? updateStandard : createStandard,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    if (standard) onDone?.();
    else formRef.current?.reset();
  }, [state, standard, onDone]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={
        standard
          ? "flex min-w-0 flex-1 flex-wrap items-start gap-2"
          : "space-y-3"
      }
    >
      {standard ? (
        <input type="hidden" name="id" value={standard.id} />
      ) : (
        <>
          <input type="hidden" name="cycleId" value={cycleId} />
          {scope && (
            <>
              <input type="hidden" name="scopeType" value={scope.scopeType} />
              <input
                type="hidden"
                name="scopeCategory"
                value={scope.scopeCategory}
              />
              <input
                type="hidden"
                name="scopeUnitId"
                value={scope.scopeUnitId}
              />
            </>
          )}
        </>
      )}

      <div className="min-w-0 flex-1">
        <Field label="Nama standar" labelHidden>
          <input
            name="name"
            defaultValue={standard?.name ?? ""}
            placeholder="mis. Standar Tata Pamong / Standar Isi Pembelajaran"
            className="input-base"
            required
          />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton
          label={standard ? "Simpan" : "Tambah Standar"}
          icon={standard ? undefined : <Plus className="h-4 w-4" />}
        />
        {standard && onDone && (
          <button type="button" onClick={onDone} className={BTN_SECONDARY}>
            Batal
          </button>
        )}
      </div>
      {!standard && <ActionFeedback state={state} />}
    </form>
  );
}

function QuestionItem({
  question,
  index,
  cycleId,
  standards,
  units,
  unitNameById,
  showScopeBadge,
}: {
  question: QuestionRow;
  index: number;
  cycleId: number;
  standards: StandardRow[];
  units: UnitOption[];
  unitNameById: Map<number, string>;
  showScopeBadge: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="bg-slate-500/[0.06] px-4 py-4">
        <InlineQuestionForm
          cycleId={cycleId}
          question={question}
          standards={standards}
          units={units}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-slate-500/[0.06]">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-600/50 bg-slate-800/50 text-xs font-semibold text-slate-300">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">{question.questionText}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300">
            <FileText className="h-3 w-3" /> {question.standardName}
          </span>
          {showScopeBadge && (
            <ScopeBadge question={question} unitNameById={unitNameById} />
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-indigo-300"
          aria-label={`Ubah pertanyaan nomor ${index}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <ConfirmAction
          action={() => deleteQuestion(question.id)}
          title="Hapus pertanyaan?"
          message={
            <>
              Butir “{question.questionText}” beserta jawaban unit terkait akan
              dihapus permanen.
            </>
          }
          triggerLabel={`Hapus pertanyaan nomor ${index}`}
          trigger={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-500/10 hover:text-rose-300"
        />
      </div>
    </li>
  );
}

/** Badge penanda cakupan pertanyaan (Umum / kategori / unit). */
function ScopeBadge({
  question,
  unitNameById,
}: {
  question: Question;
  unitNameById: Map<number, string>;
}) {
  const isAll = question.scopeType === "all";
  const isCategory = question.scopeType === "category";
  const Icon = isAll ? Globe : isCategory ? Layers : Building2;
  const label = isAll
    ? "Umum"
    : isCategory
      ? `Kategori ${question.scopeCategory ?? ""}`
      : `Unit ${question.scopeUnitId != null ? (unitNameById.get(question.scopeUnitId) ?? "") : ""}`;
  const cls = isAll
    ? "border-slate-500/30 bg-slate-500/10 text-slate-400"
    : isCategory
      ? "border-sky-400/25 bg-sky-500/10 text-sky-300"
      : "border-violet-400/25 bg-violet-500/10 text-violet-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/* --------------------------- Form pertanyaan inline ---------------------- */

function InlineQuestionForm({
  cycleId,
  standardId,
  standards,
  question,
  scope,
  units,
  scopeLocked = false,
  nextOrder,
  onDone,
}: {
  cycleId: number;
  standardId?: number;
  standards?: StandardRow[];
  question?: QuestionRow;
  scope?: { scopeType: string; scopeCategory: string; scopeUnitId: string };
  units: UnitOption[];
  scopeLocked?: boolean;
  nextOrder?: number;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState<QState, FormData>(
    question ? updateQuestion : createQuestion,
    undefined
  );

  const formRef = useRef<HTMLFormElement>(null);
  // Setelah tambah berhasil: kosongkan form agar bisa input berulang;
  // setelah edit berhasil: tutup mode edit.
  useEffect(() => {
    if (!state?.ok) return;
    if (question) onDone?.();
    else formRef.current?.reset();
  }, [state, question, onDone]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    for (const u of units) set.add(u.category);
    return Array.from(set).sort();
  }, [units]);

  const [scopeType, setScopeType] = useState<"all" | "category" | "unit">(
    (question?.scopeType as "all" | "category" | "unit") ??
      (scope?.scopeType as "all" | "category" | "unit") ??
      "all"
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {question ? (
        <input type="hidden" name="id" value={question.id} />
      ) : (
        <>
          <input type="hidden" name="cycleId" value={cycleId} />
          {standardId ? (
            <input type="hidden" name="standardId" value={standardId} />
          ) : null}
          {scopeLocked && scope ? (
            <>
              <input type="hidden" name="scopeType" value={scope.scopeType} />
              <input
                type="hidden"
                name="scopeCategory"
                value={scope.scopeCategory}
              />
              <input
                type="hidden"
                name="scopeUnitId"
                value={scope.scopeUnitId}
              />
            </>
          ) : null}
        </>
      )}

      <ActionFeedback state={state} />

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Field label="Teks Pertanyaan">
          <textarea
            name="questionText"
            defaultValue={question?.questionText}
            rows={2}
            placeholder="Apakah unit memiliki dokumen rencana kerja tahunan yang disahkan pimpinan?"
            className="input-base resize-none"
            required
          />
        </Field>
        <div className="space-y-3">
          {/* Saat mengedit, standar induk bisa dipindahkan. */}
          {question && standards && standards.length > 0 ? (
            <Field label="Standar">
              <select
                name="standardId"
                defaultValue={question.standardId}
                className="input-base"
                required
              >
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Urutan">
            <input
              type="number"
              name="order"
              defaultValue={question?.order ?? nextOrder ?? 0}
              className="input-base"
            />
          </Field>
        </div>
      </div>

      {/* Pilih cakupan hanya saat mengedit / saat form tidak terkunci */}
      {!scopeLocked && (
        <div className="space-y-3 rounded-xl border border-indigo-400/20 bg-indigo-500/5 p-3">
          <Field
            label="Cakupan Pertanyaan"
            hint="Tentukan unit mana yang harus menjawab pertanyaan ini."
          >
            <select
              name="scopeType"
              value={scopeType}
              onChange={(e) =>
                setScopeType(e.target.value as "all" | "category" | "unit")
              }
              className="input-base"
            >
              <option value="all">Semua Unit (Umum)</option>
              <option value="category">Per Kategori (mis. semua Biro)</option>
              <option value="unit">Unit Tertentu (mis. hanya Prodi A)</option>
            </select>
          </Field>
          {scopeType === "category" && (
            <Field label="Kategori Unit">
              <select
                name="scopeCategory"
                defaultValue={question?.scopeCategory ?? ""}
                className="input-base"
                required
              >
                <option value="">— Pilih kategori —</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {scopeType === "unit" && (
            <Field label="Unit">
              <select
                name="scopeUnitId"
                defaultValue={question?.scopeUnitId ?? ""}
                className="input-base"
                required
              >
                <option value="">— Pilih unit —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.category})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" onClick={onDone} className={BTN_SECONDARY}>
            Batal
          </button>
        )}
        <SubmitButton
          label={question ? "Perbarui" : "Tambah Pertanyaan"}
          icon={<Plus className="h-4 w-4" />}
        />
      </div>
    </form>
  );
}

/* ------------------------------- Tambah Unit ----------------------------- */

function AddUnitDialog({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category: string;
}) {
  const [state, formAction] = useActionState<QState, FormData>(
    createUnit,
    undefined
  );
  useCloseOnSuccess(state, onClose);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Tambah Unit — ${category}`}
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="category" value={category} />
        <ActionFeedback state={state} />
        <Field label="Nama Unit">
          <input
            name="name"
            placeholder={`${category} …`}
            className="input-base"
            required
          />
        </Field>
        <Field label="Keterangan (opsional)">
          <input
            name="description"
            placeholder="Keterangan singkat unit…"
            className="input-base"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Batal
          </button>
          <SubmitButton label="Simpan Unit" />
        </div>
      </form>
    </Modal>
  );
}

/* ======================================================================== */
/*  AUDITEE WORKSPACE                                                       */
/* ======================================================================== */

export function AuditeeAuditWorkspace({
  cycleId,
  cycleName,
  myUnits,
  questions,
  responses,
  units,
  canEdit,
}: {
  cycleId: number;
  cycleName: string;
  myUnits: { id: number; name: string; category: string; isHead: boolean }[];
  questions: QuestionRow[];
  responses: ResponseRow[];
  units: UnitOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeUnitId, setActiveUnitId] = useState<number | null>(
    myUnits[0]?.id ?? null
  );
  const activeUnit = myUnits.find((u) => u.id === activeUnitId) ?? null;
  // HE-02: tampilkan hanya butir berstatus "Perlu Revisi".
  const [revisionOnly, setRevisionOnly] = useState(false);
  // HE-08: kunci butir/RTL yang memiliki isian belum disimpan.
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  // Tindakan yang menunggu konfirmasi "buang perubahan".
  const [pendingLeave, setPendingLeave] = useState<
    { kind: "unit"; unitId: number } | { kind: "href"; href: string } | null
  >(null);
  const leaveCancelRef = useRef<HTMLButtonElement>(null);

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const dirtyCount = dirtyKeys.size;

  // Peringatan bawaan peramban saat menutup tab / memuat ulang / keluar situs.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyCount]);

  // Navigasi sisi klien (<Link>) tidak memicu beforeunload: cegat klik tautan
  // internal pada fase capture, lalu minta konfirmasi lewat dialog.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return; // hanya pindah anchor (#) pada halaman yang sama
      e.preventDefault();
      e.stopPropagation();
      setPendingLeave({
        kind: "href",
        href: url.pathname + url.search + url.hash,
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirtyCount]);

  const switchUnit = (unitId: number) => {
    if (unitId === activeUnitId) return;
    if (dirtyCount > 0) setPendingLeave({ kind: "unit", unitId });
    else setActiveUnitId(unitId);
  };

  const confirmLeave = () => {
    const p = pendingLeave;
    setPendingLeave(null);
    if (!p) return;
    if (p.kind === "unit") {
      setActiveUnitId(p.unitId);
    } else {
      setDirtyKeys(new Set());
      router.push(p.href);
    }
  };

  // Respons untuk unit aktif saja.
  const unitResponses = useMemo(
    () => responses.filter((r) => r.unitId === activeUnitId),
    [responses, activeUnitId]
  );

  const responseByQuestion = useMemo(() => {
    const map = new Map<number, ResponseRow>();
    for (const r of unitResponses) map.set(r.auditQuestionId, r);
    return map;
  }, [unitResponses]);

  const unitNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of units) m.set(u.id, u.name);
    return m;
  }, [units]);

  // Hanya pertanyaan yang relevan untuk unit aktif.
  const relevant = useMemo(() => {
    if (!activeUnit) return questions;
    const u = { id: activeUnit.id, category: activeUnit.category };
    return questions.filter((q) => isQuestionForUnit(q, u));
  }, [questions, activeUnit]);

  // Kelompokkan berdasarkan standar induk untuk tampilan bertab.
  const groups = useMemo(() => {
    const map = new Map<string, QuestionRow[]>();
    for (const q of relevant) {
      const key = q.standardName?.trim() || "Tanpa Standar";
      const arr = map.get(key) ?? [];
      arr.push(q);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([name, qs]) => ({
      name,
      questions: qs,
    }));
  }, [relevant]);

  const totalQuestions = relevant.length;
  const answeredCount = relevant.filter(
    (q) => responseByQuestion.get(q.id)?.answer
  ).length;
  const revisionCount = relevant.filter(
    (q) => responseByQuestion.get(q.id)?.status === "revision"
  ).length;
  const showRevisionOnly = revisionOnly && revisionCount > 0;

  if (myUnits.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Akun Anda belum ditempatkan pada unit"
        description="Hubungi LPM agar akun Anda ditempatkan pada unit audit."
      />
    );
  }

  const pendingUnitName =
    pendingLeave?.kind === "unit"
      ? (myUnits.find((u) => u.id === pendingLeave.unitId)?.name ?? "")
      : "";

  return (
    <div className="space-y-4">
      {/* Pemilih unit (mendukung rangkap jabatan). */}
      {myUnits.length > 1 && (
        <div className="card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Building2 className="h-3.5 w-3.5 text-indigo-300" /> Unit yang Anda
            isi ({myUnits.length})
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Pilih unit yang diisi"
          >
            {myUnits.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={activeUnitId === u.id}
                onClick={() => switchUnit(u.id)}
                className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  activeUnitId === u.id
                    ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                    : "border-slate-600/40 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
                }`}
              >
                {u.name}
                {u.isHead && (
                  <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-200">
                    Kepala
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {totalQuestions === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada pertanyaan untuk unit Anda"
          description="LPM belum menambahkan pertanyaan yang berlaku untuk unit Anda pada siklus ini."
        />
      ) : (
        <>
          <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-xs text-slate-400">
              Unit:{" "}
              <span className="text-slate-200">{activeUnit?.name ?? "-"}</span>{" "}
              • Siklus: <span className="text-slate-200">{cycleName}</span>
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400" aria-hidden="true">
                Progres
              </span>
              <ProgressBar
                value={percent(answeredCount, totalQuestions)}
                label={`Progres pengisian ${activeUnit?.name ?? "unit"}`}
                className="h-2 w-24 sm:w-32"
              />
              <span
                className="text-xs font-semibold text-emerald-300"
                aria-live="polite"
              >
                {answeredCount}/{totalQuestions} (
                {percent(answeredCount, totalQuestions)}%)
              </span>
            </div>
          </div>

          {/* HE-02: ringkasan & filter butir "Perlu Revisi". */}
          {revisionCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-rose-200">
                <RotateCcw
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <strong>{revisionCount} butir perlu revisi</strong> menurut
                  LPM. Baca catatan LPM, perbaiki jawaban/bukti, lalu simpan
                  ulang.
                </span>
              </p>
              <button
                type="button"
                aria-pressed={showRevisionOnly}
                onClick={() => setRevisionOnly((v) => !v)}
                className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  showRevisionOnly
                    ? "border-rose-400/50 bg-rose-500/25 text-rose-100"
                    : "border-rose-400/30 bg-transparent text-rose-200 hover:bg-rose-500/15"
                }`}
              >
                {showRevisionOnly
                  ? "Tampilkan semua butir"
                  : "Tampilkan hanya yang perlu revisi"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Jawab <strong className="text-slate-300">Ya</strong> dengan bukti,
              atau <strong className="text-slate-300">Tidak</strong> dengan
              alasan. Setiap butir disimpan sendiri-sendiri.
            </p>
            <p
              aria-live="polite"
              className="text-xs font-semibold text-amber-300 empty:hidden"
            >
              {dirtyCount > 0 ? `${dirtyCount} isian belum disimpan` : ""}
            </p>
          </div>

          <div className="space-y-4">
            {groups.map((g) => (
              <AspectGroup
                key={`${activeUnitId}-${g.name}`}
                name={g.name}
                unitId={activeUnitId}
                questions={g.questions}
                cycleId={cycleId}
                responseByQuestion={responseByQuestion}
                unitNameById={unitNameById}
                canEdit={canEdit}
                revisionOnly={showRevisionOnly}
                dirtyKeys={dirtyKeys}
                onDirtyChange={setDirty}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={pendingLeave !== null}
        onClose={() => setPendingLeave(null)}
        title="Buang isian yang belum disimpan?"
        role="alertdialog"
        size="sm"
        icon={<RotateCcw className="h-5 w-5 text-amber-300" />}
        description={
          <>
            Ada <strong className="text-slate-200">{dirtyCount}</strong> isian
            jawaban/RTL yang belum disimpan
            {pendingLeave?.kind === "unit" ? (
              <>
                . Berpindah ke unit{" "}
                <strong className="text-slate-200">{pendingUnitName}</strong>{" "}
                akan membuang perubahan tersebut.
              </>
            ) : (
              <>. Meninggalkan halaman ini akan membuang perubahan tersebut.</>
            )}{" "}
            Pilih &quot;Tetap di sini&quot;, lalu klik &quot;Simpan
            Jawaban&quot; pada butir bertanda &quot;Belum disimpan&quot;.
          </>
        }
        initialFocus={leaveCancelRef}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={leaveCancelRef}
            type="button"
            onClick={() => setPendingLeave(null)}
            className={BTN_SECONDARY}
          >
            Tetap di sini
          </button>
          <button type="button" onClick={confirmLeave} className={BTN_DANGER}>
            Buang perubahan
          </button>
        </div>
      </Modal>
    </div>
  );
}

const dirtyKeyOf = (
  unitId: number | null,
  questionId: number,
  part: "answer" | "rtl"
) => `${unitId ?? 0}:${questionId}:${part}`;

function AspectGroup({
  name,
  unitId,
  questions,
  cycleId,
  responseByQuestion,
  unitNameById,
  canEdit,
  revisionOnly,
  dirtyKeys,
  onDirtyChange,
}: {
  name: string;
  unitId: number | null;
  questions: QuestionRow[];
  cycleId: number;
  responseByQuestion: Map<number, ResponseRow>;
  unitNameById: Map<number, string>;
  canEdit: boolean;
  revisionOnly: boolean;
  dirtyKeys: ReadonlySet<string>;
  onDirtyChange: (key: string, dirty: boolean) => void;
}) {
  const answered = questions.filter(
    (q) => responseByQuestion.get(q.id)?.answer
  ).length;
  // HE-02: butir "Perlu Revisi" belum selesai walau sudah terjawab.
  const revisions = questions.filter(
    (q) => responseByQuestion.get(q.id)?.status === "revision"
  ).length;
  const dirtyInGroup = questions.filter(
    (q) =>
      dirtyKeys.has(dirtyKeyOf(unitId, q.id, "answer")) ||
      dirtyKeys.has(dirtyKeyOf(unitId, q.id, "rtl"))
  ).length;
  const complete =
    questions.length > 0 && answered >= questions.length && revisions === 0;
  const [open, setOpen] = useState(!complete);
  // Mode filter revisi memaksa grup berisi revisi terbuka.
  const expanded = open || (revisionOnly && revisions > 0);
  const panelId = useId();

  return (
    <div
      hidden={revisionOnly && revisions === 0}
      className={`card overflow-hidden ${
        revisions > 0
          ? "border-rose-400/40"
          : complete
            ? "border-emerald-400/40"
            : ""
      }`}
    >
      {complete && (
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-400 to-teal-400" />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={revisionOnly && revisions > 0}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-500/[0.06] disabled:cursor-default"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
              complete
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                : "border-indigo-400/25 bg-indigo-500/15 text-indigo-200"
            }`}
          >
            {name}
          </span>
          <span className="text-xs text-slate-400">
            {answered}/{questions.length} terjawab
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {dirtyInGroup > 0 && (
            <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-200">
              {dirtyInGroup} belum disimpan
            </Badge>
          )}
          {revisions > 0 && (
            <Badge className="border-rose-400/40 bg-rose-500/15 text-rose-200">
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
              {revisions} perlu revisi
            </Badge>
          )}
          {complete ? (
            <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
              <Check className="mr-1 h-3 w-3" /> Lengkap
            </Badge>
          ) : (
            answered < questions.length && (
              <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
                {questions.length - answered} tersisa
              </Badge>
            )
          )}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 text-slate-400 transition ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* HE-08: disembunyikan dengan atribut `hidden` (bukan di-unmount) agar
          isian yang belum disimpan tidak hilang saat grup dilipat. */}
      <div
        id={panelId}
        hidden={!expanded}
        className="space-y-4 border-t border-indigo-400/10 p-3 sm:p-4"
      >
        {questions.map((q, idx) => {
          const existing = responseByQuestion.get(q.id);
          return (
            <ResponseForm
              key={q.id}
              index={idx + 1}
              cycleId={cycleId}
              unitId={unitId}
              question={q}
              existing={existing}
              unitNameById={unitNameById}
              canEdit={canEdit}
              hidden={revisionOnly && existing?.status !== "revision"}
              onDirtyChange={onDirtyChange}
            />
          );
        })}
      </div>
    </div>
  );
}

function ResponseForm({
  index,
  cycleId,
  unitId,
  question,
  existing,
  unitNameById,
  canEdit,
  hidden,
  onDirtyChange,
}: {
  index: number;
  cycleId: number;
  unitId: number | null;
  question: QuestionRow;
  existing?: ResponseRow;
  unitNameById: Map<number, string>;
  canEdit: boolean;
  hidden: boolean;
  onDirtyChange: (key: string, dirty: boolean) => void;
}) {
  const [state, formAction] = useActionState<RespState, FormData>(
    saveResponse,
    undefined
  );
  const [answer, setAnswer] = useState<"ya" | "tidak" | "">(
    existing?.answer ?? ""
  );
  const [rtlState, rtlAction] = useActionState<RespState, FormData>(
    saveRtl,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [answerDirty, setAnswerDirty] = useState(false);
  const [rtlDirty, setRtlDirty] = useState(false);

  // Setelah simpan berhasil: bersihkan penanda "belum disimpan" (derivasi saat
  // render, pola "menyimpan info dari render sebelumnya").
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setAnswerDirty(false);
  }
  const [handledRtl, setHandledRtl] = useState(rtlState);
  if (rtlState !== handledRtl) {
    setHandledRtl(rtlState);
    if (rtlState?.ok) setRtlDirty(false);
  }

  // Laporkan status "belum disimpan" ke ruang kerja (beforeunload, ganti unit).
  const answerKey = dirtyKeyOf(unitId, question.id, "answer");
  const rtlKey = dirtyKeyOf(unitId, question.id, "rtl");
  useEffect(() => {
    onDirtyChange(answerKey, answerDirty);
    return () => onDirtyChange(answerKey, false);
  }, [answerKey, answerDirty, onDirtyChange]);
  useEffect(() => {
    onDirtyChange(rtlKey, rtlDirty);
    return () => onDirtyChange(rtlKey, false);
  }, [rtlKey, rtlDirty, onDirtyChange]);

  const recomputeDirty = () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const file = fd.get("file");
    const text = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" ? v : null;
    };
    setAnswerDirty(
      isResponseDirty(existing, {
        answer: text("answer"),
        evidenceLink: text("evidenceLink"),
        reason: text("reason"),
        hasFile: file instanceof File && file.size > 0,
      })
    );
  };

  // Kirim tanpa reset formulir otomatis React: bila server menolak (mis. berkas
  // terlalu besar), isian pengguna tetap utuh dan dapat diperbaiki.
  const submitAnswer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  };
  const submitRtl = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => rtlAction(fd));
  };

  // Setelah berhasil, kosongkan pilihan berkas (sudah terunggah).
  useEffect(() => {
    if (!state?.ok) return;
    const input =
      formRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.value = "";
  }, [state]);

  const status = existing?.status ?? "pending";
  const isRevision = existing?.status === "revision";
  const dirty = answerDirty || rtlDirty;

  return (
    <div
      hidden={hidden}
      className={`rounded-xl border p-3 sm:p-4 ${
        dirty
          ? "border-amber-400/50 bg-amber-500/[0.04]"
          : isRevision
            ? "border-rose-400/40 bg-rose-500/[0.04]"
            : "border-slate-700/40 bg-slate-900/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-600/50 bg-slate-800/50 text-xs font-semibold text-slate-300">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p
            id={`q-${question.id}-${unitId ?? 0}`}
            className="text-sm break-words text-slate-200"
          >
            {question.questionText}
          </p>
          {question.scopeType !== "all" && (
            <ScopeBadge question={question} unitNameById={unitNameById} />
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {existing?.answer && (
            <Badge className={STATUS_STYLE[status]}>
              {STATUS_LABEL[status]}
            </Badge>
          )}
          {dirty && (
            <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-200">
              Belum disimpan
            </Badge>
          )}
        </div>
      </div>

      {isRevision && existing?.lpmNotes && (
        <p className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 sm:ml-9">
          <strong>Catatan revisi LPM:</strong> {existing.lpmNotes}
        </p>
      )}

      {canEdit ? (
        <form
          ref={formRef}
          action={formAction}
          onSubmit={submitAnswer}
          onChange={recomputeDirty}
          className="mt-3 space-y-3 sm:pl-9"
        >
          <input type="hidden" name="cycleId" value={cycleId} />
          {unitId != null && (
            <input type="hidden" name="unitId" value={unitId} />
          )}
          <input type="hidden" name="questionId" value={question.id} />
          <input
            type="hidden"
            name="existingFile"
            value={existing?.evidenceFile ?? ""}
          />
          <ActionFeedback state={state} />

          <fieldset
            className="flex gap-2"
            aria-labelledby={`q-${question.id}-${unitId ?? 0}`}
          >
            <legend className="sr-only">
              Jawaban pertanyaan nomor {index}
            </legend>
            {(
              [
                { v: "ya", label: "Ya", icon: Check, tone: "emerald" },
                { v: "tidak", label: "Tidak", icon: X, tone: "rose" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)] ${
                  answer === opt.v
                    ? opt.tone === "emerald"
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                      : "border-rose-400/50 bg-rose-500/15 text-rose-200"
                    : "border-slate-600/50 bg-slate-800/30 text-slate-300 hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={opt.v}
                  checked={answer === opt.v}
                  onChange={() => setAnswer(opt.v)}
                  className="sr-only"
                />
                <opt.icon className="h-4 w-4" aria-hidden="true" /> {opt.label}
              </label>
            ))}
          </fieldset>

          {answer === "ya" && (
            <div className="space-y-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
              <Field
                label="Bukti"
                hint="Format PDF, maksimal 10 MB. Isi berkas atau tautan."
              >
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-emerald-400/30 bg-emerald-500/5 px-3 py-2">
                  <Upload
                    className="h-4 w-4 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  />
                  <input
                    type="file"
                    name="file"
                    accept="application/pdf,.pdf"
                    className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-200"
                  />
                </div>
              </Field>
              {existing?.evidenceFile && (
                <a
                  href={existing.evidenceFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-300 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Bukti
                  terunggah saat ini
                  <span className="sr-only"> (membuka tab baru)</span>
                </a>
              )}
              <Field label="Atau tautan bukti">
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    name="evidenceLink"
                    type="url"
                    inputMode="url"
                    defaultValue={existing?.evidenceLink ?? ""}
                    placeholder="https://…"
                    className="input-base pl-9"
                  />
                </div>
              </Field>
            </div>
          )}

          {answer === "tidak" && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-3">
              <Field label="Alasan / Penjelasan">
                <textarea
                  name="reason"
                  defaultValue={existing?.reason ?? ""}
                  rows={3}
                  placeholder="Jelaskan mengapa kriteria belum terpenuhi…"
                  className="input-base resize-none"
                  required
                />
              </Field>
            </div>
          )}

          <div className="flex justify-end">
            <SubmitButton label="Simpan Jawaban" />
          </div>
        </form>
      ) : (
        <div className="mt-3 space-y-2 text-sm sm:pl-9">
          {existing ? (
            <>
              <p className="text-slate-300">
                Jawaban:{" "}
                <span
                  className={
                    existing.answer === "ya"
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }
                >
                  {existing.answer === "ya" ? "Ya" : "Tidak"}
                </span>
              </p>
              {existing.reason && (
                <p className="text-xs text-slate-400">
                  Alasan: {existing.reason}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {existing.evidenceFile && (
                  <a
                    href={existing.evidenceFile}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-200"
                  >
                    <FileText className="h-3.5 w-3.5" /> Lihat Bukti
                  </a>
                )}
                {existing.evidenceLink && (
                  <a
                    href={existing.evidenceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-200"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Tautan Bukti
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Belum dijawab.</p>
          )}
        </div>
      )}

      {existing && (existing.answer === "tidak" || status === "revision") && (
        <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 pl-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <RotateCcw className="h-3.5 w-3.5" /> Rencana Tindak Lanjut (RTL)
          </p>
          {existing.lpmNotes && !isRevision && (
            <p className="mb-2 text-xs text-rose-300">
              Catatan LPM: {existing.lpmNotes}
            </p>
          )}
          {canEdit ? (
            <form action={rtlAction} onSubmit={submitRtl} className="space-y-2">
              <input type="hidden" name="id" value={existing.id} />
              <ActionFeedback state={rtlState} />
              <Field label="Rencana tindak lanjut" labelHidden>
                <textarea
                  name="rtl"
                  defaultValue={existing.rtl ?? ""}
                  onChange={(e) =>
                    setRtlDirty(
                      e.target.value.trim() !== (existing.rtl ?? "").trim()
                    )
                  }
                  rows={2}
                  placeholder="Rencana perbaikan yang akan dilakukan unit…"
                  className="input-base resize-none"
                  required
                />
              </Field>
              <div className="flex justify-end">
                <SubmitButton label="Simpan RTL" />
              </div>
            </form>
          ) : (
            <p className="text-xs text-slate-300">
              {existing.rtl || "Belum ada RTL."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ======================================================================== */
/*  VERIFIKASI TAB (LPM)                                                    */
/* ======================================================================== */

function VerifikasiTab({
  responses,
  questions,
  units,
  cycleName,
}: {
  responses: ResponseRow[];
  questions: QuestionRow[];
  units: UnitOption[];
  cycleName: string;
}) {
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const filtered = responses.filter(
    (r) =>
      (!unitFilter || String(r.unitId) === unitFilter) &&
      (!statusFilter || r.status === statusFilter)
  );

  const grouped = useMemo(() => {
    const map = new Map<number, ResponseRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.unitId) ?? [];
      arr.push(r);
      map.set(r.unitId, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const relevantTotalByUnit = useMemo(() => {
    const m = new Map<number, number>();
    for (const u of units) {
      m.set(u.id, questions.filter((q) => isQuestionForUnit(q, u)).length);
    }
    return m;
  }, [questions, units]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          aria-label="Saring berdasarkan unit"
          className="input-base w-full sm:max-w-xs"
        >
          <option value="">Semua Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Saring berdasarkan status verifikasi"
          className="input-base w-full sm:max-w-[200px]"
        >
          <option value="">Semua Status</option>
          <option value="pending">Menunggu Verifikasi</option>
          <option value="verified">Terverifikasi</option>
          <option value="revision">Perlu Revisi</option>
        </select>
        <span className="text-xs text-slate-400" aria-live="polite">
          {filtered.length} jawaban pada {cycleName}
        </span>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Belum ada jawaban untuk diverifikasi"
          description="Jawaban auditee akan muncul di sini untuk ditinjau dan diverifikasi."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([uid, rows]) => {
            const unit = units.find((u) => u.id === uid);
            const verified = rows.filter((r) => r.status === "verified").length;
            return (
              <div key={uid} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-400/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-xs font-semibold text-indigo-200"
                    >
                      {uid}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {unit?.name ?? rows[0]?.unitName}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {unit?.category ?? rows[0]?.unitCategory} •{" "}
                        {rows.length}/
                        {relevantTotalByUnit.get(uid) ?? rows.length} terjawab
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar
                      value={percent(verified, rows.length)}
                      label={`Progres verifikasi ${unit?.name ?? rows[0]?.unitName ?? "unit"}`}
                      className="h-2 w-28"
                    />
                    <span className="text-xs text-emerald-300">
                      {verified}/{rows.length} terverifikasi
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-500/15">
                  {rows.map((r) => (
                    <VerifyRow key={r.id} row={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VerifyRow({ row }: { row: ResponseRow }) {
  const [state, formAction] = useActionState<RespState, FormData>(
    verifyResponse,
    undefined
  );
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm break-words text-slate-200">
            {row.questionText}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge
              className={
                row.answer === "ya"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-400/25 bg-rose-500/10 text-rose-300"
              }
            >
              {row.answer === "ya"
                ? "Ya"
                : row.answer === "tidak"
                  ? "Tidak"
                  : "-"}
            </Badge>
            <Badge className={STATUS_STYLE[row.status]}>
              {STATUS_LABEL[row.status]}
            </Badge>
            {row.verifierName && (
              <span className="text-slate-500">oleh {row.verifierName}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Verifikasi
        </button>
      </div>

      {open && (
        <div
          id={panelId}
          className="mt-3 space-y-3 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3"
        >
          <div className="flex flex-wrap gap-2 text-xs">
            {row.evidenceFile && (
              <a
                href={row.evidenceFile}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1.5 text-indigo-200"
              >
                <FileText className="h-3.5 w-3.5" /> Lihat Bukti PDF
              </a>
            )}
            {row.evidenceLink && (
              <a
                href={row.evidenceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1.5 text-sky-200"
              >
                <Link2 className="h-3.5 w-3.5" /> Tautan Bukti
              </a>
            )}
            {!row.evidenceFile && !row.evidenceLink && !row.reason && (
              <span className="text-slate-500">Tidak ada lampiran.</span>
            )}
          </div>

          {row.reason && (
            <p className="rounded-lg border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
              Alasan: {row.reason}
            </p>
          )}
          {row.rtl && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
              RTL: {row.rtl}
            </p>
          )}

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="id" value={row.id} />
            <ActionFeedback state={state} />
            <Field label="Catatan Verifikasi (wajib untuk revisi)">
              <textarea
                name="lpmNotes"
                defaultValue={row.lpmNotes ?? ""}
                rows={2}
                placeholder="Catatan untuk unit…"
                className="input-base resize-none"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                name="status"
                value="verified"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
              >
                <BadgeCheck className="h-4 w-4" /> Verifikasi (Sesuai)
              </button>
              <button
                type="submit"
                name="status"
                value="revision"
                className="flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
              >
                <RotateCcw className="h-4 w-4" /> Minta Revisi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
