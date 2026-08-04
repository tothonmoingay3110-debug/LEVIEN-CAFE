"use client";

import { useMemo, useState } from "react";
import { ComboCustomizer } from "@/components/ComboCustomizer";
import { useSiteData } from "@/components/SiteDataProvider";

export function ComboCard() {
  const { combos, products } = useSiteData();
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const combo = combos[0];
  const selectedCombo = combos.find((item) => item.id === selectedComboId);
  const comboProducts = useMemo(() => combo ? combo.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) : [], [combo, products]);
  if (!combo) return null;

  const regularPrice = comboProducts.reduce((sum, product) => sum + Number(product?.price || 0), 0);
  const unavailable = comboProducts.length !== combo.productIds.length || comboProducts.some((product) => product?.soldOut);

  return <>
    <article className={`comboCard ${unavailable ? "comboSoldOut" : ""}`}>
      <div className="comboArt" aria-hidden="true">
        {combo.image ? <img src={combo.image} alt="" /> : <><div className="comboCup">LV</div><div className="comboPlus">+</div><div className="comboBanhMi">🥖</div></>}
      </div>
      <div className="comboCopy">
        <span className="eyebrow darkText">Fixed combo</span>
        <h2>{combo.name}</h2>
        <p>{combo.description}</p>
        {!!comboProducts.length && <div className="comboIncludes">{comboProducts.map((product) => <span key={product!.id}>{product!.emoji} {product!.name}</span>)}</div>}
        <div className="comboSavings"><span>Regular ${regularPrice.toFixed(2)}</span>{regularPrice > combo.price && <strong>Save ${(regularPrice - combo.price).toFixed(2)}</strong>}</div>
        <div className="comboBottom"><strong>${Number(combo.price).toFixed(2)}</strong><button className="button gold" disabled={unavailable} onClick={() => setSelectedComboId(combo.id)}>{unavailable ? "Unavailable" : "Customize Combo"}</button></div>
      </div>
    </article>
    {selectedCombo && <ComboCustomizer combo={selectedCombo} products={products} close={() => setSelectedComboId(null)} />}
  </>;
}
