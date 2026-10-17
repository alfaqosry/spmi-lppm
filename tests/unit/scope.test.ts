import { describe, expect, it } from "vitest";
import {
  generalQuestions,
  groupByStandard,
  isQuestionForUnit,
  questionsForCategory,
  questionsForSpecificUnit,
  questionsForUnit,
  scopeLabel,
  type Question,
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

  it("cakupan tak dikenal diperlakukan sebagai 'all'", () => {
    expect(isQuestionForUnit(unknown, prodi)).toBe(true);
  });
});

describe("filter pertanyaan", () => {
  it("questionsForUnit", () => {
    expect(questionsForUnit(questions, prodi).map((x) => x.id)).toEqual([
      1, 2, 5,
    ]);
    expect(questionsForUnit(questions, biro).map((x) => x.id)).toEqual([
      1, 3, 4, 5,
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
