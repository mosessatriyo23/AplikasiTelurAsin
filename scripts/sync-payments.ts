import { db } from "../lib/db";
import { syncMidtransPayment } from "../lib/payment-sync";

async function main() {
  const stale = new Date(Date.now() - 60_000);
  const orders = await db.order.findMany({
    where: { paymentMethod: "MIDTRANS", checkoutStartedAt: { not: null }, AND: [
      { paymentStatus: { in: ["PENDING", "PAID"] } },
      { OR: [{ paymentCheckedAt: null }, { paymentCheckedAt: { lt: stale } }] },
    ] }, 
    select: { id: true, orderNumber: true }, take: 100,
  });
  for (const order of orders) {
    const claimed = await db.order.updateMany({ where: { id: order.id, OR: [{ paymentCheckedAt: null }, { paymentCheckedAt: { lt: stale } }] }, data: { paymentCheckedAt: new Date() } });
    if (!claimed.count) continue;
    try { await syncMidtransPayment(order.orderNumber); }
    catch { console.error("Payment sync failed", { orderId: order.id, category: "gateway_or_transition" }); }
  }
}
main().finally(() => db.$disconnect());
