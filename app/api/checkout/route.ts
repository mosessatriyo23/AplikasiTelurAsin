import { NextResponse } from "next/server";
import { verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { createSnapCheckout } from "@/lib/midtrans";
import { publicOrder } from "@/lib/orders";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";

const checkoutSchema = z.object({ token: z.string().min(32).max(100) }).strict();

export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    await enforceRateLimit("checkout", request);
    const { token } = checkoutSchema.parse(await request.json());
    const checkout = await createSnapCheckout(token);
    return NextResponse.json({ order: publicOrder(checkout.order), snapToken: checkout.snapToken, redirectUrl: checkout.redirectUrl });
  } catch (error) { return apiError(error); }
}
