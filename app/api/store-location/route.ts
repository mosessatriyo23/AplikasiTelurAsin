import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(){try{const location=await db.storeSettings.findUnique({where:{id:1},select:{address:true,landmark:true,latitude:true,longitude:true}});return NextResponse.json({location},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({error:"Lokasi toko belum dapat dimuat."},{status:503})}}
