import type { NextConfig } from "next";

/**
 * Header keamanan dasar.
 *
 * CSP dibuat cukup permisif agar tidak memutus Next.js (yang menyisipkan skrip
 * inline untuk hidrasi). Ini tetap memblokir pemuatan skrip/iframe dari origin
 * asing. Untuk CSP ketat berbasis nonce, integrasikan dengan middleware.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js menyisipkan skrip inline (hidrasi). 'unsafe-eval' hanya
      // diizinkan pada development; di produksi dihapus untuk keamanan.
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://sso-v2.universitaspahlawan.ac.id",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Output standalone: menghasilkan server minimal yang tidak perlu
  // node_modules lengkap — cocok untuk Docker & deployment ringan.
  output: "standalone",
  // Matikan header X-Powered-By (mencegah fingerprinting framework).
  poweredByHeader: false,
  // Kompresi respons (gzip) diaktifkan di produksi.
  compress: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // Aktifkan streaming (nonaktifkan buffering nginx/proxy).
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

export default nextConfig;
