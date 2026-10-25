import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { verifyOrigin } from "@/lib/auth";
import { midtransConfig } from "@/lib/midtrans";
import { createOrder, publicOrder } from "@/lib/orders";
import { orderSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    await enforceRateLimit("order", request);
    const input = orderSchema.parse(await request.json());
    // Validate before reserving stock or persisting an order.
    if (input.paymentMethod === "MIDTRANS") midtransConfig();
    const order = await createOrder(input);
    return NextResponse.json({ order: publicOrder(order) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
