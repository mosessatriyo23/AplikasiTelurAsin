import { Prisma } from "@prisma/client";
import { db } from "./db";
import { assertStockReconciled, releaseDueBatchesInTransaction } from "./stock-readiness";

/** Reserve newly available stock for oldest waitlisted orders whose requested date is feasible. */
export async function allocateWaitlistedOrders(): Promise<number> {
  return db.$transaction(async tx => {
    await releaseDueBatchesInTransaction(tx, new Date());
    const orders = await tx.order.findMany({
      where: { waitlisted: true, completed: false, stockRestored: false, fulfillmentState: { notIn: ["REVIEW", "CANCELLED", "REFUNDED", "COMPLETED"] }, paymentStatus: { notIn: ["FAILED", "CANCELLED"] } },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "asc" },
    });
    let allocated = 0;
    for (const order of orders) {
      // Explicit legacy-only allocation: never reserve in-production batches.
      const current = await tx.product.findMany({ where: { id: { in: order.items.map(item => item.productId) }, active: true } });
      assertStockReconciled(current);
      const feasible = order.items.every(item => {
        const product = current.find(product => product.id === item.productId);
        return product && product.stock >= item.quantity;
      });
      if (!feasible) continue;
      let reserved = true;
      for (const item of order.items) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count !== 1) { reserved = false; break; }
      }
      if (!reserved) throw new Error("Stok berubah saat alokasi; transaksi dibatalkan agar stok tetap konsisten");
      await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { readyAt: new Date() } });
      await tx.order.update({
        where: { id: order.id },
        data: {
          waitlisted: false,
          dateTentative: false,
          fulfillmentState: "RESERVED",
          readyNotifiedAt: null,
          notifications: { create: { type: "STOCK_ALLOCATED", message: `${order.orderNumber}: stok sudah dialokasikan` } },
        },
      });
      allocated++;
    }
    return allocated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
