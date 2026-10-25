import test from "node:test";
import assert from "node:assert/strict";
import { clientIdentity, rateKey } from "../lib/rate-limit";

test("forwarded client IP is ignored unless a safe trusted header is explicitly configured", () => {
  const previous = process.env.TRUSTED_CLIENT_IP_HEADER;
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
  assert.equal(clientIdentity(new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.7" } })), "shared-untrusted");
  process.env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
  assert.equal(clientIdentity(new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.7" } })), "shared-untrusted");
  process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-client-ip";
  assert.equal(clientIdentity(new Request("https://example.test", { headers: { "x-real-client-ip": "203.0.113.7" } })), "203.0.113.7");
  if (previous === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER; else process.env.TRUSTED_CLIENT_IP_HEADER = previous;
});
test("rate-limit keys never persist raw username or IP", () => {
  const key = rateKey("login", "203.0.113.7", "Admin Person");
  assert.equal(key.startsWith("login:"), true);
  assert.equal(key.includes("203.0.113.7"), false);
  assert.equal(key.includes("admin"), false);
});
