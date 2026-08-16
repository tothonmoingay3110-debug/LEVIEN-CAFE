"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  roleHasPermission,
  staffRoleLabels,
  type StaffPermission,
  type StaffRole,
  type StaffSessionSummary,
} from "@/lib/staff-permissions";
import type { CustomerOrder, OrderStatus } from "@/types";

type AdminView = "dashboard" | "orders" | "customers" | "products" | "categories" | "toppings" | "combos" | "promotions" | "content" | "account";
type AdminIconName = AdminView | "external" | "logout" | "arrow";
type Category = { id: string; name: string; icon: string; active: boolean };
type Topping = { id: string; name: string; price: number; active: boolean };
type Product = {
  id: string; name: string; categoryId: string; price: number; description: string; image: string; emoji: string;
  toppingIds: string[]; allowIce: boolean; allowSugar: boolean; allowToppings: boolean; bestSeller: boolean; mustTry: boolean;
  featured: boolean; isNew: boolean; soldOut: boolean; active: boolean;
};
type Combo = { id: string; name: string; description: string; price: number; productIds: string[]; image: string; active: boolean };
type Promotion = { id: string; title: string; eyebrow: string; description: string; priceText: string; image: string; order: number; active: boolean };
type Order = CustomerOrder;
type Customer = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  averageOrder: number;
  firstOrderAt: string;
  lastOrderAt: string;
  orderIds: string[];
};
type Content = { storeName: string; tagline: string; logo: string; announcement: string; aboutTitle: string; aboutText: string; aboutImage: string; address: string; phone: string; email: string; hours: string; mapUrl: string; footerText: string };
type DB = { categories: Category[]; toppings: Topping[]; products: Product[]; combos: Combo[]; promotions: Promotion[]; orders: Order[]; content: Content };

const seed: DB = {
  categories: [
    { id: "c1", name: "Vietnamese Coffee", icon: "☕", active: true },
    { id: "c2", name: "Milk Tea", icon: "🧋", active: true },
    { id: "c3", name: "Smoothies", icon: "🥤", active: true },
    { id: "c4", name: "Bánh Mì", icon: "🥖", active: true },
    { id: "c5", name: "Chicken & More", icon: "🍗", active: true },
  ],
  toppings: [
    { id: "t1", name: "Salted Cream", price: 1.25, active: true },
    { id: "t2", name: "Egg Cream", price: 1.25, active: true },
    { id: "t3", name: "Boba", price: 1.0, active: true },
    { id: "t4", name: "Extra Espresso Shot", price: 1.5, active: true },
  ],
  products: [
    { id: "p1", name: "Vietnamese Milk Coffee", categoryId: "c1", price: 4.99, description: "Bold coffee with condensed milk.", image: "", emoji: "☕", toppingIds: ["t1", "t4"], allowIce: true, allowSugar: true, allowToppings: true, bestSeller: true, mustTry: false, featured: true, isNew: false, soldOut: false, active: true },
    { id: "p2", name: "Brown Marble Milk Tea", categoryId: "c2", price: 5.49, description: "Brown sugar milk tea with boba.", image: "", emoji: "🧋", toppingIds: ["t3"], allowIce: true, allowSugar: true, allowToppings: true, bestSeller: true, mustTry: true, featured: false, isNew: false, soldOut: false, active: true },
    { id: "p3", name: "Ube Coffee", categoryId: "c1", price: 5.49, description: "Vietnamese coffee with sweet ube cream.", image: "", emoji: "🟣", toppingIds: ["t1", "t4"], allowIce: true, allowSugar: true, allowToppings: true, bestSeller: true, mustTry: true, featured: false, isNew: true, soldOut: false, active: true },
  ],
  combos: [
    { id: "cb1", name: "Coffee & Bánh Mì Combo", description: "Vietnamese coffee paired with a fresh bánh mì.", price: 10.99, productIds: ["p1"], image: "", active: true },
  ],
  promotions: [
    { id: "pr1", title: "Vietnamese Milk Coffee", eyebrow: "Morning special", description: "Available every day from 7 AM to 9 AM.", priceText: "Only $4.99", image: "", order: 1, active: true },
    { id: "pr2", title: "Coffee & Bánh Mì", eyebrow: "Combo deal", description: "A satisfying Vietnamese pairing.", priceText: "$10.99", image: "", order: 2, active: true },
  ],
  orders: [],
  content: {
    storeName: "LEVIEN CAFE", tagline: "CAFE & EATERY", logo: "", announcement: "Fresh Vietnamese coffee and bánh mì every day.",
    aboutTitle: "From Vietnam to Philadelphia.", aboutText: "Every cup carries a little piece of Vietnamese coffee culture, served with warmth in our Philadelphia neighborhood.", aboutImage: "",
    address: "600 Washington Ave Unit 18C, Philadelphia, PA", phone: "+1 215-305-4047", email: "hello@leviencafe.com",
    hours: "Open daily • 7 AM – 9 PM", footerText: "Made with care in Philadelphia", mapUrl: "https://www.google.com/maps/search/?api=1&query=600+Washington+Ave+Unit+18C+Philadelphia",
  },
};

const viewLabels: Record<AdminView, string> = {
  dashboard: "Dashboard", orders: "Orders", customers: "Customers", products: "Products", categories: "Categories",
  toppings: "Toppings", combos: "Combos", promotions: "Promotions", content: "Website Content", account: "My Account",
};
const adminViewOrder: AdminView[] = ["dashboard", "orders", "customers", "products", "categories", "toppings", "combos", "promotions", "content", "account"];
const viewPermissions: Partial<Record<AdminView, StaffPermission>> = {
  dashboard: "view_dashboard",
  orders: "manage_orders",
  customers: "view_customers",
  products: "manage_catalog",
  categories: "manage_catalog",
  toppings: "manage_catalog",
  combos: "manage_catalog",
  promotions: "manage_catalog",
  content: "manage_catalog",
};

function viewsForRole(role: StaffRole) {
  return adminViewOrder.filter((adminView) => {
    const permission = viewPermissions[adminView];
    return !permission || roleHasPermission(role, permission);
  });
}

function initials(name: string) {
  const value = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return value || "LV";
}
const catalogId = () => crypto.randomUUID();
type ImageKind = "product" | "combo" | "promotion" | "logo" | "about";
type ImageFrame = { width: number; height: number; padding: number; mode: "contain" | "cover"; trim: boolean };
type ImageCrop = { x: number; y: number; width: number; height: number; background: string | null };
const imageFrames: Record<ImageKind, ImageFrame> = {
  product: { width: 1200, height: 1200, padding: 84, mode: "contain", trim: true },
  combo: { width: 1600, height: 1000, padding: 72, mode: "contain", trim: true },
  promotion: { width: 1200, height: 1400, padding: 76, mode: "contain", trim: true },
  logo: { width: 800, height: 800, padding: 36, mode: "contain", trim: true },
  about: { width: 1600, height: 1100, padding: 0, mode: "cover", trim: false },
};

function fullImageCrop(bitmap: ImageBitmap): ImageCrop {
  return { x: 0, y: 0, width: bitmap.width, height: bitmap.height, background: null };
}

function detectImageCrop(bitmap: ImageBitmap): ImageCrop {
  const maximumAnalysisSize = 640;
  const scale = Math.min(1, maximumAnalysisSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return fullImageCrop(bitmap);
  context.drawImage(bitmap, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height).data;
  const cornerSize = Math.max(2, Math.round(Math.min(width, height) * 0.055));
  const corners = [
    [0, 0], [width - cornerSize, 0],
    [0, height - cornerSize], [width - cornerSize, height - cornerSize],
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let samples = 0;
  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + cornerSize; y += 2) {
      for (let x = startX; x < startX + cornerSize; x += 2) {
        const index = (y * width + x) * 4;
        red += pixels[index];
        green += pixels[index + 1];
        blue += pixels[index + 2];
        alpha += pixels[index + 3];
        samples++;
      }
    }
  }
  const background = {
    red: red / samples,
    green: green / samples,
    blue: blue / samples,
    alpha: alpha / samples,
  };
  const transparentBackground = background.alpha < 48;
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const pixelAlpha = pixels[index + 3];
      const redDifference = pixels[index] - background.red;
      const greenDifference = pixels[index + 1] - background.green;
      const blueDifference = pixels[index + 2] - background.blue;
      const colorDistance = Math.sqrt(
        redDifference * redDifference + greenDifference * greenDifference + blueDifference * blueDifference,
      );
      const isContent = transparentBackground
        ? pixelAlpha > 42
        : pixelAlpha > 24 && (colorDistance > 46 || Math.abs(pixelAlpha - background.alpha) > 48);
      if (!isContent) continue;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }

  if (maximumX < minimumX || maximumY < minimumY) return fullImageCrop(bitmap);
  const detectedWidth = maximumX - minimumX + 1;
  const detectedHeight = maximumY - minimumY + 1;
  const detectedCoverage = detectedWidth * detectedHeight / (width * height);
  if (detectedCoverage > 0.92) return fullImageCrop(bitmap);

  const breathingRoom = Math.round(Math.max(detectedWidth, detectedHeight) * 0.075);
  minimumX = Math.max(0, minimumX - breathingRoom);
  minimumY = Math.max(0, minimumY - breathingRoom);
  maximumX = Math.min(width - 1, maximumX + breathingRoom);
  maximumY = Math.min(height - 1, maximumY + breathingRoom);
  const sourceScaleX = bitmap.width / width;
  const sourceScaleY = bitmap.height / height;
  return {
    x: Math.round(minimumX * sourceScaleX),
    y: Math.round(minimumY * sourceScaleY),
    width: Math.max(1, Math.round((maximumX - minimumX + 1) * sourceScaleX)),
    height: Math.max(1, Math.round((maximumY - minimumY + 1) * sourceScaleY)),
    background: transparentBackground
      ? null
      : `rgb(${Math.round(background.red)} ${Math.round(background.green)} ${Math.round(background.blue)})`,
  };
}

async function optimizeImage(file: File, kind: ImageKind) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const frame = imageFrames[kind];
  const crop = frame.trim ? detectImageCrop(bitmap) : fullImageCrop(bitmap);
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser cannot optimize this image.");
  }
  if (crop.background) {
    context.fillStyle = crop.background;
    context.fillRect(0, 0, frame.width, frame.height);
  }
  const availableWidth = frame.width - frame.padding * 2;
  const availableHeight = frame.height - frame.padding * 2;
  const fitScale = frame.mode === "cover"
    ? Math.max(availableWidth / crop.width, availableHeight / crop.height)
    : Math.min(availableWidth / crop.width, availableHeight / crop.height);
  const renderedWidth = Math.max(1, Math.round(crop.width * fitScale));
  const renderedHeight = Math.max(1, Math.round(crop.height * fitScale));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    Math.round((frame.width - renderedWidth) / 2),
    Math.round((frame.height - renderedHeight) / 2),
    renderedWidth,
    renderedHeight,
  );
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (result) => result ? resolve(result) : reject(new Error("Unable to optimize image.")),
    "image/webp",
    0.88,
  ));
  return new File([blob], `${kind}-${Date.now()}.webp`, { type: "image/webp" });
}
async function uploadAdminImage(file: File, scope: ImageKind) {
  const optimizedFile = await optimizeImage(file, scope);
  const formData = new FormData();
  formData.set("file", optimizedFile);
  formData.set("scope", scope);
  const response = await fetch("/api/admin/uploads", { method: "POST", body: formData });
  const result = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !result.url) throw new Error(result.error || "Unable to upload image.");
  return result.url;
}
const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;
const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");
const formatCustomerPhone = (phone: string) => {
  const digits = normalizePhone(phone);
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone || "—";
};
const buildCustomers = (orders: Order[]): Customer[] => {
  const customers = new Map<string, Customer>();

  [...orders]
    .filter((order) => Boolean(normalizePhone(order.phone)))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((order) => {
      const phoneKey = normalizePhone(order.phone);
      const current = customers.get(phoneKey);
      const firstName = order.firstName || order.customer.split(" ")[0] || "Guest";
      const lastName = order.lastName || order.customer.split(" ").slice(1).join(" ");
      const totalOrders = (current?.totalOrders || 0) + 1;
      const totalSpent = (current?.totalSpent || 0) + (order.status === "Cancelled" ? 0 : Number(order.total || 0));

      customers.set(phoneKey, {
        id: phoneKey,
        phone: order.phone,
        firstName,
        lastName,
        email: order.email || current?.email || "",
        totalOrders,
        totalSpent,
        averageOrder: totalOrders ? totalSpent / totalOrders : 0,
        firstOrderAt: current?.firstOrderAt || order.createdAt,
        lastOrderAt: order.createdAt,
        orderIds: [...(current?.orderIds || []), order.id],
      });
    });

  return [...customers.values()].sort(
    (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime(),
  );
};
const comboRegularPrice = (combo: Combo, products: Product[]) =>
  combo.productIds.reduce(
    (total, productId) => total + Number(products.find((product) => product.id === productId)?.price || 0),
    0,
  );
const orderItemOptions = (item: CustomerOrder["items"][number]) => [item.ice && `Ice ${item.ice}`, item.sugar && `Sugar ${item.sugar}`, ...item.toppings.map((topping) => `+ ${topping.name}`), item.note && `Note: ${item.note}`].filter(Boolean).join(" · ");
const comboChildOptions = (item: NonNullable<CustomerOrder["items"][number]["comboItems"]>[number]) => [item.ice && `Ice ${item.ice}`, item.sugar && `Sugar ${item.sugar}`, ...item.toppings.map((topping) => `+ ${topping.name}`), item.note && `Note: ${item.note}`].filter(Boolean).join(" · ");

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};
const itemPurchaseSummary = (item: CustomerOrder["items"][number]) => {
  if (item.itemType === "combo" && item.comboItems?.length) {
    return `${item.name}: ${item.comboItems.map((child) => child.name).join(" + ")}`;
  }
  return item.name;
};
const customerPurchasedProducts = (customer: Customer, orders: Order[]) => {
  const counts = new Map<string, number>();
  orders
    .filter((order) => normalizePhone(order.phone) === customer.id)
    .forEach((order) => {
      order.items.forEach((item) => {
        if (item.itemType === "combo" && item.comboItems?.length) {
          item.comboItems.forEach((child) => {
            counts.set(child.name, (counts.get(child.name) || 0) + item.quantity);
          });
        } else {
          counts.set(item.name, (counts.get(item.name) || 0) + item.quantity);
        }
      });
    });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};
function exportCustomerPurchaseCsv(customers: Customer[], orders: Order[]) {
  const headers = [
    "Customer Name", "Phone", "Email", "Order ID", "Order Date", "Order Status",
    "Fulfillment", "Item Type", "Product / Combo", "Included Product",
    "Quantity", "Unit Price", "Ice", "Sugar", "Toppings", "Item Note", "Order Total",
  ];
  const rows: unknown[][] = [];

  customers.forEach((customer) => {
    const customerOrders = orders.filter((order) => normalizePhone(order.phone) === customer.id);
    customerOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.itemType === "combo" && item.comboItems?.length) {
          item.comboItems.forEach((child) => rows.push([
            `${customer.firstName} ${customer.lastName}`.trim(),
            formatCustomerPhone(customer.phone),
            customer.email,
            order.id,
            new Date(order.createdAt).toLocaleString(),
            order.status,
            order.type,
            "Combo",
            item.name,
            child.name,
            item.quantity,
            item.unitPrice,
            child.ice || "",
            child.sugar || "",
            child.toppings.map((topping) => topping.name).join("; "),
            child.note || item.note || "",
            order.total,
          ]));
        } else {
          rows.push([
            `${customer.firstName} ${customer.lastName}`.trim(),
            formatCustomerPhone(customer.phone),
            customer.email,
            order.id,
            new Date(order.createdAt).toLocaleString(),
            order.status,
            order.type,
            "Product",
            item.name,
            "",
            item.quantity,
            item.unitPrice,
            item.ice || "",
            item.sugar || "",
            item.toppings.map((topping) => topping.name).join("; "),
            item.note || "",
            order.total,
          ]);
        }
      });
    });
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `levien-customer-purchases-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const orderItemLabel = (item: CustomerOrder["items"][number]) => item.itemType === "combo" && item.comboItems?.length
  ? `${item.name} × ${item.quantity} (${item.comboItems.map((child) => child.name).join(" + ")})`
  : `${item.name} × ${item.quantity}`;

export default function AdminApp() {
  const [staff, setStaff] = useState<StaffSessionSummary | null>(null);
  const [view, setView] = useState<AdminView>("dashboard");
  const [db, setDb] = useState<DB>(seed);
  const [modal, setModal] = useState<null | { type: string; id?: string }>(null);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState<"All" | OrderStatus>("All");
  const [orderSyncStatus, setOrderSyncStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const orderRefreshPromise = useRef<Promise<void> | null>(null);
  const loggedIn = Boolean(staff);

  useEffect(() => {
    const stored = localStorage.getItem("levien-admin-v1");
    if (stored) {
      const parsed = JSON.parse(stored) as DB;
      parsed.products = (parsed.products || []).map((product) => ({
        ...product,
        allowToppings: product.allowToppings ?? (product.toppingIds || []).length > 0,
      }));
      setDb({ ...parsed, orders: [] });
    }
    void fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { authenticated?: boolean; staff?: StaffSessionSummary | null }) => {
        if (result.authenticated && result.staff) {
          setStaff(result.staff);
          const availableViews = viewsForRole(result.staff.role);
          setView(availableViews[0] || "account");
          if (roleHasPermission(result.staff.role, "manage_orders")) void refreshCloudOrders();
          if (roleHasPermission(result.staff.role, "manage_catalog")) void refreshCloudCatalog();
        }
      })
      .catch((error) => console.error("Unable to restore admin session:", error));
  }, []);
  useEffect(() => {
    localStorage.setItem("levien-admin-v1", JSON.stringify({ ...db, orders: [] }));
    window.dispatchEvent(new Event("levien-admin-updated"));
  }, [db]);

  useEffect(() => {
    if (!staff || !roleHasPermission(staff.role, "manage_orders")) return;
    const syncOrders = () => void refreshCloudOrders();
    const eventSource = new EventSource("/api/admin/orders/stream");
    eventSource.addEventListener("ready", () => setOrderSyncStatus("live"));
    eventSource.addEventListener("orders", syncOrders);
    eventSource.addEventListener("unavailable", () => setOrderSyncStatus("polling"));
    eventSource.onerror = () => setOrderSyncStatus("polling");

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncOrders();
    };

    window.addEventListener("focus", syncOrders);
    window.addEventListener("online", syncOrders);
    document.addEventListener("visibilitychange", syncWhenVisible);
    const timer = window.setInterval(syncOrders, 30000);

    return () => {
      eventSource.close();
      window.removeEventListener("focus", syncOrders);
      window.removeEventListener("online", syncOrders);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.clearInterval(timer);
    };
  }, [staff]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2400); return () => clearTimeout(timer); }, [toast]);

  const todayOrders = db.orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const revenue = todayOrders.filter(o => o.status !== "Cancelled").reduce((sum, order) => sum + order.total, 0);
  const filteredProducts = db.products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const filteredOrders = db.orders.filter(o => orderFilter === "All" || o.status === orderFilter);
  const customers = useMemo(() => buildCustomers(db.orders), [db.orders]);
  const filteredCustomers = customers.filter((customer) => {
    const term = customerQuery.trim().toLowerCase();
    if (!term) return true;
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    return fullName.includes(term) || normalizePhone(customer.phone).includes(normalizePhone(term)) || customer.email.toLowerCase().includes(term);
  });

  function update(next: DB, message = "Saved successfully") {
    const catalogChanged = next.categories !== db.categories || next.toppings !== db.toppings ||
      next.products !== db.products || next.combos !== db.combos ||
      next.promotions !== db.promotions || next.content !== db.content;
    setDb(next);
    setToast(message);
    if (catalogChanged) void saveCloudCatalog(next);
  }
  function refreshCloudOrders() {
    if (orderRefreshPromise.current) return orderRefreshPromise.current;
    const refreshRequest = (async () => {
      try {
        const response = await fetch("/api/admin/orders", { cache: "no-store" });
        if (response.status === 401) {
          setStaff(null);
          setDb((current) => ({ ...current, orders: [] }));
          return;
        }
        const result = (await response.json()) as { orders?: CustomerOrder[]; error?: string };
        if (!response.ok || !result.orders) throw new Error(result.error || "Unable to load orders.");
        setDb((current) => ({ ...current, orders: result.orders || [] }));
      } catch (error) {
        console.error("Unable to sync Supabase orders:", error);
        setOrderSyncStatus("polling");
        setToast("Unable to sync Supabase orders");
      }
    })();
    orderRefreshPromise.current = refreshRequest;
    void refreshRequest.finally(() => {
      if (orderRefreshPromise.current === refreshRequest) orderRefreshPromise.current = null;
    });
    return refreshRequest;
  }
  async function refreshCloudCatalog() {
    try {
      const response = await fetch("/api/admin/catalog", { cache: "no-store" });
      if (response.status === 401) {
        setStaff(null);
        setDb((current) => ({ ...current, orders: [] }));
        return;
      }
      const result = (await response.json()) as { catalog?: Omit<DB, "orders">; error?: string };
      if (!response.ok || !result.catalog) throw new Error(result.error || "Unable to load catalog.");
      setDb((current) => ({ ...current, ...result.catalog }));
    } catch (error) {
      console.error("Unable to sync Supabase catalog:", error);
      setToast("Unable to sync Supabase catalog");
    }
  }
  async function saveCloudCatalog(next: DB) {
    try {
      const { orders: _orders, ...catalog } = next;
      const response = await fetch("/api/admin/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save catalog.");
      window.dispatchEvent(new Event("levien-admin-updated"));
    } catch (error) {
      console.error("Unable to save Supabase catalog:", error);
      setToast(error instanceof Error ? error.message : "Unable to save Supabase catalog");
    }
  }
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = (await response.json()) as { error?: string; staff?: StaffSessionSummary };
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      if (!result.staff) throw new Error("Staff profile is missing from the session.");
      setStaff(result.staff);
      const availableViews = viewsForRole(result.staff.role);
      setView(availableViews[0] || "account");
      await Promise.all([
        roleHasPermission(result.staff.role, "manage_orders") ? refreshCloudOrders() : Promise.resolve(),
        roleHasPermission(result.staff.role, "manage_catalog") ? refreshCloudCatalog() : Promise.resolve(),
      ]);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to sign in");
    }
  }
  function logout() {
    void fetch("/api/admin/session", { method: "DELETE" });
    setStaff(null);
    setDb((current) => ({ ...current, orders: [] }));
    setModal(null);
  }

  if (!staff) return <AdminLogin onLogin={login} toast={toast} />;

  const allowedViews = viewsForRole(staff.role);
  const canManageCatalog = roleHasPermission(staff.role, "manage_catalog");
  const canManageOrders = roleHasPermission(staff.role, "manage_orders");
  const canViewCustomers = roleHasPermission(staff.role, "view_customers");
  const canOpenModal = modal && (
    modal.type === "order" ? canManageOrders :
    modal.type === "customer" ? canViewCustomers : canManageCatalog
  );

  return (
    <div className="adminShellV3">
      <aside className="adminSidebarV3">
        <div className="adminBrandV3"><span className="adminLogoV3">LV</span><div><strong>LEVIEN</strong><small>ADMIN PLATFORM</small></div></div>
        <nav>{allowedViews.map(key => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}><span className="adminNavIcon"><AdminIcon name={key} /></span><span className="adminNavLabel">{viewLabels[key]}</span>{key === "orders" && db.orders.filter(o => o.status === "New").length > 0 && <b>{db.orders.filter(o => o.status === "New").length}</b>}</button>)}</nav>
        <div className="adminSidebarBottom"><Link href="/"><AdminIcon name="external" /><span>View Store</span></Link><button onClick={logout}><AdminIcon name="logout" /><span>Sign out</span></button></div>
      </aside>
      <main className="adminWorkspace">
        <header className="adminTopbar"><div><span className="adminBreadcrumb">LEVIEN CAFE / {viewLabels[view]}</span><h1>{viewLabels[view]}</h1></div><div className="adminTopActions">{canManageOrders && <span className={`adminLiveBadge sync-${orderSyncStatus}`}>● {orderSyncStatus === "live" ? "Orders live" : orderSyncStatus === "polling" ? "Auto reconnecting" : "Connecting"}</span>}<span className={`adminRoleBadge role-${staff.role}`}>{staffRoleLabels[staff.role]}</span><button className="adminAvatar" title={staff.fullName}>{initials(staff.fullName)}</button></div></header>
        {view === "dashboard" && canManageCatalog && <Dashboard db={db} revenue={revenue} todayOrders={todayOrders} openView={setView} openModal={setModal} />}
        {view === "dashboard" && !canManageCatalog && canManageOrders && <OperationsDashboard db={db} todayOrders={todayOrders} openView={setView} />}
        {view === "orders" && <Orders db={db} orders={filteredOrders} filter={orderFilter} setFilter={setOrderFilter} update={update} openModal={setModal} />}
        {view === "customers" && <Customers customers={filteredCustomers} allCustomers={customers} orders={db.orders} query={customerQuery} setQuery={setCustomerQuery} openModal={setModal} />}
        {view === "products" && <Products db={db} products={filteredProducts} query={query} setQuery={setQuery} openModal={setModal} update={update} />}
        {view === "categories" && <Categories db={db} openModal={setModal} update={update} />}
        {view === "toppings" && <Toppings db={db} openModal={setModal} update={update} />}
        {view === "combos" && <Combos db={db} openModal={setModal} update={update} />}
        {view === "promotions" && <Promotions db={db} openModal={setModal} update={update} />}
        {view === "content" && <WebsiteContent db={db} openModal={setModal} />}
        {view === "account" && <StaffAccount staff={staff} />}
      </main>
      {modal && canOpenModal && <AdminModal modal={modal} db={db} close={() => setModal(null)} update={update} />}
      {toast && <div className="adminToast">✓ {toast}</div>}
    </div>
  );
}

function AdminLogin({ onLogin, toast }: { onLogin: (e: React.FormEvent<HTMLFormElement>) => void; toast: string }) {
  return <div className="adminLoginPage"><div className="adminLoginVisual"><span>LEVIEN CAFE</span><h1>Your café,<br/>beautifully managed.</h1><p>Orders, store content and staff operations in one role-protected workspace.</p></div><form className="adminLoginCard" onSubmit={onLogin}><div className="adminLoginLogo">LV</div><span className="adminEyebrow">Staff workspace</span><h2>Welcome back</h2><p>Sign in with your staff email. The legacy Owner username remains available during migration.</p><label>Email or legacy username<input name="username" defaultValue="admin" autoComplete="username" /></label><label>Password<input name="password" type="password" autoComplete="current-password" /></label><button className="adminPrimary" type="submit">Sign in</button><small>Identity and permissions are verified securely by the server.</small>{toast && <div className="adminLoginError">{toast}</div>}</form></div>;
}

function Dashboard({ db, revenue, todayOrders, openView, openModal }: { db: DB; revenue: number; todayOrders: Order[]; openView: (v: AdminView) => void; openModal: (m: { type: string; id?: string }) => void }) {
  return <div className="adminStack"><section className="adminWelcome"><div><span>Good morning</span><h2>Here’s what’s happening at LEVIEN today.</h2></div><button className="adminPrimary" onClick={() => openModal({ type: "product" })}>New product</button></section><section className="adminMetrics"><Metric label="Orders today" value={String(todayOrders.length)} detail={`${db.orders.filter(o => o.status === "New").length} waiting`} /><Metric label="Revenue today" value={money(revenue)} detail="Demo order totals" /><Metric label="Active products" value={String(db.products.filter(p => p.active).length)} detail={`${db.products.filter(p => p.soldOut).length} sold out`} /><Metric label="Live promotions" value={String(db.promotions.filter(p => p.active).length)} detail="Homepage slider" /></section><div className="adminDashboardGrid"><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Live queue</span><h3>Recent orders</h3></div><button className="adminTextButton" onClick={() => openView("orders")}>View all →</button></div><OrderRows orders={db.orders.slice(0, 4)} /></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Quick actions</span><h3>Manage your store</h3></div></div><div className="quickActionGrid"><QuickAction icon="products" title="Add product" text="Create a new menu item." onClick={() => openModal({ type: "product" })}/><QuickAction icon="promotions" title="New promotion" text="Add a homepage slide." onClick={() => openModal({ type: "promotion" })}/><QuickAction icon="toppings" title="Add topping" text="Create an add-on option." onClick={() => openModal({ type: "topping" })}/><QuickAction icon="content" title="Website content" text="Update logo and story." onClick={() => openView("content")}/></div></section></div></div>;
}
function OperationsDashboard({ db, todayOrders, openView }: { db: DB; todayOrders: Order[]; openView: (view: AdminView) => void }) {
  return <div className="adminStack"><section className="adminWelcome"><div><span>Operations workspace</span><h2>Keep today’s order queue moving.</h2></div><button className="adminPrimary" onClick={() => openView("orders")}>Open orders</button></section><section className="adminMetrics"><Metric label="Orders today" value={String(todayOrders.length)} detail="Published online orders"/><Metric label="Waiting" value={String(db.orders.filter((order) => order.status === "New").length)} detail="Need confirmation"/><Metric label="Preparing" value={String(db.orders.filter((order) => order.status === "Preparing").length)} detail="In progress"/><Metric label="Ready" value={String(db.orders.filter((order) => order.status === "Ready").length)} detail="Ready for handoff"/></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Live queue</span><h3>Recent orders</h3></div><button className="adminTextButton" onClick={() => openView("orders")}>View all →</button></div><OrderRows orders={db.orders.slice(0, 6)} /></section></div>;
}
function StaffAccount({ staff }: { staff: StaffSessionSummary }) {
  const accessSummary: Record<StaffRole, string> = {
    owner: "Full store, staff, schedule, and compensation access.",
    manager: "Store, staff, schedule, and compensation management access.",
    supervisor: "Order operations and personal schedule access.",
    staff: "Personal account and schedule access.",
  };
  return <div className="adminAccountGrid"><section className="adminCard adminProfileCard"><div className="adminProfileAvatar">{initials(staff.fullName)}</div><span className="adminEyebrow">Authenticated staff account</span><h2>{staff.fullName}</h2><p>{staff.email}</p><span className={`adminRoleBadge role-${staff.role}`}>{staffRoleLabels[staff.role]}</span></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Access level</span><h3>{staffRoleLabels[staff.role]} permissions</h3></div></div><p className="adminAccessCopy">{accessSummary[staff.role]}</p><div className="adminSecurityNote"><strong>Protected server-side</strong><span>Navigation and every Admin API request are checked against this role. Payroll fields are not part of staff session data.</span></div>{staff.legacy && <div className="adminLegacyNotice"><strong>Legacy Owner session</strong><span>Create the first Supabase Auth Owner account before removing the legacy Admin environment credentials.</span></div>}</section><section className="adminCard adminSchedulePreview"><span className="adminEyebrow">Coming in V2.2</span><h3>Availability and shift registration</h3><p>Your personal schedule workspace will appear here after the scheduling sprint.</p></section></div>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="adminMetric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function QuickAction({ icon, title, text, onClick }: { icon: AdminIconName; title: string; text: string; onClick: () => void }) { return <button className="adminQuickAction" onClick={onClick}><span><AdminIcon name={icon} /></span><div><strong>{title}</strong><small>{text}</small></div><b><AdminIcon name="arrow" /></b></button>; }

function Orders({ db, orders, filter, setFilter, update, openModal }: { db: DB; orders: Order[]; filter: "All" | OrderStatus; setFilter: (v: "All" | OrderStatus) => void; update: (d: DB, m?: string) => void; openModal: (m: { type: string; id?: string }) => void }) {
  const statuses: ("All" | OrderStatus)[] = ["All", "New", "Preparing", "Ready", "Completed", "Cancelled"];

  async function changeOrderStatus(orderId: string, status: OrderStatus) {
    const previousOrders = db.orders;
    const nextOrders = db.orders.map((order) =>
      order.id === orderId ? { ...order, status } : order,
    );

    update({ ...db, orders: nextOrders }, `Order ${orderId} updated`);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderId, status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update order.");
    } catch (error) {
      update({ ...db, orders: previousOrders }, error instanceof Error ? error.message : "Unable to update order");
    }
  }

  return <div className="adminStack"><section className="adminToolbar"><div className="adminTabs">{statuses.map(s => <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>{s}<span>{s === "All" ? db.orders.length : db.orders.filter(o => o.status === s).length}</span></button>)}</div></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Online ordering</span><h3>Order queue</h3></div><span className="adminHint">Status updates are saved to Supabase</span></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><strong>{o.id}</strong><small>{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></td><td><strong>{o.customer}</strong><small>{o.phone}</small></td><td>{o.type}</td><td><strong>{money(o.total)}</strong></td><td><select className={`orderStatusSelect status-${o.status.toLowerCase()}`} value={o.status} onChange={e => void changeOrderStatus(o.id, e.target.value as OrderStatus)}>{["New", "Preparing", "Ready", "Completed", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></td><td><button className="adminIconAction" onClick={() => openModal({ type: "order", id: o.id })}>View</button></td></tr>)}</tbody></table></div></section></div>;
}
function OrderRows({ orders }: { orders: Order[] }) { return <div className="adminOrderRows">{orders.map(o => <div key={o.id}><span className={`adminOrderDot status-${o.status.toLowerCase()}`}></span><div><strong>{o.id} · {o.customer}</strong><small>{o.items.map(orderItemLabel).join(", ")}</small></div><b>{money(o.total)}</b><em>{o.status}</em></div>)}</div>; }

function Customers({ customers, allCustomers, orders, query, setQuery, openModal }: { customers: Customer[]; allCustomers: Customer[]; orders: Order[]; query: string; setQuery: (value: string) => void; openModal: (modal: { type: string; id?: string }) => void }) {
  return <div className="adminStack">
    <section className="adminToolbar customerToolbar">
      <div className="adminSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, or email..." /></div>
      <button className="adminSecondary customerExportButton" type="button" onClick={() => exportCustomerPurchaseCsv(allCustomers, orders)}>Export CSV</button>
    </section>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Internal customer data</span><h3>{customers.length} customers</h3></div><span className="adminHint">Export includes every purchased product and customization</span></div>
      <div className="adminTableWrap"><table className="adminTable customerTable"><thead><tr><th>Customer</th><th>Phone</th><th>Products purchased</th><th>Orders</th><th>Total spent</th><th>Last order</th><th></th></tr></thead><tbody>
        {customers.map((customer) => {
          const products = customerPurchasedProducts(customer, orders);
          const productPreview = products.slice(0, 3).map(([name, quantity]) => `${name} ×${quantity}`).join(" · ");
          return <tr key={customer.id}>
            <td><strong>{customer.firstName} {customer.lastName}</strong><small>{customer.email || "No email"}</small></td>
            <td>{formatCustomerPhone(customer.phone)}</td>
            <td className="customerProductsCell"><strong>{products.length} products</strong><small>{productPreview || "No product data"}{products.length > 3 ? ` · +${products.length - 3} more` : ""}</small></td>
            <td><strong>{customer.totalOrders}</strong></td>
            <td><strong>{money(customer.totalSpent)}</strong><small>Avg. {money(customer.averageOrder)}</small></td>
            <td>{new Date(customer.lastOrderAt).toLocaleDateString()}</td>
            <td><button className="adminIconAction" onClick={() => openModal({ type: "customer", id: customer.id })}>View</button></td>
          </tr>;
        })}
        {!customers.length && <tr><td colSpan={7}><div className="customerEmpty"><strong>No customers found</strong><span>New customers will appear automatically after a web order is placed.</span></div></td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function Products({ db, products, query, setQuery, openModal, update }: { db: DB; products: Product[]; query: string; setQuery: (v: string) => void; openModal: (m: { type: string; id?: string }) => void; update: (d: DB, m?: string) => void }) {
  return <div className="adminStack"><section className="adminToolbar"><div className="adminSearch"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products..." /></div><button className="adminPrimary" onClick={() => openModal({ type: "product" })}>New product</button></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Menu management</span><h3>{products.length} products</h3></div><span className="adminHint">Images are stored in this browser for Sprint 3</span></div><div className="adminProductList">{products.map(p => <div className="adminProductRow" key={p.id}><div className="adminProductThumb">{p.image ? <img src={p.image} alt=""/> : <span>{p.emoji}</span>}</div><div className="adminProductMain"><strong>{p.name}</strong><small>{db.categories.find(c => c.id === p.categoryId)?.name || "Uncategorized"}</small></div><div className="adminProductBadges">{p.bestSeller && <span>Best Seller</span>}{p.mustTry && <span>Must Try</span>}{p.featured && <span>Featured</span>}{p.isNew && <span>New</span>}</div><strong className="adminProductPrice">{money(p.price)}</strong><span className={p.soldOut ? "adminState sold" : p.active ? "adminState live" : "adminState hidden"}>{p.soldOut ? "Sold out" : p.active ? "Live" : "Hidden"}</span><div className="adminRowActions"><button onClick={() => openModal({ type: "product", id: p.id })}>Edit</button><button onClick={() => update({ ...db, products: db.products.map(item => item.id === p.id ? { ...item, active: !item.active } : item) }, p.active ? "Product hidden" : "Product published")}>{p.active ? "Hide" : "Show"}</button></div></div>)}</div></section></div>;
}

function Categories({ db, openModal, update }: { db: DB; openModal: (m: { type: string; id?: string }) => void; update: (d: DB, m?: string) => void }) { return <EntityPage title="Product categories" eyebrow="Menu structure" button="New category" onAdd={() => openModal({ type: "category" })}>{db.categories.map(c => <EntityRow key={c.id} icon={c.icon} title={c.name} subtitle={`${db.products.filter(p => p.categoryId === c.id).length} products`} active={c.active} edit={() => openModal({ type: "category", id: c.id })} toggle={() => update({ ...db, categories: db.categories.map(x => x.id === c.id ? { ...x, active: !x.active } : x) })}/>)}</EntityPage>; }
function Toppings({ db, openModal, update }: { db: DB; openModal: (m: { type: string; id?: string }) => void; update: (d: DB, m?: string) => void }) { return <EntityPage title="Toppings" eyebrow="Customization options" button="New topping" onAdd={() => openModal({ type: "topping" })}>{db.toppings.map(t => <EntityRow key={t.id} icon="＋" title={t.name} subtitle={`${money(t.price)} additional`} active={t.active} edit={() => openModal({ type: "topping", id: t.id })} toggle={() => update({ ...db, toppings: db.toppings.map(x => x.id === t.id ? { ...x, active: !x.active } : x) })}/>)}</EntityPage>; }
function Combos({ db, openModal, update }: { db: DB; openModal: (m: { type: string; id?: string }) => void; update: (d: DB, m?: string) => void }) {
  return <EntityPage title="Combo deals" eyebrow="Bundles" button="New combo" onAdd={() => openModal({ type: "combo" })}>
    {db.combos.map((combo) => {
      const regularPrice = comboRegularPrice(combo, db.products);
      const savings = Math.max(0, regularPrice - Number(combo.price || 0));
      const missingProducts = combo.productIds.filter((id) => !db.products.some((product) => product.id === id)).length;
      return <EntityRow
        key={combo.id}
        icon="▣"
        title={combo.name}
        subtitle={`${combo.productIds.length} products · Regular ${money(regularPrice)} · Combo ${money(combo.price)}${savings > 0 ? ` · Save ${money(savings)}` : ""}${missingProducts ? ` · ${missingProducts} missing` : ""}`}
        active={combo.active}
        edit={() => openModal({ type: "combo", id: combo.id })}
        toggle={() => update({ ...db, combos: db.combos.map((item) => item.id === combo.id ? { ...item, active: !item.active } : item) })}
      />;
    })}
  </EntityPage>;
}
function Promotions({ db, openModal, update }: { db: DB; openModal: (m: { type: string; id?: string }) => void; update: (d: DB, m?: string) => void }) { return <EntityPage title="Promotion slider" eyebrow="Homepage campaigns" button="New promotion" onAdd={() => openModal({ type: "promotion" })}>{[...db.promotions].sort((a,b)=>a.order-b.order).map(p => <EntityRow key={p.id} icon="▣" title={p.title} subtitle={`${p.eyebrow} · Slide ${p.order} · ${p.priceText}`} active={p.active} edit={() => openModal({ type: "promotion", id: p.id })} toggle={() => update({ ...db, promotions: db.promotions.map(x => x.id === p.id ? { ...x, active: !x.active } : x) })}/>)}</EntityPage>; }
function EntityPage({ title, eyebrow, button, onAdd, children }: { title: string; eyebrow: string; button: string; onAdd: () => void; children: React.ReactNode }) { return <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">{eyebrow}</span><h3>{title}</h3></div><button className="adminPrimary" onClick={onAdd}>＋ {button}</button></div><div className="adminEntityList">{children}</div></section>; }
function EntityRow({ icon, title, subtitle, active, edit, toggle }: { icon: string; title: string; subtitle: string; active: boolean; edit: () => void; toggle: () => void }) { return <div className="adminEntityRow"><span className="adminEntityIcon">{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div><span className={active ? "adminState live" : "adminState hidden"}>{active ? "Active" : "Hidden"}</span><button className="adminTextButton" onClick={edit}>Edit</button><button className="adminTextButton muted" onClick={toggle}>{active ? "Hide" : "Show"}</button></div>; }

function WebsiteContent({ db, openModal }: { db: DB; openModal: (m: { type: string; id?: string }) => void }) { const c=db.content; return <div className="adminContentGrid"><section className="adminCard adminContentPreview"><div className="adminCardHead"><div><span className="adminEyebrow">Brand preview</span><h3>Store identity</h3></div><button className="adminPrimary" onClick={()=>openModal({type:"content"})}>Edit content</button></div><div className="adminBrandPreview"><div className="adminLogoPreview">{c.logo?<img src={c.logo} alt=""/>:"LV"}</div><h2>{c.storeName}</h2><p>{c.aboutTitle}</p><span>{c.announcement}</span></div></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Published details</span><h3>Contact & location</h3></div></div><dl className="adminDetails"><div><dt>Address</dt><dd>{c.address}</dd></div><div><dt>Phone</dt><dd>{c.phone}</dd></div><div><dt>Email</dt><dd>{c.email}</dd></div><div><dt>Hours</dt><dd>{c.hours}</dd></div><div><dt>Google Maps</dt><dd><a href={c.mapUrl} target="_blank">Open map ↗</a></dd></div></dl></section><section className="adminCard adminAboutPreview"><div className="adminAboutPhoto">{c.aboutImage?<img src={c.aboutImage} alt=""/>:<span>☕</span>}</div><div><span className="adminEyebrow">Our story</span><h3>{c.aboutTitle}</h3><p>{c.aboutText}</p></div></section></div>; }

function AdminModal({ modal, db, close, update }: { modal: { type: string; id?: string }; db: DB; close: () => void; update: (d: DB, m?: string) => void }) {
  const [image, setImage] = useState("");
  const [logoImage, setLogoImage] = useState(db.content.logo);
  const [aboutImage, setAboutImage] = useState(db.content.aboutImage);
  const [selectedComboProductIds, setSelectedComboProductIds] = useState<string[]>([]);
  const [comboPricePreview, setComboPricePreview] = useState(0);
  const entity = useMemo(() => {
    if (modal.type === "product") return db.products.find(x => x.id === modal.id);
    if (modal.type === "category") return db.categories.find(x => x.id === modal.id);
    if (modal.type === "topping") return db.toppings.find(x => x.id === modal.id);
    if (modal.type === "combo") return db.combos.find(x => x.id === modal.id);
    if (modal.type === "promotion") return db.promotions.find(x => x.id === modal.id);
    if (modal.type === "order") return db.orders.find(x => x.id === modal.id);
    if (modal.type === "customer") return buildCustomers(db.orders).find((customer) => customer.id === modal.id);
    return undefined;
  }, [modal, db]);
  useEffect(() => {
    setImage((entity as Product | Combo | Promotion | undefined)?.image || "");
    const combo = modal.type === "combo" ? entity as Combo | undefined : undefined;
    setSelectedComboProductIds(combo?.productIds || []);
    setComboPricePreview(Number(combo?.price || 0));
  }, [entity, modal.type]);

  const selectedComboProducts = useMemo(
    () => selectedComboProductIds
      .map((id) => db.products.find((product) => product.id === id))
      .filter(Boolean) as Product[],
    [selectedComboProductIds, db.products],
  );
  const selectedComboRegularPrice = selectedComboProducts.reduce((total, product) => total + Number(product.price || 0), 0);
  const selectedComboSavings = Math.max(0, selectedComboRegularPrice - comboPricePreview);

  function toggleComboProduct(productId: string) {
    setSelectedComboProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    if (f.getAll("_imageUploading").includes("1")) {
      update(db, "Wait for image optimization to finish");
      return;
    }
    if(modal.type==="product") { const old=entity as Product|undefined; const item:Product={id:old?.id||catalogId(),name:String(f.get("name")),categoryId:String(f.get("categoryId")),price:Number(f.get("price")),description:String(f.get("description")),image:image||old?.image||"",emoji:String(f.get("emoji")||"☕"),toppingIds:f.getAll("toppings").map(String),allowIce:f.get("allowIce")==="on",allowSugar:f.get("allowSugar")==="on",allowToppings:f.get("allowToppings")==="on",bestSeller:f.get("bestSeller")==="on",mustTry:f.get("mustTry")==="on",featured:f.get("featured")==="on",isNew:f.get("isNew")==="on",soldOut:f.get("soldOut")==="on",active:f.get("active")==="on"}; update({...db,products:old?db.products.map(x=>x.id===old.id?item:x):[item,...db.products]},old?"Product updated":"Product created"); }
    if(modal.type==="category") { const old=entity as Category|undefined; const item:Category={id:old?.id||catalogId(),name:String(f.get("name")),icon:String(f.get("icon")||"☕"),active:f.get("active")==="on"}; update({...db,categories:old?db.categories.map(x=>x.id===old.id?item:x):[...db.categories,item]},"Category saved"); }
    if(modal.type==="topping") { const old=entity as Topping|undefined; const item:Topping={id:old?.id||catalogId(),name:String(f.get("name")),price:Number(f.get("price")),active:f.get("active")==="on"}; update({...db,toppings:old?db.toppings.map(x=>x.id===old.id?item:x):[...db.toppings,item]},"Topping saved"); }
    if (modal.type === "combo") {
      const old = entity as Combo | undefined;
      const name = String(f.get("name") || "").trim();
      const description = String(f.get("description") || "").trim();
      const price = Number(f.get("price") || 0);
      const productIds = f.getAll("products").map(String);

      if (!name) {
        update(db, "Enter a combo name");
        return;
      }
      if (productIds.length < 2) {
        update(db, "Select at least two products for a combo");
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        update(db, "Combo price must be greater than $0");
        return;
      }

      const regularPrice = productIds.reduce(
        (total, productId) => total + Number(db.products.find((product) => product.id === productId)?.price || 0),
        0,
      );
      if (regularPrice > 0 && price >= regularPrice) {
        update(db, "Combo price should be lower than the regular total");
        return;
      }

      const item: Combo = {
        id: old?.id || catalogId(),
        name,
        description,
        price,
        productIds,
        image: image || old?.image || "",
        active: f.get("active") === "on",
      };
      update(
        { ...db, combos: old ? db.combos.map((combo) => combo.id === old.id ? item : combo) : [item, ...db.combos] },
        old ? "Combo updated" : "Combo created",
      );
    }
    if(modal.type==="promotion") { const old=entity as Promotion|undefined; const item:Promotion={id:old?.id||catalogId(),title:String(f.get("title")),eyebrow:String(f.get("eyebrow")),description:String(f.get("description")),priceText:String(f.get("priceText")),order:Number(f.get("order")),image:image||old?.image||"",active:f.get("active")==="on"}; update({...db,promotions:old?db.promotions.map(x=>x.id===old.id?item:x):[...db.promotions,item]},"Promotion saved"); }
    if(modal.type==="content") { const c=db.content; const next={...c,storeName:String(f.get("storeName")),tagline:String(f.get("tagline")),announcement:String(f.get("announcement")),aboutTitle:String(f.get("aboutTitle")),aboutText:String(f.get("aboutText")),address:String(f.get("address")),phone:String(f.get("phone")),email:String(f.get("email")),hours:String(f.get("hours")),footerText:String(f.get("footerText")),mapUrl:String(f.get("mapUrl")),logo:logoImage,aboutImage}; update({...db,content:next},"Website content saved"); }
    close();
  }
  if (modal.type === "customer") {
    const customer = entity as Customer;
    const customerOrders = db.orders
      .filter((order) => normalizePhone(order.phone) === customer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const purchasedProducts = customerPurchasedProducts(customer, db.orders);
    return <ModalShell title={`${customer.firstName} ${customer.lastName}`.trim()} subtitle="Customer purchase history" close={close}>
      <div className="customerDetailSummary">
        <div><span>Phone</span><strong>{formatCustomerPhone(customer.phone)}</strong></div>
        <div><span>Email</span><strong>{customer.email || "Not provided"}</strong></div>
      </div>
      <div className="customerMetricGrid">
        <div><span>Total orders</span><strong>{customer.totalOrders}</strong></div>
        <div><span>Total spent</span><strong>{money(customer.totalSpent)}</strong></div>
        <div><span>Average order</span><strong>{money(customer.averageOrder)}</strong></div>
        <div><span>Products purchased</span><strong>{purchasedProducts.reduce((sum, [, quantity]) => sum + quantity, 0)}</strong></div>
      </div>
      <div className="customerProductSummary">
        <div className="adminCardHead"><div><span className="adminEyebrow">Purchase summary</span><h3>Products purchased</h3></div></div>
        <div className="customerProductChips">
          {purchasedProducts.map(([name, quantity]) => <span key={name}><strong>{name}</strong><b>×{quantity}</b></span>)}
          {!purchasedProducts.length && <small>No product information is available.</small>}
        </div>
      </div>
      <div className="customerOrderHistory customerOrderHistoryDetailed">
        <div className="adminCardHead"><div><span className="adminEyebrow">Order history</span><h3>Orders and products</h3></div></div>
        {customerOrders.map((order) => <article className="customerHistoryOrder" key={order.id}>
          <header>
            <div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleString()} · {order.type}</small></div>
            <span className={`adminState ${order.status === "Cancelled" ? "sold" : "live"}`}>{order.status}</span>
            <b>{money(order.total)}</b>
          </header>
          <div className="customerHistoryItems">
            {order.items.map((item) => <div key={item.lineId}>
              <div><strong>{item.quantity} × {item.name}</strong><small>{item.itemType === "combo" ? "Combo" : "Product"} · {money(item.unitPrice)} each</small></div>
              {item.itemType === "combo" && item.comboItems?.length
                ? <div className="customerComboItems">{item.comboItems.map((child) => <span key={`${item.lineId}-${child.productId}`}><b>{child.name}</b><small>{comboChildOptions(child) || "Standard options"}</small></span>)}</div>
                : <small className="customerItemOptions">{orderItemOptions(item) || "Standard options"}</small>}
            </div>)}
          </div>
        </article>)}
      </div>
    </ModalShell>;
  }
  if(modal.type==="order") { const o=entity as Order; return <ModalShell title={o.id} subtitle="Order details" close={close}><div className="orderDetailHeader"><div><strong>{o.customer}</strong><span>{o.phone} · {o.type}</span></div><b>{money(o.total)}</b></div><div className="orderItemList">{o.items.map(i=><div className={i.itemType === "combo" ? "adminComboOrderItem" : ""} key={i.lineId}><strong>{i.quantity} × {i.name}</strong>{i.itemType === "combo" && i.comboItems?.length ? <div className="adminComboChildren">{i.comboItems.map(child=><span key={child.productId}><b>{child.emoji} {child.name}</b><small>{comboChildOptions(child)}</small></span>)}</div> : <small>{orderItemOptions(i)}</small>}<b>{money(i.unitPrice * i.quantity)}</b></div>)}</div><div className="adminOrderMeta"><span><b>Payment</b>{o.payment}</span>{o.pickupTime && <span><b>Pickup time</b>{o.pickupTime}</span>}{o.address && <span><b>Delivery address</b>{[o.address,o.apartment,o.city,o.zip].filter(Boolean).join(", ")}</span>}</div><div className="adminNote"><strong>Customer note</strong><p>{o.note||"No special note."}</p></div></ModalShell>; }
  if(modal.type==="content") { const c=db.content; return <ModalShell title="Website Content" subtitle="Logo, story, contact and map" close={close}><form onSubmit={submit} className="adminForm"><FormInput label="Store name" name="storeName" defaultValue={c.storeName}/><FormInput label="Brand tagline" name="tagline" defaultValue={c.tagline||"CAFE & EATERY"}/><FormInput label="Announcement bar" name="announcement" defaultValue={c.announcement} wide/><ImageUpload kind="logo" label="Logo image" image={logoImage} setImage={setLogoImage}/><FormInput label="Our Story title" name="aboutTitle" defaultValue={c.aboutTitle} wide/><FormTextarea label="Our Story text" name="aboutText" defaultValue={c.aboutText}/><ImageUpload kind="about" label="About Us image" image={aboutImage} setImage={setAboutImage}/><FormInput label="Address" name="address" defaultValue={c.address} wide/><FormInput label="Phone" name="phone" defaultValue={c.phone}/><FormInput label="Email" name="email" defaultValue={c.email}/><FormInput label="Opening hours" name="hours" defaultValue={c.hours} wide/><FormInput label="Footer note" name="footerText" defaultValue={c.footerText||"Made with care in Philadelphia"} wide/><FormInput label="Google Maps link" name="mapUrl" defaultValue={c.mapUrl} wide/><FormActions close={close}/></form></ModalShell>; }
  if(modal.type==="product") { const p=entity as Product|undefined; return <ModalShell title={p?"Edit product":"New product"} subtitle="Menu item details and customization" close={close}><form onSubmit={submit} className="adminForm"><FormInput label="Product name" name="name" defaultValue={p?.name||""}/><label>Category<select name="categoryId" defaultValue={p?.categoryId||db.categories[0]?.id}>{db.categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><FormInput label="Price" name="price" type="number" step="0.01" defaultValue={String(p?.price||0)}/><FormInput label="Emoji fallback" name="emoji" defaultValue={p?.emoji||"☕"}/><FormTextarea label="Description" name="description" defaultValue={p?.description||""}/><ImageUpload image={image||p?.image||""} setImage={setImage}/><fieldset className="adminChecklist wide"><legend>Customer Options</legend><Check name="allowIce" label="Allow Ice Level" checked={p?.allowIce??true}/><Check name="allowSugar" label="Allow Sugar Level" checked={p?.allowSugar??true}/><Check name="allowToppings" label="Allow Toppings" checked={p?.allowToppings??((p?.toppingIds.length||0)>0)}/></fieldset><fieldset className="adminChecklist wide"><legend>Available Toppings</legend>{db.toppings.map(t=><Check key={t.id} name="toppings" value={t.id} label={`${t.name} (+${money(t.price)})`} checked={p?.toppingIds.includes(t.id)}/>)}</fieldset><fieldset className="adminChecklist wide"><legend>Badges & Visibility</legend><Check name="bestSeller" label="Best Seller" checked={p?.bestSeller}/><Check name="mustTry" label="Must Try" checked={p?.mustTry}/><Check name="featured" label="Featured" checked={p?.featured}/><Check name="isNew" label="New" checked={p?.isNew}/><Check name="soldOut" label="Sold Out" checked={p?.soldOut}/><Check name="active" label="Published" checked={p?.active??true}/></fieldset><FormActions close={close}/></form></ModalShell>; }
  if(modal.type==="category") { const c=entity as Category|undefined; return <SimpleEntityForm title={c?"Edit category":"New category"} submit={submit} close={close}><FormInput label="Category name" name="name" defaultValue={c?.name||""}/><FormInput label="Icon" name="icon" defaultValue={c?.icon||"☕"}/><Check name="active" label="Active" checked={c?.active??true}/></SimpleEntityForm>; }
  if(modal.type==="topping") { const t=entity as Topping|undefined; return <SimpleEntityForm title={t?"Edit topping":"New topping"} submit={submit} close={close}><FormInput label="Topping name" name="name" defaultValue={t?.name||""}/><FormInput label="Additional price" name="price" type="number" step="0.01" defaultValue={String(t?.price||0)}/><Check name="active" label="Active" checked={t?.active??true}/></SimpleEntityForm>; }
  if (modal.type === "combo") {
    const combo = entity as Combo | undefined;
    return <ModalShell title={combo ? "Edit combo" : "New combo"} subtitle="Fixed bundle with a special price" close={close}>
      <form onSubmit={submit} className="adminForm comboBuilderForm">
        <FormInput label="Combo name" name="name" defaultValue={combo?.name || ""} />
        <label>
          Combo price
          <input
            required
            min="0.01"
            name="price"
            type="number"
            step="0.01"
            defaultValue={String(combo?.price || 0)}
            onChange={(event) => setComboPricePreview(Number(event.target.value || 0))}
          />
        </label>
        <FormTextarea label="Description" name="description" defaultValue={combo?.description || ""} />
        <ImageUpload kind="combo" image={image || combo?.image || ""} setImage={setImage} />

        <section className="comboBuilderSummary wide" aria-live="polite">
          <div>
            <span>Selected products</span>
            <strong>{selectedComboProductIds.length}</strong>
          </div>
          <div>
            <span>Regular total</span>
            <strong>{money(selectedComboRegularPrice)}</strong>
          </div>
          <div>
            <span>Combo price</span>
            <strong>{money(comboPricePreview)}</strong>
          </div>
          <div className={selectedComboSavings > 0 ? "positive" : ""}>
            <span>Customer saves</span>
            <strong>{money(selectedComboSavings)}</strong>
          </div>
        </section>

        <fieldset className="adminChecklist comboProductPicker wide">
          <legend>Included products <small>Select at least 2</small></legend>
          {db.products.map((product) => {
            const checked = selectedComboProductIds.includes(product.id);
            return <label className={`comboProductChoice ${checked ? "selected" : ""}`} key={product.id}>
              <input
                type="checkbox"
                name="products"
                value={product.id}
                checked={checked}
                onChange={() => toggleComboProduct(product.id)}
              />
              <span className="comboProductChoiceIcon">
                {product.image ? <img src={product.image} alt="" /> : product.emoji}
              </span>
              <span className="comboProductChoiceCopy">
                <strong>{product.name}</strong>
                <small>{db.categories.find((category) => category.id === product.categoryId)?.name || "Uncategorized"} · {money(product.price)}</small>
              </span>
              {product.soldOut && <b>Sold out</b>}
            </label>;
          })}
        </fieldset>

        {selectedComboProductIds.length > 0 && <div className="comboBuilderItems wide">
          <span className="adminEyebrow">Combo includes</span>
          {selectedComboProducts.map((product, index) => <div key={product.id}>
            <span>{index + 1}</span>
            <strong>{product.name}</strong>
            <b>{money(product.price)}</b>
          </div>)}
        </div>}

        <Check name="active" label="Active on website" checked={combo?.active ?? true} />
        <FormActions close={close} />
      </form>
    </ModalShell>;
  }
  const p=entity as Promotion|undefined; return <ModalShell title={p?"Edit promotion":"New promotion"} subtitle="Homepage slider content" close={close}><form onSubmit={submit} className="adminForm"><FormInput label="Headline" name="title" defaultValue={p?.title||""}/><FormInput label="Eyebrow" name="eyebrow" defaultValue={p?.eyebrow||""}/><FormInput label="Price text" name="priceText" defaultValue={p?.priceText||""}/><FormInput label="Slide order" name="order" type="number" defaultValue={String(p?.order||db.promotions.length+1)}/><FormTextarea label="Description" name="description" defaultValue={p?.description||""}/><ImageUpload kind="promotion" image={image||p?.image||""} setImage={setImage}/><Check name="active" label="Active on homepage" checked={p?.active??true}/><FormActions close={close}/></form></ModalShell>;
}
function ModalShell({title,subtitle,close,children}:{title:string;subtitle:string;close:()=>void;children:React.ReactNode}){return <div className="adminModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><div className="adminModal"><header><div><span className="adminEyebrow">{subtitle}</span><h2>{title}</h2></div><button onClick={close}>×</button></header>{children}</div></div>}
function SimpleEntityForm({title,submit,close,children}:{title:string;submit:(e:React.FormEvent<HTMLFormElement>)=>void;close:()=>void;children:React.ReactNode}){return <ModalShell title={title} subtitle="Quick setup" close={close}><form onSubmit={submit} className="adminForm compact">{children}<FormActions close={close}/></form></ModalShell>}
function FormInput({label,name,defaultValue,type="text",step,wide=false}:{label:string;name:string;defaultValue:string;type?:string;step?:string;wide?:boolean}){return <label className={wide?"wide":""}>{label}<input required name={name} type={type} step={step} defaultValue={defaultValue}/></label>}
function FormTextarea({label,name,defaultValue}:{label:string;name:string;defaultValue:string}){return <label className="wide">{label}<textarea name={name} rows={4} defaultValue={defaultValue}/></label>}
function Check({name,label,checked=false,value}:{name:string;label:string;checked?:boolean;value?:string}){return <label className="adminCheck"><input type="checkbox" name={name} value={value} defaultChecked={checked}/><span>{label}</span></label>}
function ImageUpload({image,setImage,label="Image",kind="product"}:{image:string;setImage:(v:string)=>void;label?:string;kind?:ImageKind}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setImage(await uploadAdminImage(file, kind));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  };
  const frame = imageFrames[kind];
  return <div className="adminUploadField wide"><label>{label}</label><input type="hidden" name="_imageUploading" value={uploading ? "1" : "0"}/><div className="adminUploadRow"><div className={`adminImagePreview landscape normalizedPreview ${kind === "logo" ? "logoPreview" : ""}`}>{image?<img src={image} alt="Preview"/>:<span>Upload</span>}</div><div><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>void upload(e)}/><small>{error || (uploading ? "Detecting the subject and uploading…" : `Auto-trimmed and centered to ${frame.width} × ${frame.height} WebP.`)}</small></div></div></div>;
}
function FormActions({close}:{close:()=>void}){return <div className="adminFormActions wide"><button type="button" className="adminSecondary" onClick={close}>Cancel</button><button type="submit" className="adminPrimary">Save changes</button></div>}
function AdminIcon({ name }: { name: AdminIconName }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<AdminIconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    orders: <><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 7h16"/><path d="M9 11a3 3 0 0 0 6 0"/></>,
    customers: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="2.5"/><path d="M15 16.5a5 5 0 0 1 6 3.5"/></>,
    products: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></>,
    categories: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    toppings: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></>,
    combos: <><rect x="3" y="5" width="8" height="8" rx="2"/><rect x="13" y="11" width="8" height="8" rx="2"/><path d="M11 9h3M10 15h3"/></>,
    promotions: <><path d="M20 12 12 20 4 12 12 4l8 8Z"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><path d="m9 15 6-6"/></>,
    content: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    account: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="M18 5.5a8.5 8.5 0 0 1 0 5"/></>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    logout: <><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"/><path d="m14 8 4 4-4 4M18 12H9"/></>,
    arrow: <><path d="m9 18 6-6-6-6"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
