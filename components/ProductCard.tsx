"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { useStore } from "@/components/StoreProvider";
import { ProductCustomizer } from "@/components/ProductCustomizer";

const badgeNames = { "best-seller": "BEST SELLER", "must-try": "MUST TRY", featured: "FEATURED", new: "NEW" };

export function ProductCard({ product }: { product: Product }) {
  const { addProduct } = useStore();
  const [customizing, setCustomizing] = useState(false);
  const hasCustomization = Boolean(product.allowIce || product.allowSugar || (product.allowToppings && product.toppings?.length));
  const add = () => hasCustomization ? setCustomizing(true) : addProduct(product);

  return (
    <>
      <article className="productCard">
        <div className="productImage">
          <div className="badges">{product.badges.map((badge) => <span className={`badge ${badge}`} key={badge}>{badgeNames[badge]}</span>)}</div>
          {product.image ? <img src={product.image} alt={product.name} /> : <div className={`drinkIllustration drink${product.id}`}><span>{product.emoji}</span><small>LEVIEN</small></div>}
          <button className="quickAdd" disabled={product.soldOut} onClick={add} aria-label={`${hasCustomization ? "Customize" : "Add"} ${product.name}`} title={hasCustomization ? "Customize" : "Quick add"}>{product.soldOut ? "×" : "+"}</button>
        </div>
        <div className="productBody"><div className="productMeta"><span>{product.category}</span><strong>${product.price.toFixed(2)}</strong></div><h3>{product.name}</h3><p>{product.description}</p><button className="productAddButton" disabled={product.soldOut} onClick={add}>{product.soldOut ? "Sold Out" : hasCustomization ? "Customize & Add" : "Add to Order"}</button></div>
      </article>
      {customizing && <ProductCustomizer product={product} close={() => setCustomizing(false)} />}
    </>
  );
}
