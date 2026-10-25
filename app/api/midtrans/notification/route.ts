import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchMidtransStatus, midtransConfig, verifyMidtransSignature } from "@/lib/midtrans";
import { applyMidtransStatus } from "@/lib/payment-sync";

const notificationSchema = z.object({
  order_id: z.string().min(1).max(100), status_code: z.string().regex(/^\d{3}$/),
  gross_amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/), signature_key: z.string().regex(/^[a-fA-F0-9]{128}$/),
});

export async function POST(request: Request) {
  try {
    const config = midtransConfig();
    const notification = notificationSchema.parse(await request.json());
    if (!verifyMidtransSignature(notification.order_id, notification.status_code, notification.gross_amount, notification.signature_key, config.serverKey)) throw new ApiError(401, "Signature tidak valid");
    const order = await db.order.findUnique({ where: { orderNumber: notification.order_id } });
    if (!order || order.paymentMethod !== "MIDTRANS") throw new ApiError(404, "Transaksi tidak ditemukan");
    if (Number(notification.gross_amount) !== order.total) throw new ApiError(400, "Jumlah pembayaran tidak cocok");
    // Signed events can be stale. Always fetch the current authenticated gateway status.
    await applyMidtransStatus(order.orderNumber, await fetchMidtransStatus(order.orderNumber), "WEBHOOK");
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
