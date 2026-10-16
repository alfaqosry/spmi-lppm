/**
 * Logika cakupan (scope) pertanyaan audit.
 *
 * Setiap pertanyaan punya salah satu cakupan:
 *  - "all"      : berlaku untuk SEMUA unit (menu "Umum")
 *  - "category" : berlaku untuk semua unit dengan kategori tertentu (mis. "Biro")
 *  - "unit"     : berlaku hanya untuk SATU unit tertentu (mis. "Biro Administrasi Umum")
 */

export type ScopeType = "all" | "category" | "unit";

export type QuestionScope = {
  scopeType: string;
  scopeCategory: string | null;
  scopeUnitId: number | null;
};

export type Question = {
  id: number;
  questionText: string;
  /** Standar induk (pengelompok) butir pertanyaan ini. */
  standardId: number;
  /** Nama standar (didenormalisasi untuk tampilan). */
  standardName: string;
  order: number;
} & QuestionScope;

export type Standard = {
  id: number;
  name: string;
  order: number;
  questionCount: number;
};

export type UnitLike = {
  id: number;
  category: string;
};

export type UnitOption = { id: number; name: string; category: string };

/** Segmen URL khusus untuk daftar pertanyaan "Umum (Semua Unit)". */
export const UMUM_SLUG = "umum";

/** Kategori unit bawaan (dipakai sebagai saran saat menambah unit baru). */
export const CATEGORIES = [
  "Program Studi",
  "Wakil Rektor",
  "Pusat",
  "Perpustakaan",
  "Biro",
  "Lembaga",
  "Unit Lainnya",
];

/** Apakah sebuah pertanyaan relevan (harus dijawab) oleh unit tertentu? */
export function isQuestionForUnit(
  question: QuestionScope,
  unit: UnitLike
): boolean {
  switch (question.scopeType) {
    case "category":
      return question.scopeCategory === unit.category;
    case "unit":
      return question.scopeUnitId === unit.id;
    default:
      return true; // "all"
  }
}

/** Label singkat cakupan untuk badge. */
export function scopeLabel(
  question: QuestionScope,
  unitNameById?: Map<number, string>
): string {
  switch (question.scopeType) {
    case "category":
      return question.scopeCategory ?? "Kategori";
    case "unit": {
      const name =
        question.scopeUnitId != null
          ? unitNameById?.get(question.scopeUnitId)
          : null;
      return name ?? "Unit Tertentu";
    }
    default:
      return "Semua Unit";
  }
}

/** Filter daftar pertanyaan yang relevan untuk sebuah unit. */
export function questionsForUnit<T extends QuestionScope>(
  questions: T[],
  unit: UnitLike
): T[] {
  return questions.filter((q) => isQuestionForUnit(q, unit));
}

/** Pertanyaan yang berlaku untuk SELURUH unit dalam satu kategori. */
export function questionsForCategory<T extends QuestionScope>(
  questions: T[],
  category: string
): T[] {
  return questions.filter(
    (q) => q.scopeType === "category" && q.scopeCategory === category
  );
}

/** Pertanyaan yang khusus untuk satu unit. */
export function questionsForSpecificUnit<T extends QuestionScope>(
  questions: T[],
  unitId: number
): T[] {
  return questions.filter(
    (q) => q.scopeType === "unit" && q.scopeUnitId === unitId
  );
}

/** Pertanyaan umum (berlaku untuk semua unit). */
export function generalQuestions<T extends QuestionScope>(
  questions: T[]
): T[] {
  return questions.filter((q) => q.scopeType === "all");
}

/** Satu kelompok butir pertanyaan di bawah sebuah standar. */
export type StandardGroup<T extends QuestionScope> = {
  standardId: number;
  standardName: string;
  order: number;
  questions: T[];
};

/**
 * Kelompokkan butir pertanyaan berdasarkan standar induknya.
 * Urutan mengikuti `order` standar (lalu nama), dan urutan butir di dalamnya
 * mengikuti `order` pertanyaan.
 */
export function groupByStandard<T extends QuestionScope & {
  id: number;
  standardId: number;
  standardName: string;
  order: number;
}>(questions: T[]): StandardGroup<T>[] {
  const map = new Map<number, StandardGroup<T>>();
  for (const q of questions) {
    const g =
      map.get(q.standardId) ??
      ({
        standardId: q.standardId,
        standardName: q.standardName,
        order: q.order,
        questions: [],
      } as StandardGroup<T>);
    g.questions.push(q);
    map.set(q.standardId, g);
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      questions: [...g.questions].sort((a, b) => a.order - b.order || a.id - b.id),
    }))
    .sort(
      (a, b) => a.order - b.order || a.standardName.localeCompare(b.standardName)
    );
}
