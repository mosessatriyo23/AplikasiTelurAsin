import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { presentStockProduct, releaseDueBatches } from "@/lib/stock-readiness";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const now = new Date();
    await releaseDueBatches(now);
    const products = await db.product.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
      select: {
        id: true, name: true, price: true, stock: true, availableAt: true, readyStockReconciled: true,
        batches: { where: { releasedAt: null }, select: { quantity: true, readyAt: true, releasedAt: true } },
      },
    });
    return NextResponse.json({ products: products.map((product) => presentStockProduct(product, now)) });
  } catch (error) { return apiError(error); }
}
