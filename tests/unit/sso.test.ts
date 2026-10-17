import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settings: Record<string, string> = {};
vi.mock("@/lib/settings", () => ({
  getSettings: async () => settings,
  isOn: (v: string | undefined) => v === "true" || v === "1" || v === "on",
}));

import {
  getSsoRuntimeConfig,
  getSsoUrl,
  isSsoConfigured,
  resolveLocalRole,
  SSO_DEFAULT_URL,
  type SsoIdentity,
} from "@/lib/sso";

const identity = (over: Partial<SsoIdentity> = {}): SsoIdentity => ({
  username: "budi",
  email: "budi@up.ac.id",
  name: "Budi",
  sub: "123",
  role: "",
  ...over,
});

beforeEach(() => {
  for (const k of Object.keys(settings)) delete settings[k];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveLocalRole", () => {
  it("email di whitelist admin -> lpm_admin (case-insensitive)", () => {
    expect(
      resolveLocalRole(identity({ email: "Budi@UP.ac.id" }), ["budi@up.ac.id"])
    ).toBe("lpm_admin");
  });

  it("selain whitelist -> pengunjung", () => {
    expect(resolveLocalRole(identity(), ["lain@up.ac.id"])).toBe("pengunjung");
    expect(resolveLocalRole(identity({ email: "" }), [""])).toBe("pengunjung");
  });

  it("TIDAK mempercayai klaim role admin dari SSO secara default", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const role of ["admin", "LPM", "lpm_admin"]) {
      expect(resolveLocalRole(identity({ role }), [])).toBe("pengunjung");
    }
    expect(warn).toHaveBeenCalled();
  });

  it("klaim role hanya dipercaya bila SSO_TRUST_ROLE=true", () => {
    vi.stubEnv("SSO_TRUST_ROLE", "true");
    expect(resolveLocalRole(identity({ role: "admin" }), [])).toBe("lpm_admin");
    vi.stubEnv("SSO_TRUST_ROLE", "1");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveLocalRole(identity({ role: "admin" }), [])).toBe(
      "pengunjung"
    );
  });

  it("role non-admin tidak pernah dinaikkan", () => {
    vi.stubEnv("SSO_TRUST_ROLE", "true");
    expect(resolveLocalRole(identity({ role: "mahasiswa" }), [])).toBe(
      "pengunjung"
    );
  });
});

describe("getSsoRuntimeConfig", () => {
  it("memakai default bila belum diatur", async () => {
    const cfg = await getSsoRuntimeConfig();
    expect(cfg.url).toBe(SSO_DEFAULT_URL);
    expect(cfg.enabled).toBe(false);
    expect(cfg.scope).toBe("*");
    expect(cfg.adminEmails).toEqual([]);
    await expect(isSsoConfigured()).resolves.toBe(false);
  });

  it("membuang slash di akhir URL & mem-parsing daftar email admin", async () => {
    Object.assign(settings, {
      "sso.enabled": "true",
      "sso.url": "https://sso.example.ac.id///",
      "sso.clientId": "id",
      "sso.clientSecret": "secret",
      "sso.adminEmails": " A@UP.ac.id, ,b@up.ac.id ",
    });
    const cfg = await getSsoRuntimeConfig();
    expect(cfg.url).toBe("https://sso.example.ac.id");
    expect(cfg.adminEmails).toEqual(["a@up.ac.id", "b@up.ac.id"]);
    await expect(isSsoConfigured()).resolves.toBe(true);
    await expect(getSsoUrl()).resolves.toBe("https://sso.example.ac.id");
  });

  it("produksi: redirect URI tidak pernah default ke localhost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    Object.assign(settings, {
      "sso.enabled": "true",
      "sso.clientId": "id",
      "sso.clientSecret": "secret",
    });
    const cfg = await getSsoRuntimeConfig();
    expect(cfg.redirectUri).toBe("");
    await expect(isSsoConfigured()).resolves.toBe(false);

    settings["sso.redirectUri"] = "https://spmi.example.ac.id/api/sso/callback";
    await expect(isSsoConfigured()).resolves.toBe(true);
  });

  it("log peringatan klaim admin tidak memuat email utuh", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resolveLocalRole(identity({ role: "admin", email: "budi@up.ac.id" }), []);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("budi@");
  });

  it("SSO aktif tetapi tanpa secret dianggap belum terkonfigurasi", async () => {
    Object.assign(settings, { "sso.enabled": "true", "sso.clientId": "id" });
    await expect(isSsoConfigured()).resolves.toBe(false);
  });
});
