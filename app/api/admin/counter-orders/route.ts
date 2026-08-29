import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { validateAndPriceOrderItems } from "@/lib/supabase/checkout-pricing";
import type { CartItem } from "@/types";
import type { Json } from "@/types/database.types";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const clean = (value: unknown, length = 120) => typeof value === "string" ? value.trim().slice(0, length) : "";
const currency = (value: number) => Math.round(value * 100) / 100;

async function authorize() {
  const access = await getStaffAccess("manage_orders");
  if (!access.staff) return { staff: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!access.allowed) return { staff: access.staff, response: NextResponse.json({ error: "Order access is required." }, { status: 403 }) };
  return { staff: access.staff, response: null };
}

export async function GET() {
  try {
    const auth = await authorize(); if (auth.response) return auth.response;
    const db = createAdminClient();
    const [products, toppings, links, customers] = await Promise.all([
      db.from("products").select("id,sku,name,price,image_url,emoji,allow_toppings,sold_out").eq("active", true).order("name"),
      db.from("toppings").select("id,name,price,image_url").eq("active", true).order("name"),
      db.from("product_toppings").select("product_id,topping_id"),
      db.from("customer_profiles").select("id,first_name,last_name,email,phone,membership_number").order("first_name"),
    ]);
    const error = [products, toppings, links, customers].map((result) => result.error).find(Boolean);
    if (error) throw error;
    return NextResponse.json({
      products: (products.data || []).map((product) => ({ ...product, price: Number(product.price), toppingIds: (links.data || []).filter((link) => link.product_id === product.id).map((link) => link.topping_id) })),
      toppings: (toppings.data || []).map((topping) => ({ ...topping, price: Number(topping.price) })),
      customers: customers.data || [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load counter order catalog:", error);
    return NextResponse.json({ error: "Unable to load counter order catalog." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const auth = await authorize(); if (auth.response || !auth.staff) return auth.response;
    if (requestBodyExceeds(request, 128 * 1024)) return NextResponse.json({ error: "Order is too large." }, { status: 413 });
    const body = await request.json() as Record<string, unknown>;
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    const customerProfileId = uuid.test(clean(body.customerProfileId)) ? clean(body.customerProfileId) : null;
    const payment = ["Cash", "Card terminal"].includes(clean(body.payment)) ? clean(body.payment) : "Cash";
    const db = createAdminClient();
    const productIds = [...new Set(rawItems.map((item) => typeof item === "object" && item ? clean((item as Record<string, unknown>).productId) : "").filter((id) => uuid.test(id)))];
    if (!productIds.length) return NextResponse.json({ error: "Add at least one product." }, { status: 400 });
    const [productResult, toppingResult, customerResult] = await Promise.all([
      db.from("products").select("id,name,price,emoji,active,sold_out").in("id", productIds),
      db.from("toppings").select("id,name,price,active"),
      customerProfileId ? db.from("customer_profiles").select("id,first_name,last_name,email,phone").eq("id", customerProfileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (productResult.error) throw productResult.error; if (toppingResult.error) throw toppingResult.error; if (customerResult.error) throw customerResult.error;
    const products = new Map((productResult.data || []).map((item) => [item.id, item]));
    const toppings = new Map((toppingResult.data || []).filter((item) => item.active).map((item) => [item.id, item]));
    const items: CartItem[] = rawItems.map((raw, index) => {
      const item = raw as Record<string, unknown>; const product = products.get(clean(item.productId));
      const quantity = Number(item.quantity); const toppingIds = Array.isArray(item.toppingIds) ? item.toppingIds.map((id) => clean(id)).filter((id) => toppings.has(id)) : [];
      if (!product || !product.active || product.sold_out || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("COUNTER_ITEM_INVALID");
      return { lineId: `counter-${index}-${product.id}`, itemType: "product", productId: product.id, name: product.name, emoji: product.emoji, basePrice: Number(product.price), unitPrice: Number(product.price) + toppingIds.reduce((sum, id) => sum + Number(toppings.get(id)?.price || 0), 0), quantity, toppings: toppingIds.map((id) => ({ id, name: toppings.get(id)!.name, price: Number(toppings.get(id)!.price) })) };
    });
    const priced = await validateAndPriceOrderItems(db, items);
    const subtotal = currency(priced.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const tax = currency(subtotal * 0.08); const total = currency(subtotal + tax);
    const customer = customerResult.data;
    const firstName = customer?.first_name || clean(body.firstName, 100) || "Counter";
    const lastName = customer?.last_name || clean(body.lastName, 100) || "Guest";
    const phone = customer?.phone || clean(body.phone, 30);
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) return NextResponse.json({ error: "Enter a valid customer phone number." }, { status: 400 });
    const { data, error } = await db.rpc("create_checkout_order_v3", {
      p_first_name: firstName, p_last_name: lastName, p_phone: phone, p_phone_normalized: normalizedPhone,
      p_email: customer?.email || null, p_fulfillment_type: "Pickup", p_pickup_time: "ASAP", p_address: null, p_city: null, p_zip: null, p_apartment: null,
      p_payment_method: payment === "Card terminal" ? "Card at Pickup" : "Pay at Store", p_subtotal: subtotal, p_tax: tax, p_delivery_fee: 0, p_total: total,
      p_note: clean(body.note, 1000), p_items: JSON.parse(JSON.stringify(priced)) as Json, p_gift_card_hash: null,
      p_customer_profile_id: customerProfileId, p_payment_channel: "offline", p_loyalty_reward_id: null,
    });
    if (error) throw error;
    const created = data?.[0]; if (!created?.order_number) throw new Error("Order number was not returned.");
    const paid = await db.from("orders").update({ payment_status: "paid", amount_due: 0 }).eq("order_number", created.order_number);
    if (paid.error) throw paid.error;
    return NextResponse.json({ orderNumber: created.order_number, total, subtotal, tax }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("COUNTER_ITEM_INVALID")) return NextResponse.json({ error: "A selected product is unavailable." }, { status: 409 });
    console.error("Unable to create counter order:", error);
    return NextResponse.json({ error: "Unable to create counter order." }, { status: 500 });
  }
}
