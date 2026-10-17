import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LegalFooter } from "@/components/legal/legal-footer";
import {
  LEGAL_DATE,
  LEGAL_DATE_ISO,
  LEGAL_VERSION,
} from "@/components/legal/site";

/** Kerangka halaman dokumen hukum publik (dapat diakses tanpa login). */
export function LegalPage({
  title,
  intro,
  toc,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="surface-bar border-b border-indigo-400/10 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/"
            className="text-sm font-semibold text-white hover:text-indigo-300"
          >
            SPMI Universitas Pahlawan
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-400 hover:text-indigo-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Kembali ke aplikasi
          </Link>
        </div>
      </header>

      <main
        id="konten-utama"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 focus:outline-none"
      >
        <article className="card prose-legal p-5 text-sm leading-relaxed text-slate-300 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            Versi {LEGAL_VERSION} —{" "}
            <time dateTime={LEGAL_DATE_ISO}>{LEGAL_DATE}</time>
          </p>
          <div className="mt-4 space-y-3">{intro}</div>

          <nav
            aria-labelledby="daftar-isi"
            className="mt-6 rounded-xl border border-indigo-400/15 bg-indigo-500/[0.05] p-4"
          >
            <h2 id="daftar-isi" className="text-sm font-semibold text-white">
              Daftar Isi
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="text-indigo-300">
                    {t.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-6 space-y-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-200 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_section]:scroll-mt-24 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </main>

      <LegalFooter className="px-4 pb-6" />
    </div>
  );
}
