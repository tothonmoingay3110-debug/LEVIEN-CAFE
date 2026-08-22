import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { deliverGiftCardSale } from "@/lib/gift-card-fulfillment";
import { getSiteOrigin, getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function identifier(value: string | Stripe.PaymentIntent | null) { return typeof value === "string" ? value : value?.id || ""; }

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, getStripeWebhookSecret()); }
  catch (error) { console.error("Stripe webhook signature failed:", error); return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 }); }

  try {
    const supported = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded"];
    if (!supported.includes(event.type)) return NextResponse.json({ received: true, ignored: true });
    let kind = ""; let sessionId = ""; let paymentIntentId = ""; let amountCents = 0;
    if (event.type.startsWith("checkout.session.")) {
      const session = event.data.object as Stripe.Checkout.Session;
      kind = session.metadata?.kind || ""; sessionId = session.id; paymentIntentId = identifier(session.payment_intent); amountCents = session.amount_total || 0;
      if (event.type === "checkout.session.completed" && !["paid", "no_payment_required"].includes(session.payment_status)) {
        return NextResponse.json({ received: true, pending: true });
      }
    } else {
      const charge = event.data.object as Stripe.Charge;
      paymentIntentId = identifier(charge.payment_intent); amountCents = charge.amount;
      if (paymentIntentId) { const intent = await getStripe().paymentIntents.retrieve(paymentIntentId); kind = intent.metadata.kind || ""; }
    }
    const db = createAdminClient();
    if (kind === "order") {
      const { error } = await db.rpc("process_stripe_order_event", { p_event_id: event.id, p_event_type: event.type, p_session_id: sessionId || null, p_payment_intent_id: paymentIntentId || null, p_amount_cents: amountCents });
      if (error) throw error;
    } else if (kind === "gift_card") {
      const { data, error } = await db.rpc("fulfill_gift_card_sale", { p_event_id: event.id, p_event_type: event.type, p_session_id: sessionId || null, p_payment_intent_id: paymentIntentId || null, p_amount_cents: amountCents });
      if (error) throw error;
      const result = data?.[0];
      if (result?.sale_id && ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
        try { await deliverGiftCardSale(result.sale_id, getSiteOrigin(request)); } catch (deliveryError) { console.error("Gift Card delivery requires follow-up:", deliveryError); }
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) { console.error("Stripe webhook processing failed:", error); return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 }); }
}
