import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidDate } from "../lib/validation";

/**
 * Explicit operator-reviewed manifest, e.g.
 * { "products": [{ "id": "...", "expectedStock": 50, "ready": 20,
 *   "pending": [{ "quantity": 30, "readyDate": "2026-10-25" }] }] }
 * expectedStock is the ALREADY-NET Product.stock (existing reservations have been deducted).
 * Never subtract orders again. Do not guess a pending quantity from Product.availableAt.
 * Run only after schema deployment and while all stock writers are stopped.
 */
const db = new PrismaClient();
type Entry = { id: string; expectedStock: number; ready: number; pending: { quantity: number; readyDate: string }[] };
function validCount(value: number) { return Number.isSafeInteger(value) && value >= 0; }
async function main() {
  const path = process.argv[2];
  const apply = process.argv[3] === "--apply";
  if (!path || (process.argv[3] && !apply) || (apply && process.argv[4] !== "--backup-verified") || process.argv.length > (apply ? 5 : 3)) throw new Error("Usage: tsx scripts/reconcile-ready-stock.ts <reviewed-manifest.json> [--apply --backup-verified]. Stop all writers and verify a full DB backup first.");
  const manifest = JSON.parse(readFileSync(resolve(path), "utf8")) as { products: Entry[] };
  if (!Array.isArray(manifest.products)) throw new Error("Manifest products wajib berupa array");
  const products = await db.product.findMany({ include: { batches: true } });
  if (manifest.products.length !== products.length || new Set(manifest.products.map(p => p.id)).size !== products.length) throw new Error("Manifest harus mencakup semua produk tepat sekali");
  for (const entry of manifest.products) {
    const product = products.find(p => p.id === entry.id);
    if (!product || product.readyStockReconciled || product.batches.length || product.stock !== entry.expectedStock ||
        !validCount(entry.ready) || !validCount(entry.expectedStock) || !Array.isArray(entry.pending) ||
        entry.pending.some(batch => !validCount(batch.quantity) || batch.quantity === 0 || !isValidDate(batch.readyDate)) ||
        entry.ready + entry.pending.reduce((sum, batch) => sum + batch.quantity, 0) !== entry.expectedStock) {
      throw new Error(`Rekonsiliasi tidak aman untuk ${entry.id}; periksa stok, tanggal, dan batch`);
    }
  }
  const orders = await db.order.findMany({ select: { id: true, orderNumber: true, waitlisted: true, stockRestored: true, paymentStatus: true, items: { select: { productId: true, quantity: true } } } });
  const backupPath = resolve(`prisma/stock-reconciliation-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  mkdirSync(resolve("prisma"), { recursive: true });
  writeFileSync(backupPath, JSON.stringify({ generatedAt: new Date(), products, orders, manifest }, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Snapshot lokal dibuat: ${backupPath}; bukan backup database. Tinjau pembagian ready/pending. Reservasi pesanan TIDAK dikurangi ulang.`);
  if (!apply) { console.log("Dry-run saja. Jalankan ulang dengan --apply --backup-verified setelah backup database dipulihkan di lingkungan uji."); return; }
  await db.$transaction(async tx => {
    for (const entry of manifest.products) {
      const changed = await tx.product.updateMany({ where: { id: entry.id, stock: entry.expectedStock, readyStockReconciled: false }, data: { stock: entry.ready, availableAt: null, readyStockReconciled: true } });
      if (changed.count !== 1 || await tx.stockBatch.count({ where: { productId: entry.id } })) throw new Error(`Stok ${entry.id} berubah; transaksi dibatalkan`);
      for (const batch of entry.pending) await tx.stockBatch.create({ data: {
        productId: entry.id, quantity: batch.quantity, readyAt: new Date(`${batch.readyDate}T00:00:00+07:00`),
      } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log("Rekonsiliasi selesai; legacy orders (termasuk waitlisted/PAID) tidak diubah.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
