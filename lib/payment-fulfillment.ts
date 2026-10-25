import { db } from "./db";
import { ApiError } from "./auth";
import { completionBlockReason } from "./completion-readiness";
import { expireReservation } from "./reservation";

export async function transitionFulfillment(id: string, action: "READY" | "COMPLETE" | "COD_PAID") {
  await expireReservation(id);
  return db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new ApiError(404, "Pesanan tidak ditemukan");
    if (action === "COMPLETE" && order.completed) return order;
    if (["CANCELLED", "REFUNDED", "REVIEW"].includes(order.fulfillmentState) || order.stockRestored || order.waitlisted || ["CANCELLED", "FAILED"].includes(order.paymentStatus)) throw new ApiError(409, "Pesanan dibatalkan, stok dilepas, atau perlu tinjauan admin");
    if (action === "COD_PAID") {
      if (order.paymentMethod !== "COD") throw new ApiError(409, "Hanya COD dapat dibayar manual");
      if (order.paymentStatus === "PAID") return order;
      return tx.order.update({ where: { id }, data: { paymentStatus: "PAID", notifications: { create: { type: "PAYMENT_UPDATE", message: `${order.orderNumber}: pembayaran COD dikonfirmasi admin` } } } });
    }
    if (order.paymentMethod === "MIDTRANS" && order.paymentStatus !== "PAID") throw new ApiError(409, "Pembayaran Midtrans belum terverifikasi");
    const reason = completionBlockReason(order.items, new Date());
    if (reason) throw new ApiError(409, reason);
    if (action === "READY") {
      if (order.completed && !order.readyNotifiedAt) throw new ApiError(409, "Pesanan telah selesai");
      if (order.readyNotifiedAt) return order;
      return tx.order.update({ where: { id }, data: { readyNotifiedAt: new Date(), fulfillmentState: "READY" } });
    }
    if (!order.readyNotifiedAt || order.fulfillmentState !== "READY") throw new ApiError(409, "Tandai pesanan siap dahulu");
    return tx.order.update({ where: { id }, data: { completed: true, completedAt: new Date(), fulfillmentState: "COMPLETED" } });
  });
}
