import { NextResponse } from "next/server";
import { requireAdmin, verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { transitionFulfillment } from "@/lib/payment-fulfillment";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    verifyOrigin(request); await requireAdmin();
    return NextResponse.json({ order: await transitionFulfillment((await params).id, "COD_PAID") });
  } catch (error) { return apiError(error); }
}
