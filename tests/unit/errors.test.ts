import { describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import {
  AppError,
  fail,
  isSafeHttpUrl,
  jsonError,
  toActionError,
} from "@/lib/errors";

describe("AppError & fail", () => {
  it("fail() melempar AppError dengan pesan yang dikurasi", () => {
    expect(() => fail("Unit tidak ditemukan.")).toThrow(AppError);
    try {
      fail("Unit tidak ditemukan.");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as AppError).name).toBe("AppError");
      expect((e as AppError).message).toBe("Unit tidak ditemukan.");
    }
  });
});

describe("toActionError", () => {
  it("meneruskan pesan AppError apa adanya", () => {
    expect(toActionError(new AppError("Pesan aman"))).toBe("Pesan aman");
  });

  it("TIDAK membocorkan pesan error internal ke klien", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const msg = toActionError(
      new Error("Unknown column 'users.password_hash' in 'field list'")
    );
    expect(msg).not.toMatch(/password_hash|column/);
    expect(msg).toBe("Terjadi kesalahan. Silakan coba lagi.");
    expect(spy).toHaveBeenCalled();
  });

  it("mendukung pesan fallback kustom & nilai non-Error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toActionError("boom", "Gagal menyimpan.")).toBe("Gagal menyimpan.");
    expect(toActionError(undefined)).toBe(
      "Terjadi kesalahan. Silakan coba lagi."
    );
  });
});

describe("toActionError — error Prisma & internal Next.js", () => {
  it.each([
    ["P2002", /sudah ada/],
    ["P2003", /terkait/],
    ["P2025", /tidak ditemukan/],
  ])("memetakan kode Prisma %s ke pesan aman", (code, re) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = Object.assign(
      new Error("Unique constraint failed on users_email_key"),
      { code }
    );
    const msg = toActionError(e);
    expect(msg).toMatch(re);
    expect(msg).not.toMatch(/users_email_key/);
  });

  it("kode Prisma lain / bukan kode Prisma memakai fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e1 = Object.assign(new Error("x"), { code: "P1001" });
    const e2 = Object.assign(new Error("x"), { code: "ECONNREFUSED" });
    expect(toActionError(e1, "fb")).toBe("fb");
    expect(toActionError(e2, "fb")).toBe("fb");
  });

  it("log server disamarkan (tanpa email)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    toActionError(new Error("gagal untuk budi@up.ac.id"));
    expect(spy.mock.calls.flat().join(" ")).not.toContain("budi@");
  });

  it("melempar ulang redirect()/notFound() Next.js (tidak ditelan)", () => {
    let redirectErr: unknown;
    try {
      redirect("/login");
    } catch (e) {
      redirectErr = e;
    }
    expect(() => toActionError(redirectErr)).toThrow();

    let notFoundErr: unknown;
    try {
      notFound();
    } catch (e) {
      notFoundErr = e;
    }
    expect(() => toActionError(notFoundErr)).toThrow();
  });
});

describe("jsonError", () => {
  it("membuat respons JSON tanpa cache dengan status yang diberikan", async () => {
    const res = jsonError("Terlalu banyak permintaan.", 429, {
      "Retry-After": "30",
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("retry-after")).toBe("30");
    expect(await res.json()).toEqual({ error: "Terlalu banyak permintaan." });
  });
});

describe("isSafeHttpUrl", () => {
  it("mengizinkan http/https dan nilai kosong", () => {
    expect(isSafeHttpUrl("")).toBe(true);
    expect(isSafeHttpUrl("https://drive.google.com/file/d/abc")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("HTTPS://EXAMPLE.COM/x")).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "mailto:a@b.c",
  ])("menolak skema berbahaya/non-http: %s", (url) => {
    expect(isSafeHttpUrl(url)).toBe(false);
  });

  it("menolak kredensial tertanam (phishing userinfo)", () => {
    expect(isSafeHttpUrl("https://user:pass@example.com")).toBe(false);
    expect(isSafeHttpUrl("https://google.com@evil.example/")).toBe(false);
  });

  it("menolak URL relatif / tidak valid", () => {
    expect(isSafeHttpUrl("/uploads/x.pdf")).toBe(false);
    expect(isSafeHttpUrl("example.com")).toBe(false);
    expect(isSafeHttpUrl("http//broken")).toBe(false);
  });
});
