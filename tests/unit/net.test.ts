import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NetModule = typeof import("@/lib/net");

/** Muat ulang modul agar cache CIDR & env terbaca ulang. */
async function loadNet(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, "");
    else vi.stubEnv(k, v);
  }
  return (await import("@/lib/net")) as NetModule;
}

function headers(map: Record<string, string>) {
  const lower = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v])
  );
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

// Alamat contoh (RFC 5737 / RFC 3849) + IP edge Cloudflare yang sah.
const CLIENT = "203.0.113.7";
const SPOOF = "198.51.100.66";
const CF_EDGE = "172.70.1.2"; // 172.64.0.0/13
const CF_EDGE_V6 = "2606:4700::1";

let net: NetModule;

beforeEach(async () => {
  net = await loadNet({
    TRUST_PROXY: undefined,
    TRUSTED_PROXY_CIDRS: undefined,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeIp", () => {
  it("menerima IPv4 & IPv6 polos", () => {
    expect(net.normalizeIp("10.0.0.1")).toBe("10.0.0.1");
    expect(net.normalizeIp(" 2001:DB8::1 ")).toBe("2001:db8::1");
    expect(net.normalizeIp("::1")).toBe("::1");
  });

  it("membuang port, kurung siku, dan zona", () => {
    expect(net.normalizeIp("1.2.3.4:5678")).toBe("1.2.3.4");
    expect(net.normalizeIp("[::1]:80")).toBe("::1");
    expect(net.normalizeIp("fe80::1%eth0")).toBe("fe80::1");
  });

  it("mengubah IPv4-mapped menjadi IPv4", () => {
    expect(net.normalizeIp("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(net.normalizeIp("::FFFF:192.0.2.1")).toBe("192.0.2.1");
  });

  it("menolak nilai tidak valid / kosong", () => {
    expect(net.normalizeIp(null)).toBeNull();
    expect(net.normalizeIp(undefined)).toBeNull();
    expect(net.normalizeIp("")).toBeNull();
    expect(net.normalizeIp("   ")).toBeNull();
    expect(net.normalizeIp("256.1.1.1")).toBeNull();
    expect(net.normalizeIp("1.2.3")).toBeNull();
    expect(net.normalizeIp("localhost")).toBeNull();
    expect(net.normalizeIp("1::2::3")).toBeNull();
    expect(net.normalizeIp("<script>")).toBeNull();
  });
});

describe("isTrustedProxy", () => {
  it("mengenali rentang Cloudflare IPv4 & IPv6", () => {
    expect(net.isTrustedProxy(CF_EDGE)).toBe(true);
    expect(net.isTrustedProxy("104.16.0.1")).toBe(true);
    expect(net.isTrustedProxy(CF_EDGE_V6)).toBe(true);
  });

  it("menolak IP non-Cloudflare & nilai kosong", () => {
    expect(net.isTrustedProxy(CLIENT)).toBe(false);
    expect(net.isTrustedProxy("127.0.0.1")).toBe(false);
    expect(net.isTrustedProxy("2001:db8::1")).toBe(false);
    expect(net.isTrustedProxy(null)).toBe(false);
    expect(net.isTrustedProxy("bukan-ip")).toBe(false);
  });

  it("menambahkan CIDR dari TRUSTED_PROXY_CIDRS", async () => {
    const n = await loadNet({ TRUSTED_PROXY_CIDRS: "10.0.0.0/8, bogus/99" });
    expect(n.isTrustedProxy("10.20.30.40")).toBe(true);
    expect(n.isTrustedProxy("11.0.0.1")).toBe(false);
  });
});

describe("clientIpFromHeaders (mode cloudflare, default)", () => {
  it("memakai CF-Connecting-IP bila hop terakhir adalah edge Cloudflare", () => {
    const h = headers({
      "x-forwarded-for": `${SPOOF}, ${CF_EDGE}`,
      "cf-connecting-ip": CLIENT,
    });
    expect(net.clientIpFromHeaders(h)).toBe(CLIENT);
  });

  it("MENGABAIKAN CF-Connecting-IP palsu bila tidak lewat Cloudflare", () => {
    const h = headers({
      "x-forwarded-for": `${SPOOF}, ${CLIENT}`,
      "cf-connecting-ip": "1.1.1.1",
    });
    // Hop terakhir (ditambahkan IIS) adalah yang dipercaya.
    expect(net.clientIpFromHeaders(h)).toBe(CLIENT);
  });

  it("tanpa CF-Connecting-IP: ambil hop sebelum proxy tepercaya", () => {
    const h = headers({ "x-forwarded-for": `${CLIENT}, ${CF_EDGE}` });
    expect(net.clientIpFromHeaders(h)).toBe(CLIENT);
  });

  it("fallback ke X-Real-IP lalu 'unknown'", () => {
    expect(net.clientIpFromHeaders(headers({ "x-real-ip": CLIENT }))).toBe(
      CLIENT
    );
    expect(net.clientIpFromHeaders(headers({}))).toBe("unknown");
    expect(
      net.clientIpFromHeaders(headers({ "x-forwarded-for": "sampah" }))
    ).toBe("unknown");
  });
});

describe("clientIpFromHeaders (mode lain)", () => {
  it("TRUST_PROXY=none mengabaikan seluruh header proxy", async () => {
    const n = await loadNet({ TRUST_PROXY: "none" });
    const h = headers({
      "x-forwarded-for": CLIENT,
      "cf-connecting-ip": CLIENT,
    });
    expect(n.clientIpFromHeaders(h)).toBe("unknown");
  });

  it("TRUST_PROXY=xff hanya memakai hop terakhir", async () => {
    const n = await loadNet({ TRUST_PROXY: "xff" });
    const h = headers({
      "x-forwarded-for": `${SPOOF}, ${CF_EDGE}`,
      "cf-connecting-ip": CLIENT,
    });
    expect(n.clientIpFromHeaders(h)).toBe(CF_EDGE);
  });
});
