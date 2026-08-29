import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";

export async function PATCH(request:Request){
  try{
    if(!isSameOriginRequest(request))return NextResponse.json({error:"Forbidden."},{status:403});
    if(requestBodyExceeds(request,8*1024))return NextResponse.json({error:"Request is too large."},{status:413});
    const staff=await getStaffSession();if(!staff||staff.legacy)return NextResponse.json({error:"A staff account is required."},{status:401});
    const body=await request.json() as {avatarUrl?:unknown};const avatarUrl=typeof body.avatarUrl==="string"?body.avatarUrl.trim().slice(0,2000):"";
    if(avatarUrl&&!/^https:\/\//i.test(avatarUrl))return NextResponse.json({error:"Invalid avatar URL."},{status:400});
    const {data,error}=await createAdminClient().from("staff_profiles").update({avatar_url:avatarUrl||null}).eq("id",staff.id).select("avatar_url").single();
    if(error)throw error;return NextResponse.json({avatarUrl:data.avatar_url||""});
  }catch(error){console.error("Unable to update staff avatar:",error);return NextResponse.json({error:"Unable to update avatar."},{status:500});}
}
