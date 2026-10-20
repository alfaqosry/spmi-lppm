import { describe, expect, it } from "vitest";
import { checkboxField } from "@/lib/checkbox";
import { cycleHref } from "@/components/analytics/cycle-href";

function fd(entries: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("checkboxField (TC-ROL-12)", () => {
  it("checkbox tidak dicentang (field tidak dikirim browser) → false", () => {
    expect(checkboxField(fd(), "isActive")).toBe(false);
  });

  it('checkbox dicentang (nilai default "on") → true', () => {
    expect(checkboxField(fd({ isActive: "on" }), "isActive")).toBe(true);
  });

  it('menerima "true"/"1" dan mengabaikan huruf besar/spasi', () => {
    expect(checkboxField(fd({ a: "true" }), "a")).toBe(true);
    expect(checkboxField(fd({ a: " ON " }), "a")).toBe(true);
    expect(checkboxField(fd({ a: "1" }), "a")).toBe(true);
  });

  it('nilai lain ("off", kosong, "false") → false', () => {
    expect(checkboxField(fd({ a: "off" }), "a")).toBe(false);
    expect(checkboxField(fd({ a: "" }), "a")).toBe(false);
    expect(checkboxField(fd({ a: "false" }), "a")).toBe(false);
  });

  it("nilai berkas (File) → false", () => {
    const f = new FormData();
    f.set("a", new Blob(["x"]), "x.txt");
    expect(checkboxField(f, "a")).toBe(false);
  });
});

describe("cycleHref (HE-07 / TC-ANL-08)", () => {
  it("membangun URL halaman dengan cycleId terpilih", () => {
    expect(cycleHref("/analitik", 5)).toBe("/analitik?cycleId=5");
  });

  it("pathname kosong → akar", () => {
    expect(cycleHref("", 2)).toBe("/?cycleId=2");
  });
});
