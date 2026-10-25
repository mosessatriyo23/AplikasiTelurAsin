import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

test("fresh deploy and reviewed historical readiness rollback/replay", async () => {
  assert.equal(process.env.ALLOW_TEMP_TEST_DB, "true");
  assert.equal(process.env.NODE_ENV, "test");
  const temp = mkdtempSync(join(tmpdir(), "telur-migration-"));
  const file = resolve(temp, "migration.db");
  const original = resolve("prisma/dev.db");
  assert.notEqual(file, original);
  assert.ok(file.startsWith(resolve(temp) + sep));
  assert.ok(!relative(resolve("."), file).startsWith(`prisma${sep}`));
  assert.notEqual(process.env.TEST_DATABASE_FILE && resolve(process.env.TEST_DATABASE_FILE), original);
  const url = `file:${file}`;
  const require = createRequire(import.meta.url);
  const tsxCli = require.resolve("tsx/cli");
  const prisma = (args: string[]) => spawnSync("npx", ["prisma", ...args], { cwd: resolve("."), env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", shell: process.platform === "win32" });
  // A fresh database is built only from checked-in migrations; replay is a no-op.
  assert.equal(prisma(["migrate", "deploy"]).status, 0);
  assert.equal(prisma(["migrate", "deploy"]).status, 0);
  const db = new PrismaClient({ datasources: { db: { url } } });
  const manifest = join(temp, "manifest.json");
  const run = (apply = false) => spawnSync(process.execPath, [tsxCli, "scripts/backfill-order-item-readiness.ts", manifest, ...(apply ? ["--apply"] : [])], {
    cwd: resolve("."), env: { ...process.env, DATABASE_URL: url }, encoding: "utf8",
  });
  try {
    const product = await db.product.create({ data: { slug: "migration-test", name: "Test", price: 1 } });
    const order = await db.order.create({ data: { token: "migration-test", orderNumber: "migration-test", customerName: "Test", phone: "0", requestedDate: "2026-10-25", deliveryMethod: "PICKUP", subtotal: 2, total: 2, paymentMethod: "COD", fulfillmentState: "REVIEW", items: { create: [
      { productId: product.id, name: "First", price: 1, quantity: 1, lineTotal: 1 },
      { productId: product.id, name: "Second", price: 1, quantity: 1, lineTotal: 1 },
    ] } }, include: { items: true } });
    const entries = order.items.map(item => ({ id: item.id, productId: product.id, orderCreatedAt: order.createdAt.toISOString(), readyDate: "2026-10-25" }));
    const readyDates = async () => (await db.orderItem.findMany({ where: { orderId: order.id }, select: { readyAt: true } })).map(item => item.readyAt);
    writeFileSync(manifest, JSON.stringify({ items: [{ ...entries[0], productId: "wrong" }, entries[1]] }));
    assert.notEqual(run(true).status, 0);
    assert.deepEqual(await readyDates(), [null, null]);
    writeFileSync(manifest, JSON.stringify({ items: entries }));
    assert.equal(run().status, 0);
    assert.deepEqual(await readyDates(), [null, null]);

    // The first update records a marker inside the backfill transaction. The next
    // update aborts via SQLite, proving the earlier update is rolled back too.
    await db.$executeRawUnsafe('CREATE TABLE "BackfillTestUpdateMarker" ("id" INTEGER PRIMARY KEY)');
    await db.$executeRawUnsafe('CREATE TRIGGER "BackfillTestFailSecond" BEFORE UPDATE OF "readyAt" ON "OrderItem" WHEN NEW."readyAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "BackfillTestUpdateMarker") BEGIN SELECT RAISE(ABORT, "test second update failure"); END');
    await db.$executeRawUnsafe('CREATE TRIGGER "BackfillTestMarkFirst" AFTER UPDATE OF "readyAt" ON "OrderItem" WHEN NEW."readyAt" IS NOT NULL BEGIN INSERT INTO "BackfillTestUpdateMarker" ("id") VALUES (1); END');
    assert.notEqual(run(true).status, 0);
    assert.deepEqual(await readyDates(), [null, null]);
    const markers = await db.$queryRawUnsafe<{ id: number }[]>('SELECT "id" FROM "BackfillTestUpdateMarker"');
    assert.deepEqual(markers, []);
    await db.$executeRawUnsafe('DROP TRIGGER "BackfillTestFailSecond"');
    await db.$executeRawUnsafe('DROP TRIGGER "BackfillTestMarkFirst"');
    assert.equal(run(true).status, 0);
    const dates = (await readyDates()).map(date => date?.toISOString());
    assert.deepEqual(dates, ["2026-10-24T17:00:00.000Z", "2026-10-24T17:00:00.000Z"]);
    assert.equal(run(true).status, 0);
    assert.deepEqual((await readyDates()).map(date => date?.toISOString()), dates);
    assert.ok(readdirSync(temp).some(name => name.startsWith("manifest.json.before-")));
  } finally { await db.$disconnect(); rmSync(temp, { recursive: true, force: true }); }
});
