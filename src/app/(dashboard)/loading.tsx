import { PageSkeleton } from "@/components/ui/primitives";

/** Kerangka pemuatan untuk seluruh halaman dasbor (streaming UI). */
export default function DashboardLoading() {
  return <PageSkeleton cards={4} rows={6} />;
}
