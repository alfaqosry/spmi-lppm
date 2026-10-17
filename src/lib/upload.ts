import { mkdir, writeFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logError } from "@/lib/redact";
import { prisma } from "@/lib/prisma";

/* =====================================================================
   Penyimpanan unggahan (PRIVAT)
   ---------------------------------------------------------------------
   Berkas disimpan di luar /public pada direktori `UPLOAD_DIR`
   (default: <cwd>/storage/uploads) dan HANYA disajikan lewat route handler
   terautentikasi `GET /api/files/<folder>/<nama>` (lihat
   src/app/api/files/[...path]/route.ts). URL lama `/uploads/...` yang
   tersimpan di database tetap berfungsi karena di-rewrite ke route tersebut
   (next.config.ts) — tidak perlu migrasi data.

   Berkas lama yang masih berada di public/uploads tetap dibaca sebagai
   fallback (kompatibilitas), tetapi tidak lagi disajikan langsung.
   ===================================================================== */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** Folder unggahan yang diizinkan (whitelist — anti path traversal). */
export const UPLOAD_FOLDERS = [
  "bukti",
  "penetapan",
  "evaluasi",
  "branding",
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];
const ALLOWED_FOLDERS = new Set<string>(UPLOAD_FOLDERS);

/** Ekstensi dokumen yang diizinkan (hanya PDF — file pasif). */
const DOC_EXT = new Set([".pdf"]);

/**
 * Ekstensi gambar yang diizinkan untuk aset branding (logo/favicon/OG).
 * SENGAJA TIDAK menyertakan .svg karena SVG dapat memuat skrip (XSS).
 */
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico", ".gif"]);

/** Folder yang hanya menerima gambar (aset branding). */
const IMAGE_FOLDERS = new Set(["branding"]);

/** Batas ukuran khusus gambar branding (2MB). */
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** MIME per ekstensi (dipakai saat menyajikan berkas — tidak dari input klien). */
export const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

/** MIME yang boleh diklaim browser saat mengunggah (selain kosong). */
const CLAIMED_MIME_OK = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
  "image/png",
  "image/jpeg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Direktori penyimpanan privat (env UPLOAD_DIR, default <cwd>/storage/uploads). */
export function uploadRoot(): string {
  const env = process.env.UPLOAD_DIR?.trim();
  return path.resolve(
    /*turbopackIgnore: true*/ env ||
      path.join(process.cwd(), "storage", "uploads")
  );
}

/** Direktori lama (sebelum 17 Okt 2026) — hanya dibaca sebagai fallback. */
export function legacyUploadRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "uploads"
  );
}

export type UploadResult =
  { ok: true; path: string } | { ok: false; error: string };

/** Deteksi tipe gambar dari magic bytes (mencegah file palsu ber-ekstensi gambar). */
function isRealImage(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 12) return false;
  const b = buffer;
  const isPng =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isGif =
    b.subarray(0, 6).toString("latin1") === "GIF87a" ||
    b.subarray(0, 6).toString("latin1") === "GIF89a";
  const isWebp =
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP";
  const isIco =
    b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00;

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

/** Validasi PDF: signature `%PDF-` + tolak aksi aktif (JavaScript/Launch). */
function pdfProblem(buffer: Buffer): string | null {
  if (
    buffer.length < 8 ||
    buffer.subarray(0, 5).toString("latin1") !== "%PDF-"
  ) {
    return "Berkas bukan PDF yang valid.";
  }
  const text = buffer.toString("latin1");
  // Hanya nama panjang (/JS pendek terlalu sering muncul acak di stream biner).
  if (/\/(JavaScript|Launch)\b/.test(text)) {
    return "PDF mengandung skrip/aksi aktif dan tidak dapat diterima. Simpan ulang sebagai PDF biasa.";
  }
  return null;
}

/**
 * Simpan file unggahan ke `UPLOAD_DIR/<folder>/` dengan nama acak dan
 * kembalikan path logis `/uploads/<folder>/<nama>` untuk disimpan di DB.
 * Folder, ekstensi, ukuran, MIME, dan magic bytes divalidasi ketat.
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
  const ext = path.extname(String(file.name || "")).toLowerCase();
  const allowedExt = imageMode ? IMAGE_EXT : DOC_EXT;
  if (!allowedExt.has(ext)) {
    return {
      ok: false,
      error: imageMode
        ? "Tipe gambar tidak diizinkan. Gunakan PNG, JPG, WEBP, GIF, atau ICO."
        : "Tipe file tidak diizinkan. Hanya berkas PDF yang diperbolehkan.",
    };
  }
  const claimed = String(file.type || "").toLowerCase();
  if (claimed && !CLAIMED_MIME_OK.has(claimed)) {
    return { ok: false, error: "Tipe berkas tidak diizinkan." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > maxBytes) {
    return { ok: false, error: "Ukuran file melebihi batas." };
  }

  // 3) Verifikasi konten sesuai tipe (magic bytes).
  if (imageMode) {
    if (!isRealImage(buffer, ext)) {
      return { ok: false, error: "Berkas bukan gambar yang valid." };
    }
  } else {
    const problem = pdfProblem(buffer);
    if (problem) return { ok: false, error: problem };
  }

  // 4) Nama acak (tanpa bagian nama asli dari pengguna).
  const fileName = `${Date.now()}-${randomUUID()}${ext}`;
  const root = uploadRoot();
  const dir = path.join(root, folder);
  const resolved = path.resolve(/*turbopackIgnore: true*/ dir, fileName);
  if (!resolved.startsWith(root + path.sep)) {
    return { ok: false, error: "Tujuan unggahan tidak valid." };
  }

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(resolved, buffer, { flag: "wx", mode: 0o640 });
  } catch (e) {
    logError("[upload] gagal menyimpan berkas:", e);
    return { ok: false, error: "Gagal menyimpan berkas. Silakan coba lagi." };
  }

  return { ok: true, path: `/uploads/${folder}/${fileName}` };
}

const FILE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export type ParsedUploadPath = {
  folder: UploadFolder;
  name: string;
  ext: string;
  /** Path logis kanonik, persis seperti tersimpan di DB. */
  logical: string;
};

/**
 * Validasi & urai path logis `/uploads/<folder>/<nama>` (atau segmen
 * `[folder, nama]` dari route). Mengembalikan null bila tidak valid
 * (termasuk upaya traversal `..`, backslash, byte NUL, ekstensi asing).
 */
export function parseUploadPath(
  input: string | string[]
): ParsedUploadPath | null {
  let segs: string[];
  if (Array.isArray(input)) {
    segs = input;
  } else {
    const m = /^\/uploads\/([^/]+)\/([^/]+)$/.exec(input.trim());
    if (!m) return null;
    segs = [m[1], m[2]];
  }
  if (segs.length !== 2) return null;
  const [folder, name] = segs;
  if (!ALLOWED_FOLDERS.has(folder)) return null;
  if (!FILE_NAME_RE.test(name) || name.includes("..")) return null;
  const ext = path.extname(name).toLowerCase();
  const allowed = IMAGE_FOLDERS.has(folder) ? IMAGE_EXT : DOC_EXT;
  if (!allowed.has(ext)) return null;
  return {
    folder: folder as UploadFolder,
    name,
    ext,
    logical: `/uploads/${folder}/${name}`,
  };
}

/** Cari berkas fisik (penyimpanan privat dulu, lalu folder lama public/uploads). */
export async function locateUpload(
  parsed: ParsedUploadPath
): Promise<{ absPath: string; size: number; mtime: Date } | null> {
  for (const root of [uploadRoot(), legacyUploadRoot()]) {
    const abs = path.resolve(
      /*turbopackIgnore: true*/ root,
      parsed.folder,
      parsed.name
    );
    if (!abs.startsWith(root + path.sep)) continue;
    try {
      const st = await stat(abs);
      if (st.isFile()) return { absPath: abs, size: st.size, mtime: st.mtime };
    } catch {
      /* tidak ada di lokasi ini */
    }
  }
  return null;
}

/** Hapus berkas unggahan (best-effort) — mis. saat dokumen dihapus. */
export async function deleteUpload(
  logicalPath: string | null | undefined
): Promise<void> {
  if (!logicalPath) return;
  const parsed = parseUploadPath(logicalPath);
  if (!parsed) return;
  const found = await locateUpload(parsed);
  if (!found) return;
  try {
    await unlink(found.absPath);
  } catch (e) {
    logError("[upload] gagal menghapus berkas:", e);
  }
}

/**
 * Hapus berkas unggahan yang TIDAK lagi direferensikan oleh jawaban audit
 * maupun dokumen mana pun (best-effort; tidak pernah melempar error).
 * Panggil SETELAH baris database terkait dihapus/diubah.
 */
export async function cleanupUnreferencedUploads(
  paths: (string | null | undefined)[]
): Promise<void> {
  const unique = Array.from(
    new Set(paths.filter((p): p is string => Boolean(p)))
  );
  for (const p of unique) {
    try {
      const [resp, doc] = await Promise.all([
        prisma.auditResponse.count({ where: { evidenceFile: p } }),
        prisma.document.count({ where: { filePath: p } }),
      ]);
      if (resp === 0 && doc === 0) await deleteUpload(p);
    } catch (e) {
      logError("[upload] gagal membersihkan berkas:", e);
    }
  }
}

export function isProbablyPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}
