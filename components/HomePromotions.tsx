"use client";

import Link from "next/link";
import NormalizedProductImage from "@/components/NormalizedProductImage";
import { useSalesPromotions, type SalesPromotion } from "@/components/SalesPromotionProvider";
import { useSiteData } from "@/components/SiteDataProvider";

function offerCopy(price: number, offer: SalesPromotion) {
  if (offer.promotion_type === "percent_off") return { price: Math.max(0, price * (1 - offer.discount_value / 100)), detail: `${offer.discount_value}% off` };
  if (offer.promotion_type === "fixed_off") return { price: Math.max(0, price - offer.discount_value), detail: `$${offer.discount_value.toFixed(2)} off` };
  return { price, detail: `Buy ${offer.buy_quantity}, get ${offer.get_quantity} free` };
}

export function HomePromotions() {
  const { products } = useSiteData();
  const { forProduct } = useSalesPromotions();
  const promoted = products.flatMap((product) => {
    const offer = forProduct(product.id, product.categoryId)[0];
    return offer ? [{ product, offer, ...offerCopy(product.price, offer) }] : [];
  }).slice(0, 8);
  if (!promoted.length) return null;

  return <section className="section homePromotions" aria-labelledby="home-promotions-title">
    <div className="sectionHeading"><div><span className="sectionLabel">Limited-time offers</span><h2 id="home-promotions-title">Products on Promotion</h2></div><p>Current offers are applied automatically when your order qualifies.</p></div>
    <div className="homePromotionGrid">{promoted.map(({ product, offer, price, detail }) => {
      const isDrink = /(coffee|tea|matcha|smoothie|shake|drink)/i.test(product.category);
      const description = offer.description?.trim() && offer.description.trim().toLowerCase() !== detail.toLowerCase() ? offer.description.trim() : "";
      return <Link className="homePromotionCard" href={`/menu?q=${encodeURIComponent(product.name)}`} key={`${offer.id}-${product.id}`}>
      <div className={`homePromotionImage ${isDrink ? "drinkPromotionStage" : ""}`}>{product.image ? <NormalizedProductImage src={product.image} alt={product.name} normalize={isDrink} /> : <span>{product.emoji}</span>}<b>{offer.badge_text}</b></div>
      <div>{product.vietnameseName && <small>{product.vietnameseName}</small>}<h3>{product.name}</h3>{description && <p>{description}</p>}<div className="homePromotionPrice">{offer.promotion_type !== "buy_x_get_y" && <><s>${product.price.toFixed(2)}</s><strong>${price.toFixed(2)}</strong></>}<em>{detail}</em></div></div>
    </Link>;})}</div>
  </section>;
}
