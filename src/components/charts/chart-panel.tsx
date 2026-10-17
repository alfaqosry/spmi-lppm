/**
 * Panel grafik yang aksesibel: grafik visual disembunyikan dari pembaca
 * layar (role="img" + ringkasan) dan data aslinya tersedia sebagai tabel
 * tersembunyi visual (WCAG 1.1.1 alternatif teks untuk konten non-teks).
 */
export function ChartPanel({
  title,
  subtitle,
  rows,
  valueLabel = "Nilai",
  height = "h-64",
  children,
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; value: string | number }[];
  valueLabel?: string;
  height?: string;
  children: React.ReactNode;
}) {
  const summary = rows.length
    ? rows.map((r) => `${r.label}: ${r.value}`).join("; ")
    : "Belum ada data.";
  return (
    <figure className="card min-w-0 p-4">
      <figcaption className="mb-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </figcaption>
      <div
        role="img"
        aria-label={`${title}. ${summary}`}
        className={`${height} w-full`}
      >
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-600/40 text-xs text-slate-500">
            Belum ada data untuk ditampilkan.
          </div>
        ) : (
          <div aria-hidden="true" className="h-full w-full">
            {children}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Kategori</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Kerangka pemuatan grafik (ditampilkan selama chunk recharts dimuat). */
export function ChartsSkeleton({
  count = 4,
  height = "h-64",
}: {
  count?: number;
  height?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-busy="true">
      <span className="sr-only">Memuat grafik…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <div aria-hidden="true" className="skeleton mb-3 h-4 w-1/2" />
          <div aria-hidden="true" className={`skeleton ${height} w-full`} />
        </div>
      ))}
    </div>
  );
}
