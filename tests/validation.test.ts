import test from "node:test";
import assert from "node:assert/strict";
import { addDays, availabilityFromArrival, isValidDate, jakartaDate, orderSchema } from "../lib/validation";
test("date validation rejects impossible dates", () => { assert.equal(isValidDate("2026-02-29"), false); assert.equal(isValidDate("2028-02-29"), true); });
test("raw eggs are ready immediately and salted eggs after two days", () => {
  assert.equal(addDays("2026-10-30", 2), "2026-11-01");
  assert.equal(availabilityFromArrival("2026-10-30", "raw-duck").toISOString(), "2026-10-29T17:00:00.000Z");
  assert.equal(availabilityFromArrival("2026-10-30", "salted-raw").toISOString(), "2026-10-31T17:00:00.000Z");
  assert.equal(availabilityFromArrival("2026-10-30", "salted-cooked").toISOString(), "2026-10-31T17:00:00.000Z");
});
const baseOrder = { customerName: "Pembeli", phone: "081234567890", requestedDate: jakartaDate(), paymentMethod: "COD" as const, tip: 0 as const, items: [{ productId: "product-1", quantity: 1 }] };
test("both pickup and buyer-booked GoSend collect at the store", () => {
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "DELIVERY" }).success, false);
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "PICKUP" }).success, true);
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "GOSEND" }).success, true);
});
test("buyer addresses and coordinates are not collected", () => {
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "PICKUP", address: "Jl. Contoh 1" }).success, false);
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "GOSEND", latitude: -6.2, longitude: 106.8 }).success, false);
});
test("tip must always be zero", () => {
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "PICKUP", tip: 1 }).success, false);
  assert.equal(orderSchema.safeParse({ ...baseOrder, deliveryMethod: "GOSEND", tip: 1 }).success, false);
});
