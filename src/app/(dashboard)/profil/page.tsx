import { redirect } from "next/navigation";
import { BadgeCheck, Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL, initials } from "@/lib/format";
import { PageHeader } from "@/components/ui/primitives";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export const metadata = { title: "Profil Saya — SPMI" };

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true, username: true, ssoId: true, createdAt: true },
  });

  const ssoOnly = !record?.password;

  const info = [
    { icon: UserRound, label: "Nama Lengkap", value: user.name },
    { icon: Mail, label: "Email", value: user.email },
    { icon: ShieldCheck, label: "Peran", value: ROLE_LABEL[user.role] ?? user.role },
    {
      icon: Building2,
      label: "Unit",
      value: user.unitName ?? "Lembaga Penjaminan Mutu",
    },
  ];

  return (
    <div>
      <PageHeader
        icon={UserRound}
        title="Profil Saya"
        description="Kelola informasi akun dan keamanan kata sandi Anda."
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Kartu identitas */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-on-accent shadow-lg shadow-indigo-900/40">
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {user.name}
              </p>
              <p className="truncate text-sm text-slate-400">{user.email}</p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                <BadgeCheck className="h-3 w-3" />
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
          </div>

          <dl className="mt-5 space-y-3 border-t border-slate-500/15 pt-4">
            {info.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                      {row.label}
                    </dt>
                    <dd className="truncate text-sm text-slate-200">
                      {row.value}
                    </dd>
                  </div>
                </div>
              );
            })}
          </dl>

          {record?.username && (
            <p className="mt-4 text-[11px] text-slate-500">
              Nama pengguna: <span className="text-slate-400">{record.username}</span>
            </p>
          )}
        </div>

        {/* Kartu keamanan */}
        <div className="card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">Keamanan Akun</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {ssoOnly
              ? "Akun Anda terhubung melalui SSO."
              : "Perbarui kata sandi Anda secara berkala untuk menjaga keamanan akun."}
          </p>
          <div className="mt-5">
            <ChangePasswordForm ssoOnly={ssoOnly} />
          </div>
        </div>
      </div>
    </div>
  );
}
