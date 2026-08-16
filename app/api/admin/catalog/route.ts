import { NextResponse } from "next/server";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffAccess } from "@/lib/staff-auth";
import type { Json } from "@/types/database.types";

async function authorizeCatalog() {
  const access = await getStaffAccess("manage_catalog");
  if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Catalog access requires Manager or Owner permission." }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    const denied = await authorizeCatalog();
    if (denied) return denied;
    const supabase = createAdminClient();
    const [contentResult, categoryResult, toppingResult, productResult, productToppingResult, comboResult, comboProductResult, promotionResult] = await Promise.all([
      supabase.from("site_content").select("*").eq("singleton_key", "main").single(),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("toppings").select("*").order("name"),
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("product_toppings").select("product_id,topping_id"),
      supabase.from("combos").select("*").order("sort_order"),
      supabase.from("combo_products").select("combo_id,product_id,position").order("position"),
      supabase.from("promotions").select("*").order("sort_order"),
    ]);
    const error = [contentResult, categoryResult, toppingResult, productResult, productToppingResult, comboResult, comboProductResult, promotionResult]
      .map((result) => result.error).find(Boolean);
    if (error) throw error;
    if (!contentResult.data) throw new Error("Site content is missing.");

    const productToppings = productToppingResult.data || [];
    const comboProducts = comboProductResult.data || [];
    const content = contentResult.data;
    return NextResponse.json({ catalog: {
      categories: (categoryResult.data || []).map((row) => ({ id: row.id, name: row.name, icon: row.icon, active: row.active })),
      toppings: (toppingResult.data || []).map((row) => ({ id: row.id, name: row.name, price: Number(row.price), active: row.active })),
      products: (productResult.data || []).map((row) => ({
        id: row.id, name: row.name, categoryId: row.category_id || "", price: Number(row.price),
        description: row.description || "", image: row.image_url || "", emoji: row.emoji,
        toppingIds: productToppings.filter((link) => link.product_id === row.id).map((link) => link.topping_id),
        allowIce: row.allow_ice, allowSugar: row.allow_sugar, allowToppings: row.allow_toppings,
        bestSeller: row.best_seller, mustTry: row.must_try, featured: row.featured,
        isNew: row.is_new, soldOut: row.sold_out, active: row.active,
      })),
      combos: (comboResult.data || []).map((row) => ({
        id: row.id, name: row.name, description: row.description || "", price: Number(row.price),
        productIds: comboProducts.filter((link) => link.combo_id === row.id).map((link) => link.product_id),
        image: row.image_url || "", active: row.active,
      })),
      promotions: (promotionResult.data || []).map((row) => ({
        id: row.id, title: row.name, eyebrow: row.eyebrow || "", description: row.description || "",
        priceText: row.price_text || "", image: row.image_url || "", order: row.sort_order, active: row.active,
      })),
      content: {
        storeName: content.store_name, tagline: content.tagline, logo: content.logo_url || "",
        announcement: content.announcement || "", aboutTitle: content.about_title || "",
        aboutText: content.about_text || "", aboutImage: content.about_image_url || "",
        address: content.address || "", phone: content.phone || "", email: content.email || "",
        hours: content.opening_hours || "", mapUrl: content.map_url || "", footerText: content.footer_text || "",
      },
    } });
  } catch (error) {
    console.error("Unable to load admin catalog:", error);
    return NextResponse.json({ error: "Unable to load catalog." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const denied = await authorizeCatalog();
    if (denied) return denied;
    if (requestBodyExceeds(request, 1024 * 1024)) return NextResponse.json({ error: "Catalog request is too large." }, { status: 413 });
    let body: { catalog?: unknown };
    try {
      body = (await request.json()) as { catalog?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    if (!body.catalog || typeof body.catalog !== "object" || Array.isArray(body.catalog)) {
      return NextResponse.json({ error: "Invalid catalog." }, { status: 400 });
    }
    const catalog = JSON.parse(JSON.stringify(body.catalog)) as Json;
    const { error } = await createAdminClient().rpc("save_admin_catalog", { p_catalog: catalog });
    if (error) throw error;
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to save admin catalog:", error);
    return NextResponse.json({ error: "Unable to save catalog." }, { status: 500 });
  }
}
