import { createHash } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./auth";

// Serverless/multi-instance safe: all counters and failed-login backoff live in SQLite.
// Without a deliberately configured trusted proxy we use a shared bucket rather than
// trusting attacker-controlled X-Forwarded-For. Production operators should configure
// a trusted edge that overwrites (not appends) the configured identity header.
const rules = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  order: { limit: 8, windowMs: 60 * 60_000 },
  checkout: { limit: 15, windowMs: 15 * 60_000 },
  payment: { limit: 20, windowMs: 15 * 60_000 },
  orderSync: { limit: 20, windowMs: 15 * 60_000 },
  identitySync: { limit: 120, windowMs: 15 * 60_000 },
} as const;
export type RateScope = keyof typeof rules;
export function clientIdentity(request: Request): string {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (!header || !/^[a-z][a-z0-9-]{0,60}$/.test(header) || header === "x-forwarded-for" || header === "forwarded") return "shared-untrusted";
  // Only enable behind an edge that drops inbound copies and sets a single IP.
  const value = request.headers.get(header)?.trim() || "";
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(value)) return "shared-untrusted";
  return value;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function rateKey(scope: RateScope, identity: string, username?: string) {
  return `${scope}:${digest(`${identity}:${username?.trim().toLowerCase() || ""}`)}`;
}
export class RateLimitError extends ApiError {
  constructor(public retryAfter: number) { super(429, "Terlalu banyak percobaan. Silakan coba lagi nanti."); }
}
export async function checkRateLimit(scope: RateScope, request: Request, username?: string) {
  const identity = clientIdentity(request);
  const keys = scope === "login" ? [rateKey(scope, identity), rateKey(scope, "username", username || "unknown")]
    : scope === "orderSync" ? [rateKey(scope, username || identity)]
    : [rateKey(scope, identity)];
  const now = Date.now(), rule = rules[scope];
  for (const key of keys) {
    const record = await db.rateLimit.findUnique({ where: { key } });
    if (record && record.expiresAt.getTime() > now && (record.count >= rule.limit || record.blockedUntil && record.blockedUntil.getTime() > now)) {
      throw new RateLimitError(Math.max(1, Math.ceil(((record.blockedUntil && record.blockedUntil.getTime() > now ? record.blockedUntil : record.expiresAt).getTime() - now) / 1000)));
    }
  }
  return keys;
}
export async function consumeRateLimit(scope: RateScope, keys: string[], failed = false) {
  const rule = rules[scope], now = new Date();
  for (const key of keys) {
    await db.$transaction(async tx => {
      const existing = await tx.rateLimit.findUnique({ where: { key } });
      const valid = existing && existing.expiresAt > now;
      if (!failed && valid && (existing.count >= rule.limit || existing.blockedUntil && existing.blockedUntil > now)) throw new RateLimitError(Math.max(1, Math.ceil(((existing.blockedUntil && existing.blockedUntil > now ? existing.blockedUntil : existing.expiresAt).getTime() - now.getTime()) / 1000)));
      const count = valid ? existing.count + (failed ? 0 : 1) : 1;
      const failures = failed ? (valid ? existing!.failures + 1 : 1) : (valid ? existing!.failures : 0);
      const blockedUntil = failed && scope === "login" && failures >= 3 ? new Date(now.getTime() + Math.min(3600, 2 ** Math.min(failures - 3, 10)) * 30_000) : (valid ? existing!.blockedUntil : null);
      await tx.rateLimit.upsert({ where: { key }, create: { key, count, failures, expiresAt: new Date(now.getTime() + rule.windowMs), blockedUntil }, update: { count, failures, expiresAt: valid ? existing!.expiresAt : new Date(now.getTime() + rule.windowMs), blockedUntil } });
    });
  }
}
export async function enforceRateLimit(scope: RateScope, request: Request, username?: string) {
  const keys = await checkRateLimit(scope, request, username);
  await consumeRateLimit(scope, keys);
}
