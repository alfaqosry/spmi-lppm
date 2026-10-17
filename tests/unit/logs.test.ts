import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settings: {
    "log.login.enabled": "true",
    "log.activity.enabled": "true",
  } as Record<string, string>,
  loginCreate: vi.fn(async (_a: { data: Record<string, unknown> }) => ({})),
  activityCreate: vi.fn(async (_a: { data: Record<string, unknown> }) => ({})),
  purge: vi.fn(async () => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginLog: { create: h.loginCreate },
    activityLog: { create: h.activityCreate },
  },
}));
vi.mock("@/lib/settings", () => ({
  getSettings: async () => h.settings,
  isOn: (v: string | undefined) => v === "true" || v === "1" || v === "on",
}));
vi.mock("@/lib/privacy", () => ({ purgeExpiredData: h.purge }));

import { recordActivity, recordLogin } from "@/lib/logs";

beforeEach(() => {
  h.loginCreate.mockClear();
  h.activityCreate.mockClear();
  h.settings["log.login.enabled"] = "true";
  h.settings["log.activity.enabled"] = "true";
});

describe("recordLogin", () => {
  it("menyamarkan email & pesan sebelum disimpan", async () => {
    await recordLogin({
      email: "budi.santoso@up.ac.id",
      success: false,
      ip: "203.0.113.7",
      message: "gagal untuk budi.santoso@up.ac.id password=hunter2",
    });
    const data = h.loginCreate.mock.calls[0][0].data;
    expect(data.email).toBe("b***@up.ac.id");
    expect(data.method).toBe("password");
    expect(String(data.message)).not.toMatch(/budi\.santoso|hunter2/);
  });

  it("memotong field panjang sesuai kolom", async () => {
    await recordLogin({
      email: "a@b.id",
      success: true,
      ip: "x".repeat(100),
      userAgent: "u".repeat(1000),
      message: "m".repeat(1000),
    });
    const data = h.loginCreate.mock.calls[0][0].data;
    expect(String(data.ip).length).toBe(64);
    expect(String(data.userAgent).length).toBe(400);
    expect(String(data.message).length).toBe(255);
  });

  it("tidak mencatat bila fitur dimatikan", async () => {
    h.settings["log.login.enabled"] = "false";
    await recordLogin({ email: "a@b.id", success: true });
    expect(h.loginCreate).not.toHaveBeenCalled();
  });

  it("best-effort: kegagalan DB tidak dilempar ke alur login", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.loginCreate.mockRejectedValueOnce(new Error("DB down"));
    await expect(
      recordLogin({ email: "a@b.id", success: true })
    ).resolves.toBeUndefined();
  });
});

describe("recordActivity", () => {
  it("menyimpan aktivitas dengan detail tersamarkan", async () => {
    await recordActivity({
      userId: 1,
      userName: "Budi",
      action: "user.update",
      entity: "user",
      entityId: 42,
      detail: "ubah email ke ani@up.ac.id hp 081234567890",
    });
    const data = h.activityCreate.mock.calls[0][0].data;
    expect(data.entityId).toBe("42");
    expect(String(data.detail)).not.toMatch(/ani@|081234567890/);
  });

  it("tidak mencatat bila fitur dimatikan & tidak melempar saat gagal", async () => {
    h.settings["log.activity.enabled"] = "false";
    await recordActivity({ action: "x" });
    expect(h.activityCreate).not.toHaveBeenCalled();

    h.settings["log.activity.enabled"] = "true";
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.activityCreate.mockRejectedValueOnce(new Error("DB down"));
    await expect(recordActivity({ action: "x" })).resolves.toBeUndefined();
  });
});
