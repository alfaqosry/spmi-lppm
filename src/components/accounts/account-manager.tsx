"use client";

import { useMemo, useState, useActionState, useTransition } from "react";
import {
  Building2,
  Crown,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  ActionFeedback,
  Field,
  SubmitButton,
  useCloseOnSuccess,
  BTN_PRIMARY,
  BTN_SECONDARY,
} from "@/components/ui/form";
import {
  assignMember,
  createAccount,
  deleteAccount,
  removeMember,
  setLpmHead,
  unsetLpmHead,
  updateAccount,
  type ActionState,
} from "@/lib/actions/units";
import { Badge, EmptyState, StatCard } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from "@/lib/password";
import { ROLE_LABEL } from "@/lib/format";
import type { UnitRow } from "@/components/units/unit-manager";
import { ScrollRegion } from "@/components/ui/scroll-region";

type Role =
  | "superadmin"
  | "lpm_admin"
  | "lpm_member"
  | "auditee_head"
  | "auditee_member"
  | "pengunjung";

export type MembershipRow = { unitId: number; role: "head" | "member" };

export type AccountRow = {
  id: number;
  name: string;
  email: string;
  role: Role;
  unitId: number | null;
  unitName: string | null;
  isActive: boolean;
  isSso: boolean;
  /** Menandai akun yang menjabat sebagai Ketua LPM (penandatangan laporan). */
  isLpmHead: boolean;
  /** Penempatan akun pada unit-unit audit (bisa lebih dari satu). */
  memberships: MembershipRow[];
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "auditee_head", label: "Kepala Unit" },
  { value: "auditee_member", label: "Anggota Unit" },
  { value: "lpm_admin", label: "Admin LPM" },
  { value: "lpm_member", label: "Anggota LPM" },
  { value: "superadmin", label: "Superadmin" },
  { value: "pengunjung", label: "Pengunjung (Tamu)" },
];

const ROLE_BADGE: Record<Role, string> = {
  superadmin: "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300",
  lpm_admin: "border-violet-400/25 bg-violet-500/10 text-violet-300",
  lpm_member: "border-sky-400/25 bg-sky-500/10 text-sky-300",
  auditee_head: "border-indigo-400/25 bg-indigo-500/10 text-indigo-300",
  auditee_member: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  pengunjung: "border-amber-400/25 bg-amber-500/10 text-amber-300",
};

export function AccountManager({
  accounts,
  units,
}: {
  accounts: AccountRow[];
  units: UnitRow[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [preset, setPreset] = useState<{
    role: Role;
    unitId: number | null;
  } | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [query, setQuery] = useState("");
  const [assign, setAssign] = useState<{
    unitId: number;
    role: "head" | "member";
  } | null>(null);

  const stats = useMemo(
    () => ({
      total: accounts.length,
      kepala: accounts.filter((a) => a.role === "auditee_head").length,
      anggota: accounts.filter((a) => a.role === "auditee_member").length,
      lpm: accounts.filter(
        (a) =>
          a.role === "lpm_admin" ||
          a.role === "lpm_member" ||
          a.role === "superadmin"
      ).length,
      ketuaLpm: accounts.find((a) => a.isLpmHead)?.name ?? null,
    }),
    [accounts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.unitName ?? "").toLowerCase().includes(q)
      );
    });
  }, [accounts, roleFilter, query]);

  // Akun yang bisa ditempatkan ke unit (semua selain akun LPM).
  const assignableAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.role !== "lpm_admin" &&
          a.role !== "lpm_member" &&
          a.role !== "superadmin"
      ),
    [accounts]
  );

  // Kelompokkan akun auditee per unit (berdasarkan keanggotaan multi-unit).
  const unitPlacement = useMemo(() => {
    return units.map((u) => {
      const headMem = accounts.find((a) =>
        a.memberships.some((m) => m.unitId === u.id && m.role === "head")
      );
      const memberAccounts = accounts.filter((a) =>
        a.memberships.some((m) => m.unitId === u.id && m.role === "member")
      );
      return { unit: u, head: headMem ?? null, members: memberAccounts };
    });
  }, [accounts, units]);

  const openCreate = (role: Role, unitId: number | null = null) => {
    setPreset({ role, unitId });
    setCreating(true);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Akun" value={stats.total} icon={Users} />
        <StatCard
          label="Kepala Unit"
          value={stats.kepala}
          icon={UserCog}
          tone="sky"
        />
        <StatCard
          label="Anggota Unit"
          value={stats.anggota}
          icon={UserPlus}
          tone="amber"
        />
        <StatCard
          label="Akun LPM"
          value={stats.lpm}
          icon={ShieldCheck}
          tone="emerald"
        />
      </div>

      {/* Status Ketua LPM (penandatangan laporan) */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
          <Crown className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-200">Ketua LPM</p>
          <p className="text-xs text-slate-400">
            {stats.ketuaLpm
              ? `Ditandatangani oleh: ${stats.ketuaLpm}`
              : "Belum ada Ketua LPM. Tunjuk salah satu Admin LPM melalui tombol mahkota di kolom Aksi."}
          </p>
        </div>
      </div>

      {/* Aksi cepat penambahan akun */}
      <div className="card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Plus className="h-3.5 w-3.5 text-indigo-300" /> Tambah Akun Cepat
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCreate("auditee_head")}
            className="flex items-center gap-2 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20"
          >
            <UserCog className="h-3.5 w-3.5" /> Kepala Unit
          </button>
          <button
            type="button"
            onClick={() => openCreate("auditee_member")}
            className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            <UserPlus className="h-3.5 w-3.5" /> Anggota Unit
          </button>
          <button
            type="button"
            onClick={() => openCreate("lpm_member")}
            className="flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Anggota LPM
          </button>
          <button
            type="button"
            onClick={() => openCreate("lpm_admin")}
            className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Admin LPM
          </button>
          <button
            type="button"
            onClick={() => openCreate("pengunjung")}
            className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            <Users className="h-3.5 w-3.5" /> Pengunjung (Tamu)
          </button>
        </div>
      </div>

      {/* Filter & pencarian */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari akun berdasarkan nama, email, atau unit"
            placeholder="Cari nama, email, atau unit…"
            className="input-base pl-9"
          />
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Saring berdasarkan peran"
        >
          {(["all", ...ROLE_OPTIONS.map((r) => r.value)] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={roleFilter === r}
              onClick={() => setRoleFilter(r as Role | "all")}
              className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                roleFilter === r
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                  : "border-slate-600/40 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
              }`}
            >
              {r === "all" ? "Semua" : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel akun */}
      <p className="sr-only" aria-live="polite">
        {filtered.length} akun ditampilkan.
      </p>
      <div className="card overflow-hidden">
        <ScrollRegion label="Tabel daftar akun pengguna">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Daftar akun pengguna</caption>
            <thead>
              <tr className="border-b border-indigo-400/10 text-xs uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Nama
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Email
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Peran
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Unit
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-slate-500/15 last:border-0 hover:bg-slate-500/[0.08]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">
                        {a.name}
                      </span>
                      {a.isSso && (
                        <Badge className="border-sky-400/25 bg-sky-500/10 text-sky-300">
                          SSO
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{a.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={ROLE_BADGE[a.role]}>
                        {ROLE_LABEL[a.role]}
                      </Badge>
                      {a.isLpmHead && (
                        <Badge className="border-amber-400/30 bg-amber-500/10 text-amber-300">
                          <Crown className="mr-1 h-3 w-3" /> Ketua LPM
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {a.unitName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        a.isActive
                          ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                          : "border-rose-400/25 bg-rose-500/10 text-rose-300"
                      }
                    >
                      {a.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {(a.role === "lpm_admin" || a.role === "superadmin") && (
                        <LpmHeadToggle account={a} />
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(a)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/25 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                        aria-label={`Ubah akun ${a.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <ConfirmAction
                        action={() => deleteAccount(a.id)}
                        title="Hapus akun?"
                        message={
                          <>
                            Akun{" "}
                            <strong className="text-slate-200">{a.name}</strong>{" "}
                            ({a.email}) akan dihapus permanen beserta
                            penempatannya. Tindakan ini tidak dapat dibatalkan.
                          </>
                        }
                        triggerLabel={`Hapus akun ${a.name}`}
                        trigger={
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        }
                        triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Tidak ada akun yang cocok dengan pencarian atau filter. Coba
                    kata kunci lain atau pilih &ldquo;Semua&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollRegion>
      </div>

      {/* Penempatan per unit */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Building2 className="h-4 w-4 text-indigo-300" /> Penempatan Akun per
          Unit
        </h2>
        {units.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Belum ada unit"
            description="Tambahkan unit terlebih dahulu pada menu Unit Audit."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {unitPlacement.map(({ unit, head, members }) => (
              <div key={unit.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {unit.name}
                    </h3>
                    <Badge className="mt-1 border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
                      {unit.category}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setAssign({ unitId: unit.id, role: "member" })
                      }
                      aria-label={`Tambah anggota ke ${unit.name}`}
                      className="flex min-h-9 items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                    >
                      <Plus className="h-3 w-3" /> Anggota
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/5 px-2.5 py-1.5">
                    <UserCog className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                    <span className="text-xs font-semibold text-slate-300">
                      Kepala Unit:
                    </span>
                    {head ? (
                      <>
                        <span className="truncate text-xs text-slate-200">
                          {head.name}
                        </span>
                        <RemoveMembershipButton
                          unitId={unit.id}
                          unitName={unit.name}
                          userId={head.id}
                          userName={head.name}
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setAssign({ unitId: unit.id, role: "head" })
                        }
                        className="text-xs font-medium text-amber-300 hover:underline"
                      >
                        + Tentukan kepala unit
                      </button>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-600/30 bg-slate-500/[0.04] px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <span className="text-xs font-semibold text-slate-300">
                        Anggota ({members.length})
                      </span>
                    </div>
                    {members.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-600/40 bg-slate-500/10 py-0.5 pl-2 pr-1 text-xs text-slate-300"
                          >
                            {m.name}
                            <RemoveMembershipButton
                              unitId={unit.id}
                              unitName={unit.name}
                              userId={m.id}
                              userName={m.name}
                              compact
                            />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false);
          setPreset(null);
        }}
        title="Akun Pengguna Baru"
      >
        <AccountForm
          units={units}
          preset={preset}
          onDone={() => {
            setCreating(false);
            setPreset(null);
          }}
        />
      </Modal>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Ubah Akun"
      >
        {editing && (
          <AccountForm
            account={editing}
            units={units}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={!!assign}
        onClose={() => setAssign(null)}
        title={
          assign?.role === "head"
            ? "Tentukan Kepala Unit"
            : "Tambah Anggota Unit"
        }
      >
        {assign && (
          <AssignMemberDialog
            unit={units.find((u) => u.id === assign.unitId) ?? null}
            role={assign.role}
            accounts={assignableAccounts}
            units={units}
            onDone={() => setAssign(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/** Tombol kecil untuk menghapus penempatan akun dari sebuah unit. */
function RemoveMembershipButton({
  unitId,
  userId,
  userName,
  unitName,
  compact,
}: {
  unitId: number;
  userId: number;
  userName: string;
  unitName: string;
  compact?: boolean;
}) {
  return (
    <ConfirmAction
      action={() => removeMember(unitId, userId)}
      title="Hapus penempatan?"
      confirmLabel="Hapus Penempatan"
      message={
        <>
          <strong className="text-slate-200">{userName}</strong> akan
          dikeluarkan dari unit{" "}
          <strong className="text-slate-200">{unitName}</strong>. Akunnya tetap
          ada.
        </>
      }
      triggerLabel={`Hapus ${userName} dari ${unitName}`}
      trigger={
        <X className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      }
      triggerClassName={
        compact
          ? "touch-compact flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
          : "ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
      }
    />
  );
}

/** Tombol untuk menunjuk/mencabut seorang Admin LPM sebagai Ketua LPM. */
function LpmHeadToggle({ account }: { account: AccountRow }) {
  const isHead = account.isLpmHead;
  return (
    <ConfirmAction
      action={() =>
        isHead ? unsetLpmHead(account.id) : setLpmHead(account.id)
      }
      tone="primary"
      title={isHead ? "Cabut status Ketua LPM?" : "Tunjuk sebagai Ketua LPM?"}
      confirmLabel={isHead ? "Cabut" : "Tunjuk"}
      message={
        isHead ? (
          <>
            Status Ketua LPM akan dicabut dari{" "}
            <strong className="text-slate-200">{account.name}</strong>.
          </>
        ) : (
          <>
            <strong className="text-slate-200">{account.name}</strong> akan
            menjadi penandatangan dokumen laporan (menggantikan Ketua LPM
            sebelumnya bila ada).
          </>
        )
      }
      triggerLabel={
        isHead
          ? `Cabut status Ketua LPM dari ${account.name}`
          : `Tunjuk ${account.name} sebagai Ketua LPM`
      }
      trigger={<Crown className="h-4 w-4" aria-hidden="true" />}
      triggerClassName={`flex h-9 w-9 items-center justify-center rounded-lg border ${
        isHead
          ? "border-amber-400/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
          : "border-slate-600/40 bg-slate-500/10 text-slate-400 hover:bg-amber-500/15 hover:text-amber-300"
      }`}
    />
  );
}

/**
 * Modal penempatan: memilih akun yang SUDAH terdaftar untuk ditempatkan pada
 * sebuah unit sebagai kepala atau anggota. Mendukung rangkap jabatan (satu akun
 * boleh berada di banyak unit). Bila akun belum ada, tersedia tombol tambah akun.
 */
function AssignMemberDialog({
  unit,
  role,
  accounts,
  units,
  onDone,
}: {
  unit: UnitRow | null;
  role: "head" | "member";
  accounts: AccountRow[];
  units: UnitRow[];
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | "">("");
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);

  const unitId = unit?.id ?? 0;

  // Kandidat: sembunyikan yang sudah menjadi kepala unit ini.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter(
        (a) =>
          !a.memberships.some((m) => m.unitId === unitId && m.role === "head")
      )
      .filter((a) => {
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
        );
      });
  }, [accounts, query, unitId]);

  const selectedAccount = accounts.find((a) => a.id === selected) ?? null;

  const submit = () => {
    if (!unitId || selected === "") {
      setState({ error: "Pilih akun terlebih dahulu." });
      return;
    }
    start(async () => {
      const res = await assignMember(unitId, Number(selected), role);
      if (res?.error) setState(res);
      else onDone();
    });
  };

  if (creating) {
    return (
      <AccountForm
        units={units}
        preset={{
          role: role === "head" ? "auditee_head" : "auditee_member",
          unitId,
        }}
        onDone={onDone}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-400/15 bg-indigo-500/[0.06] px-3 py-2 text-xs text-slate-300">
        Unit:{" "}
        <span className="font-semibold text-white">{unit?.name ?? "-"}</span>
        {" • "}Peran:{" "}
        <span className="font-semibold text-indigo-300">
          {role === "head" ? "Kepala Unit" : "Anggota Unit"}
        </span>
      </div>

      <ActionFeedback state={state} />

      <Field label="Cari akun terdaftar">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama atau email…"
            className="input-base pl-9"
          />
        </div>
      </Field>

      <Field label="Pilih Akun">
        <select
          value={selected}
          onChange={(e) =>
            setSelected(e.target.value ? Number(e.target.value) : "")
          }
          className="input-base"
        >
          <option value="">— Pilih akun —</option>
          {candidates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.email}
              {a.memberships.length > 0
                ? ` (${a.memberships.length} unit)`
                : ""}
            </option>
          ))}
        </select>
      </Field>

      {selectedAccount && (
        <p className="rounded-lg border border-slate-600/30 bg-slate-500/[0.04] px-3 py-2 text-xs text-slate-400">
          Akun ini terdaftar pada{" "}
          <span className="text-slate-200">
            {selectedAccount.memberships.length}
          </span>{" "}
          unit
          {selectedAccount.memberships.length > 0
            ? " — rangkap jabatan diperbolehkan."
            : "."}
        </p>
      )}

      {candidates.length === 0 && (
        <p
          role="status"
          className="rounded-xl border border-dashed border-slate-600/40 px-3 py-3 text-center text-xs text-slate-500"
        >
          Tidak ada akun yang cocok. Tambahkan akun baru terlebih dahulu.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> Akun Baru
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className={BTN_SECONDARY}>
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || selected === ""}
            aria-busy={pending || undefined}
            className={BTN_PRIMARY}
          >
            {pending && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            )}
            {pending ? "Memproses…" : "Tempatkan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountForm({
  account,
  units,
  preset,
  onDone,
}: {
  account?: AccountRow;
  units: UnitRow[];
  preset?: { role: Role; unitId: number | null } | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    account ? updateAccount : createAccount,
    undefined
  );
  const [role, setRole] = useState<Role>(
    account?.role ?? preset?.role ?? "auditee_member"
  );
  const [unitId, setUnitId] = useState<string>(
    String(account?.unitId ?? preset?.unitId ?? "")
  );
  useCloseOnSuccess(state, onDone);

  const isNoUnitRole =
    role === "superadmin" ||
    role === "lpm_admin" ||
    role === "lpm_member" ||
    role === "pengunjung";

  return (
    <form action={formAction} className="space-y-4">
      {account && <input type="hidden" name="id" value={account.id} />}
      <ActionFeedback state={state} />

      <Field label="Nama Lengkap">
        <input
          name="name"
          defaultValue={account?.name}
          placeholder="Dr. Budi Santoso, M.Kom."
          className="input-base"
          required
        />
      </Field>

      {!account && (
        <Field label="Email">
          <input
            type="email"
            name="email"
            autoComplete="off"
            placeholder="nama@universitaspahlawan.ac.id"
            className="input-base"
            required
          />
        </Field>
      )}

      <Field
        label={account ? "Kata Sandi Baru (opsional)" : "Kata Sandi"}
        hint={
          account
            ? `Biarkan kosong jika tidak ingin mengubah. ${PASSWORD_POLICY_HINT}`
            : PASSWORD_POLICY_HINT
        }
      >
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            className="input-base pl-9"
            placeholder="••••••••"
            minLength={PASSWORD_MIN_LENGTH}
            required={!account}
          />
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Peran">
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="input-base"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Unit"
          hint={
            role === "auditee_head"
              ? "Satu unit hanya boleh punya satu Kepala Unit."
              : undefined
          }
        >
          <select
            name="unitId"
            value={isNoUnitRole ? "" : unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="input-base"
            disabled={isNoUnitRole}
            required={!isNoUnitRole}
          >
            <option value="">— Pilih Unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isNoUnitRole && (
        <p className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-300">
          <UserCog className="h-3.5 w-3.5" />
          {role === "pengunjung"
            ? "Akun pengunjung tidak memiliki akses fitur apa pun."
            : "Akun LPM tidak terikat pada unit tertentu."}
        </p>
      )}

      {account && (
        <label className="flex items-center gap-2.5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 px-3 py-2.5">
          <input
            type="checkbox"
            name="isActive"
            value="on"
            defaultChecked={account.isActive}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">Akun aktif</span>
        </label>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className={BTN_SECONDARY}>
          Batal
        </button>
        <SubmitButton label={account ? "Perbarui" : "Simpan"} />
      </div>
    </form>
  );
}
