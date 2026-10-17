import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Jangan menyentuh disk saat uji.
const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn(async (..._a: unknown[]) => undefined),
  writeFile: vi.fn(async (..._a: unknown[]) => undefined),
  stat: vi.fn(async (..._a: unknown[]): Promise<unknown> => {
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  }),
  unlink: vi.fn(async (..._a: unknown[]) => undefined),
}));
vi.mock("node:fs/promises", () => ({ ...fsMock, default: fsMock }));

import {
  deleteUpload,
  isProbablyPdf,
  locateUpload,
  MIME_BY_EXT,
  parseUploadPath,
  saveUpload,
  UPLOAD_FOLDERS,
  uploadRoot,
} from "@/lib/upload";

const ROOT = path.resolve(process.cwd(), "tmp-test-uploads");

const PDF = Buffer.from(
  "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n",
  "latin1"
);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
]);
const JPG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
]);
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00", "latin1");
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from("WEBPVP8 "),
]);
const ICO = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");

function file(content: Buffer | string, name: string, type = "") {
  return new File([content as BlobPart], name, { type });
}

beforeEach(() => {
  vi.stubEnv("UPLOAD_DIR", ROOT);
  for (const fn of Object.values(fsMock)) fn.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("uploadRoot", () => {
  it("memakai UPLOAD_DIR bila diatur", () => {
    expect(uploadRoot()).toBe(ROOT);
  });

  it("default <cwd>/storage/uploads (di luar /public)", () => {
    vi.stubEnv("UPLOAD_DIR", "  ");
    const root = uploadRoot();
    expect(root).toBe(path.resolve(process.cwd(), "storage", "uploads"));
    expect(root.includes(`${path.sep}public${path.sep}`)).toBe(false);
  });
});

describe("saveUpload — validasi masukan", () => {
  it("menolak file kosong / tidak ada", async () => {
    expect(await saveUpload(null as unknown as File, "bukti")).toMatchObject({
      ok: false,
    });
    expect(await saveUpload("x" as unknown as File, "bukti")).toMatchObject({
      ok: false,
    });
    expect(await saveUpload(file("", "a.pdf"), "bukti")).toEqual({
      ok: false,
      error: "File kosong.",
    });
  });

  it.each([
    "../../etc",
    "..",
    "bukti/../..",
    "uploads",
    "",
    "BUKTI",
    "/tmp",
    "bukti\\..\\..",
  ])(
    "menolak folder di luar whitelist (path traversal): %j",
    async (folder) => {
      const r = await saveUpload(file(PDF, "a.pdf"), folder);
      expect(r).toEqual({ ok: false, error: "Tujuan unggahan tidak valid." });
      expect(fsMock.writeFile).not.toHaveBeenCalled();
    }
  );

  it.each([
    "shell.php",
    "a.pdf.exe",
    "x.html",
    "x.svg",
    "noext",
    "a.PDF.js",
    ".pdf",
  ])("menolak ekstensi dokumen selain PDF: %s", async (name) => {
    const r = await saveUpload(file(PDF, name), "bukti");
    expect(r.ok).toBe(false);
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it.each([
    "text/html",
    "application/javascript",
    "image/svg+xml",
    "application/x-msdownload",
  ])("menolak MIME yang diklaim berbahaya: %s", async (type) => {
    const r = await saveUpload(file(PDF, "a.pdf", type), "bukti");
    expect(r).toEqual({ ok: false, error: "Tipe berkas tidak diizinkan." });
  });

  it.each(["", "application/pdf", "application/octet-stream"])(
    "menerima MIME umum untuk PDF: %j",
    async (type) => {
      expect((await saveUpload(file(PDF, "a.pdf", type), "bukti")).ok).toBe(
        true
      );
    }
  );

  it("menolak file > 10MB untuk dokumen", async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    PDF.copy(big);
    const r = await saveUpload(file(big, "big.pdf"), "bukti");
    expect(r).toMatchObject({
      ok: false,
      error: expect.stringMatching(/10MB/),
    });
  });
});

describe("saveUpload — konten PDF", () => {
  it("menolak berkas ber-ekstensi .pdf yang bukan PDF (magic bytes)", async () => {
    const r = await saveUpload(
      file(HTML, "palsu.pdf", "application/pdf"),
      "bukti"
    );
    expect(r).toEqual({ ok: false, error: "Berkas bukan PDF yang valid." });
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("menolak PDF sangat pendek", async () => {
    expect((await saveUpload(file("%PDF-1", "a.pdf"), "bukti")).ok).toBe(false);
  });

  it.each(["/JavaScript", "/Launch"])(
    "menolak PDF dengan aksi aktif %s",
    async (action) => {
      const evil = Buffer.concat([
        PDF,
        Buffer.from(`<< /OpenAction << /S ${action} >> >>`),
      ]);
      const r = await saveUpload(file(evil, "a.pdf"), "bukti");
      expect(r).toMatchObject({
        ok: false,
        error: expect.stringMatching(/skrip|aksi aktif/),
      });
      expect(fsMock.writeFile).not.toHaveBeenCalled();
    }
  );

  it("menyimpan dengan nama acak (tanpa nama asli) di dalam UPLOAD_DIR", async () => {
    for (const folder of ["bukti", "penetapan", "evaluasi"]) {
      const r = await saveUpload(
        file(PDF, "../../Laporan Rahasia <x>.PDF"),
        folder
      );
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.path).toMatch(
        new RegExp(`^/uploads/${folder}/\\d+-[0-9a-f-]{36}\\.pdf$`)
      );
      expect(r.path).not.toMatch(/Laporan|Rahasia|\.\./);
    }
    expect(fsMock.writeFile).toHaveBeenCalledTimes(3);
    const [abs, , opts] = fsMock.writeFile.mock.calls[0] as unknown as [
      string,
      Buffer,
      { flag: string },
    ];
    expect(path.resolve(abs).startsWith(ROOT + path.sep)).toBe(true);
    // Tidak menimpa berkas yang sudah ada.
    expect(opts.flag).toBe("wx");
  });

  it("kegagalan disk -> pesan generik (tanpa path internal)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fsMock.writeFile.mockRejectedValueOnce(
      new Error(`EACCES: permission denied, open '${ROOT}'`)
    );
    const r = await saveUpload(file(PDF, "a.pdf"), "bukti");
    expect(r).toEqual({
      ok: false,
      error: "Gagal menyimpan berkas. Silakan coba lagi.",
    });
  });
});

describe("saveUpload — gambar branding", () => {
  it.each([
    ["logo.png", PNG, "image/png"],
    ["logo.jpg", JPG, "image/jpeg"],
    ["logo.jpeg", JPG, ""],
    ["logo.gif", GIF, "image/gif"],
    ["logo.webp", WEBP, "image/webp"],
    ["favicon.ico", ICO, "image/x-icon"],
  ])("menerima %s dengan magic bytes yang cocok", async (name, buf, type) => {
    const r = await saveUpload(file(buf, name, type), "branding");
    expect(r.ok).toBe(true);
  });

  it("menolak SVG (berpotensi XSS)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    );
    expect(
      (await saveUpload(file(svg, "logo.svg", "image/svg+xml"), "branding")).ok
    ).toBe(false);
    expect(
      (await saveUpload(file(svg, "logo.png", "image/svg+xml"), "branding")).ok
    ).toBe(false);
  });

  it.each([
    ["logo.png", JPG],
    ["logo.jpg", PNG],
    ["logo.gif", HTML],
    ["logo.gif", Buffer.from("GIF00a\x01\x00\x01\x00\x00\x00", "latin1")],
    ["logo.webp", Buffer.from("RIFF0000WAVE")],
    ["logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ])("menolak %s dengan isi tidak cocok", async (name, buf) => {
    const r = await saveUpload(file(buf, name), "branding");
    expect(r).toMatchObject({ ok: false });
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("menolak PDF di folder branding & gambar di folder dokumen", async () => {
    expect((await saveUpload(file(PDF, "a.pdf"), "branding")).ok).toBe(false);
    expect((await saveUpload(file(PNG, "a.png"), "bukti")).ok).toBe(false);
  });

  it("batas ukuran gambar 2MB", async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    PNG.copy(big);
    const r = await saveUpload(file(big, "logo.png"), "branding");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/2MB/) });
  });
});

describe("parseUploadPath", () => {
  const NAME = "1700000000000-0f8fad5b-d9cb-469f-a165-70867728950e.pdf";

  it("mengurai path logis yang valid", () => {
    expect(parseUploadPath(`/uploads/bukti/${NAME}`)).toEqual({
      folder: "bukti",
      name: NAME,
      ext: ".pdf",
      logical: `/uploads/bukti/${NAME}`,
    });
    expect(parseUploadPath(["branding", "logo.png"])?.logical).toBe(
      "/uploads/branding/logo.png"
    );
  });

  it.each([
    "/uploads/../etc/passwd",
    "/uploads/bukti/../../.env",
    "/uploads/bukti/..%2F..%2F.env",
    "/uploads/bukti/a\\..\\b.pdf",
    "/uploads/bukti/a\u0000.pdf",
    "/uploads/bukti/.hidden.pdf",
    "/uploads/bukti/a..pdf",
    "/uploads/bukti/x.exe",
    "/uploads/bukti/x.png",
    "/uploads/branding/x.pdf",
    "/uploads/branding/x.svg",
    "/uploads/lain/x.pdf",
    "/uploads/bukti/sub/x.pdf",
    "uploads/bukti/x.pdf",
    "https://evil.example/uploads/bukti/x.pdf",
    "",
  ])("menolak %j", (input) => {
    expect(parseUploadPath(input)).toBeNull();
  });

  it("menolak segmen array yang tidak tepat dua", () => {
    expect(parseUploadPath(["bukti"])).toBeNull();
    expect(parseUploadPath(["bukti", "a", "b.pdf"])).toBeNull();
    expect(parseUploadPath(["..", "x.pdf"])).toBeNull();
  });

  it("menolak nama sangat panjang", () => {
    expect(parseUploadPath(["bukti", "a".repeat(250) + ".pdf"])).toBeNull();
  });
});

describe("locateUpload & deleteUpload", () => {
  const parsed = parseUploadPath("/uploads/bukti/abc.pdf")!;

  it("mencari di penyimpanan privat lebih dulu", async () => {
    fsMock.stat.mockResolvedValueOnce({
      isFile: () => true,
      size: 10,
      mtime: new Date(0),
    });
    const found = await locateUpload(parsed);
    expect(found?.absPath).toBe(path.resolve(ROOT, "bukti", "abc.pdf"));
    expect(found?.size).toBe(10);
  });

  it("fallback ke public/uploads lama", async () => {
    fsMock.stat
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValueOnce({
        isFile: () => true,
        size: 5,
        mtime: new Date(0),
      });
    const found = await locateUpload(parsed);
    expect(found?.absPath).toBe(
      path.resolve(process.cwd(), "public", "uploads", "bukti", "abc.pdf")
    );
  });

  it("null bila tidak ada / bukan berkas", async () => {
    fsMock.stat.mockResolvedValueOnce({
      isFile: () => false,
      size: 0,
      mtime: new Date(0),
    });
    expect(await locateUpload(parsed)).toBeNull();
  });

  it("deleteUpload mengabaikan path tidak valid (tanpa akses disk)", async () => {
    await deleteUpload("/uploads/../../.env");
    await deleteUpload(null);
    await deleteUpload("");
    expect(fsMock.stat).not.toHaveBeenCalled();
    expect(fsMock.unlink).not.toHaveBeenCalled();
  });

  it("deleteUpload menghapus berkas yang ditemukan", async () => {
    fsMock.stat.mockResolvedValueOnce({
      isFile: () => true,
      size: 1,
      mtime: new Date(0),
    });
    await deleteUpload("/uploads/bukti/abc.pdf");
    expect(fsMock.unlink).toHaveBeenCalledWith(
      path.resolve(ROOT, "bukti", "abc.pdf")
    );
  });
});

describe("konstanta", () => {
  it("whitelist folder & MIME penyajian", () => {
    expect([...UPLOAD_FOLDERS].sort()).toEqual([
      "branding",
      "bukti",
      "evaluasi",
      "penetapan",
    ]);
    expect(MIME_BY_EXT[".pdf"]).toBe("application/pdf");
    expect(MIME_BY_EXT[".svg"]).toBeUndefined();
    expect(MIME_BY_EXT[".html"]).toBeUndefined();
  });
});

describe("isProbablyPdf", () => {
  it("berdasarkan MIME atau ekstensi", () => {
    expect(isProbablyPdf(file("", "a.bin", "application/pdf"))).toBe(true);
    expect(isProbablyPdf(file("", "A.PDF"))).toBe(true);
    expect(isProbablyPdf(file("", "a.png", "image/png"))).toBe(false);
  });
});
