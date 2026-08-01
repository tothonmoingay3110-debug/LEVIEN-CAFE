import type { CustomerOrder, OrderStatus } from "@/types";

export const ORDER_STORAGE_KEY = "levien-orders-v1";

export function readOrders(): CustomerOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerOrder[]) : [];
  } catch {
    return [];
  }
}

export function writeOrders(orders: CustomerOrder[]) {
  if (typeof window === "undefined") return;
  const next = JSON.stringify(orders);
  if (localStorage.getItem(ORDER_STORAGE_KEY) === next) return;
  localStorage.setItem(ORDER_STORAGE_KEY, next);
  window.dispatchEvent(new Event("levien-orders-updated"));
}

export function createOrderNumber(existing: CustomerOrder[]) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `LV${yy}${mm}${dd}`;
  const count = existing.filter((order) => order.id.startsWith(prefix)).length + 1;
  return `${prefix}${String(count).padStart(3, "0")}`;
}

export function saveOrder(order: CustomerOrder) {
  const current = readOrders();
  writeOrders([order, ...current]);
}

export function updateStoredOrderStatus(id: string, status: OrderStatus) {
  writeOrders(readOrders().map((order) => (order.id === id ? { ...order, status } : order)));
}
