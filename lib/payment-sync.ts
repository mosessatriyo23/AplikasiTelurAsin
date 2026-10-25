import { Prisma, type Order, type PaymentStatus } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./auth";
import { fetchMidtransStatus, mapMidtransStatus, type MidtransStatus } from "./midtrans";
import { restoreReservation } from "./reservation";

const refundStatuses = ["refund", "partial_refund", "chargeback", "partial_chargeback"];

// Rows are the persisted state, columns are authenticated gateway outcomes.
// A cancellation before payment may still be followed by a late settlement;
// a verified full refund is different: it is terminal even for late captures.
const transitions: Record<PaymentStatus, Record<"PAID" | "FAILED" | "CANCELLED", PaymentStatus>> = {
  PENDING: { PAID: "PAID", FAILED: "FAILED", CANCELLED: "CANCELLED" },
  PAID: { PAID: "PAID", FAILED: "PAID", CANCELLED: "PAID" },
  FAILED: { PAID: "PAID", FAILED: "FAILED", CANCELLED: "CANCELLED" },
  CANCELLED: { PAID: "PAID", FAILED: "FAILED", CANCELLED: "CANCELLED" },
};

/** Only call with an authenticated server-to-server gateway response, never browser input. */
export async function applyMidtransStatus(orderNumber: string, status: MidtransStatus, source: "WEBHOOK" | "SYNC" | "EXPIRY" = "SYNC") {
  const existing = await db.order.findUnique({ where: { orderNumber } });
  if (!existing || existing.paymentMethod !== "MIDTRANS") throw new ApiError(404, "Transaksi tidak ditemukan");
  if (status.order_id !== orderNumber || !/^\d+(?:\.\d{1,2})?$/.test(status.gross_amount) || Number(status.gross_amount) !== existing.total)
    throw new ApiError(400, "Status atau jumlah transaksi Midtrans tidak cocok");
  if (!status.transaction_id) throw new ApiError(502, "ID transaksi Midtrans tidak valid");
  const next = mapMidtransStatus(status.transaction_status, status.fraud_status);
  const refund = refundStatuses.includes(status.transaction_status);
  const partial = ["partial_refund", "partial_chargeback"].includes(status.transaction_status);
  const rawRefund = refund ? (status.refund_amount === undefined ? (partial ? NaN : existing.total) : Number(status.refund_amount)) : 0;
  if (refund && (!Number.isSafeInteger(rawRefund) || rawRefund <= 0 || rawRefund > existing.total || (partial && rawRefund >= existing.total)))
    throw new ApiError(502, "Jumlah refund Midtrans tidak valid");
  return db.$transaction(async tx => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: existing.id } });
    if (order.midtransTransactionId && order.midtransTransactionId !== status.transaction_id) throw new ApiError(409, "ID transaksi tidak cocok");
    if (next === "IGNORE" || next === "PENDING") return order;
    // A full refund is absorbing even when a delayed terminal confirmation arrives.
    if (order.refundedAmount === order.total && order.fulfillmentState === "REFUNDED") return order;
    const terminalForRelease = ["expire", "cancel", "deny", "failure"].includes(status.transaction_status);
    if (["AMBIGUOUS", "DEFINITIVE_FAILURE", "TERMINAL_CONFIRMED"].includes(order.checkoutState) && terminalForRelease) {
      const confirmed = await tx.order.updateMany({ where: { id: order.id, checkoutState: { in: ["AMBIGUOUS", "DEFINITIVE_FAILURE"] } }, data: { checkoutState: "TERMINAL_CONFIRMED", checkoutTerminalCheckedAt: new Date(), checkoutTerminalStatus: status.transaction_status } });
      if (confirmed.count) await tx.paymentAudit.create({ data: { orderId: order.id, source, outcome: "TERMINAL_CONFIRMED", detail: status.transaction_status } });
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }
    const refundedAmount = refund ? Math.max(order.refundedAmount, rawRefund) : order.refundedAmount;
    const paymentStatus = refund ? (refundedAmount === order.total ? "CANCELLED" : "PAID") : transitions[order.paymentStatus][next];
    // Ignore non-refund responses once paid (also preserves partial-refund review).
    if (!refund && order.paymentStatus === "PAID") return order;
    if (order.paymentStatus === paymentStatus && order.refundedAmount === refundedAmount && order.midtransTransactionId === status.transaction_id) return order;
    const late = paymentStatus === "PAID" && order.stockRestored;
    const review = late || refund || (order.fulfillmentState === "REVIEW");
    // Claim the transition before stock mutation: repeated webhooks and workers cannot restore twice.
    const changed = await tx.order.updateMany({ where: { id: order.id, paymentStatus: order.paymentStatus, refundedAmount: order.refundedAmount, stockRestored: order.stockRestored }, data: {
      paymentStatus, refundedAmount, midtransTransactionId: status.transaction_id,
      ...(paymentStatus === "PAID" && ["AMBIGUOUS", "CREATING", "DEFINITIVE_FAILURE", "TERMINAL_CONFIRMED"].includes(order.checkoutState) ? { checkoutState: "ACTIVE" as const, checkoutTerminalCheckedAt: null, checkoutTerminalStatus: null } : {}),
      fulfillmentState: refund && refundedAmount === order.total ? "REFUNDED" : review ? "REVIEW" : paymentStatus === "PAID" ? order.fulfillmentState : "CANCELLED",
      ...(refund ? { readyNotifiedAt: null } : {}),
      ...(late ? { waitlisted: true, dateTentative: true, readyNotifiedAt: null } : {}),
      ...(!refund && paymentStatus !== "PAID" ? { cancellationReason: `MIDTRANS_${status.transaction_status.toUpperCase()}` } : {}),
    } });
    if (!changed.count) return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (!refund && paymentStatus !== "PAID") await restoreReservation(tx, order, `MIDTRANS_${status.transaction_status.toUpperCase()}`);
    await tx.paymentAudit.create({ data: { orderId: order.id, source, outcome: refund ? "REFUND_REVIEW" : late ? "LATE_PAYMENT_REVIEW" : paymentStatus, detail: status.transaction_status } });
    await tx.notification.create({ data: { orderId: order.id, type: "PAYMENT_UPDATE", message: `${order.orderNumber}: pembayaran ${status.transaction_status}${review ? " (perlu tinjauan admin)" : ""}` } });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Reconcile only against Midtrans's authenticated status endpoint. A 404 fails closed. */
export async function syncMidtransPayment(orderNumber: string): Promise<Order> {
  const existing = await db.order.findUnique({ where: { orderNumber } });
  if (!existing || existing.paymentMethod !== "MIDTRANS") throw new ApiError(404, "Transaksi tidak ditemukan");
  if (!existing.checkoutStartedAt) return existing;
  const status = await fetchMidtransStatus(orderNumber);
  return applyMidtransStatus(orderNumber, status);
}
