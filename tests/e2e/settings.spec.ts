import { test, expect } from "@playwright/test";

test("settings load failure blocks editing and saving until retry succeeds", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 501, json: { error: "Unmocked E2E API" } }));
  let gets = 0;
  let saves = 0;
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: { id: "e2e-admin", name: "Admin Uji", email: "admin@example.invalid" } } }));
  await page.route("**/api/admin/settings", route => {
    if (route.request().method() === "PUT") {
      saves++;
      return route.fulfill({ json: { settings: route.request().postDataJSON() } });
    }
    gets++;
    return route.fulfill(gets === 1 ? { status: 503, json: { error: "Pengaturan uji gagal dimuat" } } : { json: { settings: { address: "Jalan Pengujian 7", landmark: "Pagar uji", latitude: -6.2, longitude: 106.8 } } });
  });
  await page.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  await page.goto("/admin/pengaturan");
  await expect(page.locator(".error[role='alert']")).toContainText("Pengaturan uji gagal dimuat");
  await expect(page.getByLabel("Alamat lengkap toko *")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Simpan lokasi/ })).toHaveCount(0);
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "Coba lagi memuat pengaturan" }).click();
  await expect(page.getByLabel("Alamat lengkap toko *")).toHaveValue("Jalan Pengujian 7");
  await expect(page.getByLabel("Lintang (latitude)")).toHaveValue("-6.2");
  await expect(page.getByRole("button", { name: /Simpan lokasi/ })).toBeEnabled();
  expect(gets).toBe(2);
  expect(saves).toBe(0);
});
