import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FulfillmentType } from "@/types";

type CheckoutOrderRequest = {
  firstName: string; lastName: string; phone: string; email?: string;
  type: FulfillmentType; pickupTime?: string; address?: string; city?: string;
  zip?: string; apartment?: string; payment: string; subtotal: number;
  tax: number; deliveryFee: number; total: number; note: string;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export async function POST(request: Request) {
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

  if (!firstName || !lastName || phoneNormalized.length < 10 || phoneNormalized.length > 15 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      !["Pickup", "Delivery"].includes(fulfillmentType) || subtotal === null || tax === null ||
      deliveryFee === null || total === null) {
    return NextResponse.json({ error: "Invalid order details." }, { status: 400 });
  }

  const expectedDeliveryFee = fulfillmentType === "Delivery" ? 3.99 : 0;
  if (Math.abs(tax - subtotal * 0.08) > 0.01 ||
      Math.abs(deliveryFee - expectedDeliveryFee) > 0.01 ||
      Math.abs(total - (subtotal + tax + deliveryFee)) > 0.01) {
    return NextResponse.json({ error: "Invalid order totals." }, { status: 400 });
  }

  const address = text(body.address);
  const city = text(body.city);
  const zip = text(body.zip);
  if (fulfillmentType === "Delivery" && (!address || !city || !zip)) {
    return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("create_checkout_order", {
      p_first_name: firstName, p_last_name: lastName, p_phone: phone,
      p_phone_normalized: phoneNormalized, p_email: email || null,
      p_fulfillment_type: fulfillmentType,
      p_pickup_time: fulfillmentType === "Pickup" ? text(body.pickupTime) || "ASAP" : null,
      p_address: fulfillmentType === "Delivery" ? address : null,
      p_city: fulfillmentType === "Delivery" ? city : null,
      p_zip: fulfillmentType === "Delivery" ? zip : null,
      p_apartment: fulfillmentType === "Delivery" ? text(body.apartment) || null : null,
      p_payment_method: text(body.payment) || "Pay at Store",
      p_subtotal: subtotal, p_tax: tax, p_delivery_fee: deliveryFee,
      p_total: total, p_note: text(body.note),
    });
    if (error) throw error;
    const orderNumber = data?.[0]?.order_number;
    if (!orderNumber) throw new Error("Supabase did not return an order number.");
    return NextResponse.json({ orderNumber }, { status: 201 });
  } catch (error) {
    console.error("Unable to create checkout order:", error);
    return NextResponse.json({ error: "Unable to place order." }, { status: 500 });
  }
}
