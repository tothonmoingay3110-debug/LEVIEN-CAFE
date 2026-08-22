import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseOrders } from "@/lib/supabase/order-reader";
import type { CustomerAccountData } from "@/types/account";

const phonePattern = /^[+()\-\s\d.]{0,30}$/;

export async function GET() {
  try {
    const session = await getCustomerSession({ syncOrders: true });
    if (!session) return NextResponse.json({ error: "Sign in to view your account." }, { status: 401 });
    const admin = createAdminClient();
    const [orders, progressResult, rewardsResult, cardsResult] = await Promise.all([
      readSupabaseOrders(admin, undefined, session.profile.id),
      admin.from("loyalty_progress").select("rule_id,units_earned,review_required").eq("customer_profile_id", session.profile.id),
      admin.from("loyalty_rewards").select("id,rule_id,reward_code,reward_type,reward_product_id,reward_name,status,issued_at,expires_at,redeemed_at").eq("customer_profile_id", session.profile.id).order("issued_at", { ascending: false }).limit(200),
      admin.from("gift_cards").select("id,code_last_four,initial_balance,balance,status,expires_on,recipient_name,recipient_email,created_at").eq("owner_profile_id", session.profile.id).order("created_at", { ascending: false }).limit(200),
    ]);
    if (progressResult.error) throw progressResult.error;
    if (rewardsResult.error) throw rewardsResult.error;
    if (cardsResult.error) throw cardsResult.error;

    const ruleIds = [...new Set([
      ...(progressResult.data || []).map((item) => item.rule_id),
      ...(rewardsResult.data || []).map((item) => item.rule_id),
    ])];
    const rulesResult = ruleIds.length
      ? await admin.from("loyalty_rules").select("id,name,description,trigger_product_id,required_quantity,reward_type,reward_name").in("id", ruleIds)
      : { data: [], error: null };
    if (rulesResult.error) throw rulesResult.error;
    const productIds = [...new Set((rulesResult.data || []).map((rule) => rule.trigger_product_id))];
    const productsResult = productIds.length
      ? await admin.from("products").select("id,name").in("id", productIds)
      : { data: [], error: null };
    if (productsResult.error) throw productsResult.error;
    const productNames = new Map((productsResult.data || []).map((product) => [product.id, product.name]));
    const rules = new Map((rulesResult.data || []).map((rule) => [rule.id, rule]));
    const progressByRule = new Map((progressResult.data || []).map((item) => [item.rule_id, item]));
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    const account: CustomerAccountData = {
      profile: session.profile,
      orders,
      loyalty: (rulesResult.data || []).map((rule) => {
        const progress = progressByRule.get(rule.id);
        const units = Number(progress?.units_earned || 0);
        return {
          ruleId: rule.id,
          name: rule.name,
          description: rule.description,
          triggerProductId: rule.trigger_product_id,
          triggerProductName: productNames.get(rule.trigger_product_id) || "Eligible product",
          requiredQuantity: rule.required_quantity,
          unitsEarned: units,
          currentUnits: units % rule.required_quantity,
          rewardType: rule.reward_type,
          rewardName: rule.reward_name,
          reviewRequired: Boolean(progress?.review_required),
        };
      }),
      rewards: (rewardsResult.data || []).map((reward) => ({
        id: reward.id,
        code: reward.reward_code,
        ruleId: reward.rule_id,
        type: reward.reward_type,
        productId: reward.reward_product_id,
        name: reward.reward_name,
        status: reward.status === "issued" && reward.expires_at && new Date(reward.expires_at).getTime() <= now ? "expired" : reward.status,
        issuedAt: reward.issued_at,
        expiresAt: reward.expires_at,
        redeemedAt: reward.redeemed_at,
      })),
      giftCards: (cardsResult.data || []).map((card) => ({
        id: card.id,
        lastFour: card.code_last_four,
        initialBalance: Number(card.initial_balance),
        balance: Number(card.balance),
        status: card.expires_on && card.expires_on < today ? "expired" : card.status,
        recipientName: card.recipient_name,
        recipientEmail: card.recipient_email || "",
        createdAt: card.created_at,
      })),
    };
    return NextResponse.json(account, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load customer account:", error);
    return NextResponse.json({ error: "Unable to load your account." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 8 * 1024)) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const session = await getCustomerSession();
    if (!session) return NextResponse.json({ error: "Sign in to update your account." }, { status: 401 });
    let body: { firstName?: unknown; lastName?: unknown; phone?: unknown; marketingOptIn?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 100) : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 100) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
    const marketingOptIn = body.marketingOptIn === true;
    if (!firstName || !lastName || !phonePattern.test(phone)) {
      return NextResponse.json({ error: "Enter a valid name and phone number." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { error } = await admin.from("customer_profiles").update({
      first_name: firstName,
      last_name: lastName,
      phone,
      marketing_opt_in: marketingOptIn,
    }).eq("id", session.profile.id);
    if (error) throw error;
    const supabase = await createClient();
    await supabase.auth.updateUser({ data: { first_name: firstName, last_name: lastName, phone, marketing_opt_in: marketingOptIn } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to update customer account:", error);
    return NextResponse.json({ error: "Unable to save your profile." }, { status: 500 });
  }
}

