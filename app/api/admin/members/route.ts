import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { getStaffAccess } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkforceEvent } from "@/lib/workforce-events";

const membershipPattern = /^LV-[A-F0-9]{10}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function normalizeMembershipCode(value: unknown) {
  if (typeof value !== "string") return "";
  let code = value.trim();
  try {
    const url = new URL(code);
    code = url.searchParams.get("member") || code;
  } catch {
    // Hardware scanners normally provide the raw QR value, not a URL.
  }
  code = code.replace(/^LEVIEN-MEMBER:/i, "").replace(/\s+/g, "").toUpperCase();
  return membershipPattern.test(code) ? code : "";
}

async function authorize() {
  const access = await getStaffAccess("manage_orders");
  if (!access.staff) return { staff: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!access.allowed) return { staff: access.staff, response: NextResponse.json({ error: "Member lookup requires order access." }, { status: 403 }) };
  return { staff: access.staff, response: null };
}

async function readMember(membershipNumber: string) {
  const db = createAdminClient();
  const { data: profile, error: profileError } = await db
    .from("customer_profiles")
    .select("id,first_name,last_name,email,phone,membership_number,created_at")
    .eq("membership_number", membershipNumber)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const nowIso = new Date().toISOString();
  const [progressResult, rewardsResult, ordersResult] = await Promise.all([
    db.from("loyalty_progress").select("rule_id,units_earned,review_required").eq("customer_profile_id", profile.id),
    db.from("loyalty_rewards").select("id,reward_code,reward_type,reward_name,status,issued_at,expires_at").eq("customer_profile_id", profile.id).order("issued_at", { ascending: false }).limit(100),
    db.from("orders").select("id", { count: "exact", head: true }).eq("customer_profile_id", profile.id),
  ]);
  if (progressResult.error) throw progressResult.error;
  if (rewardsResult.error) throw rewardsResult.error;
  if (ordersResult.error) throw ordersResult.error;

  const ruleIds = [...new Set((progressResult.data || []).map((item) => item.rule_id))];
  const rulesResult = ruleIds.length
    ? await db.from("loyalty_rules").select("id,name,trigger_product_id,required_quantity,reward_name,active").in("id", ruleIds)
    : { data: [], error: null };
  if (rulesResult.error) throw rulesResult.error;
  const productIds = [...new Set((rulesResult.data || []).map((rule) => rule.trigger_product_id))];
  const productsResult = productIds.length
    ? await db.from("products").select("id,name").in("id", productIds)
    : { data: [], error: null };
  if (productsResult.error) throw productsResult.error;

  const progressByRule = new Map((progressResult.data || []).map((item) => [item.rule_id, item]));
  const productNames = new Map((productsResult.data || []).map((product) => [product.id, product.name]));
  const rewards = (rewardsResult.data || []).map((reward) => ({
    id: reward.id,
    code: reward.reward_code,
    type: reward.reward_type,
    name: reward.reward_name,
    status: reward.status === "issued" && reward.expires_at && reward.expires_at <= nowIso ? "expired" : reward.status,
    issuedAt: reward.issued_at,
    expiresAt: reward.expires_at,
  }));

  return {
    profile: {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      membershipNumber: profile.membership_number,
      memberSince: profile.created_at,
    },
    orderCount: ordersResult.count || 0,
    progress: (rulesResult.data || []).filter((rule) => rule.active).map((rule) => {
      const progress = progressByRule.get(rule.id);
      const unitsEarned = Number(progress?.units_earned || 0);
      return {
        ruleId: rule.id,
        name: rule.name,
        productName: productNames.get(rule.trigger_product_id) || "Eligible product",
        requiredQuantity: rule.required_quantity,
        unitsEarned,
        currentUnits: unitsEarned % rule.required_quantity,
        rewardName: rule.reward_name,
        reviewRequired: Boolean(progress?.review_required),
      };
    }),
    rewards,
  };
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!allowRequest(request, "staff-member-lookup", 180, 60_000)) return NextResponse.json({ error: "Too many scans. Wait a moment and try again." }, { status: 429 });
    if (requestBodyExceeds(request, 4 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const auth = await authorize();
    if (auth.response) return auth.response;
    const body = await request.json() as { code?: unknown };
    const membershipNumber = normalizeMembershipCode(body.code);
    if (!membershipNumber) return NextResponse.json({ error: "Scan a valid LEVIEN member QR or enter a member number." }, { status: 400 });
    const member = await readMember(membershipNumber);
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    return NextResponse.json({ member }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to look up member:", error);
    return NextResponse.json({ error: "Unable to look up this member." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!allowRequest(request, "staff-member-redeem", 60, 60_000)) return NextResponse.json({ error: "Too many reward requests. Wait a moment and try again." }, { status: 429 });
    if (requestBodyExceeds(request, 4 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const auth = await authorize();
    if (auth.response || !auth.staff) return auth.response;
    const body = await request.json() as { code?: unknown; rewardId?: unknown };
    const membershipNumber = normalizeMembershipCode(body.code);
    const rewardId = typeof body.rewardId === "string" ? body.rewardId : "";
    if (!membershipNumber || !uuidPattern.test(rewardId)) return NextResponse.json({ error: "Invalid member or reward." }, { status: 400 });

    const db = createAdminClient();
    const { data: profile, error: profileError } = await db.from("customer_profiles").select("id").eq("membership_number", membershipNumber).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const { data: reward, error: rewardError } = await db
      .from("loyalty_rewards")
      .select("id,reward_code,reward_name,reward_type,expires_at")
      .eq("id", rewardId)
      .eq("customer_profile_id", profile.id)
      .eq("status", "issued")
      .maybeSingle();
    if (rewardError) throw rewardError;
    if (!reward) return NextResponse.json({ error: "Reward is no longer available." }, { status: 409 });
    if (reward.expires_at && new Date(reward.expires_at).getTime() <= Date.now()) {
      await db.from("loyalty_rewards").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", reward.id).eq("status", "issued");
      return NextResponse.json({ error: "This reward has expired." }, { status: 409 });
    }

    const redeemedAt = new Date().toISOString();
    const { data: redeemed, error: redeemError } = await db
      .from("loyalty_rewards")
      .update({ status: "redeemed", redeemed_at: redeemedAt, redeemed_by: auth.staff.legacy ? null : auth.staff.id, updated_at: redeemedAt })
      .eq("id", reward.id)
      .eq("status", "issued")
      .select("id")
      .maybeSingle();
    if (redeemError) throw redeemError;
    if (!redeemed) return NextResponse.json({ error: "Reward was already redeemed." }, { status: 409 });
    await recordWorkforceEvent({ activity: {
      actorId: auth.staff.legacy ? null : auth.staff.id,
      action: "member_reward_redeemed",
      entityType: "loyalty_reward",
      entityId: reward.id,
      summary: `Redeemed ${reward.reward_name} (${reward.reward_code}) at the counter.`,
      metadata: { membershipNumber, rewardType: reward.reward_type },
    } });
    return NextResponse.json({ redeemed: true });
  } catch (error) {
    console.error("Unable to redeem member reward:", error);
    return NextResponse.json({ error: "Unable to redeem this reward." }, { status: 500 });
  }
}
