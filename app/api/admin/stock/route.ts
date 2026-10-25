import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin, verifyOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { stockSchema, availabilityFromArrival } from "@/lib/validation";
import { presentStockProduct, releaseDueBatchesInTransaction } from "@/lib/stock-readiness";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    await requireAdmin();
    const input = stockSchema.parse(await request.json());
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      await releaseDueBatchesInTransaction(tx, now);
      const existing = await tx.product.findUniqueOrThrow({ where: { id: input.productId, active: true } });
      // Raw duck eggs have no production delay: recording a restock makes them
      // ready immediately, regardless of the selected administrative arrival date.
      const readyAt = existing.slug === "raw-duck" ? now : availabilityFromArrival(input.arrivalDate, existing.slug);
      const createdBatch = await tx.stockBatch.create({
        data: { productId: existing.id, quantity: input.quantity, readyAt },
        select: { id: true },
      });
      // A batch due now is claimed through the same release path; only salted
      // future batches stay in production and never freeze older ready stock.
      await releaseDueBatchesInTransaction(tx, now);
      const batch = await tx.stockBatch.findUniqueOrThrow({
        where: { id: createdBatch.id },
        select: { id: true, productId: true, quantity: true, readyAt: true, releasedAt: true },
      });
      const product = await tx.product.findUniqueOrThrow({
        where: { id: existing.id },
        select: {
          id: true, name: true, price: true, stock: true, availableAt: true, readyStockReconciled: true,
          batches: { where: { releasedAt: null }, select: { quantity: true, readyAt: true, releasedAt: true } },
        },
      });
      return { batch, product: presentStockProduct(product, now) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiError(error); }
}
