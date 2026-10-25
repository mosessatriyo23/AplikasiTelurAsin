import test from "node:test";
import assert from "node:assert/strict";
import { stockReadiness, presentStockProduct } from "../lib/stock-readiness";
import { availabilityFromArrival } from "../lib/validation";

test("WIB midnight: raw duck ready on arrival day, salted eggs two calendar days later", () => {
  const raw = availabilityFromArrival("2026-10-22", "raw-duck");
  const salted = availabilityFromArrival("2026-10-22", "salted-raw");
  assert.equal(raw.toISOString(), "2026-10-21T17:00:00.000Z");
  assert.equal(salted.toISOString(), "2026-10-23T17:00:00.000Z");
  assert.equal(stockReadiness([{ quantity: 6, readyAt: raw, releasedAt: null }], new Date("2026-10-21T16:59:59Z")).due, 0);
  assert.equal(stockReadiness([{ quantity: 6, readyAt: raw, releasedAt: null }], raw).due, 6);
});

test("pending batches don't freeze ready stock or count released batches twice", () => {
  const pending = { quantity: 10, readyAt: availabilityFromArrival("2026-10-25", "salted-cooked"), releasedAt: null };
  const released = { quantity: 7, readyAt: new Date("2026-10-01"), releasedAt: new Date("2026-10-02") };
  const now = new Date("2026-10-22");
  assert.deepEqual(stockReadiness([pending, released], now), { inProduction: 10, nextReadyAt: pending.readyAt, due: 0 });
  assert.equal(presentStockProduct({ stock: 4, readyStockReconciled: true, availableAt: null, batches: [pending, released] }, now).stock, 4);
  assert.equal(presentStockProduct({ stock: 4, readyStockReconciled: false, availableAt: null, batches: [] }, now).stock, 0);
});
