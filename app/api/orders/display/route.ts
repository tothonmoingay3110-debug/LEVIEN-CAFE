import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const completedVisibilityMinutes = 20;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const completedSince = new Date(Date.now() - completedVisibilityMinutes * 60 * 1000).toISOString();
    const columns = "order_number,status,created_at,updated_at";

    const [activeResult, completedResult] = await Promise.all([
      supabase
        .from("orders")
        .select(columns)
        .in("status", ["New", "Preparing", "Ready"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("orders")
        .select(columns)
        .eq("status", "Completed")
        .gte("updated_at", completedSince)
        .order("updated_at", { ascending: false })
        .limit(30),
    ]);

    if (activeResult.error) throw activeResult.error;
    if (completedResult.error) throw completedResult.error;

    const orders = [...(activeResult.data || []), ...(completedResult.data || [])].map((order) => ({
      orderNumber: order.order_number,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }));

    return NextResponse.json(
      { orders, completedVisibilityMinutes },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Unable to load public order display:", error);
    return NextResponse.json(
      { error: "Unable to load the order display." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
