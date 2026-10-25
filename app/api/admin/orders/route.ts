import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const cursor = new URL(request.url).searchParams.get("cursor");
    const orders = await db.order.findMany({ orderBy: { id: "desc" }, take: 101, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, orderNumber: true, customerName: true, phone: true, requestedDate: true, deliveryMethod: true, address: true, latitude: true, longitude: true, landmark: true, total: true, paymentMethod: true, paymentStatus: true, fulfillmentState: true, checkoutState: true, checkoutReviewAlertedAt: true, reservationExpiresAt: true, refundedAmount: true, waitlisted: true, completed: true, readyNotifiedAt: true, createdAt: true, items: { select: { name: true, quantity: true } } } });
    const nextCursor = orders.length > 100 ? orders[99].id : null;
    return NextResponse.json({ orders: orders.slice(0, 100), nextCursor });
  } catch (error) { return apiError(error); }
}
