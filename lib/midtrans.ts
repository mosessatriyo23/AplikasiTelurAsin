import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./auth";
import { expireReservation } from "./reservation";

export type MidtransStatus = {
  order_id: string;
  status_code?: string;
  gross_amount: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  refund_amount?: string;
};

export type PaymentTransition = "PAID" | "FAILED" | "CANCELLED" | "PENDING" | "IGNORE";

export function mapMidtransStatus(status: string, fraudStatus?: string): PaymentTransition {
  if (status === "settlement") return "PAID";
  if (status === "capture") return fraudStatus === "accept" ? "PAID" : "PENDING";
  if (status === "pending" || status === "authorize") return "PENDING";
  if (status === "expire" || status === "cancel" || status === "deny") return "CANCELLED";
  if (status === "refund" || status === "partial_refund" || status === "chargeback" || status === "partial_chargeback") return "CANCELLED";
  if (status === "failure") return "FAILED";
  return "IGNORE";
}

export function midtransSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
  return createHash("sha512").update(orderId + statusCode + grossAmount + serverKey).digest("hex");
}

export function verifyMidtransSignature(orderId: string, statusCode: string, grossAmount: string, signature: string, serverKey: string): boolean {
  const expected = Buffer.from(midtransSignature(orderId, statusCode, grossAmount, serverKey), "hex");
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "hex"); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY?.trim();
  const production = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (!serverKey || !clientKey || !appUrl) throw new ApiError(503, "Midtrans belum dikonfigurasi lengkap");
  let parsed: URL;
  try { parsed = new URL(appUrl); } catch { throw new ApiError(503, "NEXT_PUBLIC_APP_URL tidak valid"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new ApiError(503, "NEXT_PUBLIC_APP_URL tidak valid");
  if ((production || process.env.NODE_ENV === "production") && parsed.protocol !== "https:") throw new ApiError(503, "NEXT_PUBLIC_APP_URL wajib HTTPS di production");
  return {
    serverKey, clientKey, production, appUrl: parsed.origin,
    snapBase: production ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com",
    apiBase: production ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com",
  };
}

function basicAuth(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export async function fetchMidtransStatus(orderNumber: string): Promise<MidtransStatus> {
  const config = midtransConfig();
  const response = await fetch(`${config.apiBase}/v2/${encodeURIComponent(orderNumber)}/status`, {
    headers: { Authorization: basicAuth(config.serverKey), Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Midtrans status gagal (${response.status})`);
  return response.json() as Promise<MidtransStatus>;
}

export async function createSnapCheckout(token: string) {
  const config = midtransConfig();
  let order = await db.order.findUnique({ where: { token }, include: { items: true } });
  if (!order) throw new ApiError(404, "Pesanan tidak ditemukan");
  if (order.reservationExpiresAt && order.reservationExpiresAt <= new Date()) {
    await expireReservation(order.id);
    order = await db.order.findUniqueOrThrow({ where: { token }, include: { items: true } });
  }
  if (order.paymentMethod !== "MIDTRANS") throw new ApiError(409, "Pesanan COD tidak dapat dibayar melalui Midtrans");
  if (order.paymentStatus === "PAID") throw new ApiError(409, "Pesanan sudah dibayar");
  if (order.paymentStatus === "CANCELLED" || order.paymentStatus === "FAILED") throw new ApiError(409, "Pembayaran pesanan sudah berakhir");
  if (order.stockRestored || order.fulfillmentState === "REVIEW" || ["AMBIGUOUS","CREATING","DEFINITIVE_FAILURE","TERMINAL_CONFIRMED","RESOLVED"].includes(order.checkoutState) || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) throw new ApiError(409, "Reservasi berakhir atau perlu tinjauan admin");
  if (order.snapToken && order.snapRedirectUrl) return { order, snapToken: order.snapToken, redirectUrl: order.snapRedirectUrl };

  // Do not retry ambiguous POSTs: the first request may already exist at the gateway.
  const claimed = await db.order.updateMany({
    where: { id: order.id, snapToken: null, checkoutStartedAt: null, paymentStatus: "PENDING", stockRestored: false, reservationExpiresAt: { gt: new Date() } },
    data: { checkoutStartedAt: new Date(), checkoutState: "CREATING" },
  });
  if (!claimed.count) throw new ApiError(409, "Checkout sedang dibuat, silakan coba lagi sebentar");

  let definitiveRejection = false;
  try {
    const response = await fetch(`${config.snapBase}/snap/v1/transactions`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: basicAuth(config.serverKey), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        transaction_details: { order_id: order.orderNumber, gross_amount: order.total },
        item_details: [
          ...order.items.map((item) => ({ id: item.productId.slice(0, 50), price: item.price, quantity: item.quantity, name: item.name.slice(0, 50) })),
          ...(order.tip ? [{ id: "tip", price: order.tip, quantity: 1, name: "Tip" }] : []),
        ],
        callbacks: { finish: `${config.appUrl}/pesanan/${encodeURIComponent(order.token)}` },
      }),
    });
    const result = await response.json().catch(() => ({})) as { token?: string; redirect_url?: string; error_messages?: string[] };
    // A well-formed 4xx validation rejection is distinguishable from a timeout,
    // but still requires authoritative terminal verification before stock release.
    definitiveRejection = response.status === 400 && Array.isArray(result.error_messages) && result.error_messages.length > 0;
    if (!response.ok || !result.token || !result.redirect_url) throw new Error("Gateway response invalid");
    const updated = await db.order.updateMany({ where: { id: order.id, paymentStatus: "PENDING", snapToken: null, checkoutState: "CREATING" }, data: { snapToken: result.token, snapRedirectUrl: result.redirect_url, checkoutState: "ACTIVE" } });
    if (!updated.count) throw new Error("Pembayaran berubah saat checkout dibuat");
    return { order, snapToken: result.token, redirectUrl: result.redirect_url };
  } catch (error) {
    // Any response without a valid Snap token is fail-closed. A status-code alone does
    // not prove that Midtrans did not create the transaction.
    await db.$transaction(async tx => {
      const marked = await tx.order.updateMany({ where: { id: order.id, checkoutState: "CREATING", snapToken: null }, data: { checkoutState: definitiveRejection ? "DEFINITIVE_FAILURE" : "AMBIGUOUS", fulfillmentState: "REVIEW", checkoutReviewAlertedAt: new Date(), readyNotifiedAt: null } });
      if (marked.count) await tx.paymentAudit.create({ data: { orderId: order.id, source: "CHECKOUT", outcome: definitiveRejection ? "GATEWAY_VALIDATION_REJECTED" : "AMBIGUOUS", detail: "requires_authoritative_terminal_and_admin" } });
    });
    console.error("Midtrans checkout creation failed", { category: error instanceof ApiError ? "application" : "gateway_or_network" });
    throw new ApiError(502, "Checkout Midtrans gagal dibuat, silakan coba lagi");
  }
}
