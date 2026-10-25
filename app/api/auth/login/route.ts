import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { createSession, verifyOrigin } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit, consumeRateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const input = loginSchema.parse(await request.json());
    const keys = await checkRateLimit("login", request, input.username);
    // Reserve an attempt before expensive bcrypt work, including concurrent requests.
    await consumeRateLimit("login", keys);
    const admin = await db.admin.findUnique({ where: { username: input.username } });
    const valid = await compare(input.password, admin?.passwordHash || "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5EwQfA1r5F4bTqjzUPtDkJZ3MRb0p5S");
    if (!admin || !valid) {
      await consumeRateLimit("login", keys, true);
      return NextResponse.json({ error: "Username atau kata sandi salah" }, { status: 401 });
    }
    await createSession(admin.id);
    return NextResponse.json({ admin: { id: admin.id, username: admin.username } });
  } catch (error) { return apiError(error); }
}
