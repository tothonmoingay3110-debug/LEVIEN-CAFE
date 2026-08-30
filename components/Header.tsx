"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/components/StoreProvider";
import { useSiteData } from "@/components/SiteDataProvider";
import { useCustomerSession } from "@/components/CustomerSessionProvider";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { totalItems, openCart } = useStore();
  const { content, combos } = useSiteData();
  const pathname = usePathname();
  const { authenticated, profile } = useCustomerSession();
  const links = [
    { label: "Home", href: "/" },
    { label: "Menu", href: "/menu" },
    ...(combos.some((combo) => combo.active) ? [{ label: "Combos", href: "/#combos" }] : []),
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
            <form className="headerSearch" role="search" onSubmit={(event) => { event.preventDefault(); const value=search.trim(); window.dispatchEvent(new CustomEvent("levien-menu-search",{detail:value})); router.push(`/menu${value ? `?q=${encodeURIComponent(value)}` : ""}`); }}>
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => { const value=event.target.value; setSearch(value); if(pathname==="/menu") window.dispatchEvent(new CustomEvent("levien-menu-search",{detail:value})); }} placeholder="Search menu..." aria-label="Search the LEVIEN menu" />
            </form>
            <button className="button primary orderButton" onClick={openCart} aria-label={`View order, ${totalItems} ${totalItems === 1 ? "item" : "items"}`} title="View Order">
              <svg className="orderCartIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h2l1.8 9.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6.1"/><circle cx="9.5" cy="19" r="1.25"/><circle cx="17.5" cy="19" r="1.25"/></svg>
              <span className="orderCount">{totalItems}</span>
            </button>
            {authenticated ? <Link className="headerAccount" href="/account" aria-label="Open my LEVIEN account">
              <span aria-hidden="true">{(profile?.firstName?.[0] || "M").toUpperCase()}</span>
              <b>{profile?.firstName?.trim() || "My Account"}</b>
            </Link> : <details className="headerAccountMenu">
              <summary className="headerAccount" aria-label="Open account options">
                <span aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.25"/><path d="M5.75 19c.55-3.45 2.65-5.25 6.25-5.25s5.7 1.8 6.25 5.25"/></svg></span>
                <b>Account</b><svg className="accountChevron" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5"/></svg>
              </summary>
              <div className="headerAccountDropdown">
                <Link href="/account/sign-in">Sign In</Link>
                <Link href="/account/sign-up">Create Account</Link>
              </div>
            </details>}
            <button className="mobileMenuButton" onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? "×" : "☰"}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
