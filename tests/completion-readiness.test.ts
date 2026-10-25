import test from "node:test";
import assert from "node:assert/strict";
import { completionBlockReason } from "../lib/completion-readiness";

const now = new Date("2026-10-22T06:00:00Z");
test("mixed order cannot finish while salted egg is still in production", () => {
  const result = completionBlockReason([
    { name: "Telur Bebek Mentah", readyAt: new Date("2026-10-22T02:00:00Z") },
    { name: "Telur Asin Matang", readyAt: new Date("2026-10-24T17:00:00Z") },
  ], now);
  assert.match(result || "", /Telur Asin Matang/);
  assert.doesNotMatch(result || "", /Telur Bebek Mentah:/);
});
test("every item must be ready before finishing", () => {
  assert.equal(completionBlockReason([
    { name: "Telur Bebek Mentah", readyAt: new Date("2026-10-21T17:00:00Z") },
    { name: "Telur Asin Matang", readyAt: new Date("2026-10-21T17:00:00Z") },
  ], now), null);
});
test("unknown readiness fails closed", () => {
  assert.match(completionBlockReason([{ name: "Telur Asin Mentah", readyAt: null }], now) || "", /belum dapat dipastikan/);
});
