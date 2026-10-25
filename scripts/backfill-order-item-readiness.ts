import { Prisma, PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidDate } from "../lib/validation";

// Never infer historical readiness. The manifest is an operator-reviewed mapping.
type Entry = { id: string; productId: string; orderCreatedAt: string; readyDate: string };
const db = new PrismaClient();
async function main() {
  const [file, flag, ...extra] = process.argv.slice(2);
  const apply = flag === "--apply";
  if (!file || extra.length || (flag && !apply)) throw new Error("Usage: tsx scripts/backfill-order-item-readiness.ts <reviewed-manifest.json> [--apply]");
  // Do not silently select the developer database from an implicit environment file.
  if (!process.env.DATABASE_URL?.startsWith("file:")) throw new Error("Explicit SQLite DATABASE_URL required");
  const manifest: unknown = JSON.parse(readFileSync(resolve(file), "utf8"));
  if (!manifest || typeof manifest !== "object" || !Array.isArray((manifest as { items?: unknown }).items)) throw new Error("Manifest items wajib berupa array");
  const entries = (manifest as { items: Entry[] }).items;
  if (entries.some(e => !e || typeof e.id !== "string" || !e.id || typeof e.productId !== "string" || !e.productId ||
    typeof e.orderCreatedAt !== "string" || !Number.isFinite(Date.parse(e.orderCreatedAt)) ||
    typeof e.readyDate !== "string" || !isValidDate(e.readyDate)) ||
    new Set(entries.map(e => e.id)).size !== entries.length) throw new Error("Manifest tidak valid atau ID duplikat");
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const readyAt = (entry: Entry) => new Date(`${entry.readyDate}T00:00:00+07:00`);
  const verify = async (tx: Prisma.TransactionClient) => {
    const items = await tx.orderItem.findMany({
      where: { OR: [{ readyAt: null }, { id: { in: entries.map(entry => entry.id) } }] },
      select: { id: true, productId: true, readyAt: true, order: { select: { createdAt: true } } },
    });
    // Exact coverage of unknown items; previously applied entries may be replayed only unchanged.
    if (items.length !== entries.length || items.some(item => {
      const entry = byId.get(item.id);
      return !entry || entry.productId !== item.productId || entry.orderCreatedAt !== item.order.createdAt.toISOString() ||
        (item.readyAt !== null && item.readyAt.getTime() !== readyAt(entry).getTime());
    })) throw new Error("Manifest tidak cocok; perlu tinjauan ulang");
    return items;
  };
  await db.$transaction(async tx => {
    const items = await verify(tx);
    // This private local snapshot is NOT a full database backup.
    const snapshot = resolve(`${file}.before-${Date.now()}.json`);
    writeFileSync(snapshot, JSON.stringify({ items, manifest }, null, 2), { flag: "wx", mode: 0o600 });
    if (!apply) return;
    for (const item of items) {
      if (item.readyAt !== null) continue;
      const entry = byId.get(item.id)!;
      const changed = await tx.orderItem.updateMany({ where: { id: entry.id, productId: entry.productId, readyAt: null, order: { createdAt: new Date(entry.orderCreatedAt) } }, data: { readyAt: readyAt(entry) } });
      if (changed.count !== 1) throw new Error("Item berubah; transaksi dibatalkan");
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log(apply ? "Manifest ditetapkan atau sudah diterapkan; transaksi berhasil." : "Dry-run berhasil; tidak ada item diubah. Backup DB dan hentikan writer sebelum --apply.");
}
main().catch(() => { console.error("Backfill gagal; periksa manifest, backup dan kondisi DB. Tidak ada detail sensitif dicetak."); process.exitCode = 1; }).finally(() => db.$disconnect());
