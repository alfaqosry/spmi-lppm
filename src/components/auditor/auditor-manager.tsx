"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  Trash2,
  Building2,
  AlertCircle,
  X,
  UserPlus,
  UserX,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import {
  appointAuditor,
  assignUnitAuditor,
  removeUnitAuditor,
  revokeAuditor,
} from "@/lib/actions/auditors";
import { Badge, StatCard } from "@/components/ui/primitives";
import { initials } from "@/lib/format";

export type AuditorManagerProps = {
  data: {
    cycles: {
      id: number;
      name: string;
      isActive: boolean;
      startDate: Date;
      endDate: Date;
    }[];
    currentCycle: {
      id: number;
      name: string;
      isActive: boolean;
      startDate: Date;
      endDate: Date;
    } | null;
    units: {
      id: number;
      name: string;
      category: string;
    }[];
    assignmentMap: Record<
      number,
      {
        lead?: {
          id: number;
          userId: number;
          role: string;
          user: {
            id: number;
            name: string;
            email: string;
            unitId: number | null;
            unit: { id: number; name: string } | null;
          };
          assigner?: { id: number; name: string } | null;
        };
        member?: {
          id: number;
          userId: number;
          role: string;
          user: {
            id: number;
            name: string;
            email: string;
            unitId: number | null;
            unit: { id: number; name: string } | null;
          };
          assigner?: { id: number; name: string } | null;
        };
      }
    >;
    auditors: {
      id: number;
      name: string;
      email: string;
      isActive: boolean;
      homebaseUnitId: number | null;
      homebaseUnitName: string | null;
      originUnitIds: number[];
      activeTasksCount: number;
      currentCycleTasks: {
        unitId: number;
        unitName: string;
        role: "lead" | "member";
      }[];
    }[];
    candidates: {
      id: number;
      name: string;
      email: string;
      role: string;
      unitId: number | null;
      unit: { id: number; name: string } | null;
    }[];
  };
};

export function AuditorManager({ data }: AuditorManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tab State: "assignments" | "accounts"
  const [activeTab, setActiveTab] = useState<"assignments" | "accounts">(
    "assignments"
  );

  // Filters
  const [searchUnit, setSearchUnit] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "full" | "partial" | "empty"
  >("all");

  // Assignment Modal State
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    unitId: number;
    unitName: string;
    role: "lead" | "member";
    currentAuditorId?: number;
  }>({
    isOpen: false,
    unitId: 0,
    unitName: "",
    role: "lead",
  });
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>("");
  const [assignError, setAssignError] = useState<string | null>(null);

  // Appoint Auditor Modal State
  const [appointModalOpen, setAppointModalOpen] = useState(false);
  const [appointCandidateId, setAppointCandidateId] = useState("");
  const [appointHomebaseId, setAppointHomebaseId] = useState("");
  const [appointError, setAppointError] = useState<string | null>(null);

  // Revoke Auditor Modal State
  const [revokeModal, setRevokeModal] = useState<{
    isOpen: boolean;
    userId: number;
    name: string;
  }>({
    isOpen: false,
    userId: 0,
    name: "",
  });
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const currentCycle = data.currentCycle;

  // Categories list
  const categories = Array.from(
    new Set(data.units.map((u) => u.category))
  ).filter(Boolean);

  // Filter units
  const filteredUnits = data.units.filter((unit) => {
    const matchesSearch = unit.name
      .toLowerCase()
      .includes(searchUnit.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || unit.category === categoryFilter;

    const assignment = data.assignmentMap[unit.id];
    const isFull = Boolean(assignment?.lead && assignment?.member);
    const isPartial = Boolean(
      (assignment?.lead && !assignment?.member) ||
      (!assignment?.lead && assignment?.member)
    );
    const isEmpty = !assignment?.lead && !assignment?.member;

    let matchesStatus = true;
    if (statusFilter === "full") matchesStatus = isFull;
    if (statusFilter === "partial") matchesStatus = isPartial;
    if (statusFilter === "empty") matchesStatus = isEmpty;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Stats calculation
  let fullCount = 0;
  let partialCount = 0;
  let emptyCount = 0;

  for (const unit of data.units) {
    const asg = data.assignmentMap[unit.id];
    if (asg?.lead && asg?.member) {
      fullCount++;
    } else if (asg?.lead || asg?.member) {
      partialCount++;
    } else {
      emptyCount++;
    }
  }

  // Switch cycle
  const handleCycleChange = (cycleId: string) => {
    startTransition(() => {
      router.push(`/auditor?cycleId=${cycleId}`);
    });
  };

  // Submit assign auditor
  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCycle) return;
    if (!selectedAuditorId) {
      setAssignError("Pilih auditor terlebih dahulu.");
      return;
    }

    setAssignError(null);
    const formData = new FormData();
    formData.append("cycleId", String(currentCycle.id));
    formData.append("unitId", String(assignModal.unitId));
    formData.append("userId", selectedAuditorId);
    formData.append("role", assignModal.role);

    startTransition(async () => {
      const res = await assignUnitAuditor(undefined, formData);
      if (res?.error) {
        setAssignError(res.error);
      } else {
        setAssignModal((prev) => ({ ...prev, isOpen: false }));
        setSelectedAuditorId("");
        router.refresh();
      }
    });
  };

  // Remove auditor assignment
  const handleRemoveAssignment = (
    assignmentId: number,
    roleName: string,
    unitName: string
  ) => {
    if (!confirm(`Batalkan penugasan ${roleName} untuk unit "${unitName}"?`)) {
      return;
    }

    const formData = new FormData();
    formData.append("assignmentId", String(assignmentId));

    startTransition(async () => {
      const res = await removeUnitAuditor(undefined, formData);
      if (res?.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  // Submit appoint auditor
  const handleAppointSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointCandidateId) {
      setAppointError("Pilih akun pengguna terlebih dahulu.");
      return;
    }

    setAppointError(null);
    const formData = new FormData();
    formData.append("userId", appointCandidateId);
    if (appointHomebaseId) {
      formData.append("homebaseUnitId", appointHomebaseId);
    }

    startTransition(async () => {
      const res = await appointAuditor(undefined, formData);
      if (res?.error) {
        setAppointError(res.error);
      } else {
        setAppointModalOpen(false);
        setAppointCandidateId("");
        setAppointHomebaseId("");
        router.refresh();
      }
    });
  };

  // Submit revoke auditor
  const handleRevokeSubmit = () => {
    setRevokeError(null);
    const formData = new FormData();
    formData.append("userId", String(revokeModal.userId));

    startTransition(async () => {
      const res = await revokeAuditor(undefined, formData);
      if (res?.error) {
        setRevokeError(res.error);
      } else {
        setRevokeModal({ isOpen: false, userId: 0, name: "" });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Banner Independensi SPMI */}
      <div className="card flex items-start gap-3.5 p-4 sm:p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-500/10 text-sky-400">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-white">
            Prinsip Independensi & Ketentuan Auditor SPMI
          </p>
          <p className="mt-1 text-slate-400 leading-relaxed">
            Setiap unit kerja wajib diaudit oleh tepat{" "}
            <strong className="text-white">2 orang auditor</strong> (Auditor 1
            sebagai Ketua Tim & Auditor 2 sebagai Anggota Tim). Sesuai standar
            SPMI,{" "}
            <span className="font-semibold text-amber-400 underline decoration-amber-400/40">
              auditor dilarang keras berasal dari unit yang diaudit
            </span>{" "}
            guna menjaga objektivitas dan mencegah konflik kepentingan.
          </p>
        </div>
      </div>

      {/* Baris Kontrol Siklus & Tab */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Buttons */}
        <div role="tablist" className="card flex flex-wrap gap-1 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "assignments"}
            onClick={() => setActiveTab("assignments")}
            className={`flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "assignments"
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-on-accent shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Penugasan per Unit (2 Auditor/Unit)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "accounts"}
            onClick={() => setActiveTab("accounts")}
            className={`flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "accounts"
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-on-accent shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="h-4 w-4" />
            Daftar Akun Auditor ({data.auditors.length})
          </button>
        </div>

        {/* Siklus Selector */}
        {activeTab === "assignments" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">
              Siklus Audit:
            </span>
            <select
              value={currentCycle?.id ?? ""}
              onChange={(e) => handleCycleChange(e.target.value)}
              disabled={isPending}
              className="input-base min-h-10 w-auto py-1.5 text-xs font-semibold"
            >
              {data.cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* STATS OVERVIEW */}
      {activeTab === "assignments" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Unit"
            value={data.units.length}
            icon={Building2}
            tone="indigo"
          />
          <StatCard
            label="Auditor Lengkap"
            value={fullCount}
            hint="2 dari 2 Auditor"
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="Auditor Parsial"
            value={partialCount}
            hint="1 dari 2 Auditor"
            icon={AlertTriangle}
            tone="amber"
          />
          <StatCard
            label="Belum Ditugaskan"
            value={emptyCount}
            hint="0 dari 2 Auditor"
            icon={Clock}
            tone="rose"
          />
        </div>
      )}

      {/* TAB 1: PENUGASAN PER UNIT */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Cari nama unit..."
                value={searchUnit}
                onChange={(e) => setSearchUnit(e.target.value)}
                className="input-base pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-base min-h-10 w-auto py-1.5 text-xs"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "full" | "partial" | "empty"
                  )
                }
                className="input-base min-h-10 w-auto py-1.5 text-xs"
              >
                <option value="all">Semua Status Auditor</option>
                <option value="full">Lengkap (2/2)</option>
                <option value="partial">Parsial (1/2)</option>
                <option value="empty">Belum Ada (0/2)</option>
              </select>
            </div>
          </div>

          {/* Unit Assignment List */}
          <div className="grid gap-4">
            {filteredUnits.length === 0 ? (
              <div className="card p-10 text-center text-slate-400 text-sm">
                Tidak ada unit audit yang sesuai kriteria pencarian.
              </div>
            ) : (
              filteredUnits.map((unit) => {
                const asg = data.assignmentMap[unit.id];
                const lead = asg?.lead;
                const member = asg?.member;
                const isFull = Boolean(lead && member);
                const isPartial = Boolean(
                  (lead && !member) || (!lead && member)
                );

                return (
                  <div key={unit.id} className="card p-5 space-y-4">
                    {/* Unit Header */}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-base font-semibold text-white">
                          {unit.name}
                        </h2>
                        <Badge className="border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
                          {unit.category}
                        </Badge>
                      </div>

                      {/* Status Badges */}
                      <div>
                        {isFull ? (
                          <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            2/2 Auditor Lengkap
                          </Badge>
                        ) : isPartial ? (
                          <Badge className="border-amber-400/30 bg-amber-500/10 text-amber-300">
                            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                            1/2 Auditor (Parsial)
                          </Badge>
                        ) : (
                          <Badge className="border-slate-400/20 bg-slate-500/10 text-slate-400">
                            <Clock className="mr-1.5 h-3.5 w-3.5" />
                            0/2 Belum Ditugaskan
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 2 Slots Auditor */}
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {/* Slot 1: Ketua Tim / Auditor 1 */}
                      <div className="rounded-xl border border-indigo-400/20 bg-indigo-50/20 dark:bg-slate-900/50 p-4 transition">
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                            <UserCheck className="h-3.5 w-3.5" />
                            Auditor 1 (Ketua Tim)
                          </span>
                        </div>

                        {lead ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-on-accent shadow">
                                {initials(lead.user.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white text-sm truncate">
                                  {lead.user.name}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                  {lead.user.email}
                                </p>
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                                  <span className="text-slate-400">Asal:</span>
                                  <span className="font-medium text-slate-300">
                                    {lead.user.unit?.name ??
                                      "Auditor Pusat/LPM"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t pt-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setAssignModal({
                                    isOpen: true,
                                    unitId: unit.id,
                                    unitName: unit.name,
                                    role: "lead",
                                    currentAuditorId: lead.userId,
                                  })
                                }
                                className="rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition"
                              >
                                Ganti
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveAssignment(
                                    lead.id,
                                    "Ketua Auditor",
                                    unit.name
                                  )
                                }
                                disabled={isPending}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
                              >
                                <Trash2 className="h-3 w-3" />
                                Hapus
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
                            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                              <UserPlus className="h-4 w-4" />
                            </div>
                            <p className="text-xs text-slate-400 mb-2">
                              Belum ada Ketua Auditor
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setAssignError(null);
                                setSelectedAuditorId("");
                                setAssignModal({
                                  isOpen: true,
                                  unitId: unit.id,
                                  unitName: unit.name,
                                  role: "lead",
                                });
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-on-accent shadow hover:from-indigo-600 hover:to-violet-600 transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Tugaskan Auditor 1
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Slot 2: Anggota Tim / Auditor 2 */}
                      <div className="rounded-xl border border-teal-400/20 bg-teal-50/20 dark:bg-slate-900/50 p-4 transition">
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/25 bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-300">
                            <UserCheck className="h-3.5 w-3.5" />
                            Auditor 2 (Anggota Tim)
                          </span>
                        </div>

                        {member ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-bold text-on-accent shadow">
                                {initials(member.user.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white text-sm truncate">
                                  {member.user.name}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                  {member.user.email}
                                </p>
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                                  <span className="text-slate-400">Asal:</span>
                                  <span className="font-medium text-slate-300">
                                    {member.user.unit?.name ??
                                      "Auditor Pusat/LPM"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t pt-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setAssignModal({
                                    isOpen: true,
                                    unitId: unit.id,
                                    unitName: unit.name,
                                    role: "member",
                                    currentAuditorId: member.userId,
                                  })
                                }
                                className="rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition"
                              >
                                Ganti
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveAssignment(
                                    member.id,
                                    "Anggota Auditor",
                                    unit.name
                                  )
                                }
                                disabled={isPending}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
                              >
                                <Trash2 className="h-3 w-3" />
                                Hapus
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center">
                            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                              <UserPlus className="h-4 w-4" />
                            </div>
                            <p className="text-xs text-slate-400 mb-2">
                              Belum ada Anggota Auditor
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setAssignError(null);
                                setSelectedAuditorId("");
                                setAssignModal({
                                  isOpen: true,
                                  unitId: unit.id,
                                  unitName: unit.name,
                                  role: "member",
                                });
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 px-3 py-1.5 text-xs font-semibold text-on-accent shadow hover:from-teal-600 hover:to-emerald-600 transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Tugaskan Auditor 2
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAFTAR AKUN AUDITOR */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Daftar Auditor Terdaftar
              </h2>
              <p className="text-xs text-slate-400">
                Akun terdaftar yang telah diangkat memiliki peran Auditor
                independen.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setAppointError(null);
                setAppointCandidateId("");
                setAppointHomebaseId("");
                setAppointModalOpen(true);
              }}
              className="flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-on-accent shadow-lg shadow-indigo-900/30 hover:from-indigo-600 hover:to-violet-600 transition"
            >
              <UserPlus className="h-4 w-4" />
              Angkat Akun Jadi Auditor
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b bg-slate-500/5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Nama Auditor</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Unit Asal (Homebase)</th>
                  <th className="px-4 py-3.5">Beban Audit (Siklus Ini)</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-400/10">
                {data.auditors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      Belum ada akun yang diangkat sebagai auditor.
                    </td>
                  </tr>
                ) : (
                  data.auditors.map((auditor) => (
                    <tr
                      key={auditor.id}
                      className="hover:bg-indigo-500/5 transition"
                    >
                      <td className="px-4 py-3.5 font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 font-semibold text-indigo-300 text-[11px]">
                            {initials(auditor.name)}
                          </div>
                          <span>{auditor.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {auditor.email}
                      </td>
                      <td className="px-4 py-3.5">
                        {auditor.homebaseUnitName ? (
                          <Badge className="border-slate-400/20 bg-slate-500/10 text-slate-300">
                            {auditor.homebaseUnitName}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 italic">
                            Pusat / Non-Unit
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {auditor.activeTasksCount > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-indigo-300">
                              {auditor.activeTasksCount} Unit
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {auditor.currentCycleTasks.map((t) => (
                                <div key={t.unitId}>
                                  • {t.unitName} (
                                  {t.role === "lead"
                                    ? "Auditor 1"
                                    : "Auditor 2"}
                                  )
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">0 Unit</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {auditor.isActive ? (
                          <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge className="border-rose-400/30 bg-rose-500/10 text-rose-300">
                            Nonaktif
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setRevokeModal({
                              isOpen: true,
                              userId: auditor.id,
                              name: auditor.name,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Cabut Status
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TUGASKAN AUDITOR (Dengan Pemeriksaan Konflik Kepentingan)        */}
      {/* ========================================================================= */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-white text-base">
                  Tugaskan{" "}
                  {assignModal.role === "lead"
                    ? "Auditor 1 (Ketua Tim)"
                    : "Auditor 2 (Anggota Tim)"}
                </h3>
                <p className="text-xs text-slate-400">
                  Untuk unit:{" "}
                  <span className="font-semibold text-indigo-300">
                    {assignModal.unitName}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAssignModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="rounded-lg p-1 text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Notice Independensi */}
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold">
                  Aturan Konflik Kepentingan:
                </span>{" "}
                Auditor yang berasal atau terafiliasi dengan unit{" "}
                <span className="font-semibold text-white">
                  &ldquo;{assignModal.unitName}&rdquo;
                </span>{" "}
                secara otomatis tidak dapat dipilih untuk unit ini.
              </div>
            </div>

            {assignError && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="assign-auditor-select"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Pilih Auditor
                </label>
                <select
                  id="assign-auditor-select"
                  value={selectedAuditorId}
                  onChange={(e) => setSelectedAuditorId(e.target.value)}
                  className="input-base text-xs font-medium"
                  required
                >
                  <option value="">-- Pilih dari Auditor Terdaftar --</option>
                  {data.auditors.map((auditor) => {
                    const hasConflict = auditor.originUnitIds.includes(
                      assignModal.unitId
                    );
                    const currentUnitAsg =
                      data.assignmentMap[assignModal.unitId];
                    const otherSlot =
                      assignModal.role === "lead"
                        ? currentUnitAsg?.member
                        : currentUnitAsg?.lead;
                    const isAlreadyInOtherSlot =
                      otherSlot?.userId === auditor.id;

                    const isDisabled = hasConflict || isAlreadyInOtherSlot;

                    let labelSuffix = "";
                    if (hasConflict) {
                      labelSuffix =
                        " [⚠️ KONFLIK KEPENTINGAN: Personil Unit Ini]";
                    } else if (isAlreadyInOtherSlot) {
                      labelSuffix = ` [Sudah di ${
                        assignModal.role === "lead" ? "Auditor 2" : "Auditor 1"
                      }]`;
                    } else if (auditor.homebaseUnitName) {
                      labelSuffix = ` (Asal: ${auditor.homebaseUnitName}) - [${auditor.activeTasksCount} tugas aktif]`;
                    } else {
                      labelSuffix = ` (Auditor Pusat) - [${auditor.activeTasksCount} tugas aktif]`;
                    }

                    return (
                      <option
                        key={auditor.id}
                        value={auditor.id}
                        disabled={isDisabled}
                      >
                        {auditor.name}
                        {labelSuffix}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Total auditor terdaftar: {data.auditors.length} orang.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setAssignModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="rounded-xl border px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedAuditorId}
                  className="flex min-h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-on-accent shadow hover:from-indigo-600 hover:to-violet-600 transition disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Penugasan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ANGKAT AKUN JADI AUDITOR                                        */}
      {/* ========================================================================= */}
      {appointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-white text-base">
                  Angkat Akun Terdaftar Menjadi Auditor
                </h3>
                <p className="text-xs text-slate-400">
                  Pilih akun dosen atau pegawai yang terdaftar untuk diberikan
                  peran Auditor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAppointModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {appointError && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{appointError}</span>
              </div>
            )}

            <form onSubmit={handleAppointSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="appoint-candidate-select"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Pilih Akun Terdaftar
                </label>
                <select
                  id="appoint-candidate-select"
                  value={appointCandidateId}
                  onChange={(e) => {
                    setAppointCandidateId(e.target.value);
                    const selected = data.candidates.find(
                      (c) => String(c.id) === e.target.value
                    );
                    if (selected?.unitId) {
                      setAppointHomebaseId(String(selected.unitId));
                    }
                  }}
                  className="input-base text-xs font-medium"
                  required
                >
                  <option value="">-- Pilih Akun Terdaftar --</option>
                  {data.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email}){" "}
                      {c.unit ? `[Unit: ${c.unit.name}]` : "[Non-Unit]"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="appoint-homebase-select"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Unit Asal / Homebase (Untuk Deteksi Konflik Kepentingan)
                </label>
                <select
                  id="appoint-homebase-select"
                  value={appointHomebaseId}
                  onChange={(e) => setAppointHomebaseId(e.target.value)}
                  className="input-base text-xs font-medium"
                >
                  <option value="">
                    -- Tidak Terikat Unit (Auditor Pusat / Eksternal) --
                  </option>
                  {data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.category})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Unit asal ini dipakai oleh sistem untuk mencegah penugasan
                  audit pada unit sendiri.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setAppointModalOpen(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !appointCandidateId}
                  className="flex min-h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-on-accent shadow hover:from-indigo-600 hover:to-violet-600 transition disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Angkat Jadi Auditor"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CABUT STATUS AUDITOR                                             */}
      {/* ========================================================================= */}
      {revokeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-white text-base">
                Cabut Status Auditor
              </h3>
              <button
                type="button"
                onClick={() =>
                  setRevokeModal({ isOpen: false, userId: 0, name: "" })
                }
                className="rounded-lg p-1 text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {revokeError && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{revokeError}</span>
              </div>
            )}

            <p className="text-sm text-slate-300">
              Apakah Anda yakin ingin mencabut peran auditor dari{" "}
              <span className="font-semibold text-white">
                {revokeModal.name}
              </span>
              ?
            </p>
            <p className="text-xs text-slate-400">
              Peran akun akan dikembalikan menjadi pengunjung dan seluruh
              penugasan audit aktif pada akun ini akan dibatalkan.
            </p>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() =>
                  setRevokeModal({ isOpen: false, userId: 0, name: "" })
                }
                className="rounded-xl border px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRevokeSubmit}
                disabled={isPending}
                className="flex min-h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:from-rose-600 hover:to-rose-700 transition disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Mencabut...
                  </>
                ) : (
                  "Ya, Cabut Peran"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
