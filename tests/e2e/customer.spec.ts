import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Specific mocks below take precedence; never let an unhandled API reach Next.
  await page.route("**/api/**", route => route.fulfill({ status: 501, json: { error: "Unmocked E2E API" } }));
});

const token = "e2e-token-00000000000000000000000000001";
const product = { id: "e2e-product", name: "Telur Asin E2E", price: 5000, stock: 12, availableAt: null };
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

async function mockStore(page: Page, location: unknown = null) {
  await page.route("**/api/store-location", route => route.fulfill(json({ location })));
}
async function mockProducts(page: Page) {
  await page.route("**/api/products", route => route.fulfill(json({ products: [product] })));
}

test("product failure blocks checkout until explicit retry", async ({ page }) => {
  let requests = 0;
  await mockStore(page);
  await page.route("**/api/products", route => route.fulfill(++requests === 1 ? json({ error: "offline" }, 503) : json({ products: [product] })));
  await page.goto("/pesan");
  await expect(page.locator(".error[role='alert']")).toContainText("Pilihan telur belum dapat dimuat");
  await expect(page.getByRole("button", { name: "Buat pesanan" })).toBeDisabled();
  await page.getByRole("button", { name: "Coba lagi memuat pilihan telur" }).click();
  await expect(page.getByText(product.name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Tambah ${product.name}` }).click();
  await expect(page.getByRole("button", { name: "Buat pesanan" })).toBeEnabled();
  expect(requests).toBe(2);
});

test("location request failure is distinct from unset location and retries", async ({ page }) => {
  await mockProducts(page);
  let requests = 0;
  await page.route("**/api/store-location", route => route.fulfill(++requests === 1 ? json({ error: "offline" }, 503) : json({ location: { address: "Jalan E2E 5", landmark: null, latitude: -6.2, longitude: 106.8 } })));
  await page.goto("/pesan");
  await expect(page.locator(".error[role='alert']")).toContainText("Lokasi toko belum dapat dimuat");
  await expect(page.getByText("Lokasi toko belum tersedia.")).toHaveCount(0);
  await page.getByRole("button", { name: "Coba lagi memuat lokasi toko" }).click();
  await expect(page.getByText("Jalan E2E 5")).toBeVisible();
  expect(requests).toBe(2);
});

test("radio choices work with keyboard", async ({ page }) => {
  await mockProducts(page);
  await mockStore(page);
  await page.goto("/pesan");
  const pickup = page.getByRole("radio", { name: /Ambil di toko/ });
  const gosend = page.getByRole("radio", { name: /GoSend/ });
  await pickup.focus();
  await page.keyboard.press("ArrowRight");
  await expect(gosend).toBeChecked();
  await expect(page.getByText("GoSend dipesan oleh Anda setelah telur siap.")).toBeVisible();
  const cod = page.getByRole("radio", { name: /Bayar saat menerima/ });
  await cod.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /Bank \/ QRIS/ })).toBeChecked();
});

test("storage and clipboard failure leave copyable number and link", async ({ page }) => {
  await mockProducts(page);
  await mockStore(page);
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", { configurable: true, value: () => { throw new Error("QuotaExceededError"); } });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
  });
  await page.route("**/api/orders", async route => {
    if (route.request().method() !== "POST") return route.abort();
    const payload = route.request().postDataJSON();
    expect(payload.items).toEqual([{ productId: product.id, quantity: 1 }]);
    expect(payload.paymentMethod).toBe("COD");
    await route.fulfill(json({ order: { token, orderNumber: "E2E-0001", total: 5000, waitlisted: false, paymentMethod: "COD", paymentStatus: "PENDING" } }));
  });
  await page.goto("/pesan");
  await page.getByRole("button", { name: `Tambah ${product.name}` }).click();
  await page.getByLabel("Nama lengkap *").fill("Pelanggan Uji");
  await page.getByLabel("Nomor WhatsApp *").fill("081234567890");
  await page.getByLabel("Tanggal ingin diterima *").fill("2026-12-20");
  await page.getByRole("button", { name: "Buat pesanan" }).click();
  await expect(page.getByRole("heading", { name: "Pesanan sudah dicatat" })).toBeVisible();
  await expect(page.locator(".error[role='alert']")).toContainText("Browser tidak dapat menyimpan riwayat pesanan");
  await expect(page.getByRole("link", { name: /127.0.0.1:3101\/pesanan\/e2e-token/ })).toHaveAttribute("href", `/pesanan/${token}`);
  await expect(page.getByRole("heading", { name: "E2E-0001" })).toBeVisible();
  await page.getByRole("button", { name: "Salin nomor dan tautan" }).click();
  await expect(page.getByRole("status")).toContainText("Salin nomor dan tautan di atas secara manual.");
});

test("history shows completed, cancelled and refunded states from mocked order API", async ({ page }) => {
  const cases = [
    { token: "complete-00000000000000000000000000001", orderNumber: "E2E-COMPLETE", paymentStatus: "PAID", completed: true, label: "Pesanan selesai" },
    { token: "cancelled-0000000000000000000000000001", orderNumber: "E2E-CANCELLED", paymentStatus: "CANCELLED", label: "Pesanan dibatalkan" },
    { token: "refunded-00000000000000000000000000001", orderNumber: "E2E-REFUNDED", paymentStatus: "REFUNDED", label: "Dana dikembalikan" },
  ];
  await page.addInitScript(entries => localStorage.setItem("telur-nganenin-orders-v1", JSON.stringify(entries.map(({ token, orderNumber }) => ({ token, orderNumber, total: 5000, requestedDate: "2026-12-20", paymentMethod: "COD", savedAt: "2026-10-23T09:00:00.000Z" })))), cases);
  await page.route("**/api/orders/*", route => {
    const entry = cases.find(item => route.request().url().endsWith(item.token));
    if (!entry) return route.abort();
    return route.fulfill(json({ order: entry }));
  });
  await page.goto("/pesanan");
  for (const entry of cases) {
    const card = page.locator(".history-card").filter({ hasText: entry.orderNumber });
    await expect(card).toContainText(entry.label);
    await expect(card).toContainText(entry.paymentStatus === "PAID" ? "Sudah dibayar" : entry.paymentStatus === "CANCELLED" ? "Dibatalkan / kedaluwarsa" : "Dana dikembalikan");
  }
});
