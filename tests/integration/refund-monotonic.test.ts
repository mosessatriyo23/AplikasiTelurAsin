import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

// Run only through scripts/run-integration-tests.cjs. Import application code
// after the guard; fixtures never create/change StoreSettings shared by suites.
test("verified full refunds are monotonic across out-of-order gateway syncs", async t => {
  const file = process.env.TEST_DATABASE_FILE;
  assert.equal(process.env.ALLOW_TEMP_TEST_DB, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.ok(file && path.isAbsolute(file));
  assert.notEqual(path.resolve(file!), path.resolve(__dirname, "../../prisma/dev.db"));
  assert.equal(path.dirname(path.dirname(file!)), path.resolve(tmpdir()));
  assert.ok(path.basename(path.dirname(file!)).startsWith("telur-integration-"));
  assert.equal(path.basename(file!), "integration.db");
  assert.equal(process.env.DATABASE_URL, `file:${file}`);

  const originalFetch = globalThis.fetch;
  const keys = ["MIDTRANS_SERVER_KEY", "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY", "APP_URL", "MIDTRANS_IS_PRODUCTION"] as const;
  const originalEnv = keys.map(key => process.env[key]);
  // Synthetic configuration only; never contact a network or consume real keys.
  process.env.MIDTRANS_SERVER_KEY = "refund-test-synthetic-key";
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = "refund-test-synthetic-client";
  process.env.APP_URL = "http://localhost:3000";
  process.env.MIDTRANS_IS_PRODUCTION = "false";
  globalThis.fetch = async () => { throw new Error("External network forbidden"); };
  const { db } = await import("../../lib/db");
  const { applyMidtransStatus, syncMidtransPayment } = await import("../../lib/payment-sync");
  const { publicOrder } = await import("../../lib/orders");
  const { orderStatusLabel } = await import("../../lib/order-status");
  const ids: string[] = [];
  try {
    for (const delayed of ["settlement", "capture"]) {
      for (const refund of ["refund", "chargeback"]) {
        await t.test(`${refund} completes before older ${delayed}`, async () => {
          const unique = `refund-monotonic-${randomUUID()}`;
          const order = await db.order.create({ data: {
            token: unique, orderNumber: unique, customerName: "Synthetic refund fixture",
            phone: "080000000000", requestedDate: "2026-10-25", deliveryMethod: "PICKUP",
            subtotal: 2000, total: 2000, paymentMethod: "MIDTRANS", paymentStatus: "PAID",
            fulfillmentState: "READY", readyNotifiedAt: new Date(), checkoutStartedAt: new Date(),
            midtransTransactionId: `tx-${unique}`,
          } });
          ids.push(order.id);
          const status = (transaction_status: string, extra = {}) => ({
            order_id: order.orderNumber, transaction_id: order.midtransTransactionId!,
            gross_amount: "2000.00", transaction_status, ...extra,
          });
          const releases: Array<() => void> = [];
          let bothEntered!: () => void;
          const entered = new Promise<void>(resolve => { bothEntered = resolve; });
          globalThis.fetch = async (url, options) => {
            assert.equal(String(url), `https://api.sandbox.midtrans.com/v2/${unique}/status`);
            assert.equal(options?.cache, "no-store");
            const index = releases.length;
            assert.ok(index < 2, "only the two expected mocked gateway calls are allowed");
            await new Promise<void>(resolve => {
              releases.push(resolve);
              if (releases.length === 2) bothEntered();
            });
            return Response.json(index === 0 ? status(delayed, { fraud_status: "accept" }) : status(refund));
          };
          const older = syncMidtransPayment(order.orderNumber);
          // The second request starts after the first entered fetch, but resolves first.
          while (releases.length === 0) await new Promise(resolve => setImmediate(resolve));
          const newer = syncMidtransPayment(order.orderNumber);
          try {
            await entered;
            releases[1]();
            const refunded = await newer;
            assert.equal(refunded.paymentStatus, "CANCELLED");
            assert.equal(refunded.fulfillmentState, "REFUNDED");
            releases[0]();
            const stale = await older;
            assert.equal(stale.paymentStatus, "CANCELLED");
            assert.equal(stale.fulfillmentState, "REFUNDED");
            // Direct apply/webhook replay must obey the same terminal rule.
            for (const response of [status(delayed, { fraud_status: "accept" }), status("partial_refund", { refund_amount: "500" }), status(refund)]) {
              await applyMidtransStatus(order.orderNumber, response, "WEBHOOK");
            }
            const current = await db.order.findUniqueOrThrow({ where: { id: order.id } });
            assert.equal(current.refundedAmount, current.total);
            assert.equal(current.fulfillmentState, "REFUNDED");
            assert.equal(current.paymentStatus, "CANCELLED");
            assert.equal(current.stockRestored, false);
            assert.equal(current.readyNotifiedAt, null);
            const visible = publicOrder(current);
            assert.equal(visible.paymentStatus, "CANCELLED");
            assert.equal(visible.refundedAmount, visible.total);
            assert.equal(visible.fulfillmentState, "REFUNDED");
            assert.equal(orderStatusLabel(visible), "Dana dikembalikan");
            // Same paid-only net revenue aggregation used by the admin summary,
            // scoped to this suite's fixture instead of concurrent suites' rows.
            const revenue = await db.order.aggregate({ where: { id: order.id, paymentStatus: "PAID" }, _sum: { total: true, refundedAmount: true } });
            assert.equal((revenue._sum.total ?? 0) - (revenue._sum.refundedAmount ?? 0), 0);
            assert.equal(await db.paymentAudit.count({ where: { orderId: order.id } }), 1);
            assert.equal(await db.notification.count({ where: { orderId: order.id } }), 1);
          } finally {
            releases.forEach(release => release());
            await Promise.allSettled([older, newer]);
            globalThis.fetch = async () => { throw new Error("External network forbidden"); };
          }
        });
      }
    }
  } finally {
    await db.order.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => {
      if (originalEnv[index] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[index];
    });
  }
});
