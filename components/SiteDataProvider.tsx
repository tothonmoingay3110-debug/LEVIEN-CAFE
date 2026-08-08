"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { products as fallbackProducts, promotions as fallbackPromotions } from "@/lib/data";
import { readSupabaseCatalog, type SupabaseCatalog } from "@/lib/supabase/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Combo, Product, Promotion } from "@/types";

type SiteContent = {
  storeName: string;
  tagline: string;
  logo: string;
  announcement: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  mapUrl: string;
  footerText: string;
};

type SiteCategory = { id: string; name: string; icon: string; active: boolean };
type SiteTopping = { id: string; name: string; price: number; active: boolean };

type AdminDB = {
  categories?: SiteCategory[];
  toppings?: SiteTopping[];
  products?: Array<{
    id: string; name: string; categoryId: string; price: number; description: string; image: string; emoji: string;
    toppingIds: string[]; allowIce?: boolean; allowSugar?: boolean; allowToppings?: boolean;
    bestSeller: boolean; mustTry: boolean; featured: boolean; isNew: boolean; soldOut: boolean; active: boolean;
  }>;
  combos?: Combo[];
  promotions?: Array<Promotion & { order?: number; active?: boolean }>;
  content?: Partial<SiteContent>;
};

const defaults: SiteContent = {
  storeName: "LEVIEN CAFE",
  tagline: "CAFE & EATERY",
  logo: "",
  announcement: "Fresh Vietnamese coffee & bánh mì every day",
  aboutTitle: "Vietnamese soul, made for the neighborhood.",
  aboutText: "LEVIEN CAFE brings together bold Vietnamese coffee, handcrafted drinks and fresh comfort food in a warm, modern space.",
  aboutImage: "",
  address: "600 Washington Ave Unit 18C, Philadelphia, PA",
  phone: "+1 215-305-4047",
  email: "hello@leviencafe.com",
  hours: "Open daily • 7 AM – 9 PM",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=600+Washington+Ave+Unit+18C+Philadelphia",
  footerText: "Made with care in Philadelphia",
};

type SiteDataContextValue = {
  content: SiteContent;
  products: Product[];
  promotions: Promotion[];
  categories: SiteCategory[];
  combos: Combo[];
  ready: boolean;
  source: "supabase" | "local" | "fallback";
  refresh: () => Promise<void>;
};

const SiteDataContext = createContext<SiteDataContextValue | null>(null);

function loadLocalSiteData() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("levien-admin-v1");
    return raw ? (JSON.parse(raw) as AdminDB) : null;
  } catch {
    return null;
  }
}

function localCatalog(db: AdminDB | null): SupabaseCatalog | null {
  if (!db) return null;
  const categories = (db.categories || []).filter((item) => item.active !== false);
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
  const activeToppings = (db.toppings || []).filter((item) => item.active !== false);
  const toppingMap = new Map(activeToppings.map((item) => [item.id, item]));
  const products = db.products?.length ? db.products.filter((item) => item.active !== false).map<Product>((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    category: categoryMap.get(item.categoryId) || "Other",
    image: item.image || "",
    emoji: item.emoji || "☕",
    badges: [item.bestSeller ? "best-seller" : null, item.mustTry ? "must-try" : null, item.featured ? "featured" : null, item.isNew ? "new" : null].filter(Boolean) as Product["badges"],
    soldOut: item.soldOut,
    allowIce: item.allowIce ?? true,
    allowSugar: item.allowSugar ?? true,
    allowToppings: item.allowToppings ?? (item.toppingIds || []).length > 0,
    toppings: (item.toppingIds || []).map((id) => toppingMap.get(id)).filter(Boolean).map((topping) => ({ id: topping!.id, name: topping!.name, price: Number(topping!.price) })),
  })) : [];
  const promotions = db.promotions?.length
    ? db.promotions.filter((item) => item.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)).map(({ order: _order, active: _active, ...item }) => item)
    : [];
  return {
    content: db.content || {},
    categories,
    toppings: activeToppings,
    products,
    combos: (db.combos || []).filter((item) => item.active !== false),
    promotions,
  };
}

const fallbackCategories: SiteCategory[] = [
  { id: "c1", name: "Vietnamese Coffee", icon: "☕", active: true },
  { id: "c2", name: "Milk Tea", icon: "🧋", active: true },
  { id: "c3", name: "Smoothies", icon: "🥤", active: true },
  { id: "c4", name: "Bánh Mì", icon: "🥖", active: true },
  { id: "c5", name: "Chicken & More", icon: "🍗", active: true },
];
const fallbackCombos: Combo[] = [{
  id: "combo-breakfast",
  name: "Coffee & Bánh Mì Combo",
  description: "Vietnamese milk coffee paired with a fresh grilled pork bánh mì.",
  price: 10.99,
  productIds: ["1", "7"],
  image: "",
  active: true,
}];

export function SiteDataProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<SupabaseCatalog | null>(null);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<SiteDataContextValue["source"]>("fallback");

  const refresh = useCallback(async () => {
    try {
      const cloud = await readSupabaseCatalog();
      if (cloud) {
        setCatalog(cloud);
        setSource("supabase");
        return;
      }
    } catch (error) {
      console.warn("Unable to load Supabase catalog:", error);
    } finally {
      setReady(true);
    }

    const local = localCatalog(loadLocalSiteData());
    if (local?.products.length) {
      setCatalog(local);
      setSource("local");
    } else {
      setCatalog(null);
      setSource("fallback");
    }
  }, []);

  useEffect(() => {
    void refresh();

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 300);
    };
    let unsubscribeRealtime = () => {};
    try {
      const supabase = createClient();
      const channel = [
        "site_content", "categories", "toppings", "products",
        "product_toppings", "combos", "combo_products", "promotions",
      ].reduce(
        (current, table) => current.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          scheduleRefresh,
        ),
        supabase.channel("storefront-catalog-sync"),
      ).subscribe();
      unsubscribeRealtime = () => void supabase.removeChannel(channel);
    } catch (error) {
      console.warn("Unable to start Supabase catalog sync:", error);
    }

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "levien-admin-v1") scheduleRefresh();
    };
    const onCustom = () => scheduleRefresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("levien-admin-updated", onCustom);
    window.addEventListener("online", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("levien-admin-updated", onCustom);
      window.removeEventListener("online", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribeRealtime();
    };
  }, [refresh]);

  const value = useMemo<SiteDataContextValue>(() => ({
    content: { ...defaults, ...(catalog?.content || {}) },
    products: catalog?.products.length ? catalog.products : fallbackProducts,
    promotions: catalog?.promotions.length ? catalog.promotions : fallbackPromotions,
    categories: catalog?.categories.length ? catalog.categories : fallbackCategories,
    combos: catalog?.combos.length ? catalog.combos : fallbackCombos,
    ready,
    source,
    refresh,
  }), [catalog, ready, source]);

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  const value = useContext(SiteDataContext);
  if (!value) throw new Error("useSiteData must be used inside SiteDataProvider");
  return value;
}
