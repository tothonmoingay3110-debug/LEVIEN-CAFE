import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvalidCheckoutCatalogError, validateAndPriceOrderItems } from "@/lib/supabase/checkout-pricing";
import type { CartItem, FulfillmentType, ProductTopping } from "@/types";
import type { Json } from "@/types/database.types";

type CheckoutOrderRequest = {
  firstName: string; lastName: string; phone: string; email?: string;
  type: FulfillmentType; pickupTime?: string; address?: string; city?: string;
  zip?: string; apartment?: string; payment: string; subtotal: number;
  tax: number; deliveryFee: number; total: number; note: string;
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

  if (!firstName || !lastName || phoneNormalized.length < 10 || phoneNormalized.length > 15 ||
      firstName.length > 100 || lastName.length > 100 || phone.length > 30 || email.length > 254 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      !["Pickup", "Delivery"].includes(fulfillmentType) || subtotal === null || tax === null ||
      deliveryFee === null || total === null || items === null || note.length > 1000) {
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
  if (!["Pay at Store", "Cash on Delivery", "Card at Pickup"].includes(payment)) {
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

    const { data, error } = await supabase.rpc("create_checkout_order", {
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
    });
    if (error) throw error;
    const orderNumber = data?.[0]?.order_number;
    if (!orderNumber) throw new Error("Supabase did not return an order number.");
    const { data: createdOrder, error: lookupError } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .single();
    if (lookupError || !createdOrder) throw lookupError || new Error("Unable to create tracking token.");
    return NextResponse.json({ orderNumber, trackingToken: createdOrder.id }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidCheckoutCatalogError) {
      return NextResponse.json({ error: "The menu changed or an item is unavailable. Refresh your cart and try again." }, { status: 409 });
    }
    console.error("Unable to create checkout order:", error);
    return NextResponse.json({ error: "Unable to place order." }, { status: 500 });
  }
}
