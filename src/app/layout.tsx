import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { MotionProvider } from "@/components/layout/motion-provider";
import { DEFAULT_SITE_URL, SITE_TITLE_SUFFIX } from "@/components/legal/site";

/**
 * Plus Jakarta Sans (OFL 1.1, Tokotype) di-host mandiri lewat next/font/local:
 * tanpa CDN pihak ketiga, preload otomatis, dan fallback metrik untuk
 * mencegah layout shift (CLS).
 */
const sans = localFont({
  src: "../../public/fonts/plus-jakarta-sans-latin-wght.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

/** Viewport & warna tema (metadata.themeColor sudah deprecated). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Jangan batasi zoom (WCAG 1.4.4 — teks dapat diperbesar 200%).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#070b1a" },
  ],
};

/** Metadata dinamis dari pengaturan sistem (nama, deskripsi, SEO, ikon). */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const name = s["site.name"] || "Sistem Informasi SPMI";
  const description =
    s["site.description"] ||
    "Sistem Informasi Sistem Penjaminan Mutu Internal (SPMI) Universitas Pahlawan Tuanku Tambusai.";
  const keywords = s["site.keywords"]
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const noindex = s["site.robots"] === "noindex";
  const baseUrl = resolveBaseUrl(s["site.baseUrl"]);
  const ogImage = s["site.ogImage"] || s["site.logo"] || undefined;
  const siteName = `${s["site.shortName"] || "SPMI"} Universitas Pahlawan`;

  return {
    title: {
      default: name,
      template: `%s · ${SITE_TITLE_SUFFIX}`,
    },
    description,
    applicationName: name,
    authors: s["site.author"] ? [{ name: s["site.author"] }] : undefined,
    creator: "Lembaga Penjaminan Mutu — Universitas Pahlawan Tuanku Tambusai",
    publisher: "Universitas Pahlawan Tuanku Tambusai",
    keywords: keywords.length ? keywords : undefined,
    metadataBase: baseUrl,
    formatDetection: { telephone: false, email: false, address: false },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    // Ikon unggahan admin (bila ada) menimpa ikon bawaan app/icon.svg.
    icons: s["site.favicon"] ? { icon: s["site.favicon"] } : undefined,
    openGraph: {
      title: name,
      description,
      siteName,
      locale: "id_ID",
      type: "website",
      url: "/",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: name,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    verification: s["site.googleVerification"]
      ? { google: s["site.googleVerification"] }
      : undefined,
  };
}

/** URL dasar kanonis: pengaturan > APP_URL > NEXT_PUBLIC_SITE_URL > domain produksi. */
function resolveBaseUrl(fromSettings: string): URL {
  const candidates = [
    fromSettings,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_SITE_URL,
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return new URL(c);
    } catch {
      /* lanjut ke kandidat berikutnya */
    }
  }
  return new URL(DEFAULT_SITE_URL);
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
  // Nonce CSP per permintaan (diset oleh src/proxy.ts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Mode pemeliharaan: tampilkan halaman pemberitahuan (kecuali superadmin).
  // Dicek di layout dashboard & login, bukan di sini, agar aset tetap termuat.

  return (
    <html
      lang="id"
      className={`${sans.variable}${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <a href="#konten-utama" className="skip-link">
          Lewati ke konten utama
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
