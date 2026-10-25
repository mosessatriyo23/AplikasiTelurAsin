import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./auth";

export function assertStockReconciled(products: { readyStockReconciled: boolean }[]) {
  if (products.some((product) => !product.readyStockReconciled)) {
    throw new ApiError(503, "Stok sedang direkonsiliasi oleh admin. Pemesanan belum tersedia, silakan coba kembali nanti.");
  }
}

export type StockBatchState = {
  quantity: number;
  readyAt: Date;
  releasedAt: Date | null;
};

/** Pure projection used by API responses and unit tests. Released batches are already in Product.stock. */
export function stockReadiness(batches: StockBatchState[], now = new Date()) {
  const pending = batches.filter((batch) => !batch.releasedAt);
  const inProduction = pending.reduce((total, batch) => total + batch.quantity, 0);
  const nextReadyAt = pending.reduce<Date | null>(
    (next, batch) => (!next || batch.readyAt < next ? batch.readyAt : next),
    null,
  );
  const due = pending
    .filter((batch) => batch.readyAt <= now)
    .reduce((total, batch) => total + batch.quantity, 0);
  return { inProduction, nextReadyAt, due };
}

type StockTx = Prisma.TransactionClient;

/**
 * Atomically claims every due batch before incrementing ready stock. The releasedAt guard
 * makes retries safe and prevents the same batch being counted twice.
 */
export async function releaseDueBatchesInTransaction(tx: StockTx, now = new Date()): Promise<number> {
  const due = await tx.stockBatch.findMany({
    where: { releasedAt: null, readyAt: { lte: now } },
    orderBy: { readyAt: "asc" },
  });
  let released = 0;
  for (const batch of due) {
    const claimed = await tx.stockBatch.updateMany({
      where: { id: batch.id, releasedAt: null },
      data: { releasedAt: now },
    });
    if (claimed.count !== 1) continue;
    await tx.product.update({
      where: { id: batch.productId },
      data: { stock: { increment: batch.quantity } },
    });
    released += batch.quantity;
  }
  return released;
}

export async function releaseDueBatches(now = new Date()): Promise<number> {
  return db.$transaction(
    (tx) => releaseDueBatchesInTransaction(tx, now),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export function presentStockProduct<T extends {
  batches: StockBatchState[];
  availableAt?: Date | null;
  stock: number;
  readyStockReconciled: boolean;
}>(product: T, now = new Date()) {
  const { inProduction, nextReadyAt } = stockReadiness(product.batches, now);
  const { batches: _batches, readyStockReconciled: _reconciled, ...rest } = product;
  return {
    ...rest,
    // Until reconciliation, legacy stock is ambiguous: never advertise it as ready.
    stock: product.readyStockReconciled ? product.stock : 0,
    availableAt: nextReadyAt,
    inProduction,
    nextReadyAt,
  };
}
