import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  checkText,
  cleanText,
  dateField,
  emailField,
  fileField,
  idField,
  intField,
  LIMITS,
  oneOf,
  parseId,
  requireId,
  str,
} from "@/lib/validate";

function fd(entries: Record<string, string | File>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("cleanText", () => {
  it("mengganti karakter kontrol dengan spasi (satu baris)", () => {
    expect(cleanText("a\u0000b\nc\td")).toBe("a b c d");
  });

  it("mempertahankan baris baru & tab pada mode multiline", () => {
    expect(cleanText("a\u0007b\nc\td\r\n", true)).toBe("ab\nc\td\r\n");
  });

  it("menormalisasi Unicode ke NFC", () => {
    const decomposed = "é"; // e + combining acute
    expect(cleanText(decomposed)).toBe("é");
  });
});

describe("str", () => {
  it("trim & batas panjang", () => {
    expect(str(fd({ n: "  Unit A  " }), "n", { max: 10 })).toBe("Unit A");
    expect(() => str(fd({ n: "x".repeat(11) }), "n", { max: 10 })).toThrow(
      /terlalu panjang/
    );
  });

  it("wajib diisi", () => {
    expect(() =>
      str(fd({ n: "   " }), "n", { max: 10, required: true, label: "Nama" })
    ).toThrow("Nama wajib diisi.");
    expect(str(fd({}), "n", { max: 10 })).toBe("");
  });

  it("menolak File di field teks", () => {
    const f = fd({ n: new File(["x"], "a.txt") });
    expect(() => str(f, "n", { max: 10 })).toThrow(AppError);
  });
});

describe("checkText", () => {
  it("memvalidasi nilai non-FormData", () => {
    expect(checkText("  ok ", { max: 5 })).toBe("ok");
    expect(checkText(null, { max: 5 })).toBe("");
    expect(() => checkText("", { max: 5, required: true })).toThrow(
      /wajib diisi/
    );
    expect(() => checkText("abcdef", { max: 5 })).toThrow(/maksimal 5/);
  });
});

describe("parseId / requireId / idField", () => {
  it.each([
    [1, 1],
    ["42", 42],
    [" 7 ", 7],
    [2147483647, 2147483647],
  ])("parseId(%j) -> %j", (input, expected) => {
    expect(parseId(input)).toBe(expected);
  });

  it.each([null, undefined, "", 0, -1, 1.5, "1e3x", "abc", 2147483648, NaN])(
    "parseId(%j) -> null",
    (input) => {
      expect(parseId(input)).toBeNull();
    }
  );

  it("requireId melempar AppError", () => {
    expect(requireId("5")).toBe(5);
    expect(() => requireId("x", "Unit")).toThrow("Unit tidak valid.");
  });

  it("idField: kosong -> null, invalid -> AppError", () => {
    expect(idField(fd({}), "id")).toBeNull();
    expect(idField(fd({ id: "" }), "id")).toBeNull();
    expect(idField(fd({ id: "9" }), "id")).toBe(9);
    expect(() => idField(fd({ id: "1 OR 1=1" }), "id")).toThrow(AppError);
  });
});

describe("intField", () => {
  const opts = { min: 1, max: 30, fallback: 7 };
  it("fallback bila kosong, validasi rentang", () => {
    expect(intField(fd({}), "d", opts)).toBe(7);
    expect(intField(fd({ d: "14" }), "d", opts)).toBe(14);
    expect(() => intField(fd({ d: "0" }), "d", opts)).toThrow(AppError);
    expect(() => intField(fd({ d: "31" }), "d", opts)).toThrow(AppError);
    expect(() => intField(fd({ d: "2.5" }), "d", opts)).toThrow(AppError);
  });
});

describe("oneOf", () => {
  const roles = ["lpm_admin", "lpm_member"] as const;
  it("hanya menerima nilai dalam whitelist", () => {
    expect(oneOf("lpm_admin", roles)).toBe("lpm_admin");
    expect(() => oneOf("superadmin", roles)).toThrow("Pilihan tidak valid.");
    expect(() => oneOf(undefined, roles, "Peran salah")).toThrow("Peran salah");
  });
});

describe("emailField", () => {
  it("menormalisasi ke huruf kecil", () => {
    expect(emailField(fd({ email: " Budi@UP.ac.id " }))).toBe("budi@up.ac.id");
  });

  it.each(["", "budi", "budi@", "budi@up", "a b@up.ac.id", "budi@up.c"])(
    "menolak email tidak valid: %j",
    (email) => {
      expect(() => emailField(fd({ email }))).toThrow(AppError);
    }
  );

  it("menolak email melebihi batas panjang", () => {
    const email = "a".repeat(LIMITS.email) + "@up.ac.id";
    expect(() => emailField(fd({ email }))).toThrow(/terlalu panjang/);
  });
});

describe("dateField", () => {
  it("mengubah YYYY-MM-DD menjadi Date UTC tengah malam", () => {
    const d = dateField(fd({ t: "2025-06-30" }), "t", "Tanggal");
    expect(d.toISOString()).toBe("2025-06-30T00:00:00.000Z");
  });

  it.each(["", "30-06-2025", "2025/06/30", "2025-6-30", "2025-13-01"])(
    "menolak format tidak valid: %j",
    (v) => {
      expect(() => dateField(fd({ t: v }), "t", "Tanggal")).toThrow(AppError);
    }
  );

  it("menolak tahun di luar 2000–2100", () => {
    expect(() => dateField(fd({ t: "1999-12-31" }), "t", "Tanggal")).toThrow(
      /di luar rentang/
    );
    expect(() => dateField(fd({ t: "2101-01-01" }), "t", "Tanggal")).toThrow(
      /di luar rentang/
    );
  });
});

describe("fileField", () => {
  it("mengembalikan File non-kosong saja", () => {
    const file = new File(["%PDF-"], "a.pdf", { type: "application/pdf" });
    expect(fileField(fd({ file }))).toBeInstanceOf(File);
    expect(fileField(fd({ file: new File([], "empty.pdf") }))).toBeNull();
    expect(fileField(fd({ file: "teks" }))).toBeNull();
    expect(fileField(fd({}))).toBeNull();
  });
});
