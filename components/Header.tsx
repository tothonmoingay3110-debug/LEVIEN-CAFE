"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/StoreProvider";
import { useSiteData } from "@/components/SiteDataProvider";
import { useCustomerSession } from "@/components/CustomerSessionProvider";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { totalItems, openCart } = useStore();
  const { content } = useSiteData();
  const { authenticated, profile } = useCustomerSession();
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
            <form className="headerSearch" role="search" onSubmit={(event) => { event.preventDefault(); router.push(`/menu${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`); }}>
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu..." aria-label="Search the LEVIEN menu" />
            </form>
            <button className="button primary orderButton" onClick={openCart}>
              My Order <span className="orderCount">{totalItems}</span>
            </button>
            <Link className="headerAccount" href={authenticated ? "/account" : "/account/sign-in"} aria-label={authenticated ? "Open my LEVIEN account" : "Sign in to LEVIEN"}>
              <span aria-hidden="true">{authenticated ? (profile?.firstName?.[0] || "M").toUpperCase() : "♙"}</span>
              <b>{authenticated ? (profile?.firstName?.trim() || "My Account") : "Sign In"}</b>
            </Link>
            <button className="mobileMenuButton" onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? "×" : "☰"}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
