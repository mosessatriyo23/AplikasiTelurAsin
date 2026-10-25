import { db } from "./db";
import { configureWebPush, isAllowedPushEndpoint, readyPushMessage, webpush } from "./push";

type Outcome = "sent" | "failed" | "alreadySent" | "inFlight";
export type DeliveryReport = { sent: number; failed: number; alreadySent: number; noSubscriptions: boolean; inFlight?: number };
type PushDependencies = {
  configure: () => void;
  send: typeof webpush.sendNotification;
};
const defaultPushDependencies: PushDependencies = {
  configure: configureWebPush,
  send: webpush.sendNotification.bind(webpush),
};

function statusCode(error: unknown): number {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return 0;
  const code = Number(error.statusCode);
  return Number.isInteger(code) ? code : 0;
}

function failureCategory(code: number): string {
  if (code === 429) return "rate_limited";
  if (code >= 500 && code <= 599) return "service_unavailable";
  if (code >= 400 && code <= 499) return "rejected";
  return "network_error";
}

/** An accepted response means only that the push service accepted the message. */
export async function dispatchReadyPush(orderId: string, subscriptionId?: string, push: PushDependencies = defaultPushDependencies): Promise<DeliveryReport> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { token: true, deliveryMethod: true, readyNotifiedAt: true, fulfillmentState: true, stockRestored: true, paymentStatus: true,
      pushSubscriptions: { where: subscriptionId ? { id: subscriptionId } : undefined, select: { id: true, readyPushSentAt: true, sendingAt: true } } },
  });
  if (!order?.readyNotifiedAt || order.fulfillmentState !== "READY" || order.stockRestored || ["CANCELLED", "FAILED"].includes(order.paymentStatus)) return { sent: 0, failed: 0, alreadySent: 0, noSubscriptions: true };
  const subscriptions = order.pushSubscriptions;
  if (!subscriptions.length) return { sent: 0, failed: 0, alreadySent: 0, noSubscriptions: true };
  // Configure before claiming, so a missing VAPID configuration leaves every row retryable.
  push.configure();
  const payload = JSON.stringify({ title: "Pesanan siap", body: readyPushMessage(order.deliveryMethod), url: `/pesanan/${order.token}`, tag: `order-ready-${order.token}` });
  const outcomes = await Promise.all(subscriptions.map(async ({ id, readyPushSentAt, sendingAt }): Promise<Outcome> => {
    const now = new Date();
    if (readyPushSentAt) return "alreadySent";
    if (sendingAt && sendingAt >= new Date(now.getTime() - 60_000)) return "inFlight";
    const claim = await db.pushSubscription.updateMany({
      where: { id, orderId, readyPushSentAt: null, OR: [{ sendingAt: null }, { sendingAt: { lt: new Date(now.getTime() - 60_000) } }] },
      data: { sendingAt: now, pushAttempts: { increment: 1 }, lastPushError: null },
    });
    if (!claim.count) return "inFlight"; // Another request may be sending (or just finished).
    const subscription = await db.pushSubscription.findUnique({ where: { id } });
    if (!subscription) return "failed";
    try {
      // Defensive check for legacy rows inserted before endpoint validation was enabled.
      if (!isAllowedPushEndpoint(subscription.endpoint)) throw new Error("invalid endpoint");
      await push.send({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload,
        { TTL: 86400, urgency: "high", timeout: 10000 });
      await db.pushSubscription.updateMany({ where: { id, sendingAt: now, readyPushSentAt: null }, data: { readyPushSentAt: new Date(), sendingAt: null, lastPushError: null } });
      return "sent";
    } catch (error) {
      const code = statusCode(error);
      if (code === 404 || code === 410) {
        await db.pushSubscription.deleteMany({ where: { id, sendingAt: now } });
      } else {
        await db.pushSubscription.updateMany({ where: { id, sendingAt: now }, data: { sendingAt: null, lastPushError: failureCategory(code) } });
      }
      return "failed";
    }
  }));
  return { sent: outcomes.filter(x => x === "sent").length, failed: outcomes.filter(x => x === "failed").length,
    alreadySent: outcomes.filter(x => x === "alreadySent").length, inFlight: outcomes.filter(x => x === "inFlight").length, noSubscriptions: false };
}

/** Harmless test; does not affect ready status. Caller must claim the per-row cooldown first. */
export async function sendTestPush(subscription: { endpoint: string; p256dh: string; auth: string }): Promise<boolean> {
  configureWebPush();
  if (!isAllowedPushEndpoint(subscription.endpoint)) return false;
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ title: "Tes notifikasi", body: "Notifikasi uji berhasil dikirim.", tag: "push-test" }),
      { TTL: 86400, urgency: "high", timeout: 10000 });
    return true;
  } catch { return false; }
}
