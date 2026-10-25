import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

export const SESSION_COOKIE = "telur_admin_session";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function secret(): Uint8Array {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new ApiError(503, "ADMIN_SESSION_SECRET belum dikonfigurasi (minimal 32 karakter)");
  return new TextEncoder().encode(value);
}
export function verifyOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // Browser mutations must carry an Origin that matches the configured app URL.
  // Server-to-server callbacks use dedicated authentication and do not call this helper.
  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const configured = configuredUrl ? new URL(configuredUrl).origin : null;
  // Use an explicit allowlist; never trust a forwarded Host as authorization.
  const extras = (process.env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  const allowed = new Set([configured, ...extras].filter((value): value is string => Boolean(value)));
  const isBrowser = request.headers.has("sec-fetch-site") || request.headers.has("sec-fetch-mode");
  if ((isBrowser && !origin) || (origin && !allowed.has(origin)) || request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "Origin tidak diizinkan");
}
export async function createSession(adminId: string): Promise<void> {
  const token = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setSubject(adminId).setIssuer("telur-admin").setAudience("telur-admin").setIssuedAt().setExpirationTime("8h").sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
}
export async function requireAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError(401, "Silakan masuk sebagai admin");
  const key = secret();
  let id: string | undefined;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], issuer: "telur-admin", audience: "telur-admin" });
    if (payload.role !== "admin") throw new Error("Invalid role");
    id = payload.sub;
  } catch { throw new ApiError(401, "Sesi tidak valid atau kedaluwarsa"); }
  const admin = id ? await db.admin.findUnique({ where: { id }, select: { id: true, email: true } }) : null;
  if (!admin) throw new ApiError(401, "Sesi tidak valid");
  return admin;
}
