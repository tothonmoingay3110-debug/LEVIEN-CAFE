import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const db = createAdminClient();
  const { data, error } = await (db.from("sales_promotions" as never) as any)
    .select("id,name,badge_text,description,promotion_type,scope_type,target_ids,discount_value,buy_quantity,get_quantity,reward_product_id,reward_topping_id,minimum_subtotal,starts_on,ends_on")
    .eq("active", true).lte("starts_on", today).gte("ends_on", today)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load promotions." }, { status: 500 });
  return NextResponse.json({ promotions: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
