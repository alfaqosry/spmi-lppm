import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (pengganti `middleware` di Next.js 16) — Content Security Policy
 * berbasis NONCE per permintaan.
 *
 * Next.js membaca nonce dari header CSP permintaan saat SSR lalu menempelkannya
 * otomatis ke seluruh skrip framework/bundle/inline miliknya. Syaratnya
 * halaman dirender dinamis — terpenuhi karena root layout membaca `cookies()`.
 *
 * Skrip inline milik aplikasi (anti-kedip tema di src/app/layout.tsx)
 * diizinkan lewat hash SHA-256 di bawah; bila isi skrip itu diubah, perbarui
 * hash ATAU (lebih baik) beri atribut `nonce={(await headers()).get("x-nonce")}`.
 *
 * Proxy SENGAJA tidak melakukan autentikasi/otorisasi — itu ditegakkan di
 * setiap Server Function & Route Handler (lihat src/lib/guards.ts).
 */

const IS_DEV = process.env.NODE_ENV === "development";
// upgrade-insecure-requests hanya bila situs memang dilayani lewat HTTPS. WebKit tidak
// mengecualikan 127.0.0.1 dari upgrade, sehingga uji lokal via http akan rusak.
const SERVES_HTTPS =
  !IS_DEV && !(process.env.APP_URL ?? "").startsWith("http://");

/** sha256 dari `themeScript` di src/app/layout.tsx. */
const THEME_SCRIPT_HASH =
  "'sha256-ftnDgxby8Sipix1vXghmsPep14FDXjbcM4Fd49OvXYk='";

/** Cloudflare Web Analytics (beacon disisipkan otomatis oleh Cloudflare). */
const CF_SCRIPT = "https://static.cloudflareinsights.com";
const CF_CONNECT = "https://cloudflareinsights.com";

function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      THEME_SCRIPT_HASH,
      CF_SCRIPT,
      IS_DEV ? "'unsafe-eval'" : "",
    ]
      .filter(Boolean)
      .join(" "),
    // Atribut style inline (framer-motion, recharts) tidak dapat diberi nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${CF_CONNECT}${IS_DEV ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    SERVES_HTTPS ? "upgrade-insecure-requests" : "",
  ];
  return directives.filter(Boolean).join("; ");
}

export function proxy(request: NextRequest) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      /*
       * Semua halaman, kecuali:
       * - api (route handler; header CSP ketat diatur di next.config.ts)
       * - uploads (di-rewrite ke /api/files)
       * - _next/static, _next/image, favicon.ico, robots.txt, sitemap.xml
       * - berkas statis berekstensi umum
       */
      source:
        "/((?!api/|uploads/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        // Panggilan Server Function (respons RSC, bukan HTML) + unggahan besar.
        { type: "header", key: "next-action" },
      ],
    },
  ],
};
