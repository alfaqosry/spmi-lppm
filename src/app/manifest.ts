import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Web App Manifest — warna tema mengikuti palet indigo aplikasi. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const name = s["site.name"] || "Sistem Informasi SPMI";
  return {
    name: `${name} — Universitas Pahlawan`,
    short_name: s["site.shortName"] || "SPMI",
    description:
      s["site.description"] ||
      "Sistem Penjaminan Mutu Internal Universitas Pahlawan Tuanku Tambusai.",
    lang: "id",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
