import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ error: "Sign in to view feedback." }, { status: 401 });
    const db = createAdminClient();
    const { data, error } = await db.from("order_feedback")
      .select("order_id,rating,comment,updated_at")
      .eq("customer_profile_id", session.profile.id).order("updated_at", { ascending: false });
    if (error) throw error;
    const orderIds = (data || []).map((item) => item.order_id);
    const ordersResult = orderIds.length ? await db.from("orders").select("id,order_number").in("id", orderIds).eq("customer_profile_id", session.profile.id) : { data: [], error: null };
    if (ordersResult.error) throw ordersResult.error;
    const numbers = new Map((ordersResult.data || []).map((item) => [item.id, item.order_number]));
    return NextResponse.json({ feedback: (data || []).filter((item) => numbers.has(item.order_id)).map((item) => ({
      orderNumber: numbers.get(item.order_id), rating: item.rating, comment: item.comment, updatedAt: item.updated_at,
    })) }, { headers: noStore });
  } catch (error) {
    console.error("Unable to read order feedback:", error);
    return NextResponse.json({ error: "Unable to load feedback." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 4 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const session = await getCustomerSession({ syncOrders: true });
    if (!session) return NextResponse.json({ error: "Sign in to rate an order." }, { status: 401 });
    const body = await request.json().catch(() => null) as { orderNumber?: unknown; rating?: unknown; comment?: unknown } | null;
    const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";
    const rating = body?.rating;
    const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
    if (!/^[A-Za-z0-9-]{1,40}$/.test(orderNumber) || !Number.isInteger(rating) || Number(rating) < 1 || Number(rating) > 5 || comment.length > 1000) {
      return NextResponse.json({ error: "Enter a valid rating (1–5) and a comment under 1,000 characters." }, { status: 400 });
    }
    const db = createAdminClient();
    const { data: order, error: orderError } = await db.from("orders").select("id,status")
      .eq("order_number", orderNumber).eq("customer_profile_id", session.profile.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found in your account." }, { status: 404 });
    if (order.status !== "Completed") return NextResponse.json({ error: "You can rate an order after it is completed." }, { status: 409 });
    const { error } = await db.from("order_feedback").upsert({
      order_id: order.id, customer_profile_id: session.profile.id, rating: Number(rating), comment,
    }, { onConflict: "order_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Unable to save order feedback:", error);
    return NextResponse.json({ error: "Unable to save feedback." }, { status: 500 });
  }
}
