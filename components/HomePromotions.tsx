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
    <div className="homePromotionGrid">{promoted.map(({ product, offer, price, detail }) => <Link className="homePromotionCard" href={`/menu?q=${encodeURIComponent(product.name)}`} key={`${offer.id}-${product.id}`}>
      <div className="homePromotionImage">{product.image ? <NormalizedProductImage src={product.image} alt={product.name} normalize={false} /> : <span>{product.emoji}</span>}<b>{offer.badge_text}</b></div>
      <div><small>{product.vietnameseName || "Special offer"}</small><h3>{product.name}</h3><p>{offer.description || detail}</p><div className="homePromotionPrice"><s>${product.price.toFixed(2)}</s>{offer.promotion_type !== "buy_x_get_y" && <strong>${price.toFixed(2)}</strong>}<em>{detail}</em></div></div>
    </Link>)}</div>
  </section>;
}
