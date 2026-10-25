import { db } from "../lib/db";
import { expireReservation } from "../lib/reservation";
import { escalateStaleCheckouts } from "../lib/checkout-review";

async function main() {
  await escalateStaleCheckouts();
  const orders = await db.order.findMany({ where: { paymentStatus: "PENDING", completed: false, reservationExpiresAt: { lte: new Date() } }, select: { id: true }, take: 100 });
  for (const order of orders) {
    try { await expireReservation(order.id); }
    catch { console.error("Reservation expiry failed", { orderId: order.id }); }
  }
}
main().finally(() => db.$disconnect());
