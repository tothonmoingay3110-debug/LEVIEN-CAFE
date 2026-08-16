import { NextResponse } from "next/server";
import { createOrderEventStream } from "@/lib/supabase/order-stream";
import { getStaffAccess } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = await getStaffAccess("manage_orders");
    if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!access.allowed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return createOrderEventStream(request, { channelPrefix: "admin-orders" });
  } catch (error) {
    console.error("Unable to start admin order stream:", error);
    return NextResponse.json({ error: "Unable to start live order updates." }, { status: 500 });
  }
}
