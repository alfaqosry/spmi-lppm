import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight break-words text-white sm:text-xl">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 max-w-2xl text-sm text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-800/40 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-xs text-slate-400">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "indigo" | "emerald" | "amber" | "sky" | "rose";
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500/20 text-indigo-300 border-indigo-400/25",
    emerald: "from-emerald-500/20 text-emerald-300 border-emerald-400/25",
    amber: "from-amber-500/20 text-amber-300 border-amber-400/25",
    sky: "from-sky-500/20 text-sky-300 border-sky-400/25",
    rose: "from-rose-500/20 text-rose-300 border-rose-400/25",
  };
  return (
    <div className="card relative overflow-hidden p-4">
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tones[tone].split(" ")[0]}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 text-xl font-semibold break-words text-white sm:text-2xl">
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
        </div>
        <div
          aria-hidden="true"
          className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br to-transparent min-[380px]:flex ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

/** Bilah progres yang dapat dibaca pembaca layar (role="progressbar"). */
export function ProgressBar({
  value,
  label,
  className = "h-2 w-full",
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${v}%`}
      className={`overflow-hidden rounded-full bg-slate-800 ${className}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Blok kerangka pemuatan. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Kerangka halaman dasbor standar (dipakai loading.tsx). */
export function PageSkeleton({
  cards = 4,
  rows = 5,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Memuat halaman…</span>
      <div className="mb-6 flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0" />
        <div className="w-full max-w-md space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3.5 w-full" />
        </div>
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      <div className="card mt-5 space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    </div>
  );
}
