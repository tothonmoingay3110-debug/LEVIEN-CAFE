import type { CartItem } from "@/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PromotionQuote = {
  promotionId: string | null;
  name: string | null;
  badgeText: string | null;
  discount: number;
  discountedSubtotal: number;
  message: string | null;
  snapshot: Record<string, unknown> | null;
  rewardItems: CartItem[];
};

const money = (value: number) => Math.round(value * 100) / 100;

export async function quoteBestSalesPromotion(db: AdminClient, items: CartItem[]): Promise<PromotionQuote> {
  const subtotal = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const empty: PromotionQuote = { promotionId: null, name: null, badgeText: null, discount: 0, discountedSubtotal: subtotal, message: null, snapshot: null, rewardItems: [] };
  if (!items.length) return empty;

  const today = new Date().toISOString().slice(0, 10);
  const { data: promotions, error } = await db.from("sales_promotions").select("*")
    .eq("active", true).lte("starts_on", today).gte("ends_on", today).order("discount_value", { ascending: false });
  if (error) throw error;
  if (!promotions?.length) return empty;

  const productIds = [...new Set(items.filter((item) => item.itemType === "product").map((item) => item.productId))];
  const { data: productRows, error: productError } = productIds.length
    ? await db.from("products").select("id,category_id").in("id", productIds)
    : { data: [], error: null };
  if (productError) throw productError;
  const categoryByProduct = new Map((productRows || []).map((row) => [row.id, row.category_id]));

  let best = empty;
  let bestBenefit = 0;
  for (const promotion of promotions) {
    if (promotion.usage_limit !== null && promotion.usage_count >= promotion.usage_limit) continue;
    if (subtotal < Number(promotion.minimum_subtotal || 0)) continue;
    const targets = new Set<string>(promotion.target_ids || []);
    const eligible = items.filter((item) => promotion.scope_type === "all"
      || (promotion.scope_type === "products" && item.itemType === "product" && targets.has(item.productId))
      || (promotion.scope_type === "categories" && item.itemType === "product" && targets.has(categoryByProduct.get(item.productId) || ""))
      || (promotion.scope_type === "combos" && item.itemType === "combo" && targets.has(item.comboId || item.productId)));
    const eligibleAmount = money(eligible.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    if (!eligible.length || eligibleAmount <= 0) continue;

    let discount = 0;
    let message = promotion.description || promotion.badge_text;
    let rewardItems: CartItem[] = [];
    let benefit = 0;
    if (promotion.promotion_type === "percent_off") discount = eligibleAmount * Number(promotion.discount_value) / 100;
    if (promotion.promotion_type === "fixed_off") discount = Math.min(eligibleAmount, Number(promotion.discount_value));
    if (promotion.promotion_type === "buy_x_get_y") {
      const qualifyingQuantity = eligible.reduce((sum, item) => sum + item.quantity, 0);
      const sets = Math.floor(qualifyingQuantity / Number(promotion.buy_quantity || 1));
      if (!sets) continue;
      const freeQuantity = sets * Number(promotion.get_quantity || 1);
      if (promotion.reward_product_id) {
        const { data: reward } = await db.from("products").select("id,name,price").eq("id", promotion.reward_product_id).maybeSingle();
        if (!reward) continue;
        benefit = Number(reward.price) * freeQuantity;
        message = `Free ${freeQuantity} × ${reward.name}`;
        rewardItems = [{ lineId:`promotion-${promotion.id}-${reward.id}`, itemType:"product", productId:reward.id, name:`${reward.name} (Promotion gift)`, emoji:"🎁", basePrice:Number(reward.price), unitPrice:0, quantity:freeQuantity, toppings:[], note:`Free item from ${promotion.name}` }];
      } else if (promotion.reward_topping_id) {
        const { data: reward } = await db.from("toppings").select("id,name,price").eq("id", promotion.reward_topping_id).maybeSingle();
        if (!reward) continue;
        benefit = Number(reward.price) * freeQuantity;
        message = `Free ${freeQuantity} × ${reward.name}`;
      }
    }
    discount = money(Math.min(subtotal, discount));
    benefit = money(Math.max(benefit, discount));
    if (benefit <= bestBenefit) continue;
    bestBenefit = benefit;
    best = {
      promotionId: promotion.id, name: promotion.name, badgeText: promotion.badge_text,
      discount, discountedSubtotal: money(subtotal - discount), message,
      snapshot: { id: promotion.id, name: promotion.name, badgeText: promotion.badge_text, type: promotion.promotion_type, scope: promotion.scope_type, discount, message, startsOn: promotion.starts_on, endsOn: promotion.ends_on },
      rewardItems,
    };
  }
  return best;
}
