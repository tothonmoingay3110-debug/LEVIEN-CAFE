import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderEventStream } from "@/lib/supabase/order-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!uuidPattern.test(token)) {
    return NextResponse.json({ error: "Invalid tracking token." }, { status: 400 });
  }

  try {
    const { data, error } = await createAdminClient()
      .from("orders")
      .select("id")
      .eq("id", token)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    return createOrderEventStream(request, {
      channelPrefix: "tracked-order",
      filter: `id=eq.${token}`,
    });
  } catch (error) {
    console.error("Unable to start tracking stream:", error);
    return NextResponse.json({ error: "Unable to start live tracking." }, { status: 500 });
  }
}
