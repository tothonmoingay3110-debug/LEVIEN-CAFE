import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { createOrderEventStream } from "@/lib/supabase/order-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return createOrderEventStream(request, { channelPrefix: "admin-orders" });
  } catch (error) {
    console.error("Unable to start admin order stream:", error);
    return NextResponse.json({ error: "Unable to start live order updates." }, { status: 500 });
  }
}
