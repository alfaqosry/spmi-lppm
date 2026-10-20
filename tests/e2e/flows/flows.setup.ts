import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";
import {
  ACCOUNTS,
  AUTH_DIR,
  STATE_FILE,
  acceptConsentIfShown,
  login,
  storageFile,
  type RoleKey,
} from "./helpers";

/**
 * Login SEKALI per peran (hemat batas laju login) dan simpan storageState.
 * Juga menyiapkan id-run unik agar data uji tidak bentrok antar-eksekusi.
 */
setup.describe.configure({ mode: "serial" });

setup("siapkan state run", async () => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ run: Date.now().toString(36) }, null, 2)
  );
});

setup(
  "superadmin: login & pastikan mode pemeliharaan mati",
  async ({ page }) => {
    const a = ACCOUNTS.superadmin;
    await login(page, a.email, a.password);
    await acceptConsentIfShown(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Sisa run sebelumnya yang gagal di tengah jalan: matikan pemeliharaan.
    await page.goto("/pengaturan");
    await page.getByRole("tab", { name: "Pemeliharaan" }).click();
    const box = page.getByRole("checkbox", {
      name: "Aktifkan mode pemeliharaan",
    });
    if (await box.isChecked()) {
      await box.uncheck();
      await page.getByRole("button", { name: "Simpan", exact: true }).click();
      await expect(page.getByText("Berhasil disimpan.")).toBeVisible();
    }
    await page.context().storageState({ path: storageFile("superadmin") });
  }
);

const others: RoleKey[] = [
  "lpmAdmin",
  "lpmAdmin2",
  "lpmMember",
  "head",
  "member",
  "perpusHead",
];

for (const role of others) {
  setup(`login ${role}`, async ({ page }) => {
    const a = ACCOUNTS[role];
    await login(page, a.email, a.password);
    await acceptConsentIfShown(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.context().storageState({ path: storageFile(role) });
  });
}
