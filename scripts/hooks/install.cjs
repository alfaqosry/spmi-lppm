/**
 * Memasang git hooks proyek (commit-msg: Conventional Commits; pre-commit: Prettier + ESLint)
 * secara otomatis lewat skrip npm "prepare" — berjalan setiap `npm install` / `npm ci`,
 * sehingga setiap pengembang otomatis memakai hook yang sama tanpa langkah manual.
 *
 * Aman di lingkungan tanpa git (Docker build, arsip ZIP, CI tanpa .git): cukup dilewati.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
if (process.env.CI || !fs.existsSync(path.join(root, ".git"))) process.exit(0);

try {
  const current = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (current === "scripts/hooks") process.exit(0);
} catch {
  // belum diset → pasang
}

try {
  execFileSync("git", ["config", "core.hooksPath", "scripts/hooks"], {
    cwd: root,
    stdio: "ignore",
  });
  console.log("git hooks terpasang (core.hooksPath=scripts/hooks).");
} catch {
  // git tidak tersedia: lewati tanpa menggagalkan instalasi.
}
