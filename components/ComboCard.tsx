"use client";

import { useSiteData } from "@/components/SiteDataProvider";

export function ComboCard() {
  const { combos } = useSiteData();
  const combo = combos[0];
  if (!combo) return null;
  return (
    <article className="comboCard">
      <div className="comboArt" aria-hidden="true">
        {combo.image ? <img src={combo.image} alt="" /> : <><div className="comboCup">LV</div><div className="comboPlus">+</div><div className="comboBanhMi">🥖</div></>}
      </div>
      <div className="comboCopy">
        <span className="eyebrow darkText">Everyday combo</span>
        <h2>{combo.name}</h2>
        <p>{combo.description}</p>
        <div className="comboBottom"><strong>${combo.price.toFixed(2)}</strong><button className="button gold">Add Combo</button></div>
      </div>
    </article>
  );
}
