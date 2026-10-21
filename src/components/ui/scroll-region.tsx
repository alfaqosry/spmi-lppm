/**
 * Wadah gulir horizontal untuk tabel lebar (layar sempit).
 *
 * WCAG 2.1.1 / axe `scrollable-region-focusable`: area yang dapat digulir harus bisa
 * dijangkau keyboard agar pengguna tanpa mouse dapat menggeser isinya (panah kiri/kanan).
 * Karena itu wadah diberi `tabIndex=0`, `role="region"`, dan nama aksesibel.
 */
export function ScrollRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      // Disengaja: region gulir WAJIB dapat difokus agar isinya bisa digeser dengan
      // keyboard (axe scrollable-region-focusable, WCAG 2.1.1).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={`overflow-x-auto rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
