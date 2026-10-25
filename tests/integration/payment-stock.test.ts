import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";

// Must be launched through scripts/run-integration-tests.cjs, which migrates
// only an isolated OS-temp SQLite database before this module imports application code.
test("isolated reservation/payment stock integration", async t => {
  const file = process.env.TEST_DATABASE_FILE;
  assert.equal(process.env.ALLOW_TEMP_TEST_DB, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.ok(file && path.isAbsolute(file));
  assert.notEqual(path.resolve(file!), path.resolve(__dirname, "../../prisma/dev.db"));
  assert.ok(process.env.DATABASE_URL?.startsWith("file:"));
  assert.equal(path.resolve(process.env.DATABASE_URL!.slice(5)), path.resolve(file!));
  // Fail every unmocked external request.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External network forbidden in integration tests"); };
  const { db } = await import("../../lib/db");
  const { createOrder } = await import("../../lib/orders");
  const { expireReservation } = await import("../../lib/reservation");
  const { applyMidtransStatus } = await import("../../lib/payment-sync");
  const { createSnapCheckout } = await import("../../lib/midtrans");
  const { transitionFulfillment } = await import("../../lib/payment-fulfillment");
  const { dispatchReadyPush } = await import("../../lib/push-delivery");
  let seq = 0;
  const fixture = async (method: "COD" | "MIDTRANS" = "MIDTRANS") => {
    const product = await db.product.create({ data: { slug: `p-${seq++}`, name: "Egg", price: 1000, stock: 5, readyStockReconciled: true } });
    const order = await createOrder({ customerName: "Test", phone: "081234567890", requestedDate: "2026-10-25", deliveryMethod: "PICKUP", paymentMethod: method, tip: 0, items: [{ productId: product.id, quantity: 2 }] });
    const status = (transaction_status: string, extra = {}) => ({ order_id: order.orderNumber, transaction_id: `tx-${order.id}`, gross_amount: "2000.00", transaction_status, ...extra });
    return { product, order, status };
  };
  try {
    await t.test("store configuration required, no stock deducted", async () => {
      await assert.rejects(fixture(), /Lokasi toko/);
    });
    await db.storeSettings.create({ data: { id: 1, address: "Test", latitude: -6, longitude: 106 } });
    await t.test("expiry restores once, repeat and concurrent jobs safe", async () => {
      const { product, order } = await fixture("COD");
      await db.order.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(0) } });
      await Promise.allSettled([expireReservation(order.id), expireReservation(order.id)]);
      await expireReservation(order.id);
      const current = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 5);
      assert.equal(current.cancellationReason, "RESERVATION_EXPIRED");
      assert.ok(current.stockRestoredAt);
    });
    await t.test("future COD remains reserved beyond 24 hours until pickup eve 18 WIB",async()=>{
      const product=await db.product.create({data:{slug:`future-cod-${seq++}`,name:"Egg",price:1000,stock:2,readyStockReconciled:true}});
      const order=await createOrder({customerName:"Test",phone:"081234567890",requestedDate:"2026-11-10",deliveryMethod:"PICKUP",paymentMethod:"COD",tip:0,items:[{productId:product.id,quantity:1}]});
      const after24h=new Date(order.createdAt.getTime()+25*60*60*1000);
      assert.ok(order.reservationExpiresAt&&order.reservationExpiresAt>after24h);
      await expireReservation(order.id,after24h);
      assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,1);
      await expireReservation(order.id,new Date("2026-11-09T11:00:01.000Z"));
      assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,2);
    });
    await t.test("paid COD is exempt from expiry", async () => {
      const { product, order } = await fixture("COD");
      await transitionFulfillment(order.id, "COD_PAID");
      await db.order.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(0) } });
      await expireReservation(order.id);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    });
    await t.test("Snap attempt without token + 404/network uncertainty keeps stock", async () => {
      const { product, order } = await fixture();
      await db.order.update({ where: { id: order.id }, data: { checkoutStartedAt: new Date(), reservationExpiresAt: new Date(0) } });
      process.env.MIDTRANS_SERVER_KEY = "test-key";
      process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = "test-client";
      process.env.APP_URL = "http://localhost:3000";
      globalThis.fetch = async () => new Response("{}", { status: 404 });
      await expireReservation(order.id);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
      await assert.rejects(createSnapCheckout(order.token));
    });
    await t.test("15 minute local status polling never consumes shared sync limit",async()=>{
      const {order}=await fixture();
      const {GET}=await import("../../app/api/orders/[token]/route");
      const previous=process.env.TRUSTED_CLIENT_IP_HEADER;delete process.env.TRUSTED_CLIENT_IP_HEADER;
      const before=await db.rateLimit.count();
      try{for(let tick=0;tick<=900000;tick+=20000){for(let tab=0;tab<4;tab++){
        const response=await GET(new Request("https://example.test/api/orders/test"),{params:Promise.resolve({token:order.token})});
        assert.equal(response.status,200);
      }}assert.equal(await db.rateLimit.count(),before);}finally{if(previous!==undefined)process.env.TRUSTED_CLIENT_IP_HEADER=previous}
    });
    await t.test("failed checkout classifies validation rejection versus network ambiguity without releasing stock",async()=>{
      for(const reject of [false,true]){
        const {product,order}=await fixture();
        globalThis.fetch=async()=>{if(!reject)throw new Error("mock timeout");return Response.json({error_messages:["mock validation rejection"]},{status:400})};
        await assert.rejects(createSnapCheckout(order.token));
        const current=await db.order.findUniqueOrThrow({where:{id:order.id}});
        assert.equal(current.checkoutState,reject?"DEFINITIVE_FAILURE":"AMBIGUOUS");
        assert.equal(current.fulfillmentState,"REVIEW");
        assert.ok(current.checkoutReviewAlertedAt);
        assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,3);
      }
    });
    await t.test("ambiguous checkout requires fresh terminal proof and explicit admin resolution", async () => {
      const { product, order, status } = await fixture();
      const { resolveAmbiguousCheckout, escalateStaleCheckouts } = await import("../../lib/checkout-review");
      await db.order.update({where:{id:order.id},data:{checkoutState:"CREATING",checkoutStartedAt:new Date(0),reservationExpiresAt:new Date(0)}});
      await escalateStaleCheckouts(); await escalateStaleCheckouts();
      assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).checkoutState,"AMBIGUOUS");
      globalThis.fetch=async()=>new Response("{}",{status:404});
      await assert.rejects(resolveAmbiguousCheckout(order.id,"test-operator"));
      await expireReservation(order.id);
      assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,3);
      globalThis.fetch=async()=>Response.json(status("expire"));
      await applyMidtransStatus(order.orderNumber,status("expire"));
      await applyMidtransStatus(order.orderNumber,status("expire"));
      assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,3);
      await Promise.allSettled([resolveAmbiguousCheckout(order.id,"test-operator"),resolveAmbiguousCheckout(order.id,"test-operator")]);
      await resolveAmbiguousCheckout(order.id,"test-operator");
      assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,5);
      const late=await applyMidtransStatus(order.orderNumber,status("settlement"));
      assert.equal(late.fulfillmentState,"REVIEW");
      assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,5);
    });
    await t.test("terminal status repeated restores once; late settlement blocks fulfillment", async () => {
      const { product, order, status } = await fixture();
      await Promise.allSettled([applyMidtransStatus(order.orderNumber, status("expire")), applyMidtransStatus(order.orderNumber, status("expire"))]);
      await applyMidtransStatus(order.orderNumber, status("expire"));
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 5);
      const late = await applyMidtransStatus(order.orderNumber, status("settlement"));
      assert.equal(late.paymentStatus, "PAID");
      assert.equal(late.fulfillmentState, "REVIEW");
      assert.equal(late.readyNotifiedAt, null);
      const { allocateWaitlistedOrders } = await import("../../lib/stock-allocation");
      await allocateWaitlistedOrders();
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 5);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).fulfillmentState, "REVIEW");
      await assert.rejects(transitionFulfillment(order.id, "READY"));
      await assert.rejects(transitionFulfillment(order.id, "COMPLETE"));
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 5);
    });
    await t.test("partial/full refund explicit, ready invalidated, no automatic physical restock", async () => {
      const { product, order, status } = await fixture();
      await applyMidtransStatus(order.orderNumber, status("settlement"));
      await transitionFulfillment(order.id, "READY");
      const partial = await applyMidtransStatus(order.orderNumber, status("partial_refund", { refund_amount: "500.00" }));
      assert.equal(partial.paymentStatus, "PAID");
      assert.equal(partial.fulfillmentState, "REVIEW");
      assert.equal(partial.readyNotifiedAt, null);
      await assert.rejects(transitionFulfillment(order.id, "COMPLETE"));
      const full = await applyMidtransStatus(order.orderNumber, status("refund"));
      assert.equal(full.refundedAmount, 2000);
      assert.equal(full.fulfillmentState, "REFUNDED");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
      await assert.rejects(applyMidtransStatus(order.orderNumber, status("partial_chargeback")));
    });
    await t.test("settlement duplicate, stale failure and mismatch are safe", async () => {
      const { product, order, status } = await fixture();
      await applyMidtransStatus(order.orderNumber, status("settlement"));
      await applyMidtransStatus(order.orderNumber, status("settlement"));
      await applyMidtransStatus(order.orderNumber, status("expire"));
      await assert.rejects(applyMidtransStatus(order.orderNumber, status("settlement", { gross_amount: "1.00" })));
      await assert.rejects(applyMidtransStatus(order.orderNumber, status("settlement", { transaction_id: "wrong" })));
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
      await transitionFulfillment(order.id, "READY");
      await transitionFulfillment(order.id, "COMPLETE");
      await transitionFulfillment(order.id, "COMPLETE");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    });
    await t.test("duplicate batch release increments ready stock only once", async () => {
      const { releaseDueBatches } = await import("../../lib/stock-readiness");
      const product = await db.product.create({ data: { slug: `p-${seq++}`, name: "Batch", stock: 1, price: 1000, readyStockReconciled: true } });
      const batch = await db.stockBatch.create({ data: { productId: product.id, quantity: 4, readyAt: new Date(0) } });
      const future = await db.stockBatch.create({ data: { productId: product.id, quantity: 7, readyAt: new Date("2099-01-01") } });
      assert.equal(await releaseDueBatches(), 4);
      assert.equal(await releaseDueBatches(), 0);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 5);
      assert.ok((await db.stockBatch.findUniqueOrThrow({ where: { id: batch.id } })).releasedAt);
      assert.equal((await db.stockBatch.findUniqueOrThrow({ where: { id: future.id } })).releasedAt, null);
    });
    await t.test("duplicate checkout claim sends exactly one mocked gateway POST", async () => {
      const { order, product } = await fixture();
      let calls = 0;
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      const gate = new Promise<void>(resolve => { release = resolve; });
      const previousFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        assert.equal(String(url), "https://app.sandbox.midtrans.com/snap/v1/transactions");
        assert.equal(options?.method, "POST");
        calls++;
        entered();
        await gate;
        return Response.json({ token: "synthetic-snap", redirect_url: "https://example.invalid/checkout" });
      };
      const first = createSnapCheckout(order.token);
      try {
        await started;
        await assert.rejects(createSnapCheckout(order.token), (error: any) => error.status === 409);
        release();
        await first;
        await createSnapCheckout(order.token);
        assert.equal(calls, 1);
        assert.ok((await db.order.findUniqueOrThrow({ where: { id: order.id } })).checkoutStartedAt);
        assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
      } finally { release(); await first.catch(() => {}); globalThis.fetch = previousFetch; }
    });
    await t.test("signed webhook duplicates and independently computed SHA512 fixtures", async () => {
      const { POST } = await import("../../app/api/midtrans/notification/route");
      const { order, product } = await fixture();
      await db.order.update({ where: { id: order.id }, data: { orderNumber: "integration-webhook" } });
      // Fixed SHA512 vectors computed independently with .NET SHA512, not the application signer.
      const validSignature = "3eacb7d560814efc144b98dfdba8beeb315cfad29236c1ec7c17bb4d23512ce6f2196c874f43e0c4ed6e6bba43cc0e97ca80ac96167b70c83d1a65ba796df999";
      const wrongAmountSignature = "2f4abe847b60275d5a339605dd70b396f74b73ee0ad17553403c3bd74a04c9b1bc0c42422398e23c905a603096024a191014a1d827373c931da303427c91f02c";
      const request = (gross_amount = "2000.00", signature_key = validSignature) => new Request("http://localhost:3000/api/midtrans/notification", { method: "POST", body: JSON.stringify({ order_id: "integration-webhook", status_code: "200", gross_amount, signature_key }) });
      let calls = 0;
      const previousFetch = globalThis.fetch;
      globalThis.fetch = async url => {
        assert.equal(String(url), "https://api.sandbox.midtrans.com/v2/integration-webhook/status");
        calls++;
        return Response.json({ order_id: "integration-webhook", transaction_id: "synthetic-webhook-transaction", gross_amount: "2000.00", transaction_status: "settlement" });
      };
      try {
        assert.equal((await POST(request())).status, 200);
        assert.equal((await POST(request())).status, 200);
        assert.equal(calls, 2);
        assert.equal((await POST(request("1.00"))).status, 401);
        assert.equal((await POST(request("1.00", wrongAmountSignature))).status, 400);
        assert.equal((await POST(request("2000.00", "0".repeat(128)))).status, 401);
        assert.equal(calls, 2);
        assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, "PAID");
        assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
      } finally { globalThis.fetch = previousFetch; }
    });
    await t.test("duplicate COD paid, ready and complete preserve timestamps and notifications", async () => {
      const { order, product } = await fixture("COD");
      await transitionFulfillment(order.id, "COD_PAID");
      await transitionFulfillment(order.id, "COD_PAID");
      assert.equal(await db.notification.count({ where: { orderId: order.id, type: "PAYMENT_UPDATE" } }), 1);
      const ready = await transitionFulfillment(order.id, "READY");
      const readyAgain = await transitionFulfillment(order.id, "READY");
      assert.equal(readyAgain.readyNotifiedAt?.getTime(), ready.readyNotifiedAt?.getTime());
      const completed = await transitionFulfillment(order.id, "COMPLETE");
      const completedAgain = await transitionFulfillment(order.id, "COMPLETE");
      assert.equal(completedAgain.completedAt?.getTime(), completed.completedAt?.getTime());
      assert.equal(completedAgain.fulfillmentState, "COMPLETED");
      assert.equal(completedAgain.paymentStatus, "PAID");
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    });
    await t.test("persistent rate limit returns 429 and Retry-After from stored counters", async () => {
      const { enforceRateLimit, rateKey } = await import("../../lib/rate-limit");
      const { apiError } = await import("../../lib/api");
      const previousHeader = process.env.TRUSTED_CLIENT_IP_HEADER;
      delete process.env.TRUSTED_CLIENT_IP_HEADER;
      try {
        const request = new Request("http://localhost:3000");
        for (let i = 0; i < 15; i++) await enforceRateLimit("checkout", request);
        const key = rateKey("checkout", "shared-untrusted");
        assert.equal((await db.rateLimit.findUniqueOrThrow({ where: { key } })).count, 15);
        // A fresh client observes the same persisted bucket (no in-memory counter).
        const { PrismaClient } = await import("@prisma/client");
        const other = new PrismaClient();
        try { assert.equal((await other.rateLimit.findUniqueOrThrow({ where: { key } })).count, 15); }
        finally { await other.$disconnect(); }
        for (let i = 0; i < 2; i++) {
          await assert.rejects(enforceRateLimit("checkout", new Request("http://localhost:3000")), error => {
            const response = apiError(error);
            assert.equal(response.status, 429);
            const retry = Number(response.headers.get("Retry-After"));
            assert.ok(retry > 0 && retry <= 900);
            return true;
          });
        }
        await db.rateLimit.update({ where: { key }, data: { expiresAt: new Date(0) } });
        await enforceRateLimit("checkout", request);
        assert.equal((await db.rateLimit.findUniqueOrThrow({ where: { key } })).count, 1);
      } finally {
        if (previousHeader === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER;
        else process.env.TRUSTED_CLIENT_IP_HEADER = previousHeader;
      }
    });
    await t.test("Web Push retry, active/stale claims, duplicate delivery and 404/410 cleanup", async () => {
      const { order } = await fixture("COD");
      await transitionFulfillment(order.id, "READY");
      const subscription = await db.pushSubscription.create({ data: { orderId: order.id, endpoint: "https://fcm.googleapis.com/integration-retry", p256dh: "synthetic", auth: "synthetic" } });
      let calls = 0;
      let fail = true;
      const push = { configure: () => {}, send: async () => {
        calls++;
        if (fail) throw { statusCode: 503 };
        return { statusCode: 201, body: "", headers: {} };
      } };
      assert.equal((await dispatchReadyPush(order.id, subscription.id, push)).failed, 1);
      let row = await db.pushSubscription.findUniqueOrThrow({ where: { id: subscription.id } });
      assert.equal(row.sendingAt, null);
      assert.equal(row.readyPushSentAt, null);
      assert.equal(row.lastPushError, "service_unavailable");
      assert.equal(row.pushAttempts, 1);
      await db.pushSubscription.update({ where: { id: row.id }, data: { sendingAt: new Date() } });
      assert.equal((await dispatchReadyPush(order.id, row.id, push)).inFlight, 1);
      assert.equal(calls, 1);
      await db.pushSubscription.update({ where: { id: row.id }, data: { sendingAt: new Date(Date.now() - 120_000) } });
      fail = false;
      assert.equal((await dispatchReadyPush(order.id, row.id, push)).sent, 1);
      row = await db.pushSubscription.findUniqueOrThrow({ where: { id: row.id } });
      assert.ok(row.readyPushSentAt);
      assert.equal(row.sendingAt, null);
      assert.equal(row.lastPushError, null);
      assert.equal(row.pushAttempts, 2);
      assert.equal((await dispatchReadyPush(order.id, row.id, push)).alreadySent, 1);
      assert.equal(calls, 2);
      for (const statusCode of [404, 410]) {
        const stale = await db.pushSubscription.create({ data: { orderId: order.id, endpoint: `https://fcm.googleapis.com/integration-${statusCode}`, p256dh: "synthetic", auth: "synthetic" } });
        const report = await dispatchReadyPush(order.id, stale.id, { configure: () => {}, send: async () => { throw { statusCode }; } });
        assert.equal(report.failed, 1);
        assert.equal(await db.pushSubscription.findUnique({ where: { id: stale.id } }), null);
      }
    });
    await t.test("concurrent order attempts never oversell", async () => {
      const product = await db.product.create({ data: { slug: `p-${seq++}`, name: "Limited", price: 1000, stock: 2, readyStockReconciled: true } });
      const input = { customerName: "Test", phone: "081234567890", requestedDate: "2026-10-25", deliveryMethod: "PICKUP" as const, paymentMethod: "COD" as const, tip: 0 as const, items: [{ productId: product.id, quantity: 2 }] };
      const results = await Promise.allSettled([createOrder(input), createOrder(input)]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await db.$disconnect();
    // The runner owns temporary database cleanup.
  }
});
