import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const types = ["percent_off", "fixed_off", "buy_x_get_y"];
const scopes = ["all", "products", "categories", "combos"];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
async function authorize() {
  const access = await getStaffAccess("manage_catalog");
  if (!access.staff) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Catalog permission required." }, { status: 403 });
  return null;
}
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function payload(body: Record<string, unknown>) {
  const promotionType = types.includes(String(body.promotionType)) ? String(body.promotionType) : "";
  const scopeType = scopes.includes(String(body.scopeType)) ? String(body.scopeType) : "";
  return {
    name: clean(body.name, 160), badge_text: clean(body.badgeText, 40) || "Special offer",
    description: clean(body.description, 1000), promotion_type: promotionType, scope_type: scopeType,
    target_ids: Array.isArray(body.targetIds) ? body.targetIds.filter((id): id is string => typeof id === "string" && uuid.test(id)) : [],
    discount_value: Number(body.discountValue || 0), buy_quantity: Number(body.buyQuantity || 1), get_quantity: Number(body.getQuantity || 1),
    reward_product_id: clean(body.rewardProductId, 40) || null, reward_topping_id: clean(body.rewardToppingId, 40) || null,
    minimum_subtotal: Number(body.minimumSubtotal || 0), usage_limit: body.usageLimit ? Number(body.usageLimit) : null,
    starts_on: clean(body.startsOn, 10), ends_on: clean(body.endsOn, 10), active: body.active !== false,
  };
}
function invalid(values:ReturnType<typeof payload>){
  if(!values.name||!values.promotion_type||!values.scope_type||!values.starts_on||!values.ends_on) return "Complete all required promotion fields.";
  if(values.ends_on<values.starts_on) return "End date must be on or after the start date.";
  if(values.scope_type!=="all"&&!values.target_ids.length) return "Select at least one eligible item.";
  if(values.promotion_type==="percent_off"&&(values.discount_value<=0||values.discount_value>100)) return "Percentage must be between 0 and 100.";
  if(values.promotion_type==="fixed_off"&&values.discount_value<=0) return "Fixed discount must be greater than zero.";
  if(values.promotion_type==="buy_x_get_y"&&!values.reward_product_id&&!values.reward_topping_id) return "Select a free product or topping.";
  if(values.reward_product_id&&values.reward_topping_id) return "Choose either a free product or a free topping, not both.";
  return null;
}
export async function GET() {
  const denied = await authorize(); if (denied) return denied;
  const { data, error } = await (createAdminClient().from("sales_promotions" as never) as any).select("*").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: "Unable to load promotions." }, { status: 500 }) : NextResponse.json({ promotions: data || [] });
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const denied = await authorize(); if (denied) return denied;
  if (requestBodyExceeds(request, 64 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const body = await request.json() as Record<string, unknown>; const values = payload(body);
  const validation=invalid(values); if(validation) return NextResponse.json({error:validation},{status:400});
  const { data, error } = await (createAdminClient().from("sales_promotions" as never) as any).insert(values).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ promotion: data }, { status: 201 });
}
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const denied = await authorize(); if (denied) return denied;
  const body = await request.json() as Record<string, unknown>; const id = clean(body.id, 40);
  if (!id) return NextResponse.json({ error: "Promotion id is required." }, { status: 400 });
  const values=payload(body); const validation=invalid(values); if(validation) return NextResponse.json({error:validation},{status:400});
  const { data, error } = await (createAdminClient().from("sales_promotions" as never) as any).update(values).eq("id", id).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ promotion: data });
}
