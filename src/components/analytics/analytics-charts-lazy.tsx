"use client";

import dynamic from "next/dynamic";
import { ChartsSkeleton } from "@/components/charts/chart-panel";

/** Pemuat lazy untuk grafik analitik (recharts dipisah ke chunk tersendiri). */
export const AnalyticsChartsLazy = dynamic(
  () =>
    import("@/components/analytics/analytics-charts").then(
      (m) => m.AnalyticsCharts
    ),
  { ssr: false, loading: () => <ChartsSkeleton count={4} height="h-72" /> }
);
