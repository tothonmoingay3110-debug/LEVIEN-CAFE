import type { CartItem, CustomerOrder } from "@/types";
import type { createAdminClient } from "./admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function readSupabaseOrders(supabase: AdminClient, orderId?: string): Promise<CustomerOrder[]> {
  let orderQuery = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
  if (orderId) orderQuery = orderQuery.eq("id", orderId);
  const { data: orders, error: orderError } = await orderQuery;
  if (orderError) throw orderError;
  if (!orders?.length) return [];

  const orderIds = orders.map((order) => order.id);
  const { data: orderItems, error: itemError } = await supabase
    .from("order_items").select("*").in("order_id", orderIds).order("created_at");
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

  return orders.map((order) => {
    const items: CartItem[] = (orderItems || []).filter((item) => item.order_id === order.id).map((item) => ({
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
        id: topping.topping_id || topping.id, name: topping.topping_name, price: Number(topping.topping_price),
      })),
      comboItems: item.item_type === "combo" ? (comboItems || []).filter((child) => child.order_item_id === item.id).map((child) => ({
        productId: child.product_id || child.id,
        name: child.name,
        emoji: child.emoji,
        ice: child.ice || undefined,
        sugar: child.sugar || undefined,
        note: child.note,
        toppings: (comboToppings || []).filter((topping) => topping.order_combo_item_id === child.id).map((topping) => ({
          id: topping.topping_id || topping.id, name: topping.topping_name, price: Number(topping.topping_price),
        })),
      })) : undefined,
    }));

    return {
      id: order.order_number,
      trackingToken: order.id,
      customer: `${order.first_name} ${order.last_name}`.trim(),
      firstName: order.first_name,
      lastName: order.last_name,
      phone: order.phone,
      email: order.email || "",
      type: order.fulfillment_type,
      pickupTime: order.pickup_time || undefined,
      address: order.address || undefined,
      city: order.city || undefined,
      zip: order.zip || undefined,
      apartment: order.apartment || undefined,
      payment: order.payment_method,
      giftCardAmount: Number(order.gift_card_amount || 0),
      amountDue: Math.max(0, Number(order.total) - Number(order.gift_card_amount || 0)),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      deliveryFee: Number(order.delivery_fee),
      total: Number(order.total),
      status: order.status,
      createdAt: order.created_at,
      note: order.note,
      items,
    } satisfies CustomerOrder;
  });
}
