import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settings: {
    "log.loginRetentionDays": "90",
    "log.activityRetentionDays": "365",
  } as Record<string, string>,
  loginDelete: vi.fn(async (_args: unknown) => ({ count: 4 })),
  activityDelete: vi.fn(async (_args: unknown) => ({ count: 2 })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginLog: { deleteMany: h.loginDelete },
    activityLog: { deleteMany: h.activityDelete },
  },
}));
vi.mock("@/lib/settings", () => ({ getSettings: async () => h.settings }));

import {
  CONSENT_VERSION,
  exportAuditDetail,
  needsConsent,
  purgeExpiredData,
} from "@/lib/privacy";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T00:00:00.000Z"));
  h.loginDelete.mockClear();
  h.activityDelete.mockClear();
  h.settings["log.loginRetentionDays"] = "90";
  h.settings["log.activityRetentionDays"] = "365";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("needsConsent", () => {
  it("wajib bila belum pernah setuju atau versi berbeda", () => {
    expect(needsConsent({ consentedAt: null, consentVersion: null })).toBe(
      true
    );
    expect(
      needsConsent({ consentedAt: new Date(), consentVersion: "2020-01-01" })
    ).toBe(true);
    expect(
      needsConsent({ consentedAt: null, consentVersion: CONSENT_VERSION })
    ).toBe(true);
  });

  it("tidak wajib bila sudah menyetujui versi terbaru", () => {
    expect(
      needsConsent({ consentedAt: new Date(), consentVersion: CONSENT_VERSION })
    ).toBe(false);
  });
});

describe("purgeExpiredData (retensi)", () => {
  it("menghapus log yang lebih tua dari masa simpan", async () => {
    const r = await purgeExpiredData();
    expect(r.loginLogs).toBe(4);
    expect(r.activityLogs).toBe(2);
    const loginCut = (
      h.loginDelete.mock.calls[0][0] as {
        where: { createdAt: { lt: Date } };
      }
    ).where.createdAt.lt;
    expect(loginCut.toISOString()).toBe("2026-07-19T00:00:00.000Z"); // -90 hari
    expect(r.loginCutoff).toBe("2026-07-19T07:00:00.000+07:00");
    expect(r.activityCutoff).toMatch(/^2025-10-17T07:00:00\.000\+07:00$/);
  });

  it("0 / kosong / tidak valid = simpan tanpa batas (tidak menghapus)", async () => {
    h.settings["log.loginRetentionDays"] = "0";
    h.settings["log.activityRetentionDays"] = "abc";
    const r = await purgeExpiredData();
    expect(h.loginDelete).not.toHaveBeenCalled();
    expect(h.activityDelete).not.toHaveBeenCalled();
    expect(r).toEqual({
      loginLogs: 0,
      activityLogs: 0,
      loginCutoff: null,
      activityCutoff: null,
    });
  });
});

describe("exportAuditDetail", () => {
  it("menyamarkan email pada catatan aktivitas", () => {
    const s = exportAuditDetail("budi.santoso@up.ac.id");
    expect(s).toContain("b***@up.ac.id");
    expect(s).not.toContain("budi.santoso");
  });
});
