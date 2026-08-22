import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/staff-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent } from "@/lib/workforce-events";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

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
    const profileIds = [...new Set((rewards.data || []).map((item) => item.customer_profile_id))];
    const profiles = profileIds.length ? await db.from("customer_profiles").select("id,first_name,last_name,email,membership_number").in("id", profileIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    return NextResponse.json({ rules: rules.data || [], products: products.data || [], physicalRewards: rewards.data || [], customers: profiles.data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error(error); return NextResponse.json({ error: "Unable to load loyalty programs." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const auth = await authorize(); if (auth.response || !auth.staff) return auth.response;
    if (requestBodyExceeds(request, 12 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
    const triggerProductId = typeof body.triggerProductId === "string" ? body.triggerProductId : "";
    const requiredQuantity = Number(body.requiredQuantity);
    const rewardType = body.rewardType === "physical_gift" ? "physical_gift" : "free_product";
    const rewardProductId = rewardType === "free_product" && typeof body.rewardProductId === "string" ? body.rewardProductId : null;
    const rewardName = typeof body.rewardName === "string" ? body.rewardName.trim().slice(0, 120) : "";
    const expiresDays = Number(body.expiresDays || 90);
    if (name.length < 2 || !uuid.test(triggerProductId) || !Number.isInteger(requiredQuantity) || requiredQuantity < 1 || requiredQuantity > 1000 || rewardName.length < 2 || (rewardType === "free_product" && (!rewardProductId || !uuid.test(rewardProductId))) || !Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 730) return NextResponse.json({ error: "Enter a valid product, quantity and reward." }, { status: 400 });
    const { data, error } = await createAdminClient().from("loyalty_rules").insert({ name, description, trigger_product_id: triggerProductId, required_quantity: requiredQuantity, reward_type: rewardType, reward_product_id: rewardProductId, reward_name: rewardName, reward_expires_days: expiresDays, repeatable: body.repeatable !== false, created_by: auth.staff.legacy ? null : auth.staff.id }).select("*").single();
    if (error) throw error;
    await recordWorkforceEvent({ activity: { actorId: auth.staff.legacy ? null : auth.staff.id, action: "loyalty_rule_created", entityType: "loyalty_rule", entityId: data.id, summary: `Created loyalty rule ${name}.`, metadata: { requiredQuantity, rewardType } } });
    return NextResponse.json({ rule: data }, { status: 201 });
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
