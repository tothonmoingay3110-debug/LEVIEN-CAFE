import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CartItem, CustomerOrder } from "@/types";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
type TrackedOrder = Pick<CustomerOrder, "id" | "customer" | "type" | "status" | "total" | "giftCardAmount" | "amountDue" | "items">;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!uuidPattern.test(token)) {
    return NextResponse.json({ error: "Invalid tracking token." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,first_name,last_name,fulfillment_type,status,total,gift_card_amount")
      .eq("id", token)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const { data: orderItems, error: itemError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at");
    if (itemError) throw itemError;

    const itemIds = (orderItems || []).map((item) => item.id);
    const [{ data: itemToppings, error: toppingError }, { data: comboItems, error: comboError }] = itemIds.length
      ? await Promise.all([
          supabase.from("order_item_toppings").select("*").in("order_item_id", itemIds),
          supabase.from("order_combo_items").select("*").in("order_item_id", itemIds).order("position"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (toppingError) throw toppingError;
    if (comboError) throw comboError;

    const comboItemIds = (comboItems || []).map((item) => item.id);
    const { data: comboToppings, error: comboToppingError } = comboItemIds.length
      ? await supabase.from("order_combo_item_toppings").select("*").in("order_combo_item_id", comboItemIds)
      : { data: [], error: null };
    if (comboToppingError) throw comboToppingError;

    const items: CartItem[] = (orderItems || []).map((item) => ({
      lineId: item.line_id,
      itemType: item.item_type,
      productId: item.product_id || item.combo_id || "",
      comboId: item.combo_id || undefined,
      name: item.name,
      emoji: item.emoji,
      basePrice: Number(item.base_price),
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      ice: item.ice || undefined,
      sugar: item.sugar || undefined,
      note: item.note,
      toppings: (itemToppings || []).filter((topping) => topping.order_item_id === item.id).map((topping) => ({
        id: topping.topping_id || topping.id,
        name: topping.topping_name,
        price: Number(topping.topping_price),
      })),
      comboItems: item.item_type === "combo" ? (comboItems || [])
        .filter((child) => child.order_item_id === item.id)
        .map((child) => ({
          productId: child.product_id || child.id,
          name: child.name,
          emoji: child.emoji,
          ice: child.ice || undefined,
          sugar: child.sugar || undefined,
          note: child.note,
          toppings: (comboToppings || []).filter((topping) => topping.order_combo_item_id === child.id).map((topping) => ({
            id: topping.topping_id || topping.id,
            name: topping.topping_name,
            price: Number(topping.topping_price),
          })),
        })) : undefined,
    }));

    const trackedOrder: TrackedOrder = {
      id: order.order_number,
      customer: `${order.first_name} ${order.last_name}`.trim(),
      type: order.fulfillment_type,
      status: order.status,
      total: Number(order.total),
      giftCardAmount: Number(order.gift_card_amount || 0),
      amountDue: Math.max(0, Number(order.total) - Number(order.gift_card_amount || 0)),
      items,
    };
    return NextResponse.json({ order: trackedOrder });
  } catch (error) {
    console.error("Unable to track order:", error);
    return NextResponse.json({ error: "Unable to load order." }, { status: 500 });
  }
}
