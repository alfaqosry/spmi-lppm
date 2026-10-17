import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const upsert = vi.fn((args: unknown) => args);
const $transaction = vi.fn(async (ops: unknown[]) => ops);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appSetting: {
      findMany: (...a: unknown[]) => findMany(...a),
      upsert: (a: unknown) => upsert(a),
    },
    $transaction: (ops: unknown[]) => $transaction(ops),
  },
}));

import {
  getSettings,
  getSettingsForAdmin,
  getSiteName,
  isOn,
  saveSettings,
  SECRET_KEYS,
  SETTING_DEFAULTS,
} from "@/lib/settings";

beforeEach(() => {
  findMany.mockReset();
  upsert.mockClear();
  $transaction.mockClear();
  findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isOn", () => {
  it.each([
    ["true", true],
    ["1", true],
    ["on", true],
    ["false", false],
    ["TRUE", false],
    ["", false],
    [undefined, false],
  ])("isOn(%j) = %j", (v, expected) => {
    expect(isOn(v)).toBe(expected);
  });
});

describe("getSettings", () => {
  it("nilai DB menimpa default; key tak dikenal diabaikan", async () => {
    findMany.mockResolvedValue([
      { key: "site.name", value: "SPMI UP" },
      { key: "evil.key", value: "x" },
      { key: "site.shortName", value: null },
    ]);
    const s = await getSettings();
    expect(s["site.name"]).toBe("SPMI UP");
    expect(s["site.shortName"]).toBe(SETTING_DEFAULTS["site.shortName"]);
    expect((s as Record<string, string>)["evil.key"]).toBeUndefined();
  });

  it("fallback env untuk SSO bila kosong di DB", async () => {
    vi.stubEnv("SSO_CLIENT_ID", "env-client");
    findMany.mockResolvedValue([{ key: "sso.url", value: "https://db" }]);
    const s = await getSettings();
    expect(s["sso.clientId"]).toBe("env-client");
    expect(s["sso.url"]).toBe("https://db");
  });

  it("DB gagal -> tetap mengembalikan default", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("ECONNREFUSED"));
    const s = await getSettings();
    expect(s["site.name"]).toBe(SETTING_DEFAULTS["site.name"]);
    await expect(getSiteName()).resolves.toBe(SETTING_DEFAULTS["site.name"]);
  });
});

describe("getSettingsForAdmin", () => {
  it("nilai secret TIDAK pernah dikirim ke klien", async () => {
    findMany.mockResolvedValue([
      { key: "sso.clientSecret", value: "super-secret-value" },
    ]);
    const out = await getSettingsForAdmin();
    expect(JSON.stringify(out)).not.toContain("super-secret-value");
    expect(out["sso.clientSecret"]).toEqual({
      value: "••••••••",
      isSecret: true,
    });
    expect(out["site.name"].isSecret).toBe(false);
  });

  it("secret kosong ditampilkan kosong", async () => {
    const out = await getSettingsForAdmin();
    expect(out["sso.clientSecret"].value).toBe("");
  });
});

describe("saveSettings", () => {
  it("hanya key yang dikenal yang disimpan", async () => {
    await saveSettings(
      {
        "site.name": "Baru",
        ["__proto__" as never]: "x",
        ["role.admin" as never]: "x",
      },
      7
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      where: { key: "site.name" },
      create: { value: "Baru", isSecret: false, updatedBy: 7 },
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it("secret kosong / placeholder mask tidak menimpa nilai lama", async () => {
    for (const key of SECRET_KEYS) {
      await saveSettings({ [key]: "" });
      await saveSettings({ [key]: "   " });
      await saveSettings({ [key]: "••••••••" });
    }
    expect(upsert).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();

    await saveSettings({ "sso.clientSecret": "baru" });
    expect(upsert.mock.calls[0][0]).toMatchObject({
      create: { value: "baru", isSecret: true },
    });
  });
});
