export type VisibleOrderState = { paymentStatus?: string; fulfillmentState?: string; refundedAmount?: number; total?: number; completed?: boolean; readyNotifiedAt?: unknown; stockRestored?: boolean; waitlisted?: boolean };
export function orderStatusLabel(order: VisibleOrderState): string {
  if (order.fulfillmentState === "REFUNDED" || (order.refundedAmount && order.total && order.refundedAmount >= order.total)) return "Dana dikembalikan";
  if (order.fulfillmentState === "REVIEW" || (order.refundedAmount || 0) > 0) return "Perlu tinjauan pengelola";
  if (["CANCELLED", "FAILED"].includes(order.paymentStatus || "") || order.fulfillmentState === "CANCELLED" || order.stockRestored) return "Pesanan dibatalkan";
  if (order.completed || order.fulfillmentState === "COMPLETED") return "Pesanan selesai";
  if (order.fulfillmentState === "READY" && order.readyNotifiedAt && !order.waitlisted) return "Pesanan siap";
  return order.waitlisted ? "Menunggu stok" : "Sedang disiapkan";
}
