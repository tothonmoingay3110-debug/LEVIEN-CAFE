import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { generateGiftCardCode } from "@/lib/gift-cards";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { encryptSecret } from "@/lib/secret-envelope";
import { getSiteOrigin, getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest } from "@/lib/rate-limit";

const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!allowRequest(request, "gift-card-purchase", 10, 10 * 60 * 1000)) return NextResponse.json({ error: "Too many purchase attempts. Try again later." }, { status: 429 });
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const customer = await getCustomerSession();
    if (!customer) return NextResponse.json({ error: "Sign in before purchasing a Gift Card." }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const amount = Math.round(Number(body.amount) * 100) / 100;
    const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim().slice(0, 120) : "";
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim().toLowerCase().slice(0, 254) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    if (!Number.isFinite(amount) || amount < 5 || amount > 1000) return NextResponse.json({ error: "Choose an amount between $5 and $1,000." }, { status: 400 });
    if (!recipientName || !email.test(recipientEmail)) return NextResponse.json({ error: "Enter a recipient name and valid email." }, { status: 400 });
    const code = generateGiftCardCode();
    const db = createAdminClient();
    const { data: sale, error } = await db.from("gift_card_sales").insert({ purchaser_profile_id: customer.profile.id, purchaser_email: customer.profile.email, recipient_name: recipientName, recipient_email: recipientEmail, personal_message: message, amount, sales_channel: "online", status: "pending", tender_type: "stripe", receipt_reference: "", pending_code_hash: code.hash, pending_code_last_four: code.lastFour, pending_code_ciphertext: encryptSecret(code.formatted), delivery_status: "pending" }).select("id").single();
    if (error) throw error;
    try {
      const stripe = getStripe(); const origin = getSiteOrigin(request);
      const session = await stripe.checkout.sessions.create({ mode: "payment", customer_email: customer.profile.email, line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(amount * 100), product_data: { name: `$${amount.toFixed(2)} LEVIEN CAFE Gift Card`, description: `Digital Gift Card for ${recipientName}` } } }], success_url: `${origin}/gift-card/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/gift-card/buy?payment=cancelled`, metadata: { kind: "gift_card", sale_id: sale.id }, payment_intent_data: { metadata: { kind: "gift_card", sale_id: sale.id } }, expires_at: Math.floor(Date.now() / 1000) + 30 * 60 }, { idempotencyKey: `gift-card-checkout-${sale.id}` });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      const updated = await db.from("gift_card_sales").update({ stripe_checkout_session_id: session.id }).eq("id", sale.id);
      if (updated.error) throw updated.error;
      return NextResponse.json({ checkoutUrl: session.url }, { status: 201 });
    } catch (stripeError) { await db.from("gift_card_sales").delete().eq("id", sale.id).eq("status", "pending"); throw stripeError; }
  } catch (error) { console.error("Unable to start Gift Card purchase:", error); return NextResponse.json({ error: "Unable to start secure Gift Card checkout." }, { status: 500 }); }
}
