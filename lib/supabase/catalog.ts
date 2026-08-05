import { createClient } from "@/lib/supabase/client";
import type { Combo, Product, Promotion } from "@/types";

export type CatalogCategory = {
  id: string;
  name: string;
  icon: string;
  active: boolean;
};

export type CatalogTopping = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

export type CatalogContent = {
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

export type SupabaseCatalog = {
  content: Partial<CatalogContent>;
  categories: CatalogCategory[];
  toppings: CatalogTopping[];
  products: Product[];
  combos: Combo[];
  promotions: Promotion[];
};

type Row = Record<string, unknown>;

const numberValue = (value: unknown) => Number(value ?? 0);
const stringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

export async function readSupabaseCatalog(): Promise<SupabaseCatalog | null> {
  const supabase = createClient();

  const [contentResult, categoryResult, toppingResult, productResult, productToppingResult, comboResult, comboProductResult, promotionResult] = await Promise.all([
    supabase.from("site_content").select("*").eq("singleton_key", "main").maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("toppings").select("*").order("name"),
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("product_toppings").select("product_id,topping_id"),
    supabase.from("combos").select("*").order("sort_order"),
    supabase.from("combo_products").select("combo_id,product_id,position").order("position"),
    supabase.from("promotions").select("*").order("sort_order"),
  ]);

  const firstError = [contentResult, categoryResult, toppingResult, productResult, productToppingResult, comboResult, comboProductResult, promotionResult]
    .map((result) => result.error)
    .find(Boolean);

  if (firstError) {
    console.warn("Supabase catalog fallback:", firstError.message);
    return null;
  }

  const categories = ((categoryResult.data || []) as Row[]).map((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name),
    icon: stringValue(row.icon, "☕"),
    active: row.active !== false,
  }));

  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

  const toppings = ((toppingResult.data || []) as Row[]).map((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name),
    price: numberValue(row.price),
    active: row.active !== false,
  }));
  const toppingMap = new Map(toppings.map((topping) => [topping.id, topping]));

  const toppingIdsByProduct = new Map<string, string[]>();
  ((productToppingResult.data || []) as Row[]).forEach((row) => {
    const productId = stringValue(row.product_id);
    const toppingId = stringValue(row.topping_id);
    toppingIdsByProduct.set(productId, [...(toppingIdsByProduct.get(productId) || []), toppingId]);
  });

  const products = ((productResult.data || []) as Row[]).map<Product>((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name),
    description: stringValue(row.description),
    price: numberValue(row.price),
    category: categoryMap.get(stringValue(row.category_id)) || "Other",
    image: stringValue(row.image_url),
    emoji: stringValue(row.emoji, "☕"),
    badges: [
      row.best_seller ? "best-seller" : null,
      row.must_try ? "must-try" : null,
      row.featured ? "featured" : null,
      row.is_new ? "new" : null,
    ].filter(Boolean) as Product["badges"],
    soldOut: Boolean(row.sold_out),
    allowIce: row.allow_ice !== false,
    allowSugar: row.allow_sugar !== false,
    allowToppings: Boolean(row.allow_toppings),
    toppings: (toppingIdsByProduct.get(stringValue(row.id)) || [])
      .map((id) => toppingMap.get(id))
      .filter((item): item is CatalogTopping => Boolean(item))
      .map(({ id, name, price }) => ({ id, name, price })),
  }));

  const productIdsByCombo = new Map<string, string[]>();
  ((comboProductResult.data || []) as Row[]).forEach((row) => {
    const comboId = stringValue(row.combo_id);
    const productId = stringValue(row.product_id);
    productIdsByCombo.set(comboId, [...(productIdsByCombo.get(comboId) || []), productId]);
  });

  const combos = ((comboResult.data || []) as Row[]).map<Combo>((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name),
    description: stringValue(row.description),
    price: numberValue(row.price),
    productIds: productIdsByCombo.get(stringValue(row.id)) || [],
    image: stringValue(row.image_url),
    active: row.active !== false,
  }));

  const promotions = ((promotionResult.data || []) as Row[]).map<Promotion>((row) => ({
    id: stringValue(row.id),
    eyebrow: stringValue(row.eyebrow),
    title: stringValue(row.name),
    description: stringValue(row.description),
    priceText: stringValue(row.price_text),
    image: stringValue(row.image_url),
  }));

  const contentRow = contentResult.data as Row | null;
  const content: Partial<CatalogContent> = contentRow ? {
    storeName: stringValue(contentRow.store_name),
    tagline: stringValue(contentRow.tagline),
    logo: stringValue(contentRow.logo_url),
    announcement: stringValue(contentRow.announcement),
    aboutTitle: stringValue(contentRow.about_title),
    aboutText: stringValue(contentRow.about_text),
    aboutImage: stringValue(contentRow.about_image_url),
    address: stringValue(contentRow.address),
    phone: stringValue(contentRow.phone),
    email: stringValue(contentRow.email),
    hours: stringValue(contentRow.opening_hours),
    mapUrl: stringValue(contentRow.map_url),
    footerText: stringValue(contentRow.footer_text),
  } : {};

  if (!categories.length || !products.length) return null;
  return { content, categories, toppings, products, combos, promotions };
}
