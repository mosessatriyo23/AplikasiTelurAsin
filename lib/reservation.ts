import { Prisma, type Order } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./auth";
import { syncMidtransPayment } from "./payment-sync";

// Business policy: unpaid COD reservations last 24 hours; paid orders never expire.
// MIDTRANS reservations last 24 hours; attempted Snap checkouts require authoritative
// terminal gateway confirmation before stock can be released, even after this deadline.
export const RESERVATION_MS = 24 * 60 * 60 * 1000;
export const reservationDeadline = (now = new Date()) => new Date(now.getTime() + RESERVATION_MS);
// Owner approved: COD deadline H-1 18:00 WIB, with at least 24 hours from creation.
export function codReservationDeadline(requestedDate: string, now = new Date()) {
  const pickupEve = new Date(`${requestedDate}T18:00:00+07:00`).getTime() - 86_400_000;
  return new Date(Math.max(pickupEve, reservationDeadline(now).getTime()));
}

export async function restoreReservation(tx: Prisma.TransactionClient, order: Order, reason: string, now = new Date()) {
  if (order.stockRestored || order.completed || order.waitlisted) return false;
  const claimed = await tx.order.updateMany({
    where: { id: order.id, stockRestored: false, completed: false, paymentStatus: { not: "PAID" } },
    data: { stockRestored: true, stockRestoredAt: now, cancellationReason: reason,
      fulfillmentState: "CANCELLED", readyNotifiedAt: null },
  });
  if (!claimed.count) return false;
  const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
  for (const item of items) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
  return true;
}

export async function expireReservation(id: string, now = new Date()) {
  const order = await db.order.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Pesanan tidak ditemukan");
  if (order.paymentStatus !== "PENDING" || order.completed || !order.reservationExpiresAt || order.reservationExpiresAt > now) return order;
  if (order.paymentMethod === "MIDTRANS" && order.checkoutStartedAt) {
    if (["AMBIGUOUS", "CREATING", "DEFINITIVE_FAILURE", "TERMINAL_CONFIRMED"].includes(order.checkoutState)) return order;
    // A missing Snap token can be an interrupted successful gateway request. A 404,
    // network failure or unknown status is NOT evidence that money cannot arrive.
    try { await syncMidtransPayment(order.orderNumber); } catch { return order; }
    return (await db.order.findUniqueOrThrow({ where: { id } }));
  }
  return db.$transaction(async tx => {
    const current = await tx.order.findUniqueOrThrow({ where: { id } });
    if (current.paymentStatus !== "PENDING" || !current.reservationExpiresAt || current.reservationExpiresAt > now || current.completed || current.checkoutStartedAt) return current;
    const changed = await tx.order.updateMany({ where: { id, paymentStatus: "PENDING", completed: false }, data: { paymentStatus: "CANCELLED" } });
    if (changed.count) await restoreReservation(tx, current, "RESERVATION_EXPIRED", now);
    return tx.order.findUniqueOrThrow({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
