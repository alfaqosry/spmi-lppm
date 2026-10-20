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
  /** Urutan standar induk (AuditStandard.order). Disarankan selalu diisi. */
  standardOrder?: number;
  order: number;
} & QuestionScope;

export type Standard = {
  id: number;
  name: string;
  order: number;
  questionCount: number;
} & QuestionScope;

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
    case "all":
      return true;
    default:
      // Fail-closed: jenis cakupan tak dikenal (mis. hasil SQL langsung) tidak
      // ditampilkan ke unit mana pun; terdeteksi aturan kualitas data DQ-17/DQ-40.
      return false;
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
export function generalQuestions<T extends QuestionScope>(questions: T[]): T[] {
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
 * Urutan kelompok mengikuti urutan STANDAR (`standardOrder`, yaitu
 * AuditStandard.order) — seri diputus dengan nama lalu id standar. Bila
 * `standardOrder` tidak disertakan (kompatibilitas lama), dipakai `order`
 * butir pertama yang ditemui. Urutan butir di dalamnya mengikuti `order`
 * pertanyaan (seri: id).
 */
export function groupByStandard<
  T extends QuestionScope & {
    id: number;
    standardId: number;
    standardName: string;
    standardOrder?: number;
    order: number;
  },
>(questions: T[]): StandardGroup<T>[] {
  const map = new Map<number, StandardGroup<T>>();
  for (const q of questions) {
    const g =
      map.get(q.standardId) ??
      ({
        standardId: q.standardId,
        standardName: q.standardName,
        order: q.standardOrder ?? q.order,
        questions: [],
      } as StandardGroup<T>);
    // Urutan standar eksplisit selalu menang atas urutan butir.
    if (q.standardOrder != null) g.order = q.standardOrder;
    g.questions.push(q);
    map.set(q.standardId, g);
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      questions: [...g.questions].sort(
        (a, b) => a.order - b.order || a.id - b.id
      ),
    }))
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.standardName.localeCompare(b.standardName) ||
        a.standardId - b.standardId
    );
}

/** Daftar jenis cakupan yang sah (whitelist). */
export const SCOPE_TYPES: readonly ScopeType[] = ["all", "category", "unit"];

/** Apakah `value` adalah jenis cakupan yang sah? */
export function isScopeType(value: unknown): value is ScopeType {
  return (
    typeof value === "string" &&
    (SCOPE_TYPES as readonly string[]).includes(value)
  );
}

/** Apakah dua cakupan identik (jenis + kategori + unit)? */
export function sameScope(a: QuestionScope, b: QuestionScope): boolean {
  return (
    a.scopeType === b.scopeType &&
    (a.scopeCategory ?? null) === (b.scopeCategory ?? null) &&
    (a.scopeUnitId ?? null) === (b.scopeUnitId ?? null)
  );
}

/**
 * Aturan bisnis cakupan standar vs butir: cakupan butir pertanyaan harus
 * SAMA dengan atau LEBIH SEMPIT daripada cakupan standar induknya, sehingga
 * standar unit A tidak pernah berisi butir yang berlaku untuk unit B.
 *
 *  - standar "all"           : butir boleh all / category / unit apa pun
 *  - standar "category" (C)  : butir category C, atau unit yang berkategori C
 *  - standar "unit" (U)      : butir hanya unit U
 *
 * `innerUnitCategory` = kategori unit cakupan butir (wajib bila butir
 * bercakupan "unit" dan standar bercakupan "category"). Jenis cakupan yang
 * tidak dikenal selalu ditolak (fail-closed).
 */
export function isScopeWithin(
  inner: QuestionScope,
  outer: QuestionScope,
  innerUnitCategory?: string | null
): boolean {
  if (!isScopeType(inner.scopeType) || !isScopeType(outer.scopeType)) {
    return false;
  }
  switch (outer.scopeType) {
    case "all":
      return true;
    case "category":
      if (outer.scopeCategory == null) return false;
      if (inner.scopeType === "category") {
        return inner.scopeCategory === outer.scopeCategory;
      }
      if (inner.scopeType === "unit") {
        return (
          inner.scopeUnitId != null &&
          innerUnitCategory != null &&
          innerUnitCategory === outer.scopeCategory
        );
      }
      return false;
    case "unit":
      return (
        outer.scopeUnitId != null &&
        inner.scopeType === "unit" &&
        inner.scopeUnitId === outer.scopeUnitId
      );
  }
}
