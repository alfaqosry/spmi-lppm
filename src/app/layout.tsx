import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getSettings, isOn } from "@/lib/settings";

/** Metadata dinamis dari pengaturan sistem (nama, deskripsi, SEO, ikon). */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const name = s["site.name"] || "Sistem Informasi SPMI";
  const description = s["site.description"] || "";
  const keywords = s["site.keywords"]
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const noindex = s["site.robots"] === "noindex";
  const baseUrl = s["site.baseUrl"] || undefined;
  const ogImage = s["site.ogImage"] || s["site.logo"] || undefined;

  return {
    title: {
      default: name,
      template: `%s — ${s["site.shortName"] || name}`,
    },
    description,
    applicationName: name,
    authors: s["site.author"] ? [{ name: s["site.author"] }] : undefined,
    keywords: keywords.length ? keywords : undefined,
    metadataBase: baseUrl ? new URL(baseUrl) : undefined,
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    icons: s["site.favicon"] ? { icon: s["site.favicon"] } : undefined,
    openGraph: {
      title: name,
      description,
      siteName: name,
      type: "website",
      url: baseUrl,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    verification: s["site.googleVerification"]
      ? { google: s["site.googleVerification"] }
      : undefined,
  };
}

// Script kecil yang berjalan sebelum paint untuk mencegah kedipan tema (FOUC):
// jika cookie belum ada, cek localStorage; default = terang.
const themeScript = `(function(){try{var t=document.cookie.match(/(?:^|; )theme=([^;]+)/);t=t?t[1]:null;if(!t){t=localStorage.getItem('theme')}if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}else{document.documentElement.style.colorScheme='light'}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  const isDark = theme === "dark";

  // Mode pemeliharaan: tampilkan halaman pemberitahuan (kecuali superadmin).
  // Dicek di layout dashboard & login, bukan di sini, agar aset tetap termuat.

  return (
    <html lang="id" className={isDark ? "dark" : ""} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

export { isOn };
