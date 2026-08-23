"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import LaborPlanning from "@/components/admin/LaborPlanning";
import ScheduleWorkspace from "@/components/admin/ScheduleWorkspace";
import TimeOffWorkspace from "@/components/admin/TimeOffWorkspace";
import WorkforceWorkspace from "@/components/admin/WorkforceWorkspace";
import StaffReports from "@/components/admin/StaffReports";
import ReportCenter from "@/components/admin/ReportCenter";
import {
  AiBusinessInsights,
  CampaignAnalytics,
  CustomerAnalytics,
  KpiDashboard,
  ProductAnalytics,
} from "@/components/admin/BusinessIntelligence";
import ActivityLog from "@/components/admin/ActivityLog";
import ContactMessages from "@/components/admin/ContactMessages";
import GiftCards from "@/components/admin/GiftCards";
import LoyaltyPrograms from "@/components/admin/LoyaltyPrograms";
import MemberScanner from "@/components/admin/MemberScanner";
import ComboSuggestions, { type ComboSuggestionDraft } from "@/components/admin/ComboSuggestions";
import PasswordInput from "@/components/PasswordInput";
import {
  roleHasPermission,
  staffRoleLabels,
  type StaffPermission,
  type StaffRole,
  type StaffSessionSummary,
} from "@/lib/staff-permissions";
import type { CustomerOrder, OrderStatus } from "@/types";

type AdminView = "dashboard" | "orders" | "memberscan" | "messages" | "workspace" | "schedule" | "timeoff" | "reportcenter" | "kpidashboard" | "customeranalytics" | "productanalytics" | "campaignanalytics" | "aiinsights" | "labor" | "reports" | "activity" | "customers" | "loyalty" | "giftcards" | "employees" | "products" | "categories" | "toppings" | "combos" | "combosuggestions" | "promotions" | "content" | "account";
type AdminIconName = AdminView | "external" | "logout" | "arrow";
type Category = { id: string; name: string; icon: string; active: boolean };
type Topping = { id: string; name: string; price: number; active: boolean };
type Product = {
  id: string; name: string; categoryId: string; price: number; description: string; image: string; emoji: string;
  toppingIds: string[]; allowIce: boolean; allowSugar: boolean; allowToppings: boolean; bestSeller: boolean; mustTry: boolean;
  featured: boolean; isNew: boolean; soldOut: boolean; active: boolean;
};
type Combo = { id: string; name: string; description: string; price: number; productIds: string[]; image: string; active: boolean };
type Promotion = { id: string; title: string; eyebrow: string; description: string; priceText: string; image: string; order: number; active: boolean; startDate: string; endDate: string };
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
type Employee = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  hourlyRate: number;
  weeklyHours: number;
  estimatedWeeklyPay: number;
  mustChangePassword: boolean;
  createdAt: string;
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
    { id: "pr1", title: "Vietnamese Milk Coffee", eyebrow: "Morning special", description: "Available every day from 7 AM to 9 AM.", priceText: "Only $4.99", image: "", order: 1, active: true, startDate: "2026-01-01", endDate: "2026-12-31" },
    { id: "pr2", title: "Coffee & Bánh Mì", eyebrow: "Combo deal", description: "A satisfying Vietnamese pairing.", priceText: "$10.99", image: "", order: 2, active: true, startDate: "2026-01-01", endDate: "2026-12-31" },
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
  dashboard: "Dashboard", orders: "Orders", memberscan: "Scan Member", messages: "Contact Messages", workspace: "My Workspace", schedule: "Schedule", timeoff: "Time Off", reportcenter: "Report Center", kpidashboard: "KPI Dashboard", customeranalytics: "Customer Analytics", productanalytics: "Product Analytics", campaignanalytics: "Promotion & Combo Analytics", aiinsights: "AI Business Insights", labor: "Labor Planning", reports: "Staff Reports", activity: "Activity Log", customers: "Customers", loyalty: "Loyalty Programs", giftcards: "Gift Cards", employees: "Employees", products: "Products", categories: "Categories",
  toppings: "Toppings", combos: "Combos", combosuggestions: "Combo Suggestions", promotions: "Promotions", content: "Website Content", account: "My Account",
};
const adminViewOrder: AdminView[] = ["dashboard", "orders", "memberscan", "messages", "workspace", "schedule", "timeoff", "reportcenter", "kpidashboard", "customeranalytics", "productanalytics", "campaignanalytics", "aiinsights", "labor", "reports", "activity", "customers", "loyalty", "giftcards", "employees", "products", "categories", "toppings", "combos", "combosuggestions", "promotions", "content", "account"];
const viewPermissions: Partial<Record<AdminView, StaffPermission>> = {
  dashboard: "view_dashboard",
  orders: "manage_orders",
  memberscan: "manage_orders",
  messages: "manage_contacts",
  workspace: "view_own_schedule",
  schedule: "view_own_schedule",
  timeoff: "view_own_schedule",
  reportcenter: "view_sales_reports",
  kpidashboard: "view_sales_reports",
  customeranalytics: "view_sales_reports",
  productanalytics: "view_sales_reports",
  campaignanalytics: "view_sales_reports",
  aiinsights: "view_sales_reports",
  labor: "view_compensation",
  reports: "view_workforce_reports",
  activity: "view_audit_log",
  customers: "view_customers",
  giftcards: "manage_gift_cards",
  loyalty: "manage_loyalty",
  employees: "manage_staff",
  products: "manage_catalog",
  categories: "manage_catalog",
  toppings: "manage_catalog",
  combos: "manage_catalog",
  combosuggestions: "manage_catalog",
  promotions: "manage_catalog",
  content: "manage_catalog",
};

function viewsForRole(role: StaffRole) {
  return adminViewOrder.filter((adminView) => {
    const permission = viewPermissions[adminView];
    return !permission || roleHasPermission(role, permission);
  });
}

function viewsForStaff(staff: StaffSessionSummary) {
  return staff.mustChangePassword ? ["account" as const] : viewsForRole(staff.role);
}

type AdminNavGroupId = "overview" | "staff" | "planning" | "store";
type AdminNavGroup = { id: AdminNavGroupId; label: string; shortLabel: string; icon: AdminIconName; views: AdminView[] };

const adminNavGroups: AdminNavGroup[] = [
  { id: "overview", label: "Overview", shortLabel: "Overview", icon: "dashboard", views: ["dashboard", "orders", "memberscan", "messages"] },
  { id: "staff", label: "Staff & Schedule", shortLabel: "Staff", icon: "workspace", views: ["workspace", "schedule", "timeoff", "employees"] },
  { id: "planning", label: "Planning & Reports", shortLabel: "Reports", icon: "reports", views: ["reportcenter", "kpidashboard", "customeranalytics", "productanalytics", "campaignanalytics", "aiinsights", "labor", "reports", "activity"] },
  { id: "store", label: "Customers & Store", shortLabel: "Store", icon: "products", views: ["customers", "loyalty", "giftcards", "products", "categories", "toppings", "combos", "combosuggestions", "promotions", "content"] },
];

function AdminSidebarNav({
  allowedViews,
  view,
  setView,
  newOrders,
  unreadNotifications,
}: {
  allowedViews: AdminView[];
  view: AdminView;
  setView: (view: AdminView) => void;
  newOrders: number;
  unreadNotifications: number;
}) {
  const visibleGroups = useMemo(() => adminNavGroups.map((group) => ({
    ...group,
    views: group.views.filter((item) => allowedViews.includes(item)),
  })).filter((group) => group.views.length), [allowedViews]);
  const activeGroup = visibleGroups.find((group) => group.views.includes(view))?.id || null;
  const [expandedGroup, setExpandedGroup] = useState<AdminNavGroupId | null>(activeGroup);

  useEffect(() => {
    if (activeGroup) setExpandedGroup(activeGroup);
  }, [activeGroup]);

  const badgeForView = (item: AdminView) => item === "orders" ? newOrders : item === "workspace" ? unreadNotifications : 0;

  return <nav className="adminGroupedNav" aria-label="Admin navigation">
    {visibleGroups.map((group) => {
      const open = expandedGroup === group.id;
      const containsActive = group.views.includes(view);
      const badge = group.views.reduce((total, item) => total + badgeForView(item), 0);
      return <section className={`adminNavGroup ${open ? "open" : ""} ${containsActive ? "containsActive" : ""}`} key={group.id}>
        <button className="adminNavGroupButton" type="button" aria-expanded={open} aria-controls={`admin-nav-${group.id}`} onClick={() => setExpandedGroup((current) => current === group.id ? null : group.id)}>
          <span className="adminNavIcon"><AdminIcon name={group.icon} /></span>
          <span className="adminGroupLabel">{group.label}</span>
          <span className="adminGroupShortLabel">{group.shortLabel}</span>
          {badge > 0 && <b>{Math.min(99, badge)}</b>}
          <span className="adminNavChevron"><AdminIcon name="arrow" /></span>
        </button>
        {open && <div className="adminNavSub" id={`admin-nav-${group.id}`}>
          {group.views.map((item) => {
            const itemBadge = badgeForView(item);
            return <button key={item} type="button" className={view === item ? "active" : ""} onClick={() => setView(item)}>
              <span className="adminNavIcon"><AdminIcon name={item} /></span>
              <span className="adminNavLabel">{viewLabels[item]}</span>
              {itemBadge > 0 && <b>{Math.min(99, itemBadge)}</b>}
            </button>;
          })}
        </div>}
      </section>;
    })}
    {allowedViews.includes("account") && <button type="button" className={`adminNavAccount ${view === "account" ? "active" : ""}`} onClick={() => setView("account")}><span className="adminNavIcon"><AdminIcon name="account" /></span><span className="adminNavLabel">{viewLabels.account}</span></button>}
  </nav>;
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
const promotionIsLive = (promotion: Promotion) => {
  const date = new Date().toISOString().slice(0, 10);
  return promotion.active && promotion.startDate <= date && (!promotion.endDate || promotion.endDate >= date);
};
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeModal, setEmployeeModal] = useState<{ employee?: Employee } | null>(null);
  const [temporaryCredentials, setTemporaryCredentials] = useState<{ email: string; password: string } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
          const availableViews = viewsForStaff(result.staff);
          setView(availableViews[0] || "account");
          if (!result.staff.mustChangePassword && roleHasPermission(result.staff.role, "manage_orders")) void refreshCloudOrders();
          if (!result.staff.mustChangePassword && roleHasPermission(result.staff.role, "manage_catalog")) void refreshCloudCatalog();
          if (!result.staff.mustChangePassword && roleHasPermission(result.staff.role, "manage_staff")) void refreshEmployees();
        }
      })
      .catch((error) => console.error("Unable to restore admin session:", error));
  }, []);
  useEffect(() => {
    localStorage.setItem("levien-admin-v1", JSON.stringify({ ...db, orders: [] }));
    window.dispatchEvent(new Event("levien-admin-updated"));
  }, [db]);

  useEffect(() => {
    if (!staff || staff.mustChangePassword || !roleHasPermission(staff.role, "manage_orders")) return;
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
  useEffect(() => {
    if (!staff || staff.mustChangePassword || !roleHasPermission(staff.role, "view_own_schedule")) {
      setUnreadNotifications(0);
      return;
    }
    void fetch("/api/admin/workspace", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { unreadCount?: number }) => setUnreadNotifications(Number(result.unreadCount || 0)))
      .catch(() => setUnreadNotifications(0));
  }, [staff]);

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
  function createSuggestedCombo(suggestion: ComboSuggestionDraft) {
    const combo: Combo = {
      id: catalogId(),
      name: suggestion.name,
      description: suggestion.description,
      price: suggestion.suggestedPrice,
      productIds: [...suggestion.productIds],
      image: "",
      active: false,
    };
    update({ ...db, combos: [combo, ...db.combos] }, "Draft combo created · review it before publishing");
    setView("combos");
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
  async function refreshEmployees() {
    setEmployeesLoading(true);
    try {
      const response = await fetch("/api/admin/staff", { cache: "no-store" });
      if (response.status === 401) {
        setStaff(null);
        setEmployees([]);
        return;
      }
      const result = (await response.json()) as { employees?: Employee[]; error?: string };
      if (!response.ok || !result.employees) throw new Error(result.error || "Unable to load employees.");
      setEmployees(result.employees);
    } catch (error) {
      console.error("Unable to load employees:", error);
      setToast(error instanceof Error ? error.message : "Unable to load employees");
    } finally {
      setEmployeesLoading(false);
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
      const availableViews = viewsForStaff(result.staff);
      setView(availableViews[0] || "account");
      await Promise.all([
        !result.staff.mustChangePassword && roleHasPermission(result.staff.role, "manage_orders") ? refreshCloudOrders() : Promise.resolve(),
        !result.staff.mustChangePassword && roleHasPermission(result.staff.role, "manage_catalog") ? refreshCloudCatalog() : Promise.resolve(),
        !result.staff.mustChangePassword && roleHasPermission(result.staff.role, "manage_staff") ? refreshEmployees() : Promise.resolve(),
      ]);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to sign in");
    }
  }
  function logout() {
    void fetch("/api/admin/session", { method: "DELETE" });
    setStaff(null);
    setDb((current) => ({ ...current, orders: [] }));
    setEmployees([]);
    setModal(null);
    setEmployeeModal(null);
    setTemporaryCredentials(null);
    setUnreadNotifications(0);
  }
  function handlePasswordChanged() {
    if (!staff) return;
    const nextStaff = { ...staff, mustChangePassword: false };
    setStaff(nextStaff);
    if (roleHasPermission(nextStaff.role, "manage_orders")) void refreshCloudOrders();
    if (roleHasPermission(nextStaff.role, "manage_catalog")) void refreshCloudCatalog();
    if (roleHasPermission(nextStaff.role, "manage_staff")) void refreshEmployees();
  }

  if (!staff) return <AdminLogin onLogin={login} toast={toast} />;

  const allowedViews = viewsForStaff(staff);
  const canManageCatalog = !staff.mustChangePassword && roleHasPermission(staff.role, "manage_catalog");
  const canManageOrders = !staff.mustChangePassword && roleHasPermission(staff.role, "manage_orders");
  const canViewCustomers = !staff.mustChangePassword && roleHasPermission(staff.role, "view_customers");
  const canManageStaff = !staff.mustChangePassword && roleHasPermission(staff.role, "manage_staff");
  const canOpenModal = modal && (
    modal.type === "order" ? canManageOrders :
    modal.type === "customer" ? canViewCustomers : canManageCatalog
  );

  return (
    <div className="adminShellV3">
      <aside className="adminSidebarV3">
        <div className="adminBrandV3"><span className="adminLogoV3">LV</span><div><strong>LEVIEN</strong><small>ADMIN PLATFORM</small></div></div>
        <AdminSidebarNav allowedViews={allowedViews} view={view} setView={setView} newOrders={db.orders.filter((order) => order.status === "New").length} unreadNotifications={unreadNotifications} />
        <div className="adminSidebarBottom"><Link href="/"><AdminIcon name="external" /><span>View Store</span></Link><button onClick={logout}><AdminIcon name="logout" /><span>Sign out</span></button></div>
      </aside>
      <main className="adminWorkspace">
        <header className="adminTopbar"><div><span className="adminBreadcrumb">LEVIEN CAFE / {viewLabels[view]}</span><h1>{viewLabels[view]}</h1></div><div className="adminTopActions">{canManageOrders && <span className={`adminLiveBadge sync-${orderSyncStatus}`}>● {orderSyncStatus === "live" ? "Orders live" : orderSyncStatus === "polling" ? "Auto reconnecting" : "Connecting"}</span>}<span className={`adminRoleBadge role-${staff.role}`}>{staffRoleLabels[staff.role]}</span><button className="adminAvatar" title={staff.fullName}>{initials(staff.fullName)}</button></div></header>
        {view === "dashboard" && canManageCatalog && <Dashboard db={db} revenue={revenue} todayOrders={todayOrders} openView={setView} openModal={setModal} />}
        {view === "dashboard" && !canManageCatalog && canManageOrders && <OperationsDashboard db={db} todayOrders={todayOrders} openView={setView} />}
         {view === "orders" && <Orders db={db} orders={filteredOrders} filter={orderFilter} setFilter={setOrderFilter} update={update} openModal={setModal} />}
         {view === "memberscan" && <MemberScanner notify={setToast} />}
         {view === "messages" && <ContactMessages notify={setToast} />}
        {view === "workspace" && <WorkforceWorkspace staff={staff} notify={setToast} unreadChanged={setUnreadNotifications} />}
        {view === "schedule" && <ScheduleWorkspace staff={staff} notify={setToast} />}
        {view === "timeoff" && <TimeOffWorkspace staff={staff} notify={setToast} />}
        {view === "reportcenter" && <ReportCenter />}
        {view === "kpidashboard" && <KpiDashboard />}
        {view === "customeranalytics" && <CustomerAnalytics />}
        {view === "productanalytics" && <ProductAnalytics />}
        {view === "campaignanalytics" && <CampaignAnalytics />}
        {view === "aiinsights" && <AiBusinessInsights />}
        {view === "labor" && <LaborPlanning />}
        {view === "reports" && <StaffReports />}
        {view === "activity" && <ActivityLog />}
         {view === "customers" && <Customers customers={filteredCustomers} allCustomers={customers} orders={db.orders} query={customerQuery} setQuery={setCustomerQuery} openModal={setModal} />}
         {view === "loyalty" && <LoyaltyPrograms notify={setToast} />}
         {view === "giftcards" && <GiftCards notify={setToast} />}
        {view === "employees" && canManageStaff && <Employees currentStaff={staff} employees={employees} loading={employeesLoading} openEmployee={(employee) => setEmployeeModal({ employee })} refresh={refreshEmployees} showCredentials={(credentials) => setTemporaryCredentials(credentials)} notify={setToast} />}
        {view === "products" && <Products db={db} products={filteredProducts} query={query} setQuery={setQuery} openModal={setModal} update={update} />}
        {view === "categories" && <Categories db={db} openModal={setModal} update={update} />}
        {view === "toppings" && <Toppings db={db} openModal={setModal} update={update} />}
        {view === "combos" && <Combos db={db} openModal={setModal} update={update} />}
        {view === "combosuggestions" && <ComboSuggestions products={db.products} combos={db.combos} orders={db.orders} createDraft={createSuggestedCombo} />}
        {view === "promotions" && <Promotions db={db} openModal={setModal} update={update} />}
        {view === "content" && <WebsiteContent db={db} openModal={setModal} />}
        {view === "account" && <StaffAccount staff={staff} passwordChanged={handlePasswordChanged} />}
      </main>
      {modal && canOpenModal && <AdminModal modal={modal} db={db} close={() => setModal(null)} update={update} />}
      {employeeModal && canManageStaff && <EmployeeModal currentStaff={staff} employee={employeeModal.employee} close={() => setEmployeeModal(null)} saved={(employee, password) => { setEmployees((current) => { const exists = current.some((item) => item.id === employee.id); return exists ? current.map((item) => item.id === employee.id ? employee : item) : [...current, employee].sort((left, right) => left.fullName.localeCompare(right.fullName)); }); setEmployeeModal(null); setToast(employeeModal.employee ? "Employee updated" : "Employee account created"); if (password) setTemporaryCredentials({ email: employee.email, password }); }} />}
      {temporaryCredentials && <TemporaryCredentials credentials={temporaryCredentials} close={() => setTemporaryCredentials(null)} />}
      {toast && <div className="adminToast">✓ {toast}</div>}
    </div>
  );
}

function AdminLogin({ onLogin, toast }: { onLogin: (e: React.FormEvent<HTMLFormElement>) => void; toast: string }) {
  return <div className="adminLoginPage"><div className="adminLoginVisual"><span>LEVIEN CAFE</span><h1>Your café,<br/>beautifully managed.</h1><p>Orders, store content and staff operations in one role-protected workspace.</p></div><form className="adminLoginCard" onSubmit={onLogin}><div className="adminLoginLogo">LV</div><span className="adminEyebrow">Staff workspace</span><h2>Welcome back</h2><p>Sign in with your staff email. The legacy Owner username remains available during migration.</p><label>Email or legacy username<input name="username" defaultValue="admin" autoComplete="username" /></label><label>Password<PasswordInput name="password" autoComplete="current-password" required /></label><button className="adminPrimary" type="submit">Sign in</button><small>Identity and permissions are verified securely by the server.</small>{toast && <div className="adminLoginError">{toast}</div>}</form></div>;
}

function Dashboard({ db, revenue, todayOrders, openView, openModal }: { db: DB; revenue: number; todayOrders: Order[]; openView: (v: AdminView) => void; openModal: (m: { type: string; id?: string }) => void }) {
  return <div className="adminStack"><section className="adminWelcome"><div><span>Good morning</span><h2>Here’s what’s happening at LEVIEN today.</h2></div><button className="adminPrimary" onClick={() => openModal({ type: "product" })}>New product</button></section><section className="adminMetrics"><Metric label="Orders today" value={String(todayOrders.length)} detail={`${db.orders.filter(o => o.status === "New").length} waiting`} /><Metric label="Revenue today" value={money(revenue)} detail="Demo order totals" /><Metric label="Active products" value={String(db.products.filter(p => p.active).length)} detail={`${db.products.filter(p => p.soldOut).length} sold out`} /><Metric label="Live promotions" value={String(db.promotions.filter(promotionIsLive).length)} detail="Homepage slider" /></section><div className="adminDashboardGrid"><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Live queue</span><h3>Recent orders</h3></div><button className="adminTextButton" onClick={() => openView("orders")}>View all →</button></div><OrderRows orders={db.orders.slice(0, 4)} /></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Quick actions</span><h3>Manage your store</h3></div></div><div className="quickActionGrid"><QuickAction icon="products" title="Add product" text="Create a new menu item." onClick={() => openModal({ type: "product" })}/><QuickAction icon="promotions" title="New promotion" text="Add a homepage slide." onClick={() => openModal({ type: "promotion" })}/><QuickAction icon="toppings" title="Add topping" text="Create an add-on option." onClick={() => openModal({ type: "topping" })}/><QuickAction icon="content" title="Website content" text="Update logo and story." onClick={() => openView("content")}/></div></section></div></div>;
}
function OperationsDashboard({ db, todayOrders, openView }: { db: DB; todayOrders: Order[]; openView: (view: AdminView) => void }) {
  return <div className="adminStack"><section className="adminWelcome"><div><span>Operations workspace</span><h2>Keep today’s order queue moving.</h2></div><button className="adminPrimary" onClick={() => openView("orders")}>Open orders</button></section><section className="adminMetrics"><Metric label="Orders today" value={String(todayOrders.length)} detail="Published online orders"/><Metric label="Waiting" value={String(db.orders.filter((order) => order.status === "New").length)} detail="Need confirmation"/><Metric label="Preparing" value={String(db.orders.filter((order) => order.status === "Preparing").length)} detail="In progress"/><Metric label="Ready" value={String(db.orders.filter((order) => order.status === "Ready").length)} detail="Ready for handoff"/></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Live queue</span><h3>Recent orders</h3></div><button className="adminTextButton" onClick={() => openView("orders")}>View all →</button></div><OrderRows orders={db.orders.slice(0, 6)} /></section></div>;
}
function StaffAccount({ staff, passwordChanged }: { staff: StaffSessionSummary; passwordChanged: () => void }) {
  const accessSummary: Record<StaffRole, string> = {
    owner: "Full store, staff, schedule, and compensation access.",
    manager: "Store, staff, schedule, and compensation management access.",
    supervisor: "Order operations and personal schedule access.",
    staff: "Operations dashboard, order management, and personal schedule access.",
  };
  return <div className="adminAccountGrid"><section className="adminCard adminProfileCard"><div className="adminProfileAvatar">{initials(staff.fullName)}</div><span className="adminEyebrow">Authenticated staff account</span><h2>{staff.fullName}</h2><p>{staff.email}</p><span className={`adminRoleBadge role-${staff.role}`}>{staffRoleLabels[staff.role]}</span></section><section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Access level</span><h3>{staffRoleLabels[staff.role]} permissions</h3></div></div><p className="adminAccessCopy">{accessSummary[staff.role]}</p><div className="adminSecurityNote"><strong>Protected server-side</strong><span>Navigation and every Admin API request are checked against this role. Payroll fields are not part of staff session data.</span></div>{staff.legacy && <div className="adminLegacyNotice"><strong>Legacy Owner session</strong><span>Create the first Supabase Auth Owner account before removing the legacy Admin environment credentials.</span></div>}</section>{!staff.legacy && <PasswordChangeForm required={staff.mustChangePassword} changed={passwordChanged}/>}<section className="adminCard adminSchedulePreview"><span className="adminEyebrow">Available now</span><h3>Shift registration and work schedule</h3><p>Open Schedule to register preferred shifts or review your published weekly schedule.</p></section></div>;
}
function PasswordChangeForm({ required, changed }: { required: boolean; changed: () => void }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmation = String(form.get("confirmation") || "");
    setError("");
    setMessage("");
    if (newPassword !== confirmation) return setError("New passwords do not match.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to change password.");
      formElement.reset();
      setMessage("Password changed successfully.");
      changed();
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Unable to change password.");
    } finally {
      setSaving(false);
    }
  }
  return <section className={`adminCard adminPasswordCard ${required ? "required" : ""}`}>{required && <div className="adminPasswordRequired"><strong>Password change required</strong><span>Use the temporary password as your current password before accessing the rest of the workspace.</span></div>}<div className="adminCardHead"><div><span className="adminEyebrow">Account security</span><h3>Change password</h3></div></div><form className="adminPasswordForm" onSubmit={submit}><label>Current password<PasswordInput name="currentPassword" autoComplete="current-password" required/></label><label>New password<PasswordInput name="newPassword" autoComplete="new-password" minLength={8} required/></label><label>Confirm new password<PasswordInput name="confirmation" autoComplete="new-password" minLength={8} required/></label><small>Minimum 8 characters with uppercase, lowercase, number, and symbol.</small>{error && <div className="adminLoginError">{error}</div>}{message && <div className="adminFormSuccess">{message}</div>}<button className="adminPrimary" type="submit" disabled={saving}>{saving ? "Changing…" : "Change password"}</button></form></section>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="adminMetric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function QuickAction({ icon, title, text, onClick }: { icon: AdminIconName; title: string; text: string; onClick: () => void }) { return <button className="adminQuickAction" onClick={onClick}><span><AdminIcon name={icon} /></span><div><strong>{title}</strong><small>{text}</small></div><b><AdminIcon name="arrow" /></b></button>; }

function Orders({ db, orders, filter, setFilter, update, openModal }: { db: DB; orders: Order[]; filter: "All" | OrderStatus; setFilter: (v: "All" | OrderStatus) => void; update: (d: DB, m?: string) => void; openModal: (m: { type: string; id?: string }) => void }) {
  const statuses: ("All" | OrderStatus)[] = ["All", "Pending Payment", "New", "Preparing", "Ready", "Completed", "Cancelled"];

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
      const result = (await response.json()) as { error?: string; giftCardRefund?: number };
      if (!response.ok) throw new Error(result.error || "Unable to update order.");
      if (result.giftCardRefund && result.giftCardRefund > 0) {
        update(
          { ...db, orders: nextOrders },
          `Order ${orderId} cancelled · ${money(result.giftCardRefund)} returned to Gift Card`,
        );
      }
    } catch (error) {
      update({ ...db, orders: previousOrders }, error instanceof Error ? error.message : "Unable to update order");
    }
  }

  return <div className="adminStack">
    <section className="adminToolbar">
      <div className="adminTabs">{statuses.map(s => <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>{s}<span>{s === "All" ? db.orders.length : db.orders.filter(o => o.status === s).length}</span></button>)}</div>
      <Link className="adminSecondary orderDisplayAdminLink" href="/order-display" target="_blank" rel="noopener noreferrer">Open TV Display ↗</Link>
    </section>
    <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Online ordering</span><h3>Order queue</h3></div><span className="adminHint">Paid online orders enter the queue only after Stripe confirms payment</span></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><strong>{o.id}</strong><small>{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></td><td><strong>{o.customer}</strong><small>{o.phone}</small></td><td>{o.type}</td><td><strong>{money(o.total)}</strong><small>{o.paymentStatus || "unpaid"}</small></td><td><select className={`orderStatusSelect status-${o.status.toLowerCase()}`} value={o.status} onChange={e => void changeOrderStatus(o.id, e.target.value as OrderStatus)}>{(o.status === "Pending Payment" ? ["Pending Payment", "Cancelled"] : ["New", "Preparing", "Ready", "Completed", "Cancelled"]).map(s => <option key={s}>{s}</option>)}</select></td><td><button className="adminIconAction" onClick={() => openModal({ type: "order", id: o.id })}>View</button></td></tr>)}</tbody></table></div></section>
  </div>;
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

function Employees({ currentStaff, employees, loading, openEmployee, refresh, showCredentials, notify }: {
  currentStaff: StaffSessionSummary;
  employees: Employee[];
  loading: boolean;
  openEmployee: (employee?: Employee) => void;
  refresh: () => Promise<void>;
  showCredentials: (credentials: { email: string; password: string }) => void;
  notify: (message: string) => void;
}) {
  const [actionId, setActionId] = useState("");
  const activeEmployees = employees.filter((employee) => employee.active);
  const weeklyHours = activeEmployees.reduce((total, employee) => total + employee.weeklyHours, 0);
  const weeklyPayroll = activeEmployees.reduce((total, employee) => total + employee.estimatedWeeklyPay, 0);

  function canManage(employee: Employee) {
    return currentStaff.role === "owner" || employee.role !== "owner";
  }

  async function patchEmployee(employee: Employee, body: Record<string, unknown>) {
    setActionId(employee.id);
    try {
      const response = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: employee.id, ...body }),
      });
      const result = (await response.json()) as { error?: string; temporaryPassword?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update employee.");
      if (result.temporaryPassword) showCredentials({ email: employee.email, password: result.temporaryPassword });
      await refresh();
      return result;
    } finally {
      setActionId("");
    }
  }

  async function toggleEmployee(employee: Employee) {
    try {
      await patchEmployee(employee, {
        fullName: employee.fullName,
        phone: employee.phone,
        role: employee.role,
        active: !employee.active,
        hourlyRate: employee.hourlyRate,
        weeklyHours: employee.weeklyHours,
      });
      notify(employee.active ? "Employee account locked" : "Employee account activated");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update employee");
    }
  }

  async function resetPassword(employee: Employee) {
    if (!window.confirm(`Create a new temporary password for ${employee.fullName}?`)) return;
    try {
      await patchEmployee(employee, { action: "reset_password" });
      notify("Temporary password created");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to reset password");
    }
  }

  return <div className="adminStack employeeWorkspace">
    <section className="adminWelcome employeeWelcome">
      <div><span>Private workforce data</span><h2>Manage employee access and compensation.</h2><p>Only Owner and Manager accounts can open this workspace.</p></div>
      <button className="adminPrimary" type="button" onClick={() => openEmployee()}>＋ Add employee</button>
    </section>
    <section className="employeeMetrics">
      <Metric label="Active employees" value={String(activeEmployees.length)} detail={`${employees.length - activeEmployees.length} locked`} />
      <Metric label="Managers" value={String(activeEmployees.filter((employee) => employee.role === "owner" || employee.role === "manager").length)} detail="Owner and Manager" />
      <Metric label="Weekly hours" value={weeklyHours.toFixed(1)} detail="Planned active hours" />
      <Metric label="Weekly payroll" value={money(weeklyPayroll)} detail="Estimated before taxes" />
    </section>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Employee directory</span><h3>{employees.length} staff accounts</h3></div><button className="adminTextButton" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      <div className="adminTableWrap"><table className="adminTable employeeTable"><thead><tr><th>Employee</th><th>Role</th><th>Hours / week</th><th>Hourly pay</th><th>Weekly pay</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {employees.map((employee) => {
          const manageable = canManage(employee);
          const isSelf = employee.id === currentStaff.id;
          const busy = actionId === employee.id;
          return <tr key={employee.id}>
            <td><div className="adminEmployeeIdentity"><span className="adminEmployeeAvatar">{initials(employee.fullName)}</span><div><strong>{employee.fullName}{isSelf ? " (You)" : ""}</strong><small>{employee.email}{employee.phone ? ` · ${employee.phone}` : ""}</small></div></div></td>
            <td><span className={`adminRoleBadge role-${employee.role}`}>{staffRoleLabels[employee.role]}</span></td>
            <td><strong>{employee.weeklyHours.toFixed(1)}</strong></td>
            <td><strong>{money(employee.hourlyRate)}</strong></td>
            <td><strong>{money(employee.estimatedWeeklyPay)}</strong></td>
            <td><span className={employee.active ? "adminState live" : "adminState sold"}>{employee.active ? (employee.mustChangePassword ? "Password pending" : "Active") : "Locked"}</span></td>
            <td><div className="adminEmployeeActions">
              {manageable ? <>
                <button type="button" onClick={() => openEmployee(employee)} disabled={busy}>Edit</button>
                <button type="button" onClick={() => void resetPassword(employee)} disabled={busy || isSelf}>Reset password</button>
                <button type="button" className={employee.active ? "danger" : ""} onClick={() => void toggleEmployee(employee)} disabled={busy || isSelf}>{employee.active ? "Lock" : "Activate"}</button>
              </> : <span className="adminHint">Owner only</span>}
            </div></td>
          </tr>;
        })}
        {!employees.length && <tr><td colSpan={7}><div className="customerEmpty"><strong>{loading ? "Loading employees…" : "No employees found"}</strong><span>{loading ? "Securely reading staff profiles and compensation." : "Add the first employee account to begin."}</span></div></td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function EmployeeModal({ currentStaff, employee, close, saved }: {
  currentStaff: StaffSessionSummary;
  employee?: Employee;
  close: () => void;
  saved: (employee: Employee, password?: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isSelf = employee?.id === currentStaff.id;
  const roles: StaffRole[] = currentStaff.role === "owner" ? ["owner", "manager", "supervisor", "staff"] : ["manager", "supervisor", "staff"];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const body = {
        ...(employee ? { id: employee.id } : {}),
        fullName: String(form.get("fullName") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        role: String(form.get("role") || "staff"),
        active: employee ? form.get("active") === "on" : true,
        hourlyRate: Number(form.get("hourlyRate") || 0),
        weeklyHours: Number(form.get("weeklyHours") || 0),
      };
      const response = await fetch("/api/admin/staff", {
        method: employee ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { employee?: Employee; temporaryPassword?: string; error?: string };
      if (!response.ok || !result.employee) throw new Error(result.error || "Unable to save employee.");
      saved(result.employee, result.temporaryPassword);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save employee.");
    } finally {
      setSaving(false);
    }
  }

  return <ModalShell title={employee ? "Edit employee" : "Add employee"} subtitle={employee ? "Account, role and compensation" : "Create a secure staff login"} close={close}>
    <form className="adminForm employeeForm" onSubmit={submit}>
      <label>Full name<input name="fullName" defaultValue={employee?.fullName || ""} maxLength={120} required /></label>
      <label>Email<input name="email" type="email" defaultValue={employee?.email || ""} readOnly={Boolean(employee)} required /></label>
      <label>Phone<input name="phone" type="tel" defaultValue={employee?.phone || ""} maxLength={40} /></label>
      <label>Role<select name="role" defaultValue={employee?.role || "staff"} disabled={isSelf}>{roles.map((role) => <option value={role} key={role}>{staffRoleLabels[role]}</option>)}</select>{isSelf && <input type="hidden" name="role" value={employee?.role}/>}</label>
      <label>Hourly pay (USD)<input name="hourlyRate" type="number" min="0" max="10000" step="0.01" defaultValue={String(employee?.hourlyRate ?? 0)} required /></label>
      <label>Planned hours / week<input name="weeklyHours" type="number" min="0" max="168" step="0.25" defaultValue={String(employee?.weeklyHours ?? 0)} required /></label>
      {employee && <label className="adminCheck wide"><input name="active" type="checkbox" defaultChecked={employee.active} disabled={isSelf}/><span>Account active{isSelf ? " (you cannot lock your own account)" : ""}</span>{isSelf && employee.active && <input type="hidden" name="active" value="on"/>}</label>}
      {!employee && <div className="adminEmployeeCreationNote wide"><strong>A temporary password will be generated.</strong><span>It is displayed once after saving. The employee must replace it at first login.</span></div>}
      {error && <div className="adminLoginError wide">{error}</div>}
      <div className="adminFormActions wide"><button type="button" className="adminSecondary" onClick={close} disabled={saving}>Cancel</button><button type="submit" className="adminPrimary" disabled={saving}>{saving ? "Saving…" : employee ? "Save employee" : "Create account"}</button></div>
    </form>
  </ModalShell>;
}

function TemporaryCredentials({ credentials, close }: { credentials: { email: string; password: string }; close: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(`Email: ${credentials.email}\nTemporary password: ${credentials.password}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return <ModalShell title="Temporary login" subtitle="Show this information to the employee once" close={close}>
    <div className="adminCredentials">
      <div className="adminCredentialWarning"><strong>Copy before closing</strong><span>This temporary password is not stored in readable form and cannot be shown again.</span></div>
      <label>Email<span className="adminCredentialValue">{credentials.email}</span></label>
      <label>Temporary password<span className="adminCredentialValue password">{credentials.password}</span></label>
      <p>The employee will only see My Account until they replace this password.</p>
      <div className="adminFormActions"><button type="button" className="adminSecondary" onClick={() => void copyCredentials()}>{copied ? "✓ Copied" : "Copy credentials"}</button><button type="button" className="adminPrimary" onClick={close}>Done</button></div>
    </div>
  </ModalShell>;
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
function Promotions({ db, openModal, update }: { db: DB; openModal: (m: { type: string; id?: string }) => void; update: (d: DB, m?: string) => void }) { return <EntityPage title="Promotion slider" eyebrow="Homepage campaigns" button="New promotion" onAdd={() => openModal({ type: "promotion" })}>{[...db.promotions].sort((a,b)=>a.order-b.order).map(p => <EntityRow key={p.id} icon="▣" title={p.title} subtitle={`${p.eyebrow} · Slide ${p.order} · ${p.startDate} → ${p.endDate} · ${p.priceText}`} active={promotionIsLive(p)} edit={() => openModal({ type: "promotion", id: p.id })} toggle={() => update({ ...db, promotions: db.promotions.map(x => x.id === p.id ? { ...x, active: !x.active } : x) })}/>)}</EntityPage>; }
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
    if(modal.type==="promotion") { const old=entity as Promotion|undefined; const startDate=String(f.get("startDate")); const endDate=String(f.get("endDate")); if(endDate<startDate){update(db,"Promotion end date must be on or after its start date");return;} const item:Promotion={id:old?.id||catalogId(),title:String(f.get("title")),eyebrow:String(f.get("eyebrow")),description:String(f.get("description")),priceText:String(f.get("priceText")),order:Number(f.get("order")),image:image||old?.image||"",active:f.get("active")==="on",startDate,endDate}; update({...db,promotions:old?db.promotions.map(x=>x.id===old.id?item:x):[...db.promotions,item]},"Promotion saved"); }
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
  if(modal.type==="order") { const o=entity as Order; return <ModalShell title={o.id} subtitle="Order details" close={close}><div className="orderDetailHeader"><div><strong>{o.customer}</strong><span>{o.phone} · {o.type}</span></div><b>{money(o.total)}</b></div><div className="orderItemList">{o.items.map(i=><div className={i.itemType === "combo" ? "adminComboOrderItem" : ""} key={i.lineId}><strong>{i.quantity} × {i.name}</strong>{i.itemType === "combo" && i.comboItems?.length ? <div className="adminComboChildren">{i.comboItems.map(child=><span key={child.productId}><b>{child.emoji} {child.name}</b><small>{comboChildOptions(child)}</small></span>)}</div> : <small>{orderItemOptions(i)}</small>}<b>{money(i.unitPrice * i.quantity)}</b></div>)}</div><div className="adminOrderMeta"><span><b>Payment</b>{o.payment}</span>{Boolean(o.giftCardAmount) && <span><b>Gift Card</b>{money(o.giftCardAmount || 0)} applied · {money(o.amountDue ?? Math.max(0, o.total - (o.giftCardAmount || 0)))} due</span>}{o.pickupTime && <span><b>Pickup time</b>{o.pickupTime}</span>}{o.address && <span><b>Delivery address</b>{[o.address,o.apartment,o.city,o.zip].filter(Boolean).join(", ")}</span>}</div><div className="adminNote"><strong>Customer note</strong><p>{o.note||"No special note."}</p></div></ModalShell>; }
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
  const p=entity as Promotion|undefined; const date=new Date().toISOString().slice(0,10); return <ModalShell title={p?"Edit promotion":"New promotion"} subtitle="Homepage slider content" close={close}><form onSubmit={submit} className="adminForm"><FormInput label="Headline" name="title" defaultValue={p?.title||""}/><FormInput label="Eyebrow" name="eyebrow" defaultValue={p?.eyebrow||""}/><FormInput label="Price text" name="priceText" defaultValue={p?.priceText||""}/><FormInput label="Slide order" name="order" type="number" defaultValue={String(p?.order||db.promotions.length+1)}/><FormInput label="Start date" name="startDate" type="date" defaultValue={p?.startDate||date}/><FormInput label="End date" name="endDate" type="date" defaultValue={p?.endDate||date}/><FormTextarea label="Description" name="description" defaultValue={p?.description||""}/><ImageUpload kind="promotion" image={image||p?.image||""} setImage={setImage}/><Check name="active" label="Active within this date range" checked={p?.active??true}/><FormActions close={close}/></form></ModalShell>;
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
    memberscan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 10v4M10 9v6M13 10v4M16 9v6"/></>,
    messages: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></>,
    workspace: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/><path d="M7 13h4M7 17h7"/><circle cx="17" cy="15" r="2.5"/></>,
    timeoff: <><path d="M4 5h16v15H4z"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="m9 15 2 2 4-5"/></>,
    reportcenter: <><path d="M4 20V10M10 20V6M16 20v-8M22 20V3"/><path d="M2 20h22"/><path d="m4 7 6-3 6 5 6-8"/></>,
    kpidashboard: <><path d="M4 20V12M10 20V7M16 20v-5M22 20V3"/><path d="M2 20h20"/><path d="m4 9 6-5 6 7 6-9"/></>,
    customeranalytics: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 19v-5M19 19v-8M22 19v-3"/></>,
    productanalytics: <><path d="M3 20h18M5 17V9M10 17V4M15 17v-6M20 17V7"/><path d="m5 6 5-4 5 6 5-4"/></>,
    campaignanalytics: <><path d="M20 12 12 20 4 12 12 4l8 8Z"/><path d="M8 17 17 8"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/></>,
    aiinsights: <><path d="m12 3 1.8 4.7L19 9.5l-5.2 1.8L12 16l-1.8-4.7L5 9.5l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/><path d="M4 15v6M1 18h6"/></>,
    labor: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/><path d="M2 20h20"/><path d="m4 7 6-4 6 7 6-5"/></>,
    reports: <><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/><path d="M16 17h2"/></>,
    activity: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M5 4 3 6M19 4l2 2"/></>,
    customers: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="10" r="2.5"/><path d="M15 16.5a5 5 0 0 1 6 3.5"/></>,
    loyalty: <><path d="M12 3 9.6 8l-5.5.8 4 3.9-.9 5.5 4.8-2.6 4.8 2.6-.9-5.5 4-3.9-5.5-.8L12 3Z"/><circle cx="12" cy="11.5" r="2.2"/></>,
    giftcards: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M12 7v14M3 12h18"/><path d="M12 7H8.5a2.5 2.5 0 1 1 2.5-2.5V7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5V7Z"/></>,
    employees: <><circle cx="9" cy="7" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M17 8v6M14 11h6"/><path d="M16 17h5v4h-5z"/></>,
    products: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></>,
    categories: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    toppings: <><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></>,
    combos: <><rect x="3" y="5" width="8" height="8" rx="2"/><rect x="13" y="11" width="8" height="8" rx="2"/><path d="M11 9h3M10 15h3"/></>,
    combosuggestions: <><path d="m12 3 1.7 4.2L18 9l-4.3 1.8L12 15l-1.7-4.2L6 9l4.3-1.8L12 3Z"/><path d="m18 14 .9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z"/><path d="M4 14v6M2 17h4"/></>,
    promotions: <><path d="M20 12 12 20 4 12 12 4l8 8Z"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><path d="m9 15 6-6"/></>,
    content: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    account: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/><path d="M18 5.5a8.5 8.5 0 0 1 0 5"/></>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    logout: <><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"/><path d="m14 8 4 4-4 4M18 12H9"/></>,
    arrow: <><path d="m9 18 6-6-6-6"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
