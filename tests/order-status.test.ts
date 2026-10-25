import test from "node:test";
import assert from "node:assert/strict";
import { orderStatusLabel } from "../lib/order-status";
test("completed cancelled refunded and review override stale ready timestamps", () => {
 const readyNotifiedAt = new Date();
 assert.equal(orderStatusLabel({ readyNotifiedAt, fulfillmentState:"COMPLETED", completed:true }), "Pesanan selesai");
 assert.equal(orderStatusLabel({ readyNotifiedAt, fulfillmentState:"CANCELLED", paymentStatus:"CANCELLED" }), "Pesanan dibatalkan");
 assert.equal(orderStatusLabel({ readyNotifiedAt, fulfillmentState:"REFUNDED", refundedAmount:100,total:100 }), "Dana dikembalikan");
 assert.equal(orderStatusLabel({ readyNotifiedAt, fulfillmentState:"REVIEW", refundedAmount:50,total:100 }), "Perlu tinjauan pengelola");
 assert.equal(orderStatusLabel({ readyNotifiedAt, fulfillmentState:"READY" }), "Pesanan siap");
});
