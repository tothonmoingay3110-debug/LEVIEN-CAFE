"use client";

import { ProductCard } from "@/components/ProductCard";
import { useSalesPromotions } from "@/components/SalesPromotionProvider";
import { useSiteData } from "@/components/SiteDataProvider";

export function HomePromotions() {
  const { products } = useSiteData();
  const { forProduct } = useSalesPromotions();
  const promoted = products.filter((product) => forProduct(product.id, product.categoryId).length > 0).slice(0, 8);
  if (!promoted.length) return null;

  return <section className="section homePromotions" aria-labelledby="home-promotions-title">
    <div className="sectionHeading"><div><span className="sectionLabel">Limited-time offers</span><h2 id="home-promotions-title">Products on Promotion</h2></div><p>Current offers are applied automatically when your order qualifies.</p></div>
    <div className="productGrid homePromotionProductGrid">{promoted.map((product) => <ProductCard product={product} key={product.id} />)}</div>
  </section>;
}
