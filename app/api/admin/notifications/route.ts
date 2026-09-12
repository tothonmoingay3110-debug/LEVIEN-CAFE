import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/request-security";

async function allowed(){const access=await getStaffAccess("manage_contacts");return access.staff&&access.allowed;}
export async function GET(){if(!await allowed())return NextResponse.json({error:"Unauthorized."},{status:403});const {data,error}=await (createAdminClient().from("admin_notifications" as any) as any).select("*").order("created_at",{ascending:false}).limit(50);if(error)return NextResponse.json({error:"Unable to load notifications."},{status:500});return NextResponse.json({notifications:data||[]},{headers:{"Cache-Control":"no-store"}})}
export async function PATCH(request:Request){if(!isSameOriginRequest(request)||!await allowed())return NextResponse.json({error:"Forbidden."},{status:403});const body=await request.json() as {id?:string;all?:boolean};let query=(createAdminClient().from("admin_notifications" as any) as any).update({read_at:new Date().toISOString()}).is("read_at",null);if(!body.all)query=query.eq("id",body.id||"");const {error}=await query;if(error)return NextResponse.json({error:"Unable to update notifications."},{status:500});return NextResponse.json({updated:true})}
