"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/components/StoreProvider";
import { useSiteData } from "@/components/SiteDataProvider";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems, openCart } = useStore();
  const { content } = useSiteData();
  const links = [
    { label: "Home", href: "/" },
    { label: "Menu", href: "/menu" },
    { label: "Combos", href: "/#combos" },
    { label: "Our Story", href: "/#story" },
    { label: "Contact", href: "/#contact" },
  ];

  const shortAddress = content.address.split(",").slice(0, 2).join(",");

  return (
    <>
      <div className="announcement">
        <span>{content.announcement}</span>
        <span className="announcementDot">•</span>
        <span>{shortAddress}</span>
      </div>
      <header className="siteHeader">
        <div className="navWrap">
          <Link className="brand" href="/">
            <span className={`logo ${content.logo ? "hasUploadedLogo" : ""}`}>
              {content.logo ? <img src={content.logo} alt={`${content.storeName} logo`} /> : <b>LV</b>}
            </span>
            <span className="brandText">{content.storeName}<small>{content.tagline}</small></span>
          </Link>

          <nav className={menuOpen ? "open" : ""}>
            {links.map((link) => (
              <Link key={link.label} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="headerActions">
            <Link className="headerSearch" href="/menu" aria-label="Search the LEVIEN menu">
              <span aria-hidden="true">⌕</span>
              <span>Search menu...</span>
            </Link>
            <button className="button primary orderButton" onClick={openCart}>
              My Order <span className="orderCount">{totalItems}</span>
            </button>
            <button className="mobileMenuButton" onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? "×" : "☰"}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
