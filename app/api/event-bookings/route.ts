import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { sendEventBookingEmail } from "@/lib/event-booking-email";

const text=(v:unknown,n:number)=>typeof v === "string" ? v.trim().slice(0,n) : "";
export async function POST(request:Request){
  if(!isSameOriginRequest(request)) return NextResponse.json({error:"Forbidden."},{status:403});
  if(requestBodyExceeds(request,16*1024)) return NextResponse.json({error:"Request is too large."},{status:413});
  try{
    const body=await request.json() as Record<string,unknown>;
    const eventName=text(body.eventName,160), eventType=text(body.eventType,80), eventDate=text(body.eventDate,10), startTime=text(body.startTime,5), endTime=text(body.endTime,5);
    const customerName=text(body.customerName,120), customerPhone=text(body.customerPhone,30), customerEmail=text(body.customerEmail,254).toLowerCase(), notes=text(body.notes,2000);
    if(eventName.length<2) return NextResponse.json({error:"Enter the event name."},{status:400});
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||!/^\d{2}:\d{2}$/.test(startTime)) return NextResponse.json({error:"Choose a valid event date and time."},{status:400});
    if(endTime && !/^\d{2}:\d{2}$/.test(endTime)) return NextResponse.json({error:"Choose a valid end time."},{status:400});
    if(!customerName && !customerPhone) return NextResponse.json({error:"Enter your name or phone number."},{status:400});
    if(customerEmail && !/^\S+@\S+\.\S+$/.test(customerEmail)) return NextResponse.json({error:"Enter a valid email address."},{status:400});
    const guestCount=body.guestCount ? Number(body.guestCount) : null;
    const db=createAdminClient();
    const {data,error}=await (db.from("event_booking_requests" as any) as any).insert({event_name:eventName,event_type:eventType,event_date:eventDate,start_time:startTime,end_time:endTime||null,customer_name:customerName,customer_phone:customerPhone,customer_email:customerEmail||null,guest_count:Number.isInteger(guestCount)?guestCount:null,notes,status:"new"}).select("id,reference_code").single();
    if(error) throw error;
    await (db.from("admin_notifications" as any) as any).insert({kind:"event_booking",title:"New event booking",message:`${eventName} · ${eventDate} ${startTime}`,target_view:"eventbookings",target_id:data.id}).then(()=>undefined).catch(()=>undefined);
    const {data:content}=await db.from("site_content").select("email").eq("singleton_key","main").maybeSingle();
    await sendEventBookingEmail({id:data.id,referenceCode:data.reference_code,eventName,eventDate,startTime,customerName,customerPhone,customerEmail,guestCount:Number.isInteger(guestCount)?guestCount:null,notes,to:content?.email||process.env.EVENT_BOOKING_TO_EMAIL?.trim()||""}).catch((mailError)=>console.error("Unable to email event booking:",mailError));
    return NextResponse.json({received:true,referenceCode:data.reference_code},{status:201});
  }catch(error){ console.error("Unable to save event booking request:",error); return NextResponse.json({error:"Unable to submit your event request."},{status:500}); }
}
