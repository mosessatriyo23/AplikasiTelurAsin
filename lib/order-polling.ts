export const ORDER_POLL_BASE_MS = 20_000;
export const ORDER_POLL_MAX_MS = 120_000;

/** Deterministic policy kept separate from React so long-running/multi-tab behavior is testable. */
export function nextOrderPollDelay(failures: number, retryAfterSeconds = 0) {
  const backoff = Math.min(ORDER_POLL_MAX_MS, ORDER_POLL_BASE_MS * 2 ** Math.min(3, Math.max(0, failures)));
  return Math.max(backoff, Math.max(0, retryAfterSeconds) * 1000);
}

export function mayAcquirePollLease(currentExpiry: number | null, now: number) {
  return currentExpiry === null || !Number.isFinite(currentExpiry) || currentExpiry <= now;
}
