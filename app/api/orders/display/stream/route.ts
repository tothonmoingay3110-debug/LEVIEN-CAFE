import { NextResponse } from "next/server";
import { createOrderEventStream } from "@/lib/supabase/order-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return createOrderEventStream(request, { channelPrefix: "order-display" });
  } catch (error) {
    console.error("Unable to start public order display stream:", error);
    return NextResponse.json({ error: "Unable to start live order display updates." }, { status: 500 });
  }
}
