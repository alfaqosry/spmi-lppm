import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSsoConfigured, getSsoUrl } from "@/lib/sso";
import { getSettings } from "@/lib/settings";
import LoginForm from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";
import { LegalFooter } from "@/components/legal/legal-footer";

export const metadata: Metadata = {
  title: "Masuk",
  description:
    "Masuk ke Sistem Informasi SPMI Universitas Pahlawan Tuanku Tambusai menggunakan SSO UP atau akun LPM.",
  alternates: { canonical: "/login" },
  openGraph: { url: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sso_error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "pengunjung" ? "/no-access" : "/dashboard");

  const params = await searchParams;
  const [ssoConfigured, ssoUrl, settings] = await Promise.all([
    isSsoConfigured(),
    getSsoUrl(),
    getSettings(),
  ]);

  let ssoHost = ssoUrl;
  try {
    ssoHost = new URL(ssoUrl).host;
  } catch {
    /* biarkan nilai apa adanya */
  }

  const siteName = settings["site.name"] || "Sistem Informasi SPMI";
  const organization = settings["site.organization"] || "";
  const logo = settings["site.logo"];
  const shortName = settings["site.shortName"] || "SPMI";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl"
      />

      <main
        id="konten-utama"
        tabIndex={-1}
        className="relative flex flex-1 items-center justify-center px-4 py-10 focus:outline-none"
      >
        <div className="animate-in w-full max-w-md">
          <div className="mb-7 text-center">
            <Logo
              src={logo}
              name={siteName}
              shortName={shortName}
              size={56}
              priority
              decorative
              className="mx-auto mb-4 rounded-2xl border border-indigo-400/30 p-1 shadow-lg shadow-indigo-900/30"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {siteName}
            </h1>
            {organization && (
              <p className="mt-1.5 text-sm text-slate-400">{organization}</p>
            )}
          </div>

          <section
            aria-labelledby="judul-masuk"
            className="card p-5 shadow-2xl shadow-black/30 sm:p-7"
          >
            <h2
              id="judul-masuk"
              className="mb-4 text-base font-semibold text-white"
            >
              Masuk ke akun Anda
            </h2>
            <LoginForm
              ssoConfigured={ssoConfigured}
              ssoHost={ssoHost}
              ssoError={params.sso_error}
            />
          </section>

          <p className="mt-4 text-center text-xs text-slate-500">
            Dengan masuk, Anda menyetujui pemrosesan data sesuai Kebijakan
            Privasi.
          </p>
        </div>
      </main>

      <LegalFooter
        organization={organization || siteName}
        className="relative px-4 pb-6"
      />
    </div>
  );
}
