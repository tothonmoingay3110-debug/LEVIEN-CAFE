import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent } from "@/lib/workforce-events";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function uniqueProductIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && uuid.test(item)))].slice(0, 100);
}

async function authorize() {
  const access = await getStaffAccess("manage_loyalty");
  if (!access.staff) return { staff: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!access.allowed) return { staff: access.staff, response: NextResponse.json({ error: "Loyalty programs require Owner or Manager permission." }, { status: 403 }) };
  return { staff: access.staff, response: null };
}

export async function GET() {
  try {
    const auth = await authorize(); if (auth.response) return auth.response;
    const db = createAdminClient();
    const [rules, products, rewards] = await Promise.all([
      db.from("loyalty_rules").select("*").order("created_at", { ascending: false }),
      db.from("products").select("id,name,price,active,sold_out").eq("active", true).order("name"),
      db.from("loyalty_rewards").select("id,reward_code,reward_name,reward_type,status,issued_at,expires_at,customer_profile_id").eq("reward_type", "physical_gift").eq("status", "issued").order("issued_at"),
    ]);
    if (rules.error) throw rules.error; if (products.error) throw products.error; if (rewards.error) throw rewards.error;
    const ruleIds = (rules.data || []).map((rule) => rule.id);
    const [triggerProducts, rewardProducts] = ruleIds.length ? await Promise.all([
      db.from("loyalty_rule_trigger_products").select("rule_id,product_id,position").in("rule_id", ruleIds).order("position"),
      db.from("loyalty_rule_reward_products").select("rule_id,product_id,position").in("rule_id", ruleIds).order("position"),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (triggerProducts.error) throw triggerProducts.error;
    if (rewardProducts.error) throw rewardProducts.error;
    const triggersByRule = new Map<string, string[]>();
    const rewardsByRule = new Map<string, string[]>();
    for (const item of triggerProducts.data || []) triggersByRule.set(item.rule_id, [...(triggersByRule.get(item.rule_id) || []), item.product_id]);
    for (const item of rewardProducts.data || []) rewardsByRule.set(item.rule_id, [...(rewardsByRule.get(item.rule_id) || []), item.product_id]);
    const profileIds = [...new Set((rewards.data || []).map((item) => item.customer_profile_id))];
    const profiles = profileIds.length ? await db.from("customer_profiles").select("id,first_name,last_name,email,membership_number").in("id", profileIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    return NextResponse.json({
      rules: (rules.data || []).map((rule) => ({
        ...rule,
        trigger_product_ids: triggersByRule.get(rule.id) || [rule.trigger_product_id],
        reward_product_ids: rewardsByRule.get(rule.id) || (rule.reward_product_id ? [rule.reward_product_id] : []),
      })),
      products: products.data || [],
      physicalRewards: rewards.data || [],
      customers: profiles.data || [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error(error); return NextResponse.json({ error: "Unable to load loyalty programs." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const auth = await authorize(); if (auth.response || !auth.staff) return auth.response;
    if (requestBodyExceeds(request, 32 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
    const triggerProductIds = uniqueProductIds(body.triggerProductIds);
    const requiredQuantity = Number(body.requiredQuantity);
    const rewardType = body.rewardType === "physical_gift" ? "physical_gift" : "free_product";
    const rewardProductIds = rewardType === "free_product" ? uniqueProductIds(body.rewardProductIds) : [];
    const rewardName = typeof body.rewardName === "string" ? body.rewardName.trim().slice(0, 120) : "";
    const expiresDays = Number(body.expiresDays || 90);
    const startsOn = typeof body.startsOn === "string" ? body.startsOn : "";
    const endsOn = typeof body.endsOn === "string" ? body.endsOn : "";
    const validDates = isoDate.test(startsOn) && isoDate.test(endsOn) && endsOn >= startsOn;
    if (name.length < 2 || !triggerProductIds.length || !Number.isInteger(requiredQuantity) || requiredQuantity < 1 || requiredQuantity > 1000 || rewardName.length < 2 || (rewardType === "free_product" && !rewardProductIds.length) || !Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 730 || !validDates) return NextResponse.json({ error: "Enter valid products, quantity, reward and program dates." }, { status: 400 });
    const db = createAdminClient();
    const selectedProductIds = [...new Set([...triggerProductIds, ...rewardProductIds])];
    const productCheck = await db.from("products").select("id").in("id", selectedProductIds).eq("active", true);
    if (productCheck.error) throw productCheck.error;
    if ((productCheck.data || []).length !== selectedProductIds.length) return NextResponse.json({ error: "One or more selected products are unavailable." }, { status: 400 });
    const { data: ruleId, error } = await db.rpc("create_loyalty_rule_v2", {
      p_name: name,
      p_description: description,
      p_trigger_product_ids: triggerProductIds,
      p_required_quantity: requiredQuantity,
      p_reward_type: rewardType,
      p_reward_product_ids: rewardProductIds,
      p_reward_name: rewardName,
      p_reward_expires_days: expiresDays,
      p_repeatable: body.repeatable !== false,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
      p_created_by: auth.staff.legacy ? null : auth.staff.id,
    });
    if (error) throw error;
    await recordWorkforceEvent({ activity: { actorId: auth.staff.legacy ? null : auth.staff.id, action: "loyalty_rule_created", entityType: "loyalty_rule", entityId: ruleId, summary: `Created loyalty rule ${name}.`, metadata: { requiredQuantity, rewardType, triggerProductIds, rewardProductIds, startsOn, endsOn } } });
    return NextResponse.json({ ruleId }, { status: 201 });
  } catch (error) { console.error(error); return NextResponse.json({ error: "Unable to create loyalty rule." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const auth = await authorize(); if (auth.response || !auth.staff) return auth.response;
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!uuid.test(id)) return NextResponse.json({ error: "Invalid loyalty record." }, { status: 400 });
    const db = createAdminClient();
    if (body.action === "fulfill") {
      const { data, error } = await db.from("loyalty_rewards").update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_by: auth.staff.legacy ? null : auth.staff.id }).eq("id", id).eq("reward_type", "physical_gift").eq("status", "issued").select("id,reward_code,reward_name").maybeSingle();
      if (error) throw error; if (!data) return NextResponse.json({ error: "Reward is no longer available." }, { status: 409 });
      await recordWorkforceEvent({ activity: { actorId: auth.staff.legacy ? null : auth.staff.id, action: "loyalty_gift_fulfilled", entityType: "loyalty_reward", entityId: data.id, summary: `Fulfilled ${data.reward_name} (${data.reward_code}).`, metadata: {} } });
      return NextResponse.json({ reward: data });
    }
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "Invalid loyalty update." }, { status: 400 });
    const { data, error } = await db.from("loyalty_rules").update({ active: body.active }).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ rule: data });
  } catch (error) { console.error(error); return NextResponse.json({ error: "Unable to update loyalty program." }, { status: 500 }); }
}
