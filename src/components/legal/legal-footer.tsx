import Link from "next/link";
import { CONTACT_EMAIL, INSTITUTION } from "@/components/legal/site";

/**
 * Footer berisi tautan dokumen hukum (UU PDP) & kontak LPM.
 * Dipakai di halaman login, dasbor, dan halaman publik.
 */
export function LegalFooter({
  organization,
  className = "",
}: {
  organization?: string;
  className?: string;
}) {
  const linkCls =
    "rounded underline-offset-2 hover:text-indigo-300 hover:underline focus-visible:text-indigo-300";
  return (
    <footer
      className={`text-center text-xs text-slate-500 ${className}`}
      aria-label="Informasi hukum"
    >
      <nav aria-label="Tautan kebijakan">
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <li>
            <Link href="/kebijakan-privasi" className={linkCls}>
              Kebijakan Privasi
            </Link>
          </li>
          <li>
            <Link href="/syarat-ketentuan" className={linkCls}>
              Syarat &amp; Ketentuan
            </Link>
          </li>
          <li>
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkCls}>
              Kontak LPM
            </a>
          </li>
        </ul>
      </nav>
      <p className="mt-2">
        © {new Date().getFullYear()} {organization || INSTITUTION}
      </p>
    </footer>
  );
}
