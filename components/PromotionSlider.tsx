"use client";

import { useEffect, useState } from "react";
import { useSiteData } from "@/components/SiteDataProvider";

export function PromotionSlider() {
  const { promotions } = useSiteData();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= promotions.length) setActive(0);
  }, [active, promotions.length]);

  useEffect(() => {
    if (promotions.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % promotions.length), 5500);
    return () => window.clearInterval(timer);
  }, [promotions.length]);

  if (!promotions.length) return null;
  const promotion = promotions[active] || promotions[0];
  const move = (step: number) => setActive((current) => (current + step + promotions.length) % promotions.length);

  return (
    <section className="heroSlider" aria-label="Current promotions">
      <div className="heroPattern" />
      <button className="sliderArrow left" onClick={() => move(-1)} aria-label="Previous promotion">‹</button>
      <div className="heroCopy" key={`copy-${promotion.id}`}>
        <span className="eyebrow">{promotion.eyebrow}</span>
        <h1><span className="heroTitle">{promotion.title}</span><em>{promotion.priceText}</em></h1>
        <p>{promotion.description}</p>
        <div className="heroActions"><a className="button gold" href="/menu">Order Now</a><a className="button ghost" href="/menu">View Menu</a></div>
        <div className="heroTrust"><span>✓ Made to order</span><span>✓ Pickup & delivery</span></div>
      </div>
      <div className={`heroVisual ${promotion.image ? "hasUploadedPromotion" : ""}`} key={`visual-${promotion.id}`}>
        <div className="visualHalo" />
        {promotion.image ? <img className="heroUploadedImage" src={promotion.image} alt={promotion.title} /> : <div className={`heroDrink heroDrink${active + 1}`}><div className="drinkLid" /><div className="drinkFoam"/><div className="drinkLogo">LEVIEN<small>CAFE</small></div></div>}
        <div className="promoInfoCard"><span>{promotion.eyebrow}</span><strong>{promotion.title}</strong><small>{promotion.description}</small></div>
      </div>
      <button className="sliderArrow right" onClick={() => move(1)} aria-label="Next promotion">›</button>
      <div className="sliderDots">{promotions.map((item, index) => <button key={item.id} className={index === active ? "active" : ""} onClick={() => setActive(index)} aria-label={`Show promotion ${index + 1}`} />)}</div>
    </section>
  );
}
