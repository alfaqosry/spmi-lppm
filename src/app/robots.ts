import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import {
  DEFAULT_SITE_URL,
  PRIVATE_PATHS,
  PUBLIC_PATHS,
} from "@/components/legal/site";

// Membaca pengaturan (DB) saat permintaan, bukan saat build.
export const dynamic = "force-dynamic";

/**
 * robots.txt — hanya halaman publik (login & dokumen hukum) yang boleh
 * dirayapi; API dan seluruh halaman dasbor ditutup. Bila admin memilih
 * "noindex" pada Pengaturan › SEO, seluruh situs ditutup.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  const base = (
    s["site.baseUrl"] ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");

  if (s["site.robots"] === "noindex") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/$", ...PUBLIC_PATHS],
      disallow: [...PRIVATE_PATHS],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
