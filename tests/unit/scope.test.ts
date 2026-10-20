import { describe, expect, it } from "vitest";
import {
  generalQuestions,
  groupByStandard,
  isQuestionForUnit,
  isScopeType,
  isScopeWithin,
  questionsForCategory,
  questionsForSpecificUnit,
  questionsForUnit,
  sameScope,
  scopeLabel,
  type Question,
  type QuestionScope,
} from "@/lib/scope";

const prodi = { id: 1, category: "Program Studi" };
const biro = { id: 2, category: "Biro" };

function q(
  id: number,
  scopeType: string,
  extra: Partial<Question> = {}
): Question {
  return {
    id,
    questionText: `Q${id}`,
    standardId: 1,
    standardName: "Standar 1",
    order: id,
    scopeType,
    scopeCategory: null,
    scopeUnitId: null,
    ...extra,
  };
}

const all = q(1, "all");
const catProdi = q(2, "category", { scopeCategory: "Program Studi" });
const catBiro = q(3, "category", { scopeCategory: "Biro" });
const unit2 = q(4, "unit", { scopeUnitId: 2 });
const unknown = q(5, "lainnya");
const questions = [all, catProdi, catBiro, unit2, unknown];

describe("isQuestionForUnit", () => {
  it("cakupan 'all' berlaku untuk semua unit", () => {
    expect(isQuestionForUnit(all, prodi)).toBe(true);
    expect(isQuestionForUnit(all, biro)).toBe(true);
  });

  it("cakupan 'category' hanya untuk kategori yang sama", () => {
    expect(isQuestionForUnit(catProdi, prodi)).toBe(true);
    expect(isQuestionForUnit(catProdi, biro)).toBe(false);
  });

  it("cakupan 'unit' hanya untuk unit tertentu", () => {
    expect(isQuestionForUnit(unit2, biro)).toBe(true);
    expect(isQuestionForUnit(unit2, prodi)).toBe(false);
  });

  it("cakupan tak dikenal TIDAK ditampilkan ke unit mana pun (fail-closed)", () => {
    expect(isQuestionForUnit(unknown, prodi)).toBe(false);
  });
});

describe("filter pertanyaan", () => {
  it("questionsForUnit", () => {
    // id 5 bercakupan tak dikenal -> tidak tampil (fail-closed).
    expect(questionsForUnit(questions, prodi).map((x) => x.id)).toEqual([1, 2]);
    expect(questionsForUnit(questions, biro).map((x) => x.id)).toEqual([
      1, 3, 4,
    ]);
  });

  it("questionsForCategory", () => {
    expect(questionsForCategory(questions, "Biro").map((x) => x.id)).toEqual([
      3,
    ]);
    expect(questionsForCategory(questions, "Pusat")).toEqual([]);
  });

  it("questionsForSpecificUnit", () => {
    expect(questionsForSpecificUnit(questions, 2).map((x) => x.id)).toEqual([
      4,
    ]);
    expect(questionsForSpecificUnit(questions, 1)).toEqual([]);
  });

  it("generalQuestions hanya 'all' (eksplisit)", () => {
    expect(generalQuestions(questions).map((x) => x.id)).toEqual([1]);
  });
});

describe("scopeLabel", () => {
  const names = new Map([[2, "Biro Administrasi Umum"]]);

  it("label semua unit / kategori", () => {
    expect(scopeLabel(all)).toBe("Semua Unit");
    expect(scopeLabel(catBiro)).toBe("Biro");
    expect(scopeLabel(q(9, "category"))).toBe("Kategori");
  });

  it("label unit memakai nama bila tersedia", () => {
    expect(scopeLabel(unit2, names)).toBe("Biro Administrasi Umum");
    expect(scopeLabel(unit2)).toBe("Unit Tertentu");
    expect(scopeLabel(q(9, "unit"), names)).toBe("Unit Tertentu");
  });
});

describe("groupByStandard", () => {
  it("mengelompokkan & mengurutkan standar lalu butir", () => {
    const items = [
      q(10, "all", { standardId: 2, standardName: "Beta", order: 2 }),
      q(11, "all", { standardId: 1, standardName: "Alfa", order: 3 }),
      q(12, "all", { standardId: 1, standardName: "Alfa", order: 1 }),
      q(13, "all", { standardId: 2, standardName: "Beta", order: 1 }),
    ];
    const groups = groupByStandard(items);
    expect(groups.map((g) => g.standardId)).toEqual([2, 1]);
    // Standar diurutkan berdasarkan `order` butir pertama yang ditemui.
    expect(groups[0].questions.map((x) => x.id)).toEqual([13, 10]);
    expect(groups[1].questions.map((x) => x.id)).toEqual([12, 11]);
  });

  it("urutan seri diputus dengan id (butir) / nama (standar)", () => {
    const items = [
      q(21, "all", { standardId: 5, standardName: "Zeta", order: 1 }),
      q(20, "all", { standardId: 6, standardName: "Eta", order: 1 }),
      q(22, "all", { standardId: 5, standardName: "Zeta", order: 1 }),
    ];
    const groups = groupByStandard(items);
    expect(groups.map((g) => g.standardName)).toEqual(["Eta", "Zeta"]);
    expect(groups[1].questions.map((x) => x.id)).toEqual([21, 22]);
  });

  it("tidak memutasi array masukan", () => {
    const items = [q(2, "all"), q(1, "all")];
    groupByStandard(items);
    expect(items.map((x) => x.id)).toEqual([2, 1]);
  });

  it("daftar kosong menghasilkan grup kosong", () => {
    expect(groupByStandard([])).toEqual([]);
  });
});

describe("cakupan standar vs butir (isScopeWithin)", () => {
  const sc = (
    scopeType: string,
    scopeCategory: string | null = null,
    scopeUnitId: number | null = null
  ): QuestionScope => ({ scopeType, scopeCategory, scopeUnitId });
  const ALL = sc("all");
  const BIRO = sc("category", "Biro");
  const U2 = sc("unit", null, 2);
  const U1 = sc("unit", null, 1);

  it("isScopeType hanya menerima whitelist", () => {
    expect(isScopeType("all")).toBe(true);
    expect(isScopeType("category")).toBe(true);
    expect(isScopeType("unit")).toBe(true);
    expect(isScopeType("lainnya")).toBe(false);
    expect(isScopeType("")).toBe(false);
    expect(isScopeType(undefined)).toBe(false);
  });

  it("standar umum mencakup semua cakupan butir", () => {
    expect(isScopeWithin(ALL, ALL)).toBe(true);
    expect(isScopeWithin(BIRO, ALL)).toBe(true);
    expect(isScopeWithin(U2, ALL, "Biro")).toBe(true);
  });

  it("standar kategori: kategori sama / unit berkategori sama saja", () => {
    expect(isScopeWithin(BIRO, BIRO)).toBe(true);
    expect(isScopeWithin(sc("category", "Program Studi"), BIRO)).toBe(false);
    expect(isScopeWithin(ALL, BIRO)).toBe(false);
    expect(isScopeWithin(U2, BIRO, "Biro")).toBe(true);
    expect(isScopeWithin(U1, BIRO, "Program Studi")).toBe(false);
    // Kategori unit tidak diketahui -> fail-closed.
    expect(isScopeWithin(U2, BIRO)).toBe(false);
    expect(isScopeWithin(BIRO, sc("category", null))).toBe(false);
  });

  it("standar unit A tidak pernah berisi butir unit B / umum / kategori", () => {
    expect(isScopeWithin(U2, U2)).toBe(true);
    expect(isScopeWithin(U1, U2)).toBe(false);
    expect(isScopeWithin(ALL, U2)).toBe(false);
    expect(isScopeWithin(BIRO, U2)).toBe(false);
    // Unit cakupan standar terhapus (SET NULL) -> tidak menerima apa pun.
    expect(isScopeWithin(U2, sc("unit", null, null))).toBe(false);
  });

  it("jenis cakupan tak dikenal ditolak (fail-closed)", () => {
    expect(isScopeWithin(sc("lainnya"), ALL)).toBe(false);
    expect(isScopeWithin(ALL, sc("lainnya"))).toBe(false);
  });

  it("sameScope membandingkan jenis, kategori, dan unit", () => {
    expect(sameScope(U2, sc("unit", null, 2))).toBe(true);
    expect(sameScope(U2, U1)).toBe(false);
    expect(sameScope(BIRO, sc("category", "Pusat"))).toBe(false);
    expect(sameScope(ALL, BIRO)).toBe(false);
  });
});
