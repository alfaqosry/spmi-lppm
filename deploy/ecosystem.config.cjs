// PM2 untuk spmi.universitaspahlawan.ac.id (produksi).
// IIS (ARR) -> 127.0.0.1:3002 -> Next.js standalone (server.js) di <SPMI_HOME>/current.
// Variabel lingkungan dibaca dari <SPMI_HOME>/shared/.env (tidak pernah di repo).
// CATATAN: pakai garis miring maju — PM2 di Windows merusak backslash.
const fs = require("fs");
const path = require("path");

const HOME = (process.env.SPMI_HOME || "E:/www/spmi-prod").replace(/\\/g, "/");

function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = val;
  }
  return env;
}

function releaseVersion() {
  try {
    return (
      JSON.parse(
        fs
          .readFileSync(`${HOME}/current/release.json`, "utf8")
          .replace(/^﻿/, "")
      ).version || ""
    );
  } catch {
    return "";
  }
}

module.exports = {
  apps: [
    {
      name: "spmi",
      script: "server.js",
      // Node LTS khusus SPMI (<SPMI_HOME>/runtime/node = junction ke versi aktif);
      // tidak bergantung pada Node global server yang dipakai aplikasi lain.
      interpreter: fs.existsSync(`${HOME}/runtime/node/node.exe`)
        ? `${HOME}/runtime/node/node.exe`
        : "node",
      cwd: `${HOME}/current`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 3000,
      max_memory_restart: "768M",
      kill_timeout: 8000,
      env: {
        ...readEnv(path.join(HOME, "shared", ".env")),
        NODE_ENV: "production",
        PORT: "3002",
        HOSTNAME: "127.0.0.1",
        NEXT_TELEMETRY_DISABLED: "1",
        TZ: "Asia/Jakarta",
        APP_VERSION: releaseVersion(),
      },
      out_file: `${HOME}/logs/pm2-out.log`,
      error_file: `${HOME}/logs/pm2-error.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
