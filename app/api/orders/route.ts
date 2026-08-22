import { NextResponse } from "next/server";
import { hashGiftCardCode, normalizeGiftCardCode } from "@/lib/gift-cards";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/customer-auth";
import { getSiteOrigin, getStripe } from "@/lib/stripe";
import { InvalidCheckoutCatalogError, validateAndPriceOrderItems } from "@/lib/supabase/checkout-pricing";
import type { CartItem, FulfillmentType, ProductTopping } from "@/types";
import type { Json } from "@/types/database.types";

type CheckoutOrderRequest = {
  firstName: string; lastName: string; phone: string; email?: string;
  type: FulfillmentType; pickupTime?: string; address?: string; city?: string;
  zip?: string; apartment?: string; payment: string; subtotal: number;
  tax: number; deliveryFee: number; total: number; note: string;
  giftCardCode?: string;
  loyaltyRewardId?: string;
  items: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000 ? value : null;
const currency = (value: number) => Math.round(value * 100) / 100;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToppings(value: unknown): ProductTopping[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const toppings: ProductTopping[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const id = text(entry.id);
    const name = text(entry.name);
    const price = amount(entry.price);
    if (!uuidPattern.test(id) || !name || name.length > 120 || price === null) return null;
    toppings.push({ id, name, price });
  }
  return toppings;
}

function normalizeItems(value: unknown): CartItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const items: CartItem[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const itemType = entry.itemType === "combo" ? "combo" : "product";
    const lineId = text(entry.lineId);
    const productId = text(entry.productId);
    const comboId = text(entry.comboId);
    const name = text(entry.name);
    const emoji = text(entry.emoji);
    const basePrice = amount(entry.basePrice);
    const unitPrice = amount(entry.unitPrice);
    const quantity = entry.quantity;
    const toppings = normalizeToppings(entry.toppings);
    const ice = text(entry.ice);
    const sugar = text(entry.sugar);
    const note = text(entry.note);

    if (!lineId || lineId.length > 500 || !name || name.length > 200 || emoji.length > 30 ||
        basePrice === null || unitPrice === null || typeof quantity !== "number" ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || toppings === null ||
        ice.length > 50 || sugar.length > 50 || note.length > 500 ||
        (itemType === "product" && !uuidPattern.test(productId)) ||
        (itemType === "combo" && !uuidPattern.test(comboId))) return null;

    let comboItems: CartItem["comboItems"];
    if (itemType === "combo") {
      if (!Array.isArray(entry.comboItems) || entry.comboItems.length === 0 || entry.comboItems.length > 20) return null;
      comboItems = [];
      for (const child of entry.comboItems) {
        if (!isRecord(child)) return null;
        const childProductId = text(child.productId);
        const childName = text(child.name);
        const childEmoji = text(child.emoji);
        const childToppings = normalizeToppings(child.toppings);
        const childIce = text(child.ice);
        const childSugar = text(child.sugar);
        const childNote = text(child.note);
        if (!uuidPattern.test(childProductId) || !childName || childName.length > 200 ||
            childEmoji.length > 30 || childToppings === null || childIce.length > 50 ||
            childSugar.length > 50 || childNote.length > 500) return null;
        comboItems.push({
          productId: childProductId,
          name: childName,
          emoji: childEmoji,
          ice: childIce || undefined,
          sugar: childSugar || undefined,
          toppings: childToppings,
          note: childNote,
        });
      }
    }

    items.push({
      lineId, itemType, productId, comboId: itemType === "combo" ? comboId : undefined,
      name, basePrice, unitPrice, quantity, emoji,
      ice: ice || undefined, sugar: sugar || undefined,
      toppings, note, comboItems,
    });
  }
  return items;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin order requests are not allowed." }, { status: 403 });
  }
  if (requestBodyExceeds(request, 256 * 1024)) {
    return NextResponse.json({ error: "Order request is too large." }, { status: 413 });
  }

  let body: CheckoutOrderRequest;
  try {
    body = (await request.json()) as CheckoutOrderRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const phone = text(body.phone);
  const phoneNormalized = phone.replace(/\D/g, "");
  const email = text(body.email);
  const fulfillmentType = body.type;
  const subtotal = amount(body.subtotal);
  const tax = amount(body.tax);
  const deliveryFee = amount(body.deliveryFee);
  const total = amount(body.total);
  const items = normalizeItems(body.items);
  const note = text(body.note);
  const giftCardRaw = text(body.giftCardCode);
  const giftCardCode = giftCardRaw ? normalizeGiftCardCode(giftCardRaw) : null;

  if (!firstName || !lastName || phoneNormalized.length < 10 || phoneNormalized.length > 15 ||
      firstName.length > 100 || lastName.length > 100 || phone.length > 30 || email.length > 254 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      !["Pickup", "Delivery"].includes(fulfillmentType) || subtotal === null || tax === null ||
      deliveryFee === null || total === null || items === null || note.length > 1000 ||
      (giftCardRaw && !giftCardCode)) {
    return NextResponse.json({ error: "Invalid order details." }, { status: 400 });
  }

  const expectedDeliveryFee = fulfillmentType === "Delivery" ? 3.99 : 0;
  const address = text(body.address);
  const city = text(body.city);
  const zip = text(body.zip);
  const apartment = text(body.apartment);
  if (address.length > 200 || city.length > 100 || zip.length > 20 || apartment.length > 100 ||
      (fulfillmentType === "Delivery" && (!address || !city || !zip))) {
    return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
  }
  const payment = text(body.payment) || "Pay at Store";
  if (!["Pay at Store", "Cash on Delivery", "Card at Pickup", "Online Card"].includes(payment)) {
    return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const pricedItems = await validateAndPriceOrderItems(supabase, items);
    const orderSubtotal = currency(pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const orderTax = currency(orderSubtotal * 0.08);
    const orderDeliveryFee = currency(expectedDeliveryFee);
    const orderTotal = currency(orderSubtotal + orderTax + orderDeliveryFee);
    if (Math.abs(subtotal - orderSubtotal) > 0.01 || Math.abs(tax - orderTax) > 0.01 ||
        Math.abs(deliveryFee - orderDeliveryFee) > 0.01 || Math.abs(total - orderTotal) > 0.01) {
      return NextResponse.json({ error: "Menu prices changed. Refresh your cart and try again." }, { status: 409 });
    }

    const customer = await getCustomerSession();
    if (customer && email && email.toLowerCase() !== customer.profile.email.toLowerCase()) {
      return NextResponse.json({ error: "Use the email address on your signed-in account." }, { status: 409 });
    }
    const loyaltyRewardId = text(body.loyaltyRewardId);
    if (loyaltyRewardId && !uuidPattern.test(loyaltyRewardId)) return NextResponse.json({ error: "Invalid loyalty reward." }, { status: 400 });
    const paymentChannel = payment === "Online Card" ? "stripe" : "offline";
    const { data, error } = await supabase.rpc("create_checkout_order_v3", {
      p_first_name: firstName, p_last_name: lastName, p_phone: phone,
      p_phone_normalized: phoneNormalized, p_email: email || null,
      p_fulfillment_type: fulfillmentType,
      p_pickup_time: fulfillmentType === "Pickup" ? text(body.pickupTime) || "ASAP" : null,
      p_address: fulfillmentType === "Delivery" ? address : null,
      p_city: fulfillmentType === "Delivery" ? city : null,
      p_zip: fulfillmentType === "Delivery" ? zip : null,
      p_apartment: fulfillmentType === "Delivery" ? apartment || null : null,
      p_payment_method: payment,
      p_subtotal: orderSubtotal, p_tax: orderTax, p_delivery_fee: orderDeliveryFee,
      p_total: orderTotal, p_note: note,
      p_items: JSON.parse(JSON.stringify(pricedItems)) as Json,
      p_gift_card_hash: giftCardCode ? hashGiftCardCode(giftCardCode) : null,
      p_customer_profile_id: customer?.profile.id || null,
      p_payment_channel: paymentChannel,
      p_loyalty_reward_id: loyaltyRewardId || null,
    });
    if (error) throw error;
    const created = data?.[0];
    const orderNumber = created?.order_number;
    if (!orderNumber) throw new Error("Supabase did not return an order number.");
    const orderId = created?.order_id;
    if (!orderId) throw new Error("Unable to create tracking token.");
    const amountDue = Number(created.amount_due || 0);
    let checkoutUrl: string | null = null;
    if (paymentChannel === "stripe" && amountDue > 0) {
      try {
        const stripe = getStripe();
        const origin = getSiteOrigin(request);
        const checkout = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: customer?.profile.email || email || undefined,
          line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(amountDue * 100), product_data: { name: `LEVIEN CAFE Order ${orderNumber}`, description: `${pricedItems.length} order line${pricedItems.length === 1 ? "" : "s"}` } } }],
          success_url: `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/checkout?payment=cancelled&order=${encodeURIComponent(orderNumber)}`,
          metadata: { kind: "order", order_id: orderId, order_number: orderNumber },
          payment_intent_data: { metadata: { kind: "order", order_id: orderId, order_number: orderNumber } },
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        }, { idempotencyKey: `order-checkout-${orderId}` });
        if (!checkout.url) throw new Error("Stripe did not return a checkout URL.");
        checkoutUrl = checkout.url;
        const [orderUpdate, paymentUpdate] = await Promise.all([
          supabase.from("orders").update({ stripe_checkout_session_id: checkout.id }).eq("id", orderId),
          supabase.from("payments").update({ provider_session_id: checkout.id }).eq("order_id", orderId).eq("provider", "stripe"),
        ]);
        if (orderUpdate.error) throw orderUpdate.error;
        if (paymentUpdate.error) throw paymentUpdate.error;
      } catch (stripeError) {
        await supabase.rpc("update_order_status_v3", { p_order_number: orderNumber, p_status: "Cancelled", p_actor_id: null, p_stripe_refunded: false });
        throw stripeError;
      }
    }
    return NextResponse.json({
      orderNumber,
      trackingToken: orderId,
      checkoutUrl,
      paymentMethod: created.final_payment_method,
      paymentStatus: created.payment_status,
      giftCardAmount: Number(created.gift_card_amount || 0),
      giftCardBalance: created.gift_card_balance === null ? null : Number(created.gift_card_balance),
      loyaltyDiscount: Number(created.loyalty_discount || 0),
      amountDue,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidCheckoutCatalogError) {
      return NextResponse.json({ error: "The menu changed or an item is unavailable. Refresh your cart and try again." }, { status: 409 });
    }
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
    if (errorMessage.includes("GIFT_CARD_INVALID")) return NextResponse.json({ error: "Gift Card not found." }, { status: 409 });
    if (errorMessage.includes("GIFT_CARD_INACTIVE")) return NextResponse.json({ error: "This Gift Card is not active." }, { status: 409 });
    if (errorMessage.includes("GIFT_CARD_EXPIRED")) return NextResponse.json({ error: "This Gift Card has expired." }, { status: 409 });
    if (errorMessage.includes("GIFT_CARD_EMPTY")) return NextResponse.json({ error: "This Gift Card has no remaining balance." }, { status: 409 });
    if (errorMessage.includes("LOYALTY_LOGIN_REQUIRED")) return NextResponse.json({ error: "Sign in to use this reward." }, { status: 401 });
    if (errorMessage.includes("LOYALTY_REWARD_INVALID")) return NextResponse.json({ error: "This reward is unavailable or expired." }, { status: 409 });
    if (errorMessage.includes("LOYALTY_PRODUCT_REQUIRED")) return NextResponse.json({ error: "Add the reward product to your cart before applying this reward." }, { status: 409 });
    console.error("Unable to create checkout order:", error);
    return NextResponse.json({ error: "Unable to place order." }, { status: 500 });
  }
}
