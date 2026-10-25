import { z } from "zod";
import webpush from "web-push";
import { ApiError } from "./auth";

const base64urlKey = (bytes: number) => z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(value => {
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === bytes && decoded.toString("base64url") === value.replace(/=+$/, "");
}, `Kunci harus berisi ${bytes} byte base64url`);

/** Browser push services only. Keep this fail-closed: arbitrary HTTPS URLs create SSRF. */
export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com"
      || host === "android.googleapis.com"
      || host === "push.services.mozilla.com"
      || host.endsWith(".push.services.mozilla.com")
      || host === "notify.windows.com"
      || host.endsWith(".notify.windows.com")
      || host === "web.push.apple.com"
      || host.endsWith(".push.apple.com");
  } catch { return false; }
}

export const pushEndpointSchema = z.string().max(2048).refine(isAllowedPushEndpoint, "Endpoint push tidak didukung");
export const pushSubscriptionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), subscription: z.object({ endpoint: pushEndpointSchema, keys: z.object({ p256dh: base64urlKey(65), auth: base64urlKey(16) }).strict() }).strict() }).strict(),
  z.object({ action: z.literal("unsubscribe"), endpoint: pushEndpointSchema }).strict(),
  z.object({ action: z.literal("status"), endpoint: pushEndpointSchema }).strict(),
]);
export const pushTestSchema = z.object({ endpoint: pushEndpointSchema }).strict();

export function readyPushMessage(deliveryMethod: string): string {
  if (deliveryMethod === "GOSEND") return "Pesanan Anda sudah siap. Silakan pesan GoSend melalui aplikasi Gojek.";
  return "Pesanan Anda sudah siap diambil di toko.";
}

export function vapidPublicKey(): string {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key || !base64urlKey(65).safeParse(key).success) throw new ApiError(503, "VAPID_PUBLIC_KEY belum dikonfigurasi dengan benar");
  return key;
}
export function configureWebPush(): void {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!privateKey || !base64urlKey(32).safeParse(privateKey).success || !subject || !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) {
    throw new ApiError(503, "Konfigurasi VAPID tidak lengkap atau tidak valid");
  }
  try { webpush.setVapidDetails(subject, publicKey, privateKey); }
  catch { throw new ApiError(503, "Pasangan kunci VAPID tidak valid"); }
}
export { webpush };
