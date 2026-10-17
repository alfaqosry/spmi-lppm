import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Zona waktu proses uji dipaksa UTC (diwarisi worker): hasil harus sama di
// server WIB maupun runner CI, dan membuktikan logika WIB tidak bergantung TZ server.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/report/**", "src/lib/actions/**"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
