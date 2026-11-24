/**
 * Ekspor tabel ke CSV tanpa dependensi tambahan.
 *
 * Memakai pemisah `;` dan BOM UTF-8 karena Excel di lingkungan Windows
 * berbahasa Indonesia memakai `;` sebagai pemisah daftar dan tanpa BOM
 * karakter non-ASCII (mis. `—`, `é`) akan rusak.
 */

const AMAN = /^[=+\-@\t\r]/;

/** Bungkus satu sel: kutip bila mengandung pemisah, kutip, atau baris baru. */
function sel(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  // Cegah formula injection: sel yang diawali = + - @ diperlakukan sebagai teks.
  const teks = AMAN.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

/**
 * Unduh data sebagai berkas CSV.
 *
 * @param namaBerkas nama tanpa ekstensi, mis. `"monev-prodi-mahasiswa"`.
 */
export function unduhCsv(
  namaBerkas: string,
  kolom: string[],
  baris: (string | number | null | undefined)[][]
): void {
  const isi = [kolom, ...baris].map((r) => r.map(sel).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${isi}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${namaBerkas}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  // Beri waktu browser memulai unduhan sebelum objek dibebaskan.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
