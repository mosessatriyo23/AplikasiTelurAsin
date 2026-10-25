import { NextResponse } from "next/server";
import { ApiError, requireAdmin, verifyOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { syncMidtransPayment } from "@/lib/payment-sync";
import { publicOrder } from "@/lib/orders";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    verifyOrigin(request); await requireAdmin();
    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order) throw new ApiError(404, "Pesanan tidak ditemukan");
    try {
      const current = await syncMidtransPayment(order.orderNumber);
      await db.paymentAudit.create({ data: { orderId: id, source: "ADMIN_SYNC", outcome: "SUCCESS" } });
      return NextResponse.json({ order: publicOrder(current) });
    } catch {
      await db.paymentAudit.create({ data: { orderId: id, source: "ADMIN_SYNC", outcome: "UNCERTAIN", detail: "GATEWAY_RECONCILIATION_FAILED" } });
      throw new ApiError(502, "Rekonsiliasi belum pasti; stok tidak dilepas");
    }
  } catch (error) { return apiError(error); }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const audit = await db.paymentAudit.findMany({ where: { orderId: (await params).id }, select: { source: true, outcome: true, detail: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ audit });
  } catch (error) { return apiError(error); }
}
