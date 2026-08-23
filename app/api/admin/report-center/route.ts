import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const pageSize = 1000;

type ReportOrder = {
  id: string;
  order_number: string;
  customer_profile_id: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  phone_normalized: string;
  email: string | null;
  fulfillment_type: "Pickup" | "Delivery";
  status: "Pending Payment" | "New" | "Preparing" | "Ready" | "Completed" | "Cancelled";
  subtotal: number;
  total: number;
  loyalty_discount: number;
  created_at: string;
};

type ReportItem = {
  id: string;
  order_id: string;
  item_type: "product" | "combo";
  product_id: string | null;
  combo_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
};

type ComboChild = {
  order_item_id: string;
  product_id: string | null;
  name: string;
};

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

async function readOrders(from: string, to: string) {
  const db = createAdminClient();
  const rows: ReportOrder[] = [];
  const queryFrom = `${addDays(from, -1)}T00:00:00.000Z`;
  const queryTo = `${addDays(to, 2)}T00:00:00.000Z`;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("orders")
      .select("id,order_number,customer_profile_id,first_name,last_name,phone,phone_normalized,email,fulfillment_type,status,subtotal,total,loyalty_discount,created_at")
      .gte("created_at", queryFrom)
      .lt("created_at", queryTo)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as ReportOrder[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.filter((order) => {
    const date = storeDateKey(order.created_at);
    return date >= from && date <= to;
  });
}

async function readItems(orderIds: string[]) {
  if (!orderIds.length) return [] as ReportItem[];
  const db = createAdminClient();
  const rows: ReportItem[] = [];
  for (let chunkStart = 0; chunkStart < orderIds.length; chunkStart += 100) {
    const chunk = orderIds.slice(chunkStart, chunkStart + 100);
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db
        .from("order_items")
        .select("id,order_id,item_type,product_id,combo_id,name,quantity,unit_price")
        .in("order_id", chunk)
        .order("created_at")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as ReportItem[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
  }
  return rows;
}

async function readComboChildren(parentItemIds: string[]) {
  if (!parentItemIds.length) return [] as ComboChild[];
  const db = createAdminClient();
  const rows: ComboChild[] = [];
  for (let chunkStart = 0; chunkStart < parentItemIds.length; chunkStart += 100) {
    const { data, error } = await db
      .from("order_combo_items")
      .select("order_item_id,product_id,name")
      .in("order_item_id", parentItemIds.slice(chunkStart, chunkStart + 100));
    if (error) throw error;
    rows.push(...((data || []) as ComboChild[]));
  }
  return rows;
}

export async function GET(request: Request) {
  try {
    const { staff, allowed } = await getStaffAccess("view_sales_reports");
    if (!staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!allowed) return NextResponse.json({ error: "Only Owner or Manager can view business reports." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"));
    if (!from || !to || from > to || dateDifference(from, to) > 365) {
      return NextResponse.json({ error: "Choose a valid report range of 366 days or less." }, { status: 400 });
    }

    const db = createAdminClient();
    const orders = await readOrders(from, to);
    const completedOrders = orders.filter((order) => order.status === "Completed");
    const completedIds = completedOrders.map((order) => order.id);
    const items = await readItems(completedIds);
    const comboParents = items.filter((item) => item.item_type === "combo");
    const comboChildren = await readComboChildren(comboParents.map((item) => item.id));
    const [{ data: catalogProducts, error: productError }, { data: promotions, error: promotionError }] = await Promise.all([
      db.from("products").select("id,name").order("name"),
      db.from("promotions").select("id,name,eyebrow,sort_order,active,starts_on,ends_on").order("sort_order"),
    ]);
    if (productError) throw productError;
    if (promotionError) throw promotionError;

    const sales = round(completedOrders.reduce((total, order) => total + Number(order.subtotal || 0) - Number(order.loyalty_discount || 0), 0));
    const rangeDays = dateDifference(from, to) + 1;
    const daily = Array.from({ length: rangeDays }, (_, index) => {
      const date = addDays(from, index);
      const dayOrders = completedOrders.filter((order) => storeDateKey(order.created_at) === date);
      return {
        date,
        orders: dayOrders.length,
        sales: round(dayOrders.reduce((total, order) => total + Number(order.subtotal || 0) - Number(order.loyalty_discount || 0), 0)),
      };
    });

    const customerMap = new Map<string, { id: string; name: string; phone: string; email: string; orders: number; spent: number; lastOrder: string }>();
    completedOrders.forEach((order) => {
      const key = order.customer_profile_id || order.phone_normalized || order.phone;
      const existing = customerMap.get(key) || {
        id: key,
        name: `${order.first_name} ${order.last_name}`.trim(),
        phone: order.phone,
        email: order.email || "",
        orders: 0,
        spent: 0,
        lastOrder: order.created_at,
      };
      existing.orders += 1;
      existing.spent += Number(order.subtotal || 0) - Number(order.loyalty_discount || 0);
      if (order.created_at > existing.lastOrder) existing.lastOrder = order.created_at;
      customerMap.set(key, existing);
    });

    const productNames = new Map((catalogProducts || []).map((product) => [product.id, product.name]));
    const productMap = new Map<string, { id: string; name: string; quantity: number; comboQuantity: number; sales: number; orders: Set<string> }>();
    items.filter((item) => item.item_type === "product").forEach((item) => {
      const id = item.product_id || item.name;
      const current = productMap.get(id) || { id, name: item.name, quantity: 0, comboQuantity: 0, sales: 0, orders: new Set<string>() };
      current.quantity += Number(item.quantity || 0);
      current.sales += Number(item.unit_price || 0) * Number(item.quantity || 0);
      current.orders.add(item.order_id);
      productMap.set(id, current);
    });
    const parentById = new Map(comboParents.map((item) => [item.id, item]));
    comboChildren.forEach((child) => {
      const parent = parentById.get(child.order_item_id);
      if (!parent) return;
      const id = child.product_id || child.name;
      const current = productMap.get(id) || { id, name: productNames.get(id) || child.name, quantity: 0, comboQuantity: 0, sales: 0, orders: new Set<string>() };
      const quantity = Number(parent.quantity || 0);
      current.quantity += quantity;
      current.comboQuantity += quantity;
      current.orders.add(parent.order_id);
      productMap.set(id, current);
    });

    const comboMap = new Map<string, { id: string; name: string; quantity: number; sales: number; orders: Set<string> }>();
    comboParents.forEach((item) => {
      const id = item.combo_id || item.name;
      const current = comboMap.get(id) || { id, name: item.name, quantity: 0, sales: 0, orders: new Set<string>() };
      current.quantity += Number(item.quantity || 0);
      current.sales += Number(item.unit_price || 0) * Number(item.quantity || 0);
      current.orders.add(item.order_id);
      comboMap.set(id, current);
    });

    return NextResponse.json({
      from,
      to,
      summary: {
        sales,
        orders: completedOrders.length,
        customers: customerMap.size,
        itemsSold: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
      },
      sales: daily,
      orders: orders.map((order) => ({
        orderNumber: order.order_number,
        date: order.created_at,
        customer: `${order.first_name} ${order.last_name}`.trim(),
        type: order.fulfillment_type,
        status: order.status,
        total: round(Number(order.subtotal || 0) - Number(order.loyalty_discount || 0)),
      })),
      customers: [...customerMap.values()].map((customer) => ({ ...customer, spent: round(customer.spent) })).sort((left, right) => right.spent - left.spent),
      products: [...productMap.values()].map((product) => ({ ...product, sales: round(product.sales), orderCount: product.orders.size, orders: undefined })).sort((left, right) => right.quantity - left.quantity),
      promotions: (promotions || []).map((promotion) => ({ id: promotion.id, title: promotion.name, eyebrow: promotion.eyebrow || "", position: promotion.sort_order, active: promotion.active, startDate: promotion.starts_on, endDate: promotion.ends_on })),
      combos: [...comboMap.values()].map((combo) => ({ ...combo, sales: round(combo.sales), orderCount: combo.orders.size, orders: undefined })).sort((left, right) => right.quantity - left.quantity),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load report center:", error);
    return NextResponse.json({ error: "Unable to load reports." }, { status: 500 });
  }
}
