import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateAndPriceOrderItems } from "@/lib/supabase/checkout-pricing";
import { quoteBestSalesPromotion } from "@/lib/sales-promotions";
import type { CartItem } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { items?: CartItem[]; rewardProductId?:string };
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) return NextResponse.json({ quote: null });
    const db = createAdminClient();
    const priced = await validateAndPriceOrderItems(db, body.items);
    return NextResponse.json({ quote: await quoteBestSalesPromotion(db, priced, body.rewardProductId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to quote sales promotion:", error);
    return NextResponse.json({ error: "Unable to calculate promotion." }, { status: 400 });
  }
}
