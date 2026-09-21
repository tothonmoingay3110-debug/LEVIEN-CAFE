"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { useStore } from "@/components/StoreProvider";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import NormalizedProductImage from "@/components/NormalizedProductImage";
import { useSiteData } from "@/components/SiteDataProvider";
import { useSalesPromotions } from "@/components/SalesPromotionProvider";

const badgeNames = { "best-seller": "BEST SELLER", "must-try": "MUST TRY", featured: "FEATURED", new: "NEW" };

export function ProductCard({ product }: { product: Product }) {
  const { addProduct } = useStore();
  const { content } = useSiteData();
  const offers = useSalesPromotions().forProduct(product.id, product.categoryId);
  const [customizing, setCustomizing] = useState(false);
  const hasCustomization = Boolean(product.allowIce || product.allowSugar || (product.allowToppings && product.toppings?.length));
  const isDrink = /(coffee|tea|matcha|smoothie|shake|drink)/i.test(product.category);
  const add = () => hasCustomization ? setCustomizing(true) : addProduct(product);

  return (
    <>
      <article className="productCard">
        <div className={`productImage ${isDrink ? "drinkProductStage" : ""}`}>
          {isDrink&&content.logo&&<img className="drinkStageLogo" src={content.logo} alt="" aria-hidden="true"/>}
          <div className="badges">{product.badges.map((badge) => <span className={`badge ${badge}`} key={badge}>{badgeNames[badge]}</span>)}</div>
          {offers.length>0&&<div className="promotionBadge">{offers[0].badge_text}</div>}
          {product.image ? <NormalizedProductImage src={product.image} alt={product.name} normalize={isDrink} /> : <div className={`drinkIllustration drink${product.id}`}><span>{product.emoji}</span><small>LEVIEN</small></div>}
          <button className="quickAdd" disabled={product.soldOut} onClick={add} aria-label={`${hasCustomization ? "Customize" : "Add"} ${product.name}`} title={hasCustomization ? "Customize product" : "Add to order"}>{product.soldOut ? "×" : <span aria-hidden="true">+</span>}</button>
        </div>
        <div className="productBody"><div className="productMeta"><span>{product.vietnameseName || product.category}</span><strong>${product.price.toFixed(2)}</strong></div><h3>{product.name}</h3><p>{product.description}</p>{offers.length>0&&<div className="productPromotionSummary"><span>{offers[0].description||offers[0].name}</span></div>}<button className="productAddButton" disabled={product.soldOut} onClick={add}>{product.soldOut ? "Sold Out" : hasCustomization ? "Customize & Add" : "Add to Order"}</button></div>
      </article>
      {customizing && <ProductCustomizer product={product} close={() => setCustomizing(false)} />}
    </>
  );
}
