import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { verifyOrigin } from "@/lib/auth";
import { publicOrder } from "@/lib/orders";
import { syncMidtransPayment } from "@/lib/payment-sync";
import { checkRateLimit, clientIdentity, consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

const COOLDOWN_MS = 60_000;

// Explicit, expensive gateway reconciliation. Webhooks remain the primary source of updates.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    verifyOrigin(request);
    const { token } = await params;
    const order = await db.order.findUnique({ where: { token }, select: { orderNumber: true, paymentMethod: true, paymentStatus: true, checkoutStartedAt: true, paymentCheckedAt: true } });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    if (order.paymentMethod !== "MIDTRANS" || !order.checkoutStartedAt || !["PENDING", "PAID"].includes(order.paymentStatus))
      return NextResponse.json({ error: "Pemeriksaan pembayaran tidak tersedia" }, { status: 409 });

    // Never rate-limit unrelated buyers together when a trustworthy client identity is unavailable.
    const identity = clientIdentity(request);
    const orderKeys = await checkRateLimit("orderSync", request, token);
    const identityKeys = identity === "shared-untrusted" ? [] : await checkRateLimit("identitySync", request);
    const now = Date.now();
    const claimed = await db.order.updateMany({
      where: { token, paymentMethod: "MIDTRANS", paymentStatus: { in: ["PENDING", "PAID"] }, checkoutStartedAt: { not: null },
        OR: [{ paymentCheckedAt: null }, { paymentCheckedAt: { lte: new Date(now - COOLDOWN_MS) } }] },
      data: { paymentCheckedAt: new Date(now) },
    });
    if (!claimed.count) {
      const latest = await db.order.findUnique({ where: { token }, select: { paymentCheckedAt: true } });
      throw new RateLimitError(Math.max(1, Math.ceil(((latest?.paymentCheckedAt?.getTime() ?? now) + COOLDOWN_MS - Date.now()) / 1000)));
    }
    // The per-order key uses the capability token, not a global shared-untrusted bucket.
    await consumeRateLimit("orderSync", orderKeys);
    if (identityKeys.length) await consumeRateLimit("identitySync", identityKeys);
    // Reconciliation failure must not expose gateway details to the buyer.
    let current;
    try { current = await syncMidtransPayment(order.orderNumber); }
    catch {
      console.error("Manual Midtrans reconciliation failed", { category: "gateway_or_transition" });
      return NextResponse.json({ error: "Pemeriksaan pembayaran belum tersedia. Silakan coba lagi nanti." }, { status: 503, headers: { "Retry-After": "60" } });
    }
    return NextResponse.json({ order: publicOrder(current) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
