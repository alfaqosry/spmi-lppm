"use client";

import dynamic from "next/dynamic";
import { ChartsSkeleton } from "@/components/charts/chart-panel";

/**
 * Pemuat lazy untuk grafik dasbor: recharts (~100 kB gz) dipisah ke chunk
 * tersendiri dan hanya dimuat di klien setelah halaman tampil, sehingga
 * tidak membebani first load JS / LCP.
 */
export const DashboardChartsLazy = dynamic(
  () =>
    import("@/components/dashboard/dashboard-charts").then(
      (m) => m.DashboardCharts
    ),
  { ssr: false, loading: () => <ChartsSkeleton count={4} /> }
);
