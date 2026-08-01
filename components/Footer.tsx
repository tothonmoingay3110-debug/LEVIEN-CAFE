"use client";

import Link from "next/link";
import { useSiteData } from "@/components/SiteDataProvider";

export function Footer() {
  const { content } = useSiteData();
  return (
    <footer className="siteFooter">
      <div className="footerGrid">
        <div className="footerBrand">
          <span className="logo">{content.logo ? <img src={content.logo} alt={`${content.storeName} logo`} /> : <b>LV</b>}</span>
          <div><strong>{content.storeName}</strong><p>{content.aboutText}</p></div>
        </div>
        <div><h3>Explore</h3><a href="/menu">Menu</a><a href="#combos">Combos</a><a href="#story">Our Story</a></div>
        <div><h3>Visit</h3><p>{content.address}</p><a href={`tel:${content.phone.replace(/[^+\d]/g, "")}`}>{content.phone}</a><a href={`mailto:${content.email}`}>{content.email}</a></div>
        <div><h3>Hours</h3><p>{content.hours}</p><Link className="adminLink" href="/admin">Staff Admin</Link></div>
      </div>
      <div className="footerBottom"><span>© 2026 {content.storeName}</span><span>{content.footerText}</span></div>
    </footer>
  );
}
