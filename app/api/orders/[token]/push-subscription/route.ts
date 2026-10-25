import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError, verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { dispatchReadyPush } from "@/lib/push-delivery";
import { pushSubscriptionSchema } from "@/lib/push";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    verifyOrigin(request);
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(404, "Pesanan tidak ditemukan");
    const input = pushSubscriptionSchema.parse(await request.json());
    const order = await db.order.findUnique({ where: { token }, select: { id: true, readyNotifiedAt: true } });
    if (!order) throw new ApiError(404, "Pesanan tidak ditemukan");
    if (input.action === "status") {
      const subscription = await db.pushSubscription.findUnique({ where: { orderId_endpoint: { orderId: order.id, endpoint: input.endpoint } }, select: { id: true, readyPushSentAt: true } });
      return NextResponse.json({ subscribed: !!subscription, readyPushAccepted: !!subscription?.readyPushSentAt });
    }
    if (input.action === "unsubscribe") {
      await db.pushSubscription.deleteMany({ where: { orderId: order.id, endpoint: input.endpoint } });
      return NextResponse.json({ subscribed: false });
    }
    const { endpoint, keys } = input.subscription;
    const subscription = await db.$transaction(async tx => {
      const existing = await tx.pushSubscription.findUnique({ where: { orderId_endpoint: { orderId: order.id, endpoint } } });
      if (!existing) {
        const count = await tx.pushSubscription.count({ where: { orderId: order.id } });
        if (count >= 5) throw new ApiError(409, "Maksimal 5 perangkat untuk satu pesanan");
      }
      return tx.pushSubscription.upsert({ where: { orderId_endpoint: { orderId: order.id, endpoint } },
        create: { orderId: order.id, endpoint, ...keys }, update: { p256dh: keys.p256dh, auth: keys.auth } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    // Always recheck order state inside the dispatcher to cover a concurrent admin mark-ready.
    const notification = await dispatchReadyPush(order.id, subscription.id);
    return NextResponse.json({ subscribed: true, notification });
  } catch (error) { return apiError(error); }
}
