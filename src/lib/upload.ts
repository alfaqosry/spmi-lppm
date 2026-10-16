import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Folder unggahan yang diizinkan (whitelist). Nilai `folder` berasal dari input
 * pengguna, sehingga WAJIB dibatasi untuk mencegah path traversal.
 */
const ALLOWED_FOLDERS = new Set(["bukti", "penetapan", "evaluasi", "branding"]);

/** Ekstensi dokumen yang diizinkan (hanya PDF — file pasif). */
const DOC_EXT = new Set([".pdf"]);

/**
 * Ekstensi gambar yang diizinkan untuk aset branding (logo/favicon).
 * SENGAJA TIDAK menyertakan .svg karena SVG dapat memuat skrip (XSS).
 */
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico", ".gif"]);

/** Folder yang hanya menerima gambar (aset branding). */
const IMAGE_FOLDERS = new Set(["branding"]);

/** Batas ukuran khusus gambar branding (2MB). */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/** Deteksi tipe gambar dari magic bytes (mencegah file palsu ber-ekstensi gambar). */
function isRealImage(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 12) return false;
  const b = buffer;
  const isPng =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isGif = b.subarray(0, 3).toString("latin1") === "GIF";
  const isWebp =
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP";
  const isIco = b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00;

  switch (ext) {
    case ".png":
      return isPng;
    case ".jpg":
    case ".jpeg":
      return isJpg;
    case ".gif":
      return isGif;
    case ".webp":
      return isWebp;
    case ".ico":
      return isIco;
    default:
      return false;
  }
}

/**
 * Simpan file unggahan ke /public/uploads/<folder>/ dan kembalikan path publik.
 * Folder & ekstensi divalidasi ketat (anti path traversal & anti XSS).
 */
export async function saveUpload(
  file: File,
  folder: string
): Promise<UploadResult> {
  if (!file || typeof file === "string") {
    return { ok: false, error: "File tidak ditemukan." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File kosong." };
  }

  // 1) Whitelist folder — cegah path traversal ("../../etc").
  if (!ALLOWED_FOLDERS.has(folder)) {
    return { ok: false, error: "Tujuan unggahan tidak valid." };
  }

  const imageMode = IMAGE_FOLDERS.has(folder);
  const maxBytes = imageMode ? IMAGE_MAX_BYTES : MAX_BYTES;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `Ukuran file melebihi ${Math.round(maxBytes / 1024 / 1024)}MB.`,
    };
  }

  // 2) Whitelist ekstensi — cegah unggahan file yang dapat dieksekusi.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = path.extname(safeName).toLowerCase();
  const allowedExt = imageMode ? IMAGE_EXT : DOC_EXT;
  if (!allowedExt.has(ext)) {
    return {
      ok: false,
      error: imageMode
        ? "Tipe gambar tidak diizinkan. Gunakan PNG, JPG, WEBP, GIF, atau ICO."
        : "Tipe file tidak diizinkan. Hanya berkas PDF yang diperbolehkan.",
    };
  }

  const base = path.basename(safeName, ext).slice(0, 60) || "file";
  const fileName = `${Date.now()}-${base}-${randomUUID().slice(0, 8)}${ext}`;

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  // Pastikan path akhir benar-benar berada di dalam folder unggahan.
  const resolved = path.resolve(dir, fileName);
  const root = path.resolve(process.cwd(), "public", "uploads");
  if (!resolved.startsWith(root + path.sep)) {
    return { ok: false, error: "Tujuan unggahan tidak valid." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 3) Verifikasi konten sesuai tipe (magic bytes).
  if (imageMode) {
    if (!isRealImage(buffer, ext)) {
      return { ok: false, error: "Berkas bukan gambar yang valid." };
    }
  } else if (
    buffer.length < 5 ||
    buffer.subarray(0, 5).toString("latin1") !== "%PDF-"
  ) {
    return { ok: false, error: "Berkas bukan PDF yang valid." };
  }

  await mkdir(dir, { recursive: true });
  await writeFile(resolved, buffer);

  return { ok: true, path: `/uploads/${folder}/${fileName}` };
}

export function isProbablyPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}
