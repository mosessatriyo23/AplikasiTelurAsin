import { NextResponse } from "next/server";
import { requireAdmin, verifyOrigin } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { resolveAmbiguousCheckout } from "@/lib/checkout-review";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try{verifyOrigin(request);const admin=await requireAdmin();const {id}=await params;await resolveAmbiguousCheckout(id,admin.id);return NextResponse.json({ok:true});}catch(error){return apiError(error)}
}
