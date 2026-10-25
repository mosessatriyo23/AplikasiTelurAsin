import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { configureWebPush, vapidPublicKey } from "@/lib/push";

export function GET() {
  try {
    // Validate the complete pair instead of advertising a public key that cannot send.
    configureWebPush();
    return NextResponse.json({ publicKey: vapidPublicKey() });
  }
  catch (error) { return apiError(error); }
}
