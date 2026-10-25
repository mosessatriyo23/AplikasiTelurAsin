import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { publicOrder } from "@/lib/orders";

// Reading an unguessable order URL is local-only; polling must never consume a shared identity bucket.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const order = await db.order.findUnique({ where: { token }, select: { token: true, orderNumber: true, total: true, waitlisted: true, paymentMethod: true, paymentStatus: true, requestedDate: true, dateTentative: true, readyNotifiedAt: true, completed: true, refundedAmount: true, fulfillmentState: true, stockRestored: true, reservationExpiresAt: true, checkoutState: true, checkoutStartedAt: true } });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ order: { ...publicOrder(order), checkoutStarted: !!order.checkoutStartedAt } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
