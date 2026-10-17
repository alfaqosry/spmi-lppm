import { describe, expect, it, vi } from "vitest";
import {
  describeError,
  logError,
  logWarn,
  maskEmail,
  maskPhone,
  maskToken,
  redactText,
} from "@/lib/redact";

describe("maskEmail", () => {
  it("menyisakan huruf pertama + domain", () => {
    expect(maskEmail("budi@up.ac.id")).toBe("b***@up.ac.id");
    expect(maskEmail("  ani.s@x.id ")).toBe("a***@x.id");
  });

  it("menangani nilai kosong / tanpa @", () => {
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("")).toBe("");
    expect(maskEmail("x")).toBe("*");
    expect(maskEmail("budi")).toBe("b***");
    expect(maskEmail("@domain.id")).toBe("@***");
  });
});

describe("maskPhone", () => {
  it("menyisakan 4 digit awal & akhir", () => {
    expect(maskPhone("0812 3456 7890")).toBe("0812****7890");
  });

  it("nomor pendek / kosong", () => {
    expect(maskPhone("12345")).toBe("***");
    expect(maskPhone(undefined)).toBe("");
  });
});

describe("maskToken", () => {
  it("menampilkan 4 karakter awal + panjang", () => {
    expect(maskToken("abcdefghijkl")).toBe("abcd…(12)");
    expect(maskToken("short")).toBe("****");
    expect(maskToken(null)).toBe("");
  });
});

describe("redactText", () => {
  it("menyamarkan email & nomor telepon", () => {
    const out = redactText("login gagal budi.santoso@up.ac.id hp 081234567890");
    expect(out).not.toContain("budi.santoso@");
    expect(out).toContain("b***@up.ac.id");
    expect(out).not.toContain("081234567890");
    expect(out).toContain("0812****7890");
  });

  it("menyamarkan token Bearer & JWT", () => {
    const jwt = "eyJhbGciOiJI.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4";
    expect(redactText(`Authorization: Bearer abcdefgh12345678`)).not.toContain(
      "abcdefgh12345678"
    );
    expect(redactText(`token ${jwt}`)).toContain("[jwt]");
    expect(redactText(`token ${jwt}`)).not.toContain(jwt);
  });

  it("menyamarkan pasangan key=value rahasia", () => {
    const out = redactText(
      'password=hunter2 client_secret: "s3cr3t" code=abc&state=xyz'
    );
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("s3cr3t");
    expect(out).toContain("password=[redacted]");
    expect(out).toContain("state=xyz");
  });

  it("teks biasa tidak berubah", () => {
    expect(redactText("Siklus 2025 dibuka")).toBe("Siklus 2025 dibuka");
  });
});

describe("describeError", () => {
  it("meringkas Error beserta kode & menyamarkan pesan", () => {
    const e = Object.assign(new Error("duplikat budi@up.ac.id"), {
      code: "P2002",
    });
    const out = describeError(e);
    expect(out).toMatch(/^Error \[P2002\]: duplikat b\*\*\*@up\.ac\.id/);
    expect(out).not.toContain("budi@");
  });

  it("tanpa stack di produksi", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(describeError(new TypeError("x"))).toBe("TypeError: x");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("nilai non-Error dikonversi ke string tersamarkan", () => {
    expect(describeError("password=rahasia")).toBe("password=[redacted]");
    expect(describeError(42)).toBe("42");
  });

  it("memotong pesan sangat panjang", () => {
    expect(describeError("a".repeat(2000)).length).toBe(500);
  });
});

describe("logError / logWarn", () => {
  it("menyamarkan seluruh argumen sebelum dicetak", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logError("[tag]", "email budi@up.ac.id", new Error("token=abc123"));
    logWarn("[tag]", "hp 081234567890");
    expect(err).toHaveBeenCalledTimes(1);
    const errArgs = err.mock.calls[0].join(" ");
    expect(errArgs).not.toContain("budi@");
    expect(errArgs).not.toContain("abc123");
    expect(warn.mock.calls[0].join(" ")).not.toContain("081234567890");
  });
});
