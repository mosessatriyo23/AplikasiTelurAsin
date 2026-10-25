import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ admin: await requireAdmin() }); }
  catch (error) { return apiError(error); }
}
