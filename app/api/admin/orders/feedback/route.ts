import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffAccess } from "@/lib/staff-auth";

export async function GET(request: Request) {
  try {
    const access = await getStaffAccess("manage_orders");
    if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!access.allowed) return NextResponse.json({ error: "Order access requires Supervisor, Manager, or Owner permission." }, { status: 403 });
    const orderNumber = new URL(request.url).searchParams.get("orderNumber") || "";
    if (!/^[A-Za-z0-9-]{1,40}$/.test(orderNumber)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const db = createAdminClient();
    const { data: order, error: orderError } = await db.from("orders").select("id").eq("order_number", orderNumber).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const { data, error } = await db.from("order_feedback").select("rating,comment,updated_at").eq("order_id", order.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ feedback: data ? { rating: data.rating, comment: data.comment, updatedAt: data.updated_at } : null }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load staff order feedback:", error);
    return NextResponse.json({ error: "Unable to load feedback." }, { status: 500 });
  }
}
