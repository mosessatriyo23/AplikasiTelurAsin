import assert from "node:assert/strict";
import test from "node:test";
import { mapMidtransStatus, midtransSignature, verifyMidtransSignature } from "../lib/midtrans";

test("Midtrans SHA512 signature is generated and verified", () => {
  const signature = midtransSignature("TA-123", "200", "15000.00", "server-key");
  assert.equal(signature.length, 128);
  assert.equal(verifyMidtransSignature("TA-123", "200", "15000.00", signature, "server-key"), true);
  assert.equal(verifyMidtransSignature("TA-123", "200", "15001.00", signature, "server-key"), false);
  assert.equal(verifyMidtransSignature("TA-123", "200", "15000.00", "bad", "server-key"), false);
});

test("Midtrans status mapping only accepts safe paid statuses", () => {
  assert.equal(mapMidtransStatus("settlement"), "PAID");
  assert.equal(mapMidtransStatus("capture", "accept"), "PAID");
  assert.equal(mapMidtransStatus("capture", "challenge"), "PENDING");
  assert.equal(mapMidtransStatus("pending"), "PENDING");
  assert.equal(mapMidtransStatus("deny"), "CANCELLED");
  assert.equal(mapMidtransStatus("expire"), "CANCELLED");
  assert.equal(mapMidtransStatus("refund"), "CANCELLED");
  assert.equal(mapMidtransStatus("partial_refund"), "CANCELLED");
  assert.equal(mapMidtransStatus("unexpected"), "IGNORE");
});
