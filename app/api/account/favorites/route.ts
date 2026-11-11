import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store, max-age=0" };
type SelectionInput = { ice?: unknown; sugar?: unknown; toppingIds?: unknown; note?: unknown };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ error: "Sign in to view favorites." }, { status: 401 });
    const { data, error } = await createAdminClient().from("customer_favorites")
      .select("product_id,selection,updated_at")
      .eq("customer_profile_id", session.profile.id)
      .order("updated_at", { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ favorites: (data || []).map((item) => ({ productId: item.product_id, selection: item.selection, updatedAt: item.updated_at })) }, { headers: noStore });
  } catch (error) {
    console.error("Unable to read favorites:", error);
    return NextResponse.json({ error: "Unable to load favorites." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 4 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ error: "Sign in to save favorites." }, { status: 401 });
    const body = await request.json().catch(() => null) as { productId?: unknown; selection?: SelectionInput } | null;
    if (!body || typeof body.productId !== "string" || !uuidPattern.test(body.productId)) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    const db = createAdminClient();
    const { data: product, error: productError } = await db.from("products").select("id,active,allow_toppings").eq("id", body.productId).maybeSingle();
    if (productError) throw productError;
    if (!product?.active) return NextResponse.json({ error: "This product is no longer available." }, { status: 404 });
    const selection = body.selection || {};
    const ids = Array.isArray(selection.toppingIds) ? selection.toppingIds : [];
    if (ids.length > 20 || ids.some((id) => typeof id !== "string" || !uuidPattern.test(id))) return NextResponse.json({ error: "Invalid toppings." }, { status: 400 });
    if (ids.length) {
      if (!product.allow_toppings) return NextResponse.json({ error: "This product does not accept toppings." }, { status: 400 });
      const { data: allowed, error: toppingsError } = await db.from("product_toppings").select("topping_id").eq("product_id", body.productId).in("topping_id", ids as string[]);
      if (toppingsError) throw toppingsError;
      if ((allowed || []).length !== new Set(ids).size) return NextResponse.json({ error: "A topping is no longer available." }, { status: 400 });
    }
    const safeSelection = {
      ice: typeof selection.ice === "string" ? selection.ice.slice(0, 30) : "",
      sugar: typeof selection.sugar === "string" ? selection.sugar.slice(0, 30) : "",
      toppingIds: [...new Set(ids)],
      note: typeof selection.note === "string" ? selection.note.trim().slice(0, 300) : "",
    };
    const { count, error: countError } = await db.from("customer_favorites").select("product_id", { count: "exact", head: true }).eq("customer_profile_id", session.profile.id);
    if (countError) throw countError;
    const { data: existing, error: existingError } = await db.from("customer_favorites").select("id").eq("customer_profile_id", session.profile.id).eq("product_id", body.productId).maybeSingle();
    if (existingError) throw existingError;
    if (!existing && (count || 0) >= 50) return NextResponse.json({ error: "You can save up to 50 favorites." }, { status: 409 });
    const { error } = await db.from("customer_favorites").upsert({ customer_profile_id: session.profile.id, product_id: body.productId, selection: safeSelection }, { onConflict: "customer_profile_id,product_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Unable to save favorite:", error);
    return NextResponse.json({ error: "Unable to save favorite." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ error: "Sign in to remove favorites." }, { status: 401 });
    const productId = new URL(request.url).searchParams.get("productId");
    if (!productId || !uuidPattern.test(productId)) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    const { error } = await createAdminClient().from("customer_favorites").delete().eq("customer_profile_id", session.profile.id).eq("product_id", productId);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Unable to remove favorite:", error);
    return NextResponse.json({ error: "Unable to remove favorite." }, { status: 500 });
  }
}
