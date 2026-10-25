import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./auth";
import type { OrderInput } from "./validation";
import { codReservationDeadline, reservationDeadline } from "./reservation";
import { assertStockReconciled, releaseDueBatchesInTransaction } from "./stock-readiness";

export async function createOrder(input: OrderInput) {
  return db.$transaction(async (tx) => {
    if (!await tx.storeSettings.findUnique({ where: { id: 1 } })) throw new ApiError(503, "Lokasi toko belum dikonfigurasi");
    // Availability means ready today in WIB. Requested delivery dates do not reserve future batches.
    await releaseDueBatchesInTransaction(tx, new Date());
    const ids = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({ where: { id: { in: ids }, active: true } });
    if (products.length !== ids.length) throw new ApiError(400, "Satu atau lebih produk tidak tersedia");
    assertStockReconciled(products);
    const byId = new Map(products.map((product) => [product.id, product]));
    let subtotal = 0;
    for (const item of input.items) {
      const product = byId.get(item.productId)!;
      subtotal += product.price * item.quantity;
      if (product.stock < item.quantity) {
        throw new ApiError(409, `Stok siap ${product.name} tidak mencukupi. Pesanan tidak dibuat; silakan kurangi jumlah atau coba lagi setelah stok siap.`);
      }
    }
    for (const item of input.items) {
      const result = await tx.product.updateMany({ where: { id: item.productId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
      if (result.count !== 1) throw new ApiError(409, "Stok siap berubah, pesanan tidak dibuat. Silakan coba lagi");
    }
    const token = randomBytes(32).toString("base64url");
    const orderNumber = `TA-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const order = await tx.order.create({ data: {
      token, orderNumber, customerName: input.customerName, phone: input.phone,
      requestedDate: input.requestedDate, deliveryMethod: input.deliveryMethod,
      // Both pickup and buyer-booked GoSend collect at the shop, not the buyer's home.
      address: null, latitude: null, longitude: null, landmark: null,
      subtotal, tip: input.tip, total: subtotal + input.tip,
      paymentMethod: input.paymentMethod, reservationExpiresAt: input.paymentMethod === "COD" ? codReservationDeadline(input.requestedDate) : reservationDeadline(), fulfillmentState: "RESERVED",
      waitlisted: false, dateTentative: false,
      items: { create: input.items.map((item) => { const product = byId.get(item.productId)!; return { productId: product.id, name: product.name, price: product.price, quantity: item.quantity, lineTotal: product.price * item.quantity, readyAt: new Date() }; }) },
      notifications: { create: { type: "NEW_ORDER", message: `Pesanan baru ${orderNumber}` } },
    }, include: { items: true } });
    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export function publicOrder(order: { token: string; orderNumber: string; total: number; waitlisted: boolean; paymentMethod: string; paymentStatus: string; requestedDate?: string; dateTentative?: boolean; readyNotifiedAt?: Date | null; completed?: boolean; refundedAmount?: number; fulfillmentState?: string; stockRestored?: boolean; reservationExpiresAt?: Date | null; checkoutState?: string }) {
  return { readyNotifiedAt: order.readyNotifiedAt ?? null, token: order.token, orderNumber: order.orderNumber, total: order.total, waitlisted: order.waitlisted, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus,
    completed: order.completed ?? false, refundedAmount: order.refundedAmount ?? 0, fulfillmentState: order.fulfillmentState ?? "RESERVED", stockRestored: order.stockRestored ?? false, reservationExpiresAt: order.reservationExpiresAt ?? null, checkoutState: order.checkoutState ?? "NONE",
    ...(order.requestedDate ? { requestedDate: order.requestedDate, dateTentative: order.dateTentative } : {}) };
}
