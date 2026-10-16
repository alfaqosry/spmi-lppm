import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSsoConfigured, getSsoUrl } from "@/lib/sso";
import { getSettings } from "@/lib/settings";
import LoginForm from "@/components/auth/login-form";

export const metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sso_error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user)
    redirect(user.role === "pengunjung" ? "/no-access" : "/dashboard");

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />

      <div className="animate-in w-full max-w-md">
        <div className="mb-7 text-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={siteName}
              className="mx-auto mb-4 h-14 w-14 rounded-2xl border border-indigo-400/30 object-contain p-1 shadow-lg shadow-indigo-900/40"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15 text-2xl font-bold text-indigo-200 shadow-lg shadow-indigo-900/40">
              {shortName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {siteName}
          </h1>
          {organization && (
            <p className="mt-1.5 text-sm text-slate-400">{organization}</p>
          )}
        </div>

        <div className="card p-6 shadow-2xl shadow-black/40 sm:p-7">
          <LoginForm
            ssoConfigured={ssoConfigured}
            ssoHost={ssoHost}
            ssoError={params.sso_error}
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {organization || siteName}
        </p>
      </div>
    </main>
  );
}
