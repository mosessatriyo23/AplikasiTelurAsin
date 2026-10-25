import test from "node:test";
import assert from "node:assert/strict";
import { mayAcquirePollLease, nextOrderPollDelay, ORDER_POLL_MAX_MS } from "../lib/order-polling";

test("poll scheduler backs off, honors Retry-After, and remains bounded", () => {
  assert.equal(nextOrderPollDelay(0), 20_000);
  assert.equal(nextOrderPollDelay(1), 40_000);
  assert.equal(nextOrderPollDelay(20), ORDER_POLL_MAX_MS);
  assert.equal(nextOrderPollDelay(0, 75), 75_000);
  assert.equal(nextOrderPollDelay(20, 180), 180_000);
});

test("15 minute multi-tab simulation elects only one local reader per lease window", () => {
  const tabs = 4;
  const interval = 20_000;
  const leaseDuration = 19_000;
  let leaseExpiry: number | null = null;
  let requests = 0;
  for (let now = 0; now <= 15 * 60_000; now += interval) {
    let winners = 0;
    for (let tab = 0; tab < tabs; tab++) {
      if (mayAcquirePollLease(leaseExpiry, now)) {
        leaseExpiry = now + leaseDuration;
        requests++; winners++;
      }
    }
    assert.equal(winners, 1);
  }
  assert.equal(requests, 46);
  assert.ok(requests < (15 * 60_000 / interval + 1) * tabs);
});

test("an expired tab lease lets another tab continue polling", () => {
  assert.equal(mayAcquirePollLease(35_000, 34_999), false);
  assert.equal(mayAcquirePollLease(35_000, 35_000), true);
  assert.equal(mayAcquirePollLease(null, 0), true);
});
