import Image from "next/image";

/**
 * Logo institusi (unggahan admin) atau monogram bila belum ada.
 *
 * Memakai next/image dengan dimensi eksplisit (mencegah CLS) dan
 * `priority` untuk logo di atas lipatan (LCP). Berkas branding disajikan
 * secara dinamis (route handler unggahan, format bisa SVG/ICO), sehingga
 * optimasi bawaan dimatikan (`unoptimized`) agar tidak bergantung pada
 * konfigurasi `images.localPatterns`.
 */
export function Logo({
  src,
  name,
  shortName,
  size = 36,
  priority = false,
  decorative = false,
  className = "",
}: {
  src?: string | null;
  name: string;
  shortName: string;
  size?: number;
  priority?: boolean;
  /** true bila nama situs sudah tertulis di sebelah logo (hindari duplikasi bagi pembaca layar). */
  decorative?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={decorative ? "" : `Logo ${name}`}
        width={size}
        height={size}
        sizes={`${size}px`}
        priority={priority}
        unoptimized
        className={`shrink-0 object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `Logo ${name}`}
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-on-accent shadow-lg shadow-indigo-900/30 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {shortName.slice(0, 2).toUpperCase()}
    </div>
  );
}
