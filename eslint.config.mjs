// ESLint flat config (Next.js 16: `next lint` dihapus — gunakan ESLint CLI).
// Lihat: node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Aksesibilitas: aturan `recommended` jsx-a11y penuh (eslint-config-next hanya
  // mengaktifkan sebagian). Plugin `jsx-a11y` sudah didaftarkan oleh
  // eslint-config-next, jadi di sini hanya menambahkan rules (tanpa `plugins`)
  // agar tidak terjadi "Cannot redefine plugin".
  {
    name: "spmi/jsx-a11y-recommended",
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  {
    name: "spmi/rules",
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Berkas CommonJS (mis. deploy/ecosystem.config.cjs untuk PM2) memang memakai require().
  {
    name: "spmi/commonjs",
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Uji: izinkan pola umum pada test/fixture.
  {
    name: "spmi/tests",
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },

  // Matikan aturan gaya yang bentrok dengan Prettier (harus paling akhir).
  prettier,

  globalIgnores([
    // Default ignores eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tambahan:
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "public/**",
    "storage/**",
  ]),
]);

export default eslintConfig;
