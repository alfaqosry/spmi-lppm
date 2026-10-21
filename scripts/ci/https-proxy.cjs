/**
 * Proxy HTTPS sederhana untuk uji E2E di CI (BUKAN untuk produksi).
 *
 * Mengapa: cookie sesi produksi memakai prefix __Host- + Secure. WebKit (Safari) tidak
 * pernah menyimpan cookie Secure dari server http — bahkan di localhost — sehingga
 * alur login lintas halaman hanya bisa diuji realistis lewat HTTPS, seperti produksi
 * (Cloudflare -> IIS -> Next.js).
 *
 * Pemakaian: node scripts/ci/https-proxy.cjs <cert.pem> <key.pem> [port=3443] [upstream=http://127.0.0.1:3002]
 * Meneruskan Host asli dan menambahkan X-Forwarded-Proto: https (seperti IIS ARR).
 */
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const [certPath, keyPath, portArg, upstreamArg] = process.argv.slice(2);
if (!certPath || !keyPath) {
  console.error(
    "Pemakaian: https-proxy.cjs <cert.pem> <key.pem> [port] [upstream]"
  );
  process.exit(2);
}
const port = Number(portArg || 3443);
const upstream = new URL(upstreamArg || "http://127.0.0.1:3002");

const server = https.createServer(
  { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
  (req, res) => {
    const proxied = http.request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-forwarded-proto": "https" },
      },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      }
    );
    proxied.on("error", (e) => {
      if (!res.headersSent)
        res.writeHead(502, { "content-type": "text/plain" });
      res.end(`Proxy error: ${e.message}`);
    });
    req.pipe(proxied);
  }
);

server.listen(port, "0.0.0.0", () => {
  console.log(`https-proxy: https://localhost:${port} -> ${upstream.origin}`);
});
