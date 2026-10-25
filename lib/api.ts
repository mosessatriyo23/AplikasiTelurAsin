import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";
import { RateLimitError } from "./rate-limit";

export function apiError(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data tidak valid", details: error.flatten() }, { status: 400 });
  if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Raw Prisma/gateway exceptions may contain tokens, query parameters or PII.
  console.error("API error", { category: "unexpected_server_error" });
  return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
}
