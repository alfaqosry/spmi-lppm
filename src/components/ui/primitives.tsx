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
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-indigo-300">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 max-w-2xl text-sm text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
        <Icon className="h-6 w-6" />
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
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tones[tone].split(" ")[0]}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-white">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br to-transparent ${tones[tone]}`}
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
