import { expect, type Locator, type Page } from "@playwright/test";

/** Cakupan seperti yang dikirim form tab Instrumen (main: InlineStandardForm). */
export type Scope =
  | { scopeType: "all" }
  | { scopeType: "category"; scopeCategory: string }
  | { scopeType: "unit"; scopeUnitId: number };

export function scopeFields(s: Scope): Record<string, string> {
  return {
    scopeType: s.scopeType,
    scopeCategory: s.scopeType === "category" ? s.scopeCategory : "",
    scopeUnitId: s.scopeType === "unit" ? String(s.scopeUnitId) : "",
  };
}

/** Buka /audit (LPM) → tab Instrumen → kartu kategori ("Umum (Semua Unit)" / nama kategori). */
export async function openCategory(page: Page, category: string) {
  await page.goto("/audit");
  await page.getByRole("tab", { name: "Instrumen & Pertanyaan" }).click();
  const label =
    category === "umum" ? "Umum \\(Semua Unit\\)" : escapeRe(category);
  await page
    .getByRole("button", { name: new RegExp(`^${label} \\d+ pertanyaan`) })
    .click();
  await expect(
    page.getByRole("button", { name: "Kembali ke daftar kategori" })
  ).toBeVisible();
}

/** Pilih tab cakupan di detail kategori ("Semua <kategori>" / nama unit). */
export async function selectScopeTab(page: Page, label: string) {
  const btn = page
    .getByRole("group", { name: "Cakupan pertanyaan" })
    .getByRole("button", { name: new RegExp(`^${escapeRe(label)} \\d+`) });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
}

export function standardForm(page: Page): Locator {
  return page
    .locator("form")
    .filter({ has: page.getByPlaceholder(/mis\. Standar Tata Pamong/) })
    .filter({ has: page.getByRole("button", { name: "Tambah Standar" }) });
}

/**
 * Tambah standar lewat form inline. Bila `scope` diberikan, field cakupan
 * dipastikan terisi sesuai tab (UI main mengirimnya sebagai input tersembunyi;
 * UI v1.2.0 tidak — lihat uji regresi di 02-lpm-admin).
 */
export async function addStandard(page: Page, name: string, scope?: Scope) {
  const form = standardForm(page);
  if (scope) {
    await form.evaluate((f, fields) => {
      for (const [k, v] of Object.entries(fields)) {
        let el = f.querySelector<HTMLInputElement>(`input[name="${k}"]`);
        if (!el) {
          el = document.createElement("input");
          el.type = "hidden";
          el.name = k;
          f.appendChild(el);
        }
        el.value = v;
      }
    }, scopeFields(scope));
  }
  await form.getByPlaceholder(/mis\. Standar Tata Pamong/).fill(name);
  await form.getByRole("button", { name: "Tambah Standar" }).click();
  return form;
}

/** Kartu blok standar berdasarkan nama. */
export function standardBlock(page: Page, name: string): Locator {
  return page.locator("div.card").filter({
    has: page.getByRole("button", {
      name: `Kelola butir pertanyaan standar ${name}`,
      exact: true,
    }),
  });
}

/** Tambah beberapa butir sekaligus lewat modal "Butir Pertanyaan". */
export async function addQuestionsBulk(
  page: Page,
  standardName: string,
  texts: string[]
) {
  await standardBlock(page, standardName)
    .getByRole("button", { name: "Kelola / Tambah Butir Pertanyaan" })
    .click();
  const dlg = page.getByRole("dialog", { name: "Butir Pertanyaan" });
  await expect(dlg).toBeVisible();
  const draft = dlg.getByRole("textbox", {
    name: "Teks butir pertanyaan baru",
  });
  for (const [i, t] of texts.entries()) {
    await draft.fill(t);
    if (i % 2 === 0) {
      await dlg.getByRole("button", { name: "Tambah ke Daftar" }).click();
    } else {
      await draft.press("Control+Enter");
    }
  }
  await expect(dlg.getByText(`Butir Baru (${texts.length})`)).toBeVisible();
  await dlg
    .getByRole("button", { name: `Simpan (${texts.length})`, exact: true })
    .click();
  await expect(dlg.getByText("Berhasil disimpan.")).toBeVisible();
  await expect(dlg.getByText("Butir Baru (0)")).toBeVisible();
  for (const t of texts) {
    await expect(dlg.getByText(t, { exact: true })).toBeVisible();
  }
  await dlg.getByRole("button", { name: "Tutup", exact: true }).click();
  await expect(dlg).toBeHidden();
}

/** Daftar id unit dari filter Panel Verifikasi LPM. */
export async function readUnitIds(page: Page): Promise<Record<string, number>> {
  await page.goto("/audit");
  await page.getByRole("tab", { name: "Panel Verifikasi LPM" }).click();
  const opts = await page
    .getByRole("combobox", { name: "Saring berdasarkan unit" })
    .locator("option")
    .evaluateAll((os) =>
      os.map((o) => [
        (o as HTMLOptionElement).textContent ?? "",
        (o as HTMLOptionElement).value,
      ])
    );
  const out: Record<string, number> = {};
  for (const [name, v] of opts) if (v) out[name.trim()] = Number(v);
  return out;
}

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
