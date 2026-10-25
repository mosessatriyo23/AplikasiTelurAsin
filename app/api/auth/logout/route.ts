import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    (await cookies()).delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
