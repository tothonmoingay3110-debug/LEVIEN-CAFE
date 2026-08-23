import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessIntelligenceData } from "@/types/business-intelligence";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const pageSize = 1000;

type IntelligenceOrder = {
  id: string;
  order_number: string;
  customer_profile_id: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  phone_normalized: string;
  email: string | null;
  status: "Pending Payment" | "New" | "Preparing" | "Ready" | "Completed" | "Cancelled";
  subtotal: number;
  loyalty_discount: number;
  promotion_id: string | null;
  created_at: string;
};

type IntelligenceItem = {
  id: string;
  order_id: string;
  item_type: "product" | "combo";
  product_id: string | null;
  combo_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
};

type IntelligenceComboChild = { id: string; order_item_id: string; product_id: string | null; name: string };
type IntelligenceTopping = { order_item_id: string; topping_name: string; topping_price: number };
type IntelligenceComboTopping = { order_combo_item_id: string; topping_name: string; topping_price: number };
type CatalogProduct = { id: string; name: string; category_id: string | null; price: number; active: boolean };
type CatalogCategory = { id: string; name: string };
type CatalogCombo = { id: string; name: string; price: number; active: boolean };
type CatalogComboProduct = { combo_id: string; product_id: string };
type CatalogPromotion = { id: string; name: string; active: boolean };
type PromotionEvent = { promotion_id: string; event_type: "impression" | "click" };

function validDate(value: string | null) {
  if (!value || !datePattern.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

function addDays(value: string, days: number) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function dateDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function storeDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function orderRevenue(order: IntelligenceOrder) {
  return Math.max(0, Number(order.subtotal || 0) - Number(order.loyalty_discount || 0));
}

function customerKey(order: IntelligenceOrder) {
  return order.customer_profile_id || order.phone_normalized || order.phone;
}

async function readOrdersThrough(to: string) {
  const db = createAdminClient();
  const rows: IntelligenceOrder[] = [];
  const queryTo = `${addDays(to, 2)}T00:00:00.000Z`;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("orders")
      .select("id,order_number,customer_profile_id,first_name,last_name,phone,phone_normalized,email,status,subtotal,loyalty_discount,promotion_id,created_at")
      .eq("status", "Completed")
      .lt("created_at", queryTo)
      .order("created_at")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as IntelligenceOrder[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.filter((order) => storeDateKey(order.created_at) <= to);
}

async function readItems(orderIds: string[]) {
  const db = createAdminClient();
  const rows: IntelligenceItem[] = [];
  for (let start = 0; start < orderIds.length; start += 100) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db
        .from("order_items")
        .select("id,order_id,item_type,product_id,combo_id,name,quantity,unit_price")
        .in("order_id", orderIds.slice(start, start + 100))
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as IntelligenceItem[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return rows;
}

async function readComboChildren(parentIds: string[]) {
  const db = createAdminClient();
  const rows: IntelligenceComboChild[] = [];
  for (let start = 0; start < parentIds.length; start += 100) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db
        .from("order_combo_items")
        .select("id,order_item_id,product_id,name")
        .in("order_item_id", parentIds.slice(start, start + 100))
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as IntelligenceComboChild[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return rows;
}

async function readItemToppings(parentIds: string[]) {
  const db = createAdminClient();
  const rows: IntelligenceTopping[] = [];
  for (let start = 0; start < parentIds.length; start += 100) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db
        .from("order_item_toppings")
        .select("order_item_id,topping_name,topping_price")
        .in("order_item_id", parentIds.slice(start, start + 100))
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as IntelligenceTopping[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return rows;
}

async function readComboToppings(childIds: string[]) {
  const db = createAdminClient();
  const rows: IntelligenceComboTopping[] = [];
  for (let start = 0; start < childIds.length; start += 100) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db
        .from("order_combo_item_toppings")
        .select("order_combo_item_id,topping_name,topping_price")
        .in("order_combo_item_id", childIds.slice(start, start + 100))
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as IntelligenceComboTopping[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return rows;
}

async function readPromotionEvents(from: string, to: string) {
  const db = createAdminClient();
  const rows: PromotionEvent[] = [];
  const queryFrom = `${addDays(from, -1)}T00:00:00.000Z`;
  const queryTo = `${addDays(to, 2)}T00:00:00.000Z`;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("promotion_events")
      .select("promotion_id,event_type,created_at")
      .gte("created_at", queryFrom)
      .lt("created_at", queryTo)
      .order("created_at")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as (PromotionEvent & { created_at: string })[];
    rows.push(...page.filter((event) => {
      const date = storeDateKey(event.created_at);
      return date >= from && date <= to;
    }));
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function GET(request: Request) {
  try {
    const { staff, allowed } = await getStaffAccess("view_sales_reports");
    if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!allowed) return NextResponse.json({ error: "Only Owner or Manager can view business intelligence." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"));
    if (!from || !to || from > to || dateDifference(from, to) > 365) {
      return NextResponse.json({ error: "Choose a valid analysis range of 366 days or less." }, { status: 400 });
    }

    const db = createAdminClient();
    const [historyOrders, productResult, categoryResult, comboResult, comboProductResult, promotionResult, promotionEvents] = await Promise.all([
      readOrdersThrough(to),
      db.from("products").select("id,name,category_id,price,active").order("name"),
      db.from("categories").select("id,name").order("name"),
      db.from("combos").select("id,name,price,active").order("name"),
      db.from("combo_products").select("combo_id,product_id,position").order("position"),
      db.from("promotions").select("id,name,active").order("sort_order"),
      readPromotionEvents(from, to),
    ]);
    if (productResult.error) throw productResult.error;
    if (categoryResult.error) throw categoryResult.error;
    if (comboResult.error) throw comboResult.error;
    if (comboProductResult.error) throw comboProductResult.error;
    if (promotionResult.error) throw promotionResult.error;

    const products = (productResult.data || []) as CatalogProduct[];
    const categories = (categoryResult.data || []) as CatalogCategory[];
    const catalogCombos = (comboResult.data || []) as CatalogCombo[];
    const comboProducts = (comboProductResult.data || []) as CatalogComboProduct[];
    const catalogPromotions = (promotionResult.data || []) as CatalogPromotion[];
    const completedOrders = historyOrders.filter((order) => {
      const date = storeDateKey(order.created_at);
      return date >= from && date <= to;
    });
    const orderIds = completedOrders.map((order) => order.id);
    const items = await readItems(orderIds);
    const comboParents = items.filter((item) => item.item_type === "combo");
    const comboChildren = await readComboChildren(comboParents.map((item) => item.id));
    const [itemToppings, comboToppings] = await Promise.all([
      readItemToppings(items.map((item) => item.id)),
      readComboToppings(comboChildren.map((item) => item.id)),
    ]);

    const rangeDays = dateDifference(from, to) + 1;
    const revenue = round(completedOrders.reduce((sum, order) => sum + orderRevenue(order), 0));
    const trend = Array.from({ length: rangeDays }, (_, index) => {
      const date = addDays(from, index);
      const dayOrders = completedOrders.filter((order) => storeDateKey(order.created_at) === date);
      return { date, orders: dayOrders.length, revenue: round(dayOrders.reduce((sum, order) => sum + orderRevenue(order), 0)) };
    });

    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const productNames = new Map(products.map((product) => [product.id, product.name]));
    const productStats = new Map(products.map((product) => [product.id, {
      id: product.id,
      name: product.name,
      category: product.category_id ? categoryNames.get(product.category_id) || "Uncategorized" : "Uncategorized",
      quantity: 0,
      standaloneQuantity: 0,
      comboQuantity: 0,
      standaloneRevenue: 0,
      orderIds: new Set<string>(),
      active: product.active,
    }]));

    items.filter((item) => item.item_type === "product").forEach((item) => {
      const id = item.product_id || item.name;
      const current = productStats.get(id) || {
        id, name: item.name, category: "Archived", quantity: 0, standaloneQuantity: 0,
        comboQuantity: 0, standaloneRevenue: 0, orderIds: new Set<string>(), active: false,
      };
      const quantity = Number(item.quantity || 0);
      current.quantity += quantity;
      current.standaloneQuantity += quantity;
      current.standaloneRevenue += Number(item.unit_price || 0) * quantity;
      current.orderIds.add(item.order_id);
      productStats.set(id, current);
    });

    const comboParentById = new Map(comboParents.map((item) => [item.id, item]));
    comboChildren.forEach((child) => {
      const parent = comboParentById.get(child.order_item_id);
      if (!parent) return;
      const id = child.product_id || child.name;
      const current = productStats.get(id) || {
        id, name: productNames.get(id) || child.name, category: "Archived", quantity: 0,
        standaloneQuantity: 0, comboQuantity: 0, standaloneRevenue: 0,
        orderIds: new Set<string>(), active: false,
      };
      const quantity = Number(parent.quantity || 0);
      current.quantity += quantity;
      current.comboQuantity += quantity;
      current.orderIds.add(parent.order_id);
      productStats.set(id, current);
    });

    const rankedProducts = [...productStats.values()].filter((product) => product.active).sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name));
    const bestIds = new Set(rankedProducts.filter((product) => product.quantity > 0).slice(0, 3).map((product) => product.id));
    const slowIds = new Set([...rankedProducts].sort((left, right) => left.quantity - right.quantity || left.name.localeCompare(right.name)).slice(0, 3).map((product) => product.id));
    const productRows: BusinessIntelligenceData["products"] = [...productStats.values()].map((product) => {
      const status: BusinessIntelligenceData["products"][number]["status"] = bestIds.has(product.id)
        ? "Best seller"
        : slowIds.has(product.id) ? "Slow mover" : "Steady";
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        quantity: product.quantity,
        standaloneQuantity: product.standaloneQuantity,
        comboQuantity: product.comboQuantity,
        standaloneRevenue: round(product.standaloneRevenue),
        orderCount: product.orderIds.size,
        status,
        active: product.active,
      };
    }).sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name));

    const itemById = new Map(items.map((item) => [item.id, item]));
    const toppingStats = new Map<string, { quantity: number; revenue: number; orders: Set<string> }>();
    itemToppings.forEach((topping) => {
      const parent = itemById.get(topping.order_item_id);
      if (!parent) return;
      const current = toppingStats.get(topping.topping_name) || { quantity: 0, revenue: 0, orders: new Set<string>() };
      const quantity = Number(parent.quantity || 0);
      current.quantity += quantity;
      current.revenue += Number(topping.topping_price || 0) * quantity;
      current.orders.add(parent.order_id);
      toppingStats.set(topping.topping_name, current);
    });
    const comboChildById = new Map(comboChildren.map((child) => [child.id, child]));
    comboToppings.forEach((topping) => {
      const child = comboChildById.get(topping.order_combo_item_id);
      const parent = child ? comboParentById.get(child.order_item_id) : undefined;
      if (!parent) return;
      const current = toppingStats.get(topping.topping_name) || { quantity: 0, revenue: 0, orders: new Set<string>() };
      const quantity = Number(parent.quantity || 0);
      current.quantity += quantity;
      current.revenue += Number(topping.topping_price || 0) * quantity;
      current.orders.add(parent.order_id);
      toppingStats.set(topping.topping_name, current);
    });
    const toppingRows = [...toppingStats.entries()].map(([name, value]) => ({
      name, quantity: value.quantity, revenue: round(value.revenue), orderCount: value.orders.size,
    })).sort((left, right) => right.quantity - left.quantity);

    const productPrices = new Map(products.map((product) => [product.id, Number(product.price || 0)]));
    const comboStats = new Map(catalogCombos.map((combo) => [combo.id, {
      id: combo.id, name: combo.name, quantity: 0, revenue: 0, orderIds: new Set<string>(), comboPrice: Number(combo.price || 0), active: combo.active,
    }]));
    comboParents.forEach((item) => {
      const id = item.combo_id || item.name;
      const current = comboStats.get(id) || { id, name: item.name, quantity: 0, revenue: 0, orderIds: new Set<string>(), comboPrice: Number(item.unit_price || 0), active: false };
      const quantity = Number(item.quantity || 0);
      current.quantity += quantity;
      current.revenue += Number(item.unit_price || 0) * quantity;
      current.orderIds.add(item.order_id);
      comboStats.set(id, current);
    });
    const comboRows: BusinessIntelligenceData["combos"] = [...comboStats.values()].map((combo) => {
      const regularPrice = comboProducts.filter((link) => link.combo_id === combo.id).reduce((sum, link) => sum + (productPrices.get(link.product_id) || 0), 0);
      const savingsPerCombo = Math.max(0, regularPrice - combo.comboPrice);
      return {
        id: combo.id, name: combo.name, quantity: combo.quantity, revenue: round(combo.revenue),
        orderCount: combo.orderIds.size, regularPrice: round(regularPrice), comboPrice: round(combo.comboPrice),
        savingsPerCombo: round(savingsPerCombo), customerSavings: round(savingsPerCombo * combo.quantity), active: combo.active,
      };
    }).sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name));

    const itemsByOrder = new Map<string, IntelligenceItem[]>();
    items.forEach((item) => itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) || []), item]));
    const comboChildrenByParent = new Map<string, IntelligenceComboChild[]>();
    comboChildren.forEach((child) => comboChildrenByParent.set(child.order_item_id, [...(comboChildrenByParent.get(child.order_item_id) || []), child]));
    const historyByCustomer = new Map<string, IntelligenceOrder[]>();
    historyOrders.forEach((order) => historyByCustomer.set(customerKey(order), [...(historyByCustomer.get(customerKey(order)) || []), order]));
    const currentByCustomer = new Map<string, IntelligenceOrder[]>();
    completedOrders.forEach((order) => currentByCustomer.set(customerKey(order), [...(currentByCustomer.get(customerKey(order)) || []), order]));

    const customerRows: BusinessIntelligenceData["customers"] = [...currentByCustomer.entries()].map(([id, customerOrders]) => {
      const history = historyByCustomer.get(id) || customerOrders;
      const latest = customerOrders[customerOrders.length - 1];
      const firstOrder = history[0]?.created_at || latest.created_at;
      const lifetimeSpent = history.reduce((sum, order) => sum + orderRevenue(order), 0);
      const productCounts = new Map<string, number>();
      customerOrders.forEach((order) => (itemsByOrder.get(order.id) || []).forEach((item) => {
        const quantity = Number(item.quantity || 0);
        const children = item.item_type === "combo" ? comboChildrenByParent.get(item.id) || [] : [];
        if (children.length) {
          children.forEach((child) => productCounts.set(child.name, (productCounts.get(child.name) || 0) + quantity));
        } else {
          productCounts.set(item.name, (productCounts.get(item.name) || 0) + quantity);
        }
      }));
      const favorite = [...productCounts.entries()].sort((left, right) => right[1] - left[1])[0];
      const orderTimes = history.map((order) => Date.parse(order.created_at)).filter(Number.isFinite).sort((left, right) => left - right);
      const frequencyDays = orderTimes.length < 2 ? null : round((orderTimes[orderTimes.length - 1] - orderTimes[0]) / 86_400_000 / (orderTimes.length - 1));
      const isNew = storeDateKey(firstOrder) >= from;
      const segment: BusinessIntelligenceData["customers"][number]["segment"] = isNew
        ? "New"
        : history.length >= 15 || lifetimeSpent >= 300 ? "VIP" : history.length >= 5 ? "Loyal" : "Returning";
      const spent = customerOrders.reduce((sum, order) => sum + orderRevenue(order), 0);
      return {
        id,
        name: `${latest.first_name} ${latest.last_name}`.trim(),
        email: latest.email || "",
        phone: latest.phone,
        orders: customerOrders.length,
        spent: round(spent),
        averageOrder: round(spent / customerOrders.length),
        firstOrder,
        lastOrder: latest.created_at,
        favoriteProduct: favorite?.[0] || "—",
        favoriteQuantity: favorite?.[1] || 0,
        frequencyDays,
        segment,
      };
    }).sort((left, right) => right.spent - left.spent).slice(0, 500);

    const segmentOrder: BusinessIntelligenceData["segments"][number]["name"][] = ["New", "Returning", "Loyal", "VIP"];
    const segments = segmentOrder.map((name) => ({
      name,
      customers: customerRows.filter((customer) => customer.segment === name).length,
      revenue: round(customerRows.filter((customer) => customer.segment === name).reduce((sum, customer) => sum + customer.spent, 0)),
    }));

    const promotionRows: BusinessIntelligenceData["promotions"] = catalogPromotions.map((promotion) => {
      const impressions = promotionEvents.filter((event) => event.promotion_id === promotion.id && event.event_type === "impression").length;
      const clicks = promotionEvents.filter((event) => event.promotion_id === promotion.id && event.event_type === "click").length;
      const attributed = completedOrders.filter((order) => order.promotion_id === promotion.id);
      return {
        id: promotion.id,
        title: promotion.name,
        impressions,
        clicks,
        clickThroughRate: impressions ? round(clicks / impressions * 100) : 0,
        attributedOrders: attributed.length,
        attributedRevenue: round(attributed.reduce((sum, order) => sum + orderRevenue(order), 0)),
        active: promotion.active,
      };
    });

    const averageDailyRevenue = round(revenue / rangeDays);
    const averageDailyOrders = completedOrders.length / rangeDays;
    const forecast = {
      next7DaysRevenue: round(averageDailyRevenue * 7),
      expectedOrders: Math.round(averageDailyOrders * 7),
      averageDailyRevenue,
    };
    const bestProduct = productRows.find((product) => product.active && product.quantity > 0) || null;
    const lowProduct = [...productRows].filter((product) => product.active).sort((left, right) => left.quantity - right.quantity)[0] || null;
    const half = Math.max(1, Math.floor(trend.length / 2));
    const firstHalfRevenue = trend.slice(0, half).reduce((sum, day) => sum + day.revenue, 0);
    const secondHalfRevenue = trend.slice(half).reduce((sum, day) => sum + day.revenue, 0);
    const trendChange = firstHalfRevenue ? round((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue * 100) : secondHalfRevenue > 0 ? 100 : 0;
    const dominantSegment = [...segments].sort((left, right) => right.customers - left.customers)[0];
    const weakPromotion = [...promotionRows].filter((promotion) => promotion.active && promotion.impressions >= 10).sort((left, right) => left.clickThroughRate - right.clickThroughRate)[0];

    const insights: BusinessIntelligenceData["insights"] = [
      {
        id: "sales-trend",
        tone: trendChange >= 0 ? "positive" : "watch",
        title: trendChange >= 0 ? "Sales momentum is improving" : "Sales momentum needs attention",
        message: `Revenue in the second half of this range is ${Math.abs(trendChange).toFixed(1)}% ${trendChange >= 0 ? "higher" : "lower"} than the first half.`,
        evidence: `${round(firstHalfRevenue).toFixed(2)} first half vs ${round(secondHalfRevenue).toFixed(2)} second half.`,
        action: trendChange >= 0 ? "Keep the current product and promotion cadence." : "Compare slow days and test one focused offer.",
      },
      {
        id: "slow-product",
        tone: "watch",
        title: lowProduct ? `${lowProduct.name} is a slow mover` : "More sales data is needed",
        message: lowProduct ? `It sold ${lowProduct.quantity} unit${lowProduct.quantity === 1 ? "" : "s"} in the selected range.` : "No active product could be ranked yet.",
        evidence: lowProduct ? `${lowProduct.orderCount} completed orders included this product.` : "Complete orders to unlock product ranking.",
        action: lowProduct ? "Review its menu position, image, description, or pair it in a small test combo." : "Revisit this page after completed orders are available.",
      },
      {
        id: "combo-opportunity",
        tone: "opportunity",
        title: bestProduct && lowProduct && bestProduct.id !== lowProduct.id ? `Test ${bestProduct.name} + ${lowProduct.name}` : "Watch for a combo opportunity",
        message: bestProduct && lowProduct && bestProduct.id !== lowProduct.id ? "A popular anchor can introduce a slower product without discounting the whole menu." : "The system needs two distinct product signals before proposing a pair.",
        evidence: bestProduct && lowProduct ? `${bestProduct.name}: ${bestProduct.quantity} units; ${lowProduct.name}: ${lowProduct.quantity} units.` : "Not enough product variation in this range.",
        action: "Create it as an inactive draft first, then review pricing before publishing.",
      },
      {
        id: "promotion-performance",
        tone: weakPromotion ? "watch" : "info",
        title: weakPromotion ? `${weakPromotion.title} has low engagement` : "Promotion tracking is ready",
        message: weakPromotion ? `Its click-through rate is ${weakPromotion.clickThroughRate.toFixed(1)}%.` : "Impressions, clicks and attributed completed orders are now measured together.",
        evidence: weakPromotion ? `${weakPromotion.impressions} impressions and ${weakPromotion.clicks} clicks.` : `${promotionRows.reduce((sum, promotion) => sum + promotion.attributedOrders, 0)} attributed completed orders in this range.`,
        action: weakPromotion ? "Test a clearer headline, stronger image, or more direct offer." : "Use at least 10 impressions before judging a promotion.",
      },
      {
        id: "customer-segment",
        tone: "info",
        title: dominantSegment?.customers ? `${dominantSegment.name} is the largest customer segment` : "Customer segments are waiting for data",
        message: dominantSegment?.customers ? `${dominantSegment.customers} customers generated $${dominantSegment.revenue.toFixed(2)} in the selected range.` : "Completed customer orders will populate New, Returning, Loyal and VIP groups.",
        evidence: "Segments use completed order count and spend; no private data is sent to an external AI service.",
        action: dominantSegment?.name === "New" ? "Encourage a second visit with a simple follow-up reward." : "Build offers around this segment's favorite products.",
      },
    ];

    const response: BusinessIntelligenceData = {
      range: { from, to, days: rangeDays },
      kpis: {
        revenue,
        completedOrders: completedOrders.length,
        averageOrderValue: completedOrders.length ? round(revenue / completedOrders.length) : 0,
        itemsSold: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        bestSeller: bestProduct ? { name: bestProduct.name, quantity: bestProduct.quantity } : null,
        lowSeller: lowProduct ? { name: lowProduct.name, quantity: lowProduct.quantity } : null,
        newCustomers: customerRows.filter((customer) => customer.segment === "New").length,
        returningCustomers: customerRows.filter((customer) => customer.segment !== "New").length,
        activePromotions: catalogPromotions.filter((promotion) => promotion.active).length,
      },
      trend,
      customers: customerRows,
      segments,
      products: productRows,
      toppings: toppingRows,
      combos: comboRows,
      promotions: promotionRows,
      forecast,
      insights,
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load business intelligence:", error);
    return NextResponse.json({ error: "Unable to load business intelligence." }, { status: 500 });
  }
}
