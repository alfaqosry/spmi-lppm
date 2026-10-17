import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Download,
  Mail,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL, formatDateTime, initials } from "@/lib/format";
import { CONTACT_EMAIL } from "@/components/legal/site";
import { PageHeader } from "@/components/ui/primitives";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export const metadata: Metadata = {
  title: "Profil Saya",
  description:
    "Informasi akun, keamanan kata sandi, dan hak Anda atas data pribadi.",
};

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      password: true,
      username: true,
      ssoId: true,
      createdAt: true,
      consentedAt: true,
      consentVersion: true,
    },
  });

  const ssoOnly = !record?.password;

  const deletionMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    "Permohonan Penghapusan Akun SPMI"
  )}&body=${encodeURIComponent(
    `Halo LPM,

Saya ${user.name} (${user.email}) memohon penghapusan akun dan data pribadi saya pada Sistem Informasi SPMI sesuai UU No. 27 Tahun 2022.

Terima kasih.`
  )}`;

  const info = [
    { icon: UserRound, label: "Nama Lengkap", value: user.name },
    { icon: Mail, label: "Email", value: user.email },
    {
      icon: ShieldCheck,
      label: "Peran",
      value: ROLE_LABEL[user.role] ?? user.role,
    },
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
        description="Kelola informasi akun, keamanan kata sandi, dan hak Anda atas data pribadi."
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
              Nama pengguna:{" "}
              <span className="text-slate-400">{record.username}</span>
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

      {/* Hak subjek data (UU 27/2022 PDP) */}
      <section aria-labelledby="hak-anda" className="card mt-5 p-5">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
          >
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="hak-anda" className="text-sm font-semibold text-white">
              Data Pribadi &amp; Hak Anda
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
              Lihat{" "}
              <Link
                href="/kebijakan-privasi"
                className="text-indigo-300 underline underline-offset-2"
              >
                Kebijakan Privasi
              </Link>
              .
            </p>
          </div>
        </div>

        <ul className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
          <li className="rounded-xl border border-slate-600/30 bg-slate-500/[0.04] p-3">
            <strong className="block text-slate-200">
              Hak akses &amp; portabilitas
            </strong>
            Unduh salinan data pribadi Anda (profil, penempatan, riwayat login,
            dan aktivitas) dalam format JSON.
          </li>
          <li className="rounded-xl border border-slate-600/30 bg-slate-500/[0.04] p-3">
            <strong className="block text-slate-200">Hak perbaikan</strong>
            Data nama/unit yang keliru dapat diperbaiki oleh Admin LPM atau
            melalui SSO Universitas Pahlawan.
          </li>
          <li className="rounded-xl border border-slate-600/30 bg-slate-500/[0.04] p-3">
            <strong className="block text-slate-200">Hak penghapusan</strong>
            Ajukan penghapusan akun melalui email LPM. Data audit yang wajib
            diarsipkan institusi akan dianonimkan sesuai masa retensi.
          </li>
          <li className="rounded-xl border border-slate-600/30 bg-slate-500/[0.04] p-3">
            <strong className="block text-slate-200">Persetujuan</strong>
            {record?.consentedAt
              ? `Anda menyetujui Kebijakan Privasi versi ${record.consentVersion ?? "-"} pada ${formatDateTime(record.consentedAt)}.`
              : "Anda belum menyetujui Kebijakan Privasi versi terbaru."}
          </li>
        </ul>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href="/api/me/export"
            download
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/30 transition hover:from-indigo-600 hover:to-violet-600"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Unduh data saya (JSON)
          </a>
          <a
            href={deletionMailto}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Ajukan penghapusan akun via email LPM
          </a>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Permintaan dikirim ke {CONTACT_EMAIL} dan ditanggapi dalam jangka
          waktu yang ditetapkan UU PDP setelah identitas pemohon diverifikasi.
        </p>
      </section>
    </div>
  );
}
