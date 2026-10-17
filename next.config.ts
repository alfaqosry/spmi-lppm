import type { NextConfig } from "next";

/**
 * Header keamanan global (OWASP Secure Headers / ASVS V14.4).
 *
 * Content-Security-Policy untuk HALAMAN dibuat per permintaan dengan nonce di
 * src/proxy.ts (tanpa 'unsafe-inline' pada script-src). Route handler /api/*
 * (JSON/PDF) mendapat CSP ketat statis di bawah.
 *
 * Domain publik (dipakai untuk allowlist Origin Server Actions di balik
 * Cloudflare -> IIS ARR). Diambil dari env APP_HOST atau host APP_URL saat build.
 */
function resolveAppHost(): string {
  if (process.env.APP_HOST) return process.env.APP_HOST;
  try {
    if (process.env.APP_URL) return new URL(process.env.APP_URL).host;
  } catch {
    /* abaikan */
  }
  return "spmi.universitaspahlawan.ac.id";
}
const APP_HOST = resolveAppHost();

const securityHeaders = [
  // HSTS: wajib HTTPS 2 tahun untuk host ini & subdomainnya. (Tanpa `preload`
  // karena preload hanya berlaku untuk domain apex.)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), " +
      "magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
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
      // 10MB berkas + overhead multipart & field lain.
      bodySizeLimit: "12mb",
      // Di balik IIS ARR, Host bisa berupa 127.0.0.1:3002; izinkan Origin publik.
      allowedOrigins: [APP_HOST],
    },
    // Batas buffer body yang melewati proxy.ts (unggahan diproses action).
    proxyClientMaxBodySize: "12mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // Aktifkan streaming (nonaktifkan buffering proxy bila didukung).
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
      {
        // API JSON/PDF: tidak pernah memuat sub-resource apa pun.
        // /api/files dikecualikan agar penampil PDF bawaan browser tetap jalan.
        source: "/api/:path((?!files/).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      // Kompatibilitas: URL lama /uploads/... (tersimpan di DB) dilayani oleh
      // route terautentikasi /api/files/... — SEBELUM pencarian berkas public/,
      // sehingga berkas lama di public/uploads tidak lagi tersaji langsung.
      beforeFiles: [
        {
          source: "/uploads/:folder/:file",
          destination: "/api/files/:folder/:file",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
