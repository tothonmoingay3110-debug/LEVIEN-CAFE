"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types";
import { useStore } from "@/components/StoreProvider";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import NormalizedProductImage from "@/components/NormalizedProductImage";
import { useSiteData } from "@/components/SiteDataProvider";
import { useSalesPromotions } from "@/components/SalesPromotionProvider";
import { recordWebEngagement } from "@/lib/web-engagement";

const badgeNames = { "best-seller": "BEST SELLER", "must-try": "MUST TRY", featured: "FEATURED", new: "NEW" };

export function ProductCard({ product }: { product: Product }) {
  const { addProduct } = useStore();
  const { content } = useSiteData();
  const offers = useSalesPromotions().forProduct(product.id, product.categoryId);
  const [customizing, setCustomizing] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const hasCustomization = Boolean(product.allowIce || product.allowSugar || (product.allowToppings && product.toppings?.length));
  const isDrink = /(coffee|tea|matcha|smoothie|shake|drink)/i.test(product.category);
  const isCoffee = /coffee/i.test(product.category);
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let recorded = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !recorded) {
        timer = setTimeout(() => {
          recorded = true;
          recordWebEngagement("product_view", product.id);
          observer.disconnect();
        }, 700);
      } else if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: 0.5 });
    observer.observe(card);
    return () => { if (timer) clearTimeout(timer); observer.disconnect(); };
  }, [product.id]);

  const add = () => {
    if (!content.onlineOrderingEnabled || product.soldOut) return;
    recordWebEngagement("product_click", product.id);
    hasCustomization ? setCustomizing(true) : addProduct(product);
  };

  return (
    <>
      <article className="productCard" ref={cardRef}>
        <div className={`productImage ${isDrink ? `drinkProductStage ${isCoffee ? "coffeeDrinkStage" : "botanicalDrinkStage"}` : ""}`}>
          {isDrink&&content.logo&&<img className="drinkStageLogo" src={content.logo} alt="" aria-hidden="true"/>}
          <div className="badges">{product.badges.map((badge) => <span className={`badge ${badge}`} key={badge}>{badgeNames[badge]}</span>)}</div>
          {offers.length>0&&<div className="promotionBadge">{offers[0].badge_text}</div>}
          {product.image ? <NormalizedProductImage src={product.image} alt={product.name} normalize={isDrink} /> : <div className={`drinkIllustration drink${product.id}`}><span>{product.emoji}</span><small>LEVIEN</small></div>}
          {content.onlineOrderingEnabled && <button className="quickAdd" disabled={product.soldOut} onClick={add} aria-label={`${hasCustomization ? "Customize" : "Add"} ${product.name}`} title={hasCustomization ? "Customize product" : "Add to order"}>{product.soldOut ? "×" : <span aria-hidden="true">+</span>}</button>}
        </div>
        <div className="productBody"><div className="productMeta"><span>{product.vietnameseName || product.category}</span><strong>${product.price.toFixed(2)}</strong></div><h3>{product.name}</h3><p>{product.description}</p>{offers.length>0&&<div className="productPromotionSummary"><span>{offers[0].description||offers[0].name}</span></div>}{content.onlineOrderingEnabled && <button className="productAddButton" disabled={product.soldOut} onClick={add}>{product.soldOut ? "Sold Out" : hasCustomization ? "Customize & Add" : "Add to Order"}</button>}</div>
      </article>
      {content.onlineOrderingEnabled && customizing && <ProductCustomizer product={product} close={() => setCustomizing(false)} />}
    </>
  );
}
