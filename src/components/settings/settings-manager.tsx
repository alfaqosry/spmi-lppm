"use client";

import { useRef, useState, useActionState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Palette,
  Plug,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { ActionFeedback, Field, SubmitButton } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/confirm-dialog";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from "@/lib/password";
import type { PublicSettings, SettingKey } from "@/lib/settings";
import {
  saveGeneralSettings,
  uploadBranding,
  clearBranding,
  testSsoConnection,
  clearLoginLogs,
  clearActivityLogs,
  purgeLoginLogs,
  createSuperadmin,
  type ActionState,
} from "@/lib/actions/settings";
import type { LoginLogRow, ActivityLogRow } from "@/components/settings/types";

type Tab =
  "identity" | "logs" | "sso" | "security" | "maintenance" | "superadmin";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "identity", label: "Identitas & SEO", icon: Palette },
  { id: "sso", label: "Integrasi SSO", icon: Plug },
  { id: "logs", label: "Log & Pemantauan", icon: Activity },
  { id: "security", label: "Keamanan", icon: ShieldCheck },
  { id: "maintenance", label: "Pemeliharaan", icon: Wrench },
  { id: "superadmin", label: "Superadmin", icon: KeyRound },
];

function val(s: PublicSettings, key: SettingKey): string {
  return s[key]?.value ?? "";
}

export function SettingsManager({
  settings,
  loginLogs,
  activityLogs,
  superadmins,
}: {
  settings: PublicSettings;
  loginLogs: LoginLogRow[];
  activityLogs: ActivityLogRow[];
  superadmins: { id: number; name: string; email: string }[];
}) {
  const [tab, setTab] = useState<Tab>("identity");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (index + 1) % TABS.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (index - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = TABS[next].id;
    setTab(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Kategori pengaturan"
        className="flex flex-wrap gap-1.5"
      >
        {TABS.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="settings-panel"
              tabIndex={tab === t.id ? 0 : -1}
              onKeyDown={(e) => onTabKey(e, i)}
              onClick={() => setTab(t.id)}
              className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                  : "border-slate-600/40 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="settings-panel"
        aria-labelledby={`settings-tab-${tab}`}
        tabIndex={0}
        className="rounded-2xl focus-visible:outline-offset-4"
      >
        {tab === "identity" && <IdentityTab settings={settings} />}
        {tab === "sso" && <SsoTab settings={settings} />}
        {tab === "logs" && (
          <LogsTab
            settings={settings}
            loginLogs={loginLogs}
            activityLogs={activityLogs}
          />
        )}
        {tab === "security" && <SecurityTab settings={settings} />}
        {tab === "maintenance" && <MaintenanceTab settings={settings} />}
        {tab === "superadmin" && <SuperadminTab superadmins={superadmins} />}
      </div>
    </div>
  );
}

/* ----------------------------- IDENTITAS -------------------------------- */

function IdentityTab({ settings }: { settings: PublicSettings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveGeneralSettings,
    undefined
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4 p-5">
        <SectionTitle icon={Palette} title="Identitas Sistem" />
        <ActionFeedback state={state} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Nama Sistem"
            hint="Tampil di judul halaman & tab browser."
          >
            <input
              name="site.name"
              defaultValue={val(settings, "site.name")}
              className="input-base"
              required
            />
          </Field>
          <Field label="Nama Singkat" hint="Dipakai pada sidebar (mis. SPMI).">
            <input
              name="site.shortName"
              defaultValue={val(settings, "site.shortName")}
              className="input-base"
            />
          </Field>
        </div>
        <Field
          label="Deskripsi Sistem"
          hint="Dipakai sebagai meta description untuk Google."
        >
          <textarea
            name="site.description"
            defaultValue={val(settings, "site.description")}
            rows={2}
            className="input-base"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Nama Organisasi"
            hint="Tampil di halaman login & footer."
          >
            <input
              name="site.organization"
              defaultValue={val(settings, "site.organization")}
              className="input-base"
            />
          </Field>
          <Field label="Penulis / Author">
            <input
              name="site.author"
              defaultValue={val(settings, "site.author")}
              className="input-base"
            />
          </Field>
        </div>

        <SectionTitle icon={ImageIcon} title="Aset Branding" />
        <BrandingRow
          kind="logo"
          label="Logo Sistem"
          current={val(settings, "site.logo")}
        />
        <BrandingRow
          kind="favicon"
          label="Favicon"
          current={val(settings, "site.favicon")}
        />
        <BrandingRow
          kind="ogImage"
          label="Gambar Open Graph (SEO Sosial)"
          current={val(settings, "site.ogImage")}
        />

        <SectionTitle icon={Plug} title="SEO & Google" />
        <Field label="Kata Kunci (pisahkan dengan koma)">
          <input
            name="site.keywords"
            defaultValue={val(settings, "site.keywords")}
            className="input-base"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="URL Dasar Situs"
            hint="Contoh: https://spmi.universitaspahlawan.ac.id"
          >
            <input
              name="site.baseUrl"
              type="url"
              inputMode="url"
              defaultValue={val(settings, "site.baseUrl")}
              className="input-base"
              placeholder="https://spmi.universitaspahlawan.ac.id"
            />
          </Field>
          <Field label="Kode Verifikasi Google Search Console">
            <input
              name="site.googleVerification"
              defaultValue={val(settings, "site.googleVerification")}
              className="input-base"
            />
          </Field>
        </div>
        <Field label="Akses Mesin Pencari">
          <select
            name="site.robots"
            defaultValue={val(settings, "site.robots") || "index"}
            className="input-base"
          >
            <option value="index">
              Izinkan diindeks Google (index, follow)
            </option>
            <option value="noindex">Jangan diindeks (noindex, nofollow)</option>
          </select>
        </Field>

        <div className="flex justify-end pt-1">
          <SubmitButton label="Simpan Identitas" />
        </div>
      </form>
    </div>
  );
}

function BrandingRow({
  kind,
  label,
  current,
}: {
  kind: string;
  label: string;
  current: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    uploadBranding,
    undefined
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-600/30 bg-slate-500/[0.04] p-3">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt={`Pratinjau ${label}`}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="h-10 w-10 rounded-lg border border-indigo-400/20 object-contain p-0.5"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600/40 bg-slate-500/10 text-slate-500">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        <p className="truncate text-[11px] text-slate-500">
          {current ||
            "Belum ada berkas. Format: PNG/JPG/WEBP/GIF/ICO (maks 2MB)."}
        </p>
      </div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
          aria-label={`Pilih berkas ${label}`}
          required
          className="max-w-[180px] text-[11px] text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-500/15 file:px-2 file:py-1 file:text-indigo-300"
        />
        <button
          type="submit"
          aria-label={`Unggah ${label}`}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20"
        >
          <Upload className="h-3 w-3" aria-hidden="true" /> Unggah
        </button>
      </form>
      {current && (
        <ConfirmAction
          action={() => clearBranding(kind)}
          title={`Hapus ${label}?`}
          message={
            <>
              Berkas {label.toLowerCase()} saat ini akan dihapus dan diganti
              bawaan.
            </>
          }
          triggerLabel={`Hapus ${label}`}
          trigger={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          triggerClassName="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
        />
      )}
      <p className="w-full text-[11px] empty:hidden" aria-live="polite">
        {state?.error ? (
          <span role="alert" className="text-rose-300">
            {state.error}
          </span>
        ) : state?.ok ? (
          <span className="text-emerald-300">{label} berhasil diunggah.</span>
        ) : null}
      </p>
    </div>
  );
}

/* -------------------------------- SSO ----------------------------------- */

function SsoTab({ settings }: { settings: PublicSettings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveGeneralSettings,
    undefined
  );
  const [testState, setTestState] = useState<ActionState>(undefined);
  const [testing, startTest] = useTransition();

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4 p-5">
        <SectionTitle icon={Plug} title="Integrasi SSO Universitas Pahlawan" />
        <ActionFeedback state={state} />
        <input type="hidden" name="__bool_keys" value="sso.enabled" />
        <label className="flex items-center gap-2.5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 px-3 py-2.5">
          <input
            type="checkbox"
            name="sso.enabled"
            defaultChecked={val(settings, "sso.enabled") === "true"}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">Aktifkan login via SSO</span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="URL SSO"
            hint="Contoh: https://sso-v2.universitaspahlawan.ac.id"
          >
            <input
              name="sso.url"
              type="url"
              inputMode="url"
              defaultValue={val(settings, "sso.url")}
              className="input-base"
              placeholder="https://…"
            />
          </Field>
          <Field
            label="Redirect URI"
            hint="Harus sama persis dengan yang didaftarkan di SSO."
          >
            <input
              name="sso.redirectUri"
              defaultValue={val(settings, "sso.redirectUri")}
              className="input-base"
            />
          </Field>
        </div>
        <Field label="Client ID">
          <input
            name="sso.clientId"
            defaultValue={val(settings, "sso.clientId")}
            className="input-base"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Client Secret"
          hint="Nilai tersimpan disamarkan. Biarkan apa adanya bila tidak diubah."
        >
          <input
            name="sso.clientSecret"
            type="password"
            defaultValue={val(settings, "sso.clientSecret")}
            className="input-base"
            autoComplete="new-password"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Scope">
            <input
              name="sso.scope"
              defaultValue={val(settings, "sso.scope")}
              className="input-base"
              placeholder="*"
            />
          </Field>
          <Field label="Prompt">
            <input
              name="sso.prompt"
              defaultValue={val(settings, "sso.prompt")}
              className="input-base"
              placeholder="login"
            />
          </Field>
        </div>
        <Field
          label="Email Admin SSO"
          hint="Daftar email (pisahkan koma) yang otomatis menjadi Admin LPM saat login SSO."
        >
          <input
            name="sso.adminEmails"
            defaultValue={val(settings, "sso.adminEmails")}
            className="input-base"
            placeholder="lpm@universitaspahlawan.ac.id"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={testing}
            onClick={() => {
              setTestState(undefined);
              startTest(async () => setTestState(await testSsoConnection()));
            }}
            aria-busy={testing || undefined}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
          >
            {testing ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Plug className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {testing ? "Menguji…" : "Uji Koneksi"}
          </button>
          <SubmitButton label="Simpan Konfigurasi SSO" />
        </div>
        <div aria-live="polite" className="empty:hidden">
          {testState?.ok && (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Server
              SSO dapat dijangkau.
            </p>
          )}
          {testState?.error && (
            <p role="alert" className="text-[11px] text-rose-300">
              {testState.error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

/* -------------------------------- LOGS ---------------------------------- */

function LogsTab({
  settings,
  loginLogs,
  activityLogs,
}: {
  settings: PublicSettings;
  loginLogs: LoginLogRow[];
  activityLogs: ActivityLogRow[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveGeneralSettings,
    undefined
  );
  const [result, setResult] = useState<string | null>(null);
  const done = (msg: string) => () => setResult(msg);

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4 p-5">
        <SectionTitle icon={Activity} title="Pengaturan Log" />
        <ActionFeedback state={state} />
        <input
          type="hidden"
          name="__bool_keys"
          value="log.login.enabled,log.activity.enabled"
        />
        <label className="flex items-center gap-2.5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 px-3 py-2.5">
          <input
            type="checkbox"
            name="log.login.enabled"
            defaultChecked={val(settings, "log.login.enabled") === "true"}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">
            Catat riwayat login (sukses & gagal)
          </span>
        </label>
        <label className="flex items-center gap-2.5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 px-3 py-2.5">
          <input
            type="checkbox"
            name="log.activity.enabled"
            defaultChecked={val(settings, "log.activity.enabled") === "true"}
            className="h-4 w-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-300">
            Catat log aktivitas (audit trail)
          </span>
        </label>
        <Field
          label="Masa Simpan Log Login (hari)"
          hint="Log login lebih lama dari ini akan dihapus otomatis. 0 = simpan selamanya."
        >
          <input
            type="number"
            name="log.loginRetentionDays"
            min={0}
            max={3650}
            inputMode="numeric"
            defaultValue={val(settings, "log.loginRetentionDays")}
            className="input-base"
          />
        </Field>
        <Field
          label="Masa Simpan Log Aktivitas (hari)"
          hint="0–3650 hari. Log aktivitas lebih lama dari ini dihapus otomatis. 0 = simpan selamanya."
        >
          <input
            type="number"
            name="log.activityRetentionDays"
            min={0}
            max={3650}
            inputMode="numeric"
            defaultValue={val(settings, "log.activityRetentionDays")}
            className="input-base"
          />
        </Field>
        <div className="flex justify-end pt-1">
          <SubmitButton label="Simpan Pengaturan Log" />
        </div>
      </form>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={Activity} title="Riwayat Login" />
          <div className="flex flex-wrap gap-2">
            <ConfirmAction
              action={purgeLoginLogs}
              tone="primary"
              title="Bersihkan log login lama?"
              confirmLabel="Bersihkan"
              message="Log login yang lebih lama dari masa simpan akan dihapus."
              onDone={done("Log login lama berhasil dibersihkan.")}
              trigger="Bersihkan Lama"
              triggerClassName="min-h-9 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
            />
            <ConfirmAction
              action={clearLoginLogs}
              title="Hapus seluruh riwayat login?"
              confirmLabel="Hapus Semua"
              message="Seluruh riwayat login akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
              onDone={done("Seluruh riwayat login berhasil dihapus.")}
              trigger="Hapus Semua"
              triggerLabel="Hapus semua riwayat login"
              triggerClassName="min-h-9 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
            />
          </div>
        </div>
        <p
          role="status"
          aria-live="polite"
          className="mb-2 text-[11px] text-emerald-300 empty:hidden"
        >
          {result}
        </p>
        <LogTable
          caption="Riwayat login (100 terbaru)"
          head={["Waktu", "Email", "Metode", "Status", "IP", "Keterangan"]}
          rows={loginLogs.map((l) => [
            l.createdAt,
            l.email,
            l.method,
            l.success ? "Berhasil" : "Gagal",
            l.ip ?? "—",
            l.message ?? "—",
          ])}
          empty="Belum ada riwayat login."
        />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={Activity} title="Log Aktivitas" />
          <ConfirmAction
            action={clearActivityLogs}
            title="Hapus seluruh log aktivitas?"
            confirmLabel="Hapus Semua"
            message="Seluruh log aktivitas (audit trail) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            onDone={done("Seluruh log aktivitas berhasil dihapus.")}
            trigger="Hapus Semua"
            triggerLabel="Hapus semua log aktivitas"
            triggerClassName="min-h-9 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
          />
        </div>
        <LogTable
          caption="Log aktivitas (100 terbaru)"
          head={["Waktu", "Pengguna", "Aksi", "Entitas", "Detail"]}
          rows={activityLogs.map((l) => [
            l.createdAt,
            l.userName ?? "—",
            l.action,
            l.entity ?? "—",
            l.detail ?? "—",
          ])}
          empty="Belum ada log aktivitas."
        />
      </div>
    </div>
  );
}

function LogTable({
  caption,
  head,
  rows,
  empty,
}: {
  caption: string;
  head: string[];
  rows: (string | null)[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-600/30">
      <table className="w-full min-w-[640px] text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-indigo-400/10 text-[10px] uppercase tracking-wide text-slate-400">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-500/10 last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 break-words text-slate-300">
                  {c ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={head.length}
                className="px-3 py-6 text-center text-slate-500"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ KEAMANAN -------------------------------- */

function SecurityTab({ settings }: { settings: PublicSettings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveGeneralSettings,
    undefined
  );
  return (
    <form action={formAction} className="card space-y-4 p-5">
      <SectionTitle icon={ShieldCheck} title="Kebijakan Keamanan" />
      <ActionFeedback state={state} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Masa Sesi (hari)" hint="1–30 hari.">
          <input
            type="number"
            min={1}
            max={30}
            inputMode="numeric"
            name="security.sessionDays"
            defaultValue={val(settings, "security.sessionDays")}
            className="input-base"
          />
        </Field>
        <Field label="Maks. Percobaan Login" hint="1–5 kali.">
          <input
            type="number"
            min={1}
            max={5}
            inputMode="numeric"
            name="security.loginMaxAttempts"
            defaultValue={val(settings, "security.loginMaxAttempts")}
            className="input-base"
          />
        </Field>
        <Field label="Jendela Waktu (menit)" hint="1–60 menit.">
          <input
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            name="security.loginWindowMinutes"
            defaultValue={val(settings, "security.loginWindowMinutes")}
            className="input-base"
          />
        </Field>
      </div>
      <div className="flex justify-end pt-1">
        <SubmitButton label="Simpan Kebijakan Keamanan" />
      </div>
    </form>
  );
}

/* --------------------------- PEMELIHARAAN ------------------------------- */

function MaintenanceTab({ settings }: { settings: PublicSettings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveGeneralSettings,
    undefined
  );
  return (
    <form action={formAction} className="card space-y-4 p-5">
      <SectionTitle icon={Wrench} title="Mode Pemeliharaan" />
      <ActionFeedback state={state} />
      <input type="hidden" name="__bool_keys" value="maintenance.enabled" />
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Saat aktif, hanya Superadmin yang dapat mengakses sistem. Pengguna lain
        melihat halaman pemberitahuan.
      </div>
      <label className="flex items-center gap-2.5 rounded-xl border border-indigo-400/15 bg-indigo-500/5 px-3 py-2.5">
        <input
          type="checkbox"
          name="maintenance.enabled"
          defaultChecked={val(settings, "maintenance.enabled") === "true"}
          className="h-4 w-4 accent-indigo-500"
        />
        <span className="text-xs text-slate-300">
          Aktifkan mode pemeliharaan
        </span>
      </label>
      <Field label="Pesan Pemeliharaan">
        <textarea
          name="maintenance.message"
          rows={2}
          defaultValue={val(settings, "maintenance.message")}
          className="input-base"
        />
      </Field>
      <div className="flex justify-end pt-1">
        <SubmitButton label="Simpan" />
      </div>
    </form>
  );
}

/* ---------------------------- SUPERADMIN -------------------------------- */

function SuperadminTab({
  superadmins,
}: {
  superadmins: { id: number; name: string; email: string }[];
}) {
  const [createState, createAction] = useActionState<ActionState, FormData>(
    createSuperadmin,
    undefined
  );

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <SectionTitle icon={KeyRound} title="Daftar Superadmin" />
        <div className="mt-3 space-y-2">
          {superadmins.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 px-3 py-2"
            >
              <ShieldCheck className="h-4 w-4 text-fuchsia-300" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-200">
                  {s.name}
                </p>
                <p className="truncate text-[11px] text-slate-400">{s.email}</p>
              </div>
              <Badge className="ml-auto border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300">
                Superadmin
              </Badge>
            </div>
          ))}
          {superadmins.length === 0 && (
            <p className="text-xs text-slate-500">Belum ada akun superadmin.</p>
          )}
        </div>
      </div>

      <form action={createAction} className="card space-y-4 p-5">
        <SectionTitle icon={KeyRound} title="Buat Superadmin Baru" />
        <ActionFeedback state={createState} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nama Lengkap">
            <input name="name" className="input-base" required />
          </Field>
          <Field label="Email">
            <input
              type="email"
              name="email"
              autoComplete="off"
              className="input-base"
              required
            />
          </Field>
        </div>
        <Field label="Kata Sandi" hint={PASSWORD_POLICY_HINT}>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            className="input-base"
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
        </Field>
        <div className="flex justify-end pt-1">
          <SubmitButton
            label="Buat Superadmin"
            icon={<Save className="h-4 w-4" />}
          />
        </div>
      </form>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Palette;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-indigo-300" aria-hidden="true" />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
    </div>
  );
}
