import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mail, ShieldAlert, LogOut } from "lucide-react";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { LegalFooter } from "@/components/legal/legal-footer";
import { ConsentDialog } from "@/components/legal/consent-dialog";
import { CONTACT_EMAIL } from "@/components/legal/site";

export const metadata: Metadata = {
  title: "Akses Belum Tersedia",
  description: "Akun Anda belum memiliki akses ke Sistem Informasi SPMI.",
  robots: { index: false, follow: false },
};

export default async function NoAccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Jika ternyata sudah punya akses, arahkan ke dashboard.
  if (hasAccess(user.role)) redirect("/dashboard");

  const mailSubject = encodeURIComponent("Permohonan Akses Akun SPMI");
  const mailBody = encodeURIComponent(
    `Halo LPM,\n\nSaya ${user.name} (${user.email}) ingin memohon pemberian akses ke Sistem Informasi SPMI.\n\nTerima kasih.`
  );
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <>
      <main
        id="konten-utama"
        tabIndex={-1}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 focus:outline-none"
      >
        {/* Latar dekoratif sesuai tema */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl"
        />

        <div className="animate-in relative w-full max-w-lg">
          <div className="card overflow-hidden p-7 text-center shadow-2xl shadow-black/40 sm:p-9">
            <div
              aria-hidden="true"
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-300 shadow-lg shadow-amber-900/20"
            >
              <ShieldAlert className="h-8 w-8" />
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Akun Anda Belum Memiliki Akses
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Halo{" "}
              <span className="font-medium text-slate-200">{user.name}</span>,
              akun Anda saat ini terdaftar sebagai{" "}
              <span className="font-medium text-amber-300">Pengunjung</span> dan
              belum memiliki akses ke fitur apa pun pada Sistem Informasi SPMI.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Silakan hubungi LPM untuk memberikan akses sesuai peran Anda.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <a
                href={mailto}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/40 transition hover:from-indigo-600 hover:to-violet-600 sm:w-auto"
              >
                <Mail className="h-4 w-4" />
                Hubungi LPM via Email
              </a>
              <form action={logoutAction} className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600/50 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </form>
            </div>

            <div className="mt-6 rounded-xl border border-indigo-400/15 bg-indigo-500/[0.06] px-4 py-3 text-left">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Email LPM
              </p>
              <p className="mt-0.5 font-mono text-sm text-indigo-300">
                {CONTACT_EMAIL}
              </p>
            </div>
          </div>

          <LegalFooter className="mt-6" />
        </div>
      </main>
      {user.consentRequired && <ConsentDialog userName={user.name} />}
    </>
  );
}
