import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSupabaseOrders } from "@/lib/supabase/order-reader";
import { getStaffAccess } from "@/lib/staff-auth";
import type { OrderStatus } from "@/types";

const statuses: OrderStatus[] = ["New", "Preparing", "Ready", "Completed", "Cancelled"];

async function authorizeOrders() {
  const access = await getStaffAccess("manage_orders");
  if (!access.staff) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }), staff: null };
  if (!access.allowed) return { response: NextResponse.json({ error: "Order access requires Supervisor, Manager, or Owner permission." }, { status: 403 }), staff: access.staff };
  return { response: null, staff: access.staff };
}

export async function GET() {
  try {
    const authorization = await authorizeOrders();
    if (authorization.response) return authorization.response;
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
    const authorization = await authorizeOrders();
    if (authorization.response || !authorization.staff) return authorization.response;
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

    const { data, error } = await createAdminClient().rpc("update_order_status_with_gift_card", {
      p_order_number: orderNumber,
      p_status: status,
      p_actor_id: authorization.staff.legacy ? null : authorization.staff.id,
    });
    if (error) throw error;
    const updated = data?.[0];
    if (!updated) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    return NextResponse.json({ orderNumber: updated.order_number, status: updated.order_status, giftCardRefund: Number(updated.gift_card_refund || 0) });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
    if (errorMessage.includes("ORDER_NOT_FOUND")) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (errorMessage.includes("ORDER_CANCELLED_FINAL")) return NextResponse.json({ error: "A cancelled order cannot be reopened." }, { status: 409 });
    console.error("Unable to update admin order:", error);
    return NextResponse.json({ error: "Unable to update order." }, { status: 500 });
  }
}
