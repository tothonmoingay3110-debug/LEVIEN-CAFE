"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteData } from "@/components/SiteDataProvider";

const promotionSessionKey = "levien-promotion-session";
const promotionAttributionKey = "levien-promotion-attribution";

function promotionSession() {
  try {
    const current = window.sessionStorage.getItem(promotionSessionKey);
    if (current) return current;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(promotionSessionKey, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function recordPromotion(promotionId: string, eventType: "impression" | "click") {
  void fetch("/api/promotions/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promotionId, eventType, sessionKey: promotionSession() }),
    keepalive: eventType === "click",
  }).catch(() => undefined);
}

export function PromotionSlider() {
  const { promotions } = useSiteData();
  const [active, setActive] = useState(0);
  const viewed = useRef(new Set<string>());

  useEffect(() => {
    if (active >= promotions.length) setActive(0);
  }, [active, promotions.length]);

  useEffect(() => {
    if (promotions.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % promotions.length), 5500);
    return () => window.clearInterval(timer);
  }, [promotions.length]);

  const promotion = promotions[active] || promotions[0];

  useEffect(() => {
    if (!promotion?.id || viewed.current.has(promotion.id)) return;
    viewed.current.add(promotion.id);
    recordPromotion(promotion.id, "impression");
  }, [promotion?.id]);

  if (!promotions.length) return null;
  const move = (step: number) => setActive((current) => (current + step + promotions.length) % promotions.length);
  const selectPromotion = () => {
    try {
      window.sessionStorage.setItem(promotionAttributionKey, JSON.stringify({
        promotionId: promotion.id,
        attributedAt: new Date().toISOString(),
      }));
    } catch {
      // Attribution must never prevent customers from reaching the menu.
    }
    recordPromotion(promotion.id, "click");
  };

  return (
    <section className="heroSlider" aria-label="Current promotions">
      <div className="heroPattern" />
      <button className="sliderArrow left" onClick={() => move(-1)} aria-label="Previous promotion">‹</button>
      <div className="heroCopy" key={`copy-${promotion.id}`}>
        <span className="eyebrow">{promotion.eyebrow}</span>
        <h1><span className="heroTitle">{promotion.title}</span><em>{promotion.priceText}</em></h1>
        <p>{promotion.description}</p>
        <div className="heroActions"><a className="button gold" href={`/menu?promotion=${promotion.id}`} onClick={selectPromotion}>Order Now</a><a className="button ghost" href={`/menu?promotion=${promotion.id}`} onClick={selectPromotion}>View Menu</a></div>
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
