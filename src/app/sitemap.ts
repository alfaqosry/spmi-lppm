import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SITE_URL, LEGAL_DATE_ISO } from "@/components/legal/site";

export const dynamic = "force-dynamic";

/** sitemap.xml — hanya halaman publik. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSettings();
  if (s["site.robots"] === "noindex") return [];
  const base = (
    s["site.baseUrl"] ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
  const legalDate = new Date(`${LEGAL_DATE_ISO}T00:00:00+07:00`);
  return [
    { url: `${base}/login`, changeFrequency: "monthly", priority: 1 },
    {
      url: `${base}/kebijakan-privasi`,
      lastModified: legalDate,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/syarat-ketentuan`,
      lastModified: legalDate,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
