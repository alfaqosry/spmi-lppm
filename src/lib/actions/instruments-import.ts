"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireLpm } from "@/lib/guards";
import { AppError, toActionError } from "@/lib/errors";
import { LIMITS, checkText, cleanText, requireId } from "@/lib/validate";
import { recordActivity } from "@/lib/logs";
import { getClientIp } from "@/lib/net";
import { CATEGORIES, type ScopeType } from "@/lib/scope";

export type RowSuccess = {
  rowNumber: number;
  scopeLabel: string;
  standardName: string;
  questionText: string;
  status: "created" | "skipped";
};

export type RowFailure = {
  rowNumber: number;
  standardName: string;
  questionText: string;
  reason: string;
};

export type ImportSummary = {
  standardsCreated: number;
  standardsReused: number;
  questionsCreated: number;
  questionsSkipped: number;
  totalRows: number;
  successCount: number;
  failedCount: number;
  successRows: RowSuccess[];
  failedRows: RowFailure[];
};

export type ImportActionState =
  | {
      ok?: boolean;
      error?: string;
      rowErrors?: string[];
      summary?: ImportSummary;
    }
  | undefined;

type Tx = Prisma.TransactionClient;

type ScopeTarget = {
  scopeType: ScopeType;
  scopeCategory: string | null;
  scopeUnitId: number | null;
  unitCategory: string | null;
};

type ParsedInstrumentItem = {
  rowNumber: number;
  scope: ScopeTarget;
  standardName: string;
  standardOrder: number | null;
  questionText: string;
  questionOrder: number | null;
};

function revalidateAll() {
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  revalidatePath("/analitik");
  revalidatePath("/siklus");
}

async function lockCycle(tx: Tx, cycleId: number) {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM audit_cycles WHERE id = ${cycleId} FOR UPDATE`;
  if (!rows.length) throw new AppError("Siklus tidak ditemukan.");
}

function norm(str: unknown): string {
  if (str == null) return "";
  return String(str).trim().toLowerCase();
}

function describeItemScope(
  scope: ScopeTarget,
  unitById: Map<number, { name: string }>
): string {
  if (scope.scopeType === "category")
    return `Kategori: ${scope.scopeCategory ?? "-"}`;
  if (scope.scopeType === "unit") {
    const u = scope.scopeUnitId ? unitById.get(scope.scopeUnitId) : null;
    return `Unit: ${u?.name ?? scope.scopeUnitId}`;
  }
  return "Semua Unit";
}

/**
 * Server action untuk import massal standar dan pertanyaan audit dari berkas Excel (.xlsx/.xls/.csv).
 * Menghasilkan rincian baris demi baris: baris yang berhasil diinput dan baris yang gagal beserta alasannya.
 */
export async function importInstrumentsExcel(
  _prev: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  try {
    const user = await requireLpm();
    const cycleId = requireId(formData.get("cycleId"), "Siklus");

    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return {
        error: "Pilih berkas Excel (.xlsx / .xls / .csv) untuk diunggah.",
      };
    }

    // Batas ukuran berkas 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return { error: "Ukuran berkas terlalu besar (maksimal 10 MB)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch {
      return {
        error:
          "Format berkas tidak terbaca. Pastikan berkas berformat Excel (.xlsx/.xls) atau .csv yang valid.",
      };
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { error: "Berkas Excel tidak memiliki lembar kerja (worksheet)." };
    }

    // Gunakan sheet "Template Instrumen" jika ada, atau sheet pertama
    const sheetName =
      workbook.SheetNames.find(
        (s) =>
          s.toLowerCase() === "template instrumen" ||
          s.toLowerCase().includes("instrumen")
      ) ?? workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return { error: `Lembar kerja "${sheetName}" tidak ditemukan.` };
    }

    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];

    if (!rawRows || rawRows.length < 2) {
      return {
        error: "Berkas Excel kosong atau tidak memiliki baris data instrumen.",
      };
    }

    // Cari baris header di 10 baris pertama
    let headerRowIdx = -1;
    let colScope = -1;
    let colTarget = -1;
    let colStandard = -1;
    let colStdOrder = -1;
    let colQuestion = -1;
    let colQOrder = -1;

    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      let foundStandard = false;
      let foundQuestion = false;

      row.forEach((cell, idx) => {
        const text = norm(cell);
        if (/target/.test(text)) colTarget = idx;
        else if (/cakupan|scope/.test(text)) colScope = idx;
        else if (/nama.*standar|standar|standard/.test(text)) {
          if (/urutan|order/.test(text)) colStdOrder = idx;
          else {
            colStandard = idx;
            foundStandard = true;
          }
        } else if (/urutan.*standar|order.*standar/.test(text))
          colStdOrder = idx;
        else if (/pertanyaan|butir|question|indikator/.test(text)) {
          if (/urutan|order/.test(text)) colQOrder = idx;
          else {
            colQuestion = idx;
            foundQuestion = true;
          }
        } else if (
          /urutan.*pertanyaan|urutan.*butir|order.*pertanyaan/.test(text)
        )
          colQOrder = idx;
      });

      if (foundStandard && foundQuestion) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1 || colStandard === -1 || colQuestion === -1) {
      return {
        error:
          'Kolom wajib "Nama Standar" dan "Pertanyaan / Butir Instrumen" tidak ditemukan pada header berkas. Silakan unduh format template resmi yang disediakan.',
      };
    }

    // Ambil data unit dari database untuk pencocokan target
    const units = await prisma.unit.findMany({
      select: { id: true, name: true, category: true },
    });

    const unitByName = new Map<
      string,
      { id: number; name: string; category: string }
    >();
    const unitById = new Map<
      number,
      { id: number; name: string; category: string }
    >();
    for (const u of units) {
      unitByName.set(u.name.trim().toLowerCase(), u);
      unitById.set(u.id, u);
    }

    const categoryMap = new Map<string, string>();
    for (const c of CATEGORIES) {
      categoryMap.set(c.trim().toLowerCase(), c);
    }
    for (const u of units) {
      if (!categoryMap.has(u.category.trim().toLowerCase())) {
        categoryMap.set(u.category.trim().toLowerCase(), u.category);
      }
    }

    const failedRows: RowFailure[] = [];
    const validItems: ParsedInstrumentItem[] = [];

    let currentScope: ScopeTarget | null = null;
    let currentStandardName: string | null = null;
    let currentStdOrder: number | null = null;

    // Iterasi setiap baris data
    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      const rawScope = colScope >= 0 ? String(row[colScope] ?? "").trim() : "";
      const rawTarget =
        colTarget >= 0 ? String(row[colTarget] ?? "").trim() : "";
      const rawStandard = String(row[colStandard] ?? "").trim();
      const rawStdOrder =
        colStdOrder >= 0 ? String(row[colStdOrder] ?? "").trim() : "";
      const rawQuestion = String(row[colQuestion] ?? "").trim();
      const rawQOrder =
        colQOrder >= 0 ? String(row[colQOrder] ?? "").trim() : "";

      // Lewati baris yang seluruh isiannya kosong
      if (!rawScope && !rawTarget && !rawStandard && !rawQuestion) {
        continue;
      }

      const rowNumber = r + 1;

      // 1. Tentukan Cakupan
      let rowScope: ScopeTarget | null = null;
      if (rawScope) {
        const sNorm = rawScope.toLowerCase();
        if (
          sNorm === "semua unit" ||
          sNorm === "semua" ||
          sNorm === "umum" ||
          sNorm === "all"
        ) {
          rowScope = {
            scopeType: "all",
            scopeCategory: null,
            scopeUnitId: null,
            unitCategory: null,
          };
          currentScope = rowScope;
        } else if (sNorm === "kategori" || sNorm === "category") {
          if (!rawTarget) {
            failedRows.push({
              rowNumber,
              standardName: rawStandard || currentStandardName || "-",
              questionText: rawQuestion || "-",
              reason:
                'Cakupan "Kategori" wajib menyertakan nama kategori pada kolom Target Cakupan.',
            });
            continue;
          }
          const matchedCategory = categoryMap.get(rawTarget.toLowerCase());
          if (!matchedCategory) {
            failedRows.push({
              rowNumber,
              standardName: rawStandard || currentStandardName || "-",
              questionText: rawQuestion || "-",
              reason: `Kategori unit "${rawTarget}" tidak dikenal dalam sistem.`,
            });
            continue;
          }
          rowScope = {
            scopeType: "category",
            scopeCategory: matchedCategory,
            scopeUnitId: null,
            unitCategory: null,
          };
          currentScope = rowScope;
        } else if (
          sNorm === "unit tertentu" ||
          sNorm === "unit" ||
          sNorm === "spesifik"
        ) {
          if (!rawTarget) {
            failedRows.push({
              rowNumber,
              standardName: rawStandard || currentStandardName || "-",
              questionText: rawQuestion || "-",
              reason:
                'Cakupan "Unit Tertentu" wajib menyertakan nama unit pada kolom Target Cakupan.',
            });
            continue;
          }
          const matchedUnit = unitByName.get(rawTarget.toLowerCase());
          if (!matchedUnit) {
            failedRows.push({
              rowNumber,
              standardName: rawStandard || currentStandardName || "-",
              questionText: rawQuestion || "-",
              reason: `Unit "${rawTarget}" tidak ditemukan di database.`,
            });
            continue;
          }
          rowScope = {
            scopeType: "unit",
            scopeCategory: null,
            scopeUnitId: matchedUnit.id,
            unitCategory: matchedUnit.category,
          };
          currentScope = rowScope;
        } else {
          failedRows.push({
            rowNumber,
            standardName: rawStandard || currentStandardName || "-",
            questionText: rawQuestion || "-",
            reason: `Jenis cakupan "${rawScope}" tidak valid. Pilihan yang sah: "Semua Unit", "Kategori", atau "Unit Tertentu".`,
          });
          continue;
        }
      } else if (currentScope) {
        rowScope = currentScope;
      } else {
        rowScope = {
          scopeType: "all",
          scopeCategory: null,
          scopeUnitId: null,
          unitCategory: null,
        };
        currentScope = rowScope;
      }

      // 2. Tentukan Standar
      if (rawStandard) {
        try {
          currentStandardName = checkText(rawStandard, {
            max: LIMITS.standardName,
            required: true,
            label: "Nama standar",
          });
        } catch (e) {
          failedRows.push({
            rowNumber,
            standardName: rawStandard,
            questionText: rawQuestion || "-",
            reason: (e as AppError).message,
          });
          continue;
        }

        if (rawStdOrder && !isNaN(Number(rawStdOrder))) {
          currentStdOrder = parseInt(rawStdOrder, 10);
        } else {
          currentStdOrder = null;
        }
      }

      if (!currentStandardName) {
        failedRows.push({
          rowNumber,
          standardName: "-",
          questionText: rawQuestion || "-",
          reason: "Nama standar wajib diisi.",
        });
        continue;
      }

      // 3. Tentukan Pertanyaan
      if (!rawQuestion) {
        failedRows.push({
          rowNumber,
          standardName: currentStandardName,
          questionText: "-",
          reason: "Teks pertanyaan tidak boleh kosong.",
        });
        continue;
      }

      let questionText = "";
      try {
        questionText = checkText(rawQuestion, {
          max: LIMITS.questionText,
          required: true,
          multiline: true,
          label: "Teks pertanyaan",
        });
      } catch (e) {
        failedRows.push({
          rowNumber,
          standardName: currentStandardName,
          questionText: rawQuestion,
          reason: (e as AppError).message,
        });
        continue;
      }

      let questionOrder: number | null = null;
      if (rawQOrder && !isNaN(Number(rawQOrder))) {
        questionOrder = parseInt(rawQOrder, 10);
      }

      validItems.push({
        rowNumber,
        scope: { ...rowScope },
        standardName: currentStandardName,
        standardOrder: currentStdOrder,
        questionText,
        questionOrder,
      });
    }

    if (validItems.length === 0) {
      return {
        ok: false,
        error: `Seluruh ${failedRows.length} baris dalam berkas Excel tidak dapat diproses karena kesalahan format atau data.`,
        rowErrors: failedRows.map((f) => `Baris ${f.rowNumber}: ${f.reason}`),
        summary: {
          standardsCreated: 0,
          standardsReused: 0,
          questionsCreated: 0,
          questionsSkipped: 0,
          totalRows: failedRows.length,
          successCount: 0,
          failedCount: failedRows.length,
          successRows: [],
          failedRows,
        },
      };
    }

    // Eksekusi penyimpanan ke database dalam Prisma Transaction
    const successRows: RowSuccess[] = [];
    const summary = {
      standardsCreated: 0,
      standardsReused: 0,
      questionsCreated: 0,
      questionsSkipped: 0,
    };

    await prisma.$transaction(async (tx) => {
      await lockCycle(tx, cycleId);

      // Kelompokkan item berdasarkan Standar (kunci: cakupan + nama standar)
      type StandardGroupKey = string;
      const groups = new Map<
        StandardGroupKey,
        {
          scope: ScopeTarget;
          name: string;
          explicitOrder: number | null;
          questions: {
            rowNumber: number;
            text: string;
            explicitOrder: number | null;
          }[];
        }
      >();

      for (const item of validItems) {
        const key = `${item.scope.scopeType}:${item.scope.scopeCategory ?? ""}:${item.scope.scopeUnitId ?? 0}:${item.standardName.toLowerCase()}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            scope: item.scope,
            name: item.standardName,
            explicitOrder: item.standardOrder,
            questions: [],
          };
          groups.set(key, g);
        } else if (g.explicitOrder == null && item.standardOrder != null) {
          g.explicitOrder = item.standardOrder;
        }

        g.questions.push({
          rowNumber: item.rowNumber,
          text: item.questionText,
          explicitOrder: item.questionOrder,
        });
      }

      for (const group of groups.values()) {
        const scopeCols = {
          scopeType: group.scope.scopeType,
          scopeCategory: group.scope.scopeCategory,
          scopeUnitId: group.scope.scopeUnitId,
        };

        // Cek apakah standar dengan nama & cakupan ini sudah ada pada siklus ini
        let standard = await tx.auditStandard.findFirst({
          where: {
            cycleId,
            name: group.name,
            ...scopeCols,
          },
          select: { id: true, order: true },
        });

        if (standard) {
          summary.standardsReused++;
        } else {
          // Tentukan order standar baru
          let stdOrder = group.explicitOrder;
          if (stdOrder == null) {
            const lastStd = await tx.auditStandard.findFirst({
              where: { cycleId, ...scopeCols },
              orderBy: { order: "desc" },
              select: { order: true },
            });
            stdOrder = (lastStd?.order ?? 0) + 1;
          }

          standard = await tx.auditStandard.create({
            data: {
              cycleId,
              name: group.name,
              order: stdOrder,
              ...scopeCols,
            },
            select: { id: true, order: true },
          });
          summary.standardsCreated++;
        }

        // Ambil butir pertanyaan yang sudah ada di bawah standar ini untuk mencegah duplikasi identik
        const existingQuestions = await tx.auditQuestion.findMany({
          where: { standardId: standard.id },
          select: { id: true, questionText: true, order: true },
        });

        const existingTexts = new Set<string>();
        let maxQOrder = 0;
        for (const eq of existingQuestions) {
          existingTexts.add(cleanText(eq.questionText).trim().toLowerCase());
          if (eq.order > maxQOrder) maxQOrder = eq.order;
        }

        const scopeLabel = describeItemScope(group.scope, unitById);

        // Simpan pertanyaan-pertanyaan baru
        for (const q of group.questions) {
          const normQ = cleanText(q.text).trim().toLowerCase();
          if (existingTexts.has(normQ)) {
            summary.questionsSkipped++;
            successRows.push({
              rowNumber: q.rowNumber,
              scopeLabel,
              standardName: group.name,
              questionText: q.text,
              status: "skipped",
            });
            continue;
          }

          let qOrder = q.explicitOrder;
          if (qOrder == null) {
            maxQOrder += 1;
            qOrder = maxQOrder;
          } else if (qOrder > maxQOrder) {
            maxQOrder = qOrder;
          }

          await tx.auditQuestion.create({
            data: {
              cycleId,
              standardId: standard.id,
              questionText: q.text,
              order: qOrder,
              ...scopeCols,
            },
          });

          existingTexts.add(normQ);
          summary.questionsCreated++;
          successRows.push({
            rowNumber: q.rowNumber,
            scopeLabel,
            standardName: group.name,
            questionText: q.text,
            status: "created",
          });
        }
      }
    });

    successRows.sort((a, b) => a.rowNumber - b.rowNumber);
    failedRows.sort((a, b) => a.rowNumber - b.rowNumber);

    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "instruments.import_excel",
      entity: "question",
      entityId: cycleId,
      detail: `Import Excel: ${successRows.length} berhasil (${summary.standardsCreated} std baru, ${summary.questionsCreated} butir baru, ${summary.questionsSkipped} duplikat), ${failedRows.length} gagal.`,
      ip: await getClientIp(),
    });

    revalidateAll();

    return {
      ok: true,
      summary: {
        standardsCreated: summary.standardsCreated,
        standardsReused: summary.standardsReused,
        questionsCreated: summary.questionsCreated,
        questionsSkipped: summary.questionsSkipped,
        totalRows: successRows.length + failedRows.length,
        successCount: successRows.length,
        failedCount: failedRows.length,
        successRows,
        failedRows,
      },
    };
  } catch (e) {
    return {
      error: toActionError(e, "Gagal mengimpor data instrumen dari Excel."),
    };
  }
}
