import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { jakartaDate } from "@/lib/validation";
import { presentStockProduct, releaseDueBatches } from "@/lib/stock-readiness";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();
    await releaseDueBatches(now);
    const dayStart = new Date(`${jakartaDate()}T00:00:00+07:00`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const [todayCount, pendingCount, revenueResult, products, orders] = await Promise.all([
      db.order.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
      db.order.count({ where: { completed: false, paymentStatus: { not: "CANCELLED" } } }),
      db.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { total: true, refundedAmount: true } }),
      db.product.findMany({ where: { active: true }, orderBy: { price: "asc" }, include: { batches: { where: { releasedAt: null }, select: { quantity: true, readyAt: true, releasedAt: true } } } }),
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, orderNumber: true, customerName: true, phone: true, requestedDate: true, deliveryMethod: true, address: true, latitude: true, longitude: true, landmark: true, total: true, paymentMethod: true, paymentStatus: true, fulfillmentState: true, refundedAmount: true, waitlisted: true, completed: true, readyNotifiedAt: true, createdAt: true, items: { select: { name: true, quantity: true } } } }),
    ]);
    const stockProducts = products.map((product) => presentStockProduct(product, now));
    return NextResponse.json({ todayCount, pendingCount, revenue: (revenueResult._sum.total ?? 0) - (revenueResult._sum.refundedAmount ?? 0), lowStock: stockProducts.filter((product) => product.stock <= 20).length, inProduction: stockProducts.reduce((sum, product) => sum + product.inProduction, 0), orders, products: stockProducts });
  } catch (error) { return apiError(error); }
}
