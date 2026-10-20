/** URL halaman saat ini untuk siklus tertentu (`?cycleId=`). */
export function cycleHref(pathname: string, cycleId: number): string {
  const params = new URLSearchParams({ cycleId: String(cycleId) });
  return `${pathname || "/"}?${params.toString()}`;
}
