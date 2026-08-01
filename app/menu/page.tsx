"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MenuExplorer } from "@/components/MenuExplorer";
import { useSiteData } from "@/components/SiteDataProvider";

export default function MenuPage() {
  const { content } = useSiteData();
  return (
    <><Header /><main><section className="menuHero"><div><span className="sectionLabel">Made to order</span><h1>Explore the {content.storeName} Menu</h1><p>Vietnamese coffee, handcrafted drinks, fresh bánh mì and savory favorites.</p></div><div className="menuHeroArt"><span>☕</span><span>🧋</span><span>🥖</span></div></section><section className="section menuPageSection"><MenuExplorer /></section></main><Footer /></>
  );
}
