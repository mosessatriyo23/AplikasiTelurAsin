import { NextResponse } from "next/server";
import { requireAdmin, verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { transitionFulfillment } from "@/lib/payment-fulfillment";
import { dispatchReadyPush } from "@/lib/push-delivery";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    verifyOrigin(request); await requireAdmin();
    const { id } = await params;
    const before = await transitionFulfillment(id, "READY");
    const notification = await dispatchReadyPush(id);
    return NextResponse.json({ readyNotifiedAt: before.readyNotifiedAt, newlyReady: before.readyNotifiedAt !== null, notification });
  } catch (error) { return apiError(error); }
}
