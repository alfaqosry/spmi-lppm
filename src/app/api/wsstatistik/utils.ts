const BASE = "http://kuesioner.universitaspahlawan.ac.id/wsstatistik";

export function buildExternalUrl(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const url = new URL(`${BASE}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

/**
 * Ambil data wsstatistik langsung dari sisi server (tanpa lewat route internal),
 * sehingga tidak bergantung pada NEXT_PUBLIC_APP_URL. Mengembalikan null bila
 * layanan eksternal gagal agar halaman tetap bisa dirender.
 */
export async function fetchExternal<T = unknown>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T | null> {
  try {
    const response = await fetch(buildExternalUrl(endpoint, params), {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
