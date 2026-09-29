"use client";

import Link from "next/link";
import { useSiteData } from "@/components/SiteDataProvider";

export default function ScanLandingPage() {
  const { content } = useSiteData();

  return <main className="scanLandingPage">
    <section className="scanLandingCard">
      <div className={`scanLandingLogo ${content.logo ? "hasLogo" : ""}`}>
        {content.logo ? <img src={content.logo} alt={`${content.storeName} logo`} /> : <b>LV</b>}
      </div>
      <span className="eyebrow">Welcome to {content.storeName}</span>
      <h1>How can we help?</h1>
      <p>Choose an option below to plan your event or explore our catering menu.</p>
      <div className="scanLandingChoices">
        <Link href="/event-booking" className="scanChoice eventChoice">
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/></svg></span>
          <div><strong>Book an Event</strong><small>Tell us about your celebration, meeting or private event.</small></div>
          <b aria-hidden="true">→</b>
        </Link>
        <Link href="/catering" className="scanChoice cateringChoice">
          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11h16v8H4z"/><path d="M7 11a5 5 0 0 1 10 0M2 19h20"/><path d="M12 5V3"/></svg></span>
          <div><strong>View Catering Menu</strong><small>Browse catering trays, drinks and add-ons.</small></div>
          <b aria-hidden="true">→</b>
        </Link>
      </div>
      <div className="scanLandingContact">
        <span>{content.address}</span>
        {content.phone && <a href={`tel:${content.phone.replace(/[^+\d]/g, "")}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1.5 1.5 0 0 1 1.6-.35c1 .35 2.05.55 3.1.55a1.4 1.4 0 0 1 1.4 1.4v3.3a1.4 1.4 0 0 1-1.4 1.4A17.6 17.6 0 0 1 2.5 3.9a1.4 1.4 0 0 1 1.4-1.4h3.3a1.4 1.4 0 0 1 1.4 1.4c0 1.05.2 2.1.55 3.1a1.5 1.5 0 0 1-.35 1.6z"/></svg>{content.phone}</a>}
      </div>
    </section>
  </main>;
}
