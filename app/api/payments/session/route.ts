import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { deliverGiftCardSale } from "@/lib/gift-card-fulfillment";
import { getSiteOrigin, getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutId = /^cs_(?:test_|live_)?[A-Za-z0-9]+$/;
const id = (value: string | Stripe.PaymentIntent | null) => typeof value === "string" ? value : value?.id || "";

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id") || "";
    if (!checkoutId.test(sessionId)) return NextResponse.json({ error: "Invalid payment session." }, { status: 400 });
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const kind = session.metadata?.kind;
    const paymentIntentId = id(session.payment_intent);
    const db = createAdminClient();
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (kind === "order") {
      if (paid) {
        const { error } = await db.rpc("process_stripe_order_event", { p_event_id: `landing:${session.id}`, p_event_type: "checkout.session.completed", p_session_id: session.id, p_payment_intent_id: paymentIntentId || null, p_amount_cents: session.amount_total || 0 });
        if (error) throw error;
      }
      const { data: order, error } = await db.from("orders").select("id,order_number,first_name,fulfillment_type,pickup_time,total,amount_due,gift_card_amount,loyalty_discount,payment_status,status").eq("stripe_checkout_session_id", session.id).single();
      if (error) throw error;
      return NextResponse.json({ kind, paid, order: { trackingToken: order.id, orderNumber: order.order_number, firstName: order.first_name, type: order.fulfillment_type, pickupTime: order.pickup_time, total: Number(order.total), amountDue: Number(order.amount_due), giftCardAmount: Number(order.gift_card_amount), loyaltyDiscount: Number(order.loyalty_discount), paymentStatus: order.payment_status, status: order.status } }, { headers: { "Cache-Control": "no-store" } });
    }
    if (kind === "gift_card") {
      if (paid) {
        const { data, error } = await db.rpc("fulfill_gift_card_sale", { p_event_id: `landing:${session.id}`, p_event_type: "checkout.session.completed", p_session_id: session.id, p_payment_intent_id: paymentIntentId || null, p_amount_cents: session.amount_total || 0 });
        if (error) throw error;
        if (data?.[0]?.sale_id) try { await deliverGiftCardSale(data[0].sale_id, getSiteOrigin(request)); } catch (deliveryError) { console.error(deliveryError); }
      }
      const { data: sale, error } = await db.from("gift_card_sales").select("id,status,delivery_status,amount,recipient_email").eq("stripe_checkout_session_id", session.id).single();
      if (error) throw error;
      return NextResponse.json({ kind, paid, sale: { id: sale.id, status: sale.status, deliveryStatus: sale.delivery_status, amount: Number(sale.amount), recipientEmail: sale.recipient_email } }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unknown payment session." }, { status: 404 });
  } catch (error) { console.error("Unable to confirm Stripe session:", error); return NextResponse.json({ error: "Unable to confirm payment." }, { status: 500 }); }
}
