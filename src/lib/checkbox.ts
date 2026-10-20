/**
 * Baca nilai checkbox HTML dari FormData.
 *
 * Browser HANYA mengirim field checkbox bila dicentang (nilainya `value`,
 * default "on"); checkbox yang tidak dicentang sama sekali tidak dikirim.
 * Karena itu pola `formData.get(key) !== "off"` selalu bernilai true —
 * akun tidak pernah bisa dinonaktifkan (TC-ROL-12). Fungsi ini menganggap
 * hanya nilai "dicentang" yang eksplisit sebagai true.
 */
export function checkboxField(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (typeof v !== "string") return false;
  return ["on", "true", "1"].includes(v.trim().toLowerCase());
}
