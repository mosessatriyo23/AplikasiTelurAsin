import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api";
import { requireAdmin, verifyOrigin } from "@/lib/auth";
const schema=z.object({address:z.string().trim().min(5).max(500),landmark:z.string().trim().max(200).optional(),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict();
export async function GET(){try{await requireAdmin();const settings=await db.storeSettings.findUnique({where:{id:1}});return NextResponse.json({settings})}catch(error){return apiError(error)}}
export async function PUT(request:Request){try{verifyOrigin(request);await requireAdmin();const input=schema.parse(await request.json());const settings=await db.storeSettings.upsert({where:{id:1},create:{id:1,...input,landmark:input.landmark||null},update:{...input,landmark:input.landmark||null}});return NextResponse.json({settings})}catch(error){return apiError(error)}}
