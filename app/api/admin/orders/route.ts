import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSupabaseOrders } from "@/lib/supabase/order-reader";
import { getStaffAccess } from "@/lib/staff-auth";
import type { OrderStatus } from "@/types";

const statuses: OrderStatus[] = ["New", "Preparing", "Ready", "Completed", "Cancelled"];

async function authorizeOrders() {
  const access = await getStaffAccess("manage_orders");
  if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Order access requires Supervisor, Manager, or Owner permission." }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    const denied = await authorizeOrders();
    if (denied) return denied;
    const orders = await readSupabaseOrders(createAdminClient());
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Unable to load admin orders:", error);
    return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const denied = await authorizeOrders();
    if (denied) return denied;
    if (requestBodyExceeds(request, 8 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    let body: { orderNumber?: unknown; status?: unknown };
    try {
      body = (await request.json()) as { orderNumber?: unknown; status?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
    const status = typeof body.status === "string" ? body.status as OrderStatus : null;
    if (!orderNumber || !status || !statuses.includes(status)) {
      return NextResponse.json({ error: "Invalid order update." }, { status: 400 });
    }

    const { data, error } = await createAdminClient()
      .from("orders")
      .update({ status })
      .eq("order_number", orderNumber)
      .select("order_number,status")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json({ orderNumber: data.order_number, status: data.status });
  } catch (error) {
    console.error("Unable to update admin order:", error);
    return NextResponse.json({ error: "Unable to update order." }, { status: 500 });
  }
}
