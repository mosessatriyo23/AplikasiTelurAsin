import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedPushEndpoint, pushSubscriptionSchema, readyPushMessage } from "../lib/push";

const valid = { action: "subscribe", subscription: { endpoint: "https://fcm.googleapis.com/abc", keys: { p256dh: Buffer.alloc(65, 1).toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url") } } };
test("push subscription validates HTTPS, key lengths and bounded input", () => {
  assert.equal(pushSubscriptionSchema.safeParse(valid).success, true);
  assert.equal(pushSubscriptionSchema.safeParse({ ...valid, subscription: { ...valid.subscription, endpoint: "http://push.example.com" } }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ ...valid, subscription: { ...valid.subscription, endpoint: `https://fcm.googleapis.com/${"a".repeat(2048)}` } }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ ...valid, subscription: { ...valid.subscription, keys: { ...valid.subscription.keys, auth: "bad" } } }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ action: "unsubscribe", endpoint: valid.subscription.endpoint }).success, true);
});
test("push endpoints fail closed against SSRF and status input is strict", () => {
  for (const url of ["https://127.0.0.1/", "https://push.services.mozilla.com.evil.test/", "https://fcm.googleapis.com:8443/x", "https://user@fcm.googleapis.com/x", "https://localhost/x", "https://[::1]/x", "https://fcm.googleapis.com./x"]) {
    assert.equal(isAllowedPushEndpoint(url), false, url);
  }
  for (const url of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://wns.notify.windows.com/?token=abc", "https://web.push.apple.com/q/abc"]) {
    assert.equal(isAllowedPushEndpoint(url), true, url);
  }
  assert.equal(pushSubscriptionSchema.safeParse({ action: "status", endpoint: valid.subscription.endpoint }).success, true);
  assert.equal(pushSubscriptionSchema.safeParse({ action: "status", endpoint: valid.subscription.endpoint, orderId: "other" }).success, false);
  assert.equal(pushSubscriptionSchema.safeParse({ action: "status", endpoint: "https://localhost" }).success, false);
});
test("ready messages distinguish pickup and buyer-booked GoSend", () => {
  assert.equal(readyPushMessage("PICKUP"), "Pesanan Anda sudah siap diambil di toko.");
  assert.equal(readyPushMessage("GOSEND"), "Pesanan Anda sudah siap. Silakan pesan GoSend melalui aplikasi Gojek.");
});
