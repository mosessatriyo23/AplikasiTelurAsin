import { NextResponse } from "next/server";
import { ApiError, verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendTestPush } from "@/lib/push-delivery";
import { pushTestSchema } from "@/lib/push";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    verifyOrigin(request);
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(404, "Pesanan tidak ditemukan");
    const { endpoint } = pushTestSchema.parse(await request.json());
    const order = await db.order.findUnique({ where: { token }, select: { id: true } });
    if (!order) throw new ApiError(404, "Pesanan tidak ditemukan");
    const subscription = await db.pushSubscription.findUnique({ where: { orderId_endpoint: { orderId: order.id, endpoint } } });
    if (!subscription) throw new ApiError(404, "Langganan tidak ditemukan");
    const now = new Date();
    const claimed = await db.pushSubscription.updateMany({ where: { id: subscription.id,
      OR: [{ lastTestAt: null }, { lastTestAt: { lt: new Date(now.getTime() - 30_000) } }] }, data: { lastTestAt: now } });
    if (!claimed.count) throw new ApiError(429, "Tunggu 30 detik sebelum menguji lagi");
    const accepted = await sendTestPush(subscription);
    return NextResponse.json({ accepted });
  } catch (error) { return apiError(error); }
}
